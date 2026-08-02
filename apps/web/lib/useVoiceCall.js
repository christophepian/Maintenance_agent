/**
 * useVoiceCall — browser-native voice "call" loop for the tenant assistant.
 *
 * Emulates a hands-free phone call using the Web Speech API only (no backend,
 * no keys, no cost): SpeechRecognition transcribes the tenant's French speech,
 * the transcript is handed to `onUtterance` (which reuses the existing text
 * /api/tenant/conversation brain), and the reply is spoken back with
 * speechSynthesis. The loop then resumes listening — like a real call.
 *
 * State machine: idle → listening → thinking → speaking → listening → …
 * While the assistant is speaking, recognition is stopped so the mic doesn't
 * pick up the TTS output. `interrupt()` provides barge-in.
 *
 * Prototype scope (Option B): quality/coverage is browser-dependent
 * (best on Chrome/Edge/Safari; Firefox lacks SpeechRecognition). This is the
 * "feel the UX" slice before committing to server-side STT/TTS or telephony.
 */

import { useCallback, useEffect, useRef, useState } from "react";

function getSpeechRecognition() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

// Pick the best available voice for a BCP-47 language tag (e.g. "fr-FR").
// Voices can load asynchronously, so callers should tolerate a null result
// (the utterance's `lang` still steers the browser default voice).
function pickVoice(lang) {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  const base = lang.split("-")[0].toLowerCase();
  return (
    voices.find((v) => v.lang?.toLowerCase() === lang.toLowerCase()) ||
    voices.find((v) => v.lang?.toLowerCase().startsWith(base)) ||
    null
  );
}

/**
 * @param {object}   opts
 * @param {string}   [opts.lang="fr-FR"]  BCP-47 language tag for STT + TTS.
 * @param {(text: string) => Promise<string>} opts.onUtterance  Handles a final
 *   transcript and resolves to the reply text to speak. Should also drive any
 *   UI (message bubbles) on the caller's side.
 */
export function useVoiceCall({ lang = "fr-FR", onUtterance }) {
  const [supported, setSupported] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | listening | thinking | speaking
  const [interim, setInterim] = useState("");
  const [error, setError] = useState(""); // "" | unsupported | mic-denied | send-failed

  const recognitionRef = useRef(null);
  const activeRef = useRef(false); // true for the duration of a call
  const finalRef = useRef(""); // accumulated final transcript for the current utterance
  const startingRef = useRef(false); // guards against double .start()

  // Forward-references so the machine functions can call each other without
  // stale closures (all mutable state lives in refs above).
  const listenRef = useRef(() => {});
  const submitRef = useRef(async () => {});
  const speakRef = useRef(() => {});
  const onUtteranceRef = useRef(onUtterance);
  onUtteranceRef.current = onUtterance;

  useEffect(() => {
    const hasStt = Boolean(getSpeechRecognition());
    const hasTts = typeof window !== "undefined" && "speechSynthesis" in window;
    setSupported(hasStt && hasTts);
    // Warm the voice list (some browsers populate it lazily).
    if (hasTts) {
      try { window.speechSynthesis.getVoices(); } catch { /* ignore */ }
    }
  }, []);

  const endCall = useCallback(() => {
    activeRef.current = false;
    setIsActive(false);
    setStatus("idle");
    setInterim("");
    const rec = recognitionRef.current;
    if (rec) {
      try { rec.onend = null; rec.onresult = null; rec.onerror = null; rec.abort(); } catch { /* ignore */ }
    }
    recognitionRef.current = null;
    startingRef.current = false;
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
  }, []);

  // --- Listen: start a fresh recognition cycle -----------------------------
  const listen = useCallback(() => {
    if (!activeRef.current || startingRef.current) return;
    const SR = getSpeechRecognition();
    if (!SR) return;

    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    finalRef.current = "";
    recognitionRef.current = rec;
    startingRef.current = true;
    setInterim("");
    setStatus("listening");

    rec.onstart = () => { startingRef.current = false; };

    rec.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript;
        else interimText += r[0].transcript;
      }
      setInterim((finalRef.current + interimText).trim());
    };

    rec.onerror = (e) => {
      startingRef.current = false;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("mic-denied");
        endCall();
      }
      // Other errors ("no-speech", "aborted", "network") fall through to
      // onend, which decides whether to keep listening.
    };

    rec.onend = () => {
      startingRef.current = false;
      if (!activeRef.current) return;
      const text = finalRef.current.trim();
      if (text) submitRef.current(text);
      else listenRef.current(); // heard nothing — keep the line open
    };

    try {
      rec.start();
    } catch {
      // start() throws if a prior recognition is still tearing down; retry soon.
      startingRef.current = false;
    }
  }, [lang, endCall]);

  // --- Submit: hand the transcript to the brain, then speak the reply ------
  const submit = useCallback(async (text) => {
    setStatus("thinking");
    setInterim("");
    let reply = "";
    try {
      reply = (await onUtteranceRef.current?.(text)) || "";
    } catch {
      setError("send-failed");
      reply = "";
    }
    if (!activeRef.current) return;
    if (reply) speakRef.current(reply);
    else listenRef.current(); // nothing to say — resume listening
  }, []);

  // --- Speak: TTS the reply, then resume listening -------------------------
  const speak = useCallback((text) => {
    setStatus("speaking");
    if (typeof window === "undefined" || !window.speechSynthesis) {
      if (activeRef.current) listenRef.current();
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      const voice = pickVoice(lang);
      if (voice) u.voice = voice;
      const resume = () => { if (activeRef.current) listenRef.current(); };
      u.onend = resume;
      u.onerror = resume;
      window.speechSynthesis.speak(u);
    } catch {
      if (activeRef.current) listenRef.current();
    }
  }, [lang]);

  // Keep forward-references current.
  listenRef.current = listen;
  submitRef.current = submit;
  speakRef.current = speak;

  const startCall = useCallback(() => {
    if (!supported) { setError("unsupported"); return; }
    setError("");
    activeRef.current = true;
    setIsActive(true);
    listenRef.current();
  }, [supported]);

  // Barge-in: cut the assistant off and go straight back to listening.
  const interrupt = useCallback(() => {
    if (!activeRef.current) return;
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
    listenRef.current();
  }, []);

  // Tear down on unmount.
  useEffect(() => endCall, [endCall]);

  return { supported, isActive, status, interim, error, startCall, endCall, interrupt };
}
