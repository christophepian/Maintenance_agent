/**
 * useVoiceCall — browser-native voice "call" loop for the tenant assistant.
 *
 * Emulates a hands-free phone call using the Web Speech API only (no backend,
 * no keys, no cost): SpeechRecognition transcribes the tenant's French speech,
 * the transcript is handed to `onUtterance` (which reuses the existing text
 * /api/tenant/conversation brain), and the reply is spoken back with
 * speechSynthesis. The loop then resumes listening — like a real call.
 *
 * State machine: idle → speaking(greeting) → listening → thinking → speaking → …
 * While the assistant is speaking, recognition is stopped so the mic doesn't
 * pick up the TTS output. `interrupt()` provides barge-in.
 *
 * speechSynthesis on Chrome is riddled with foot-guns that all present as
 * "no audio": the utterance is garbage-collected before it speaks unless a
 * reference is held; the synth can start paused or pause itself ~15s in
 * (needs resume()); voices load asynchronously; and onend/onerror sometimes
 * never fire. speakThen() below defends against every one of those and adds a
 * safety timeout so a silent hang can never stall the call. TTS is also primed
 * inside the connect gesture (a spoken greeting) to satisfy Chrome's autoplay
 * policy.
 *
 * Prototype scope (Option B): quality/coverage is browser-dependent
 * (best on Chrome/Edge/Safari; Firefox lacks SpeechRecognition). This is the
 * "feel the UX" slice before committing to server-side STT/TTS or telephony.
 */

import { useCallback, useEffect, useRef, useState } from "react";

// Toggle with localStorage.setItem("voiceCallDebug","1") in the browser.
function dbg(...args) {
  try {
    if (typeof window !== "undefined" && window.localStorage?.getItem("voiceCallDebug")) {
      // console.warn (not .log) so no eslint suppression is needed — the
      // frontend no-console rule allows warn/error.
      console.warn("[voiceCall]", ...args);
    }
  } catch { /* ignore */ }
}

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
 * @param {string}   [opts.greeting]  Spoken on connect (also primes/unlocks TTS
 *   inside the user gesture). Falls back to a silent prime if omitted.
 * @param {(text: string) => Promise<string>} opts.onUtterance  Handles a final
 *   transcript and resolves to the reply text to speak. Should also drive any
 *   UI (message bubbles) on the caller's side.
 */
export function useVoiceCall({ lang = "fr-FR", greeting = "", onUtterance }) {
  const [supported, setSupported] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | listening | thinking | speaking
  const [interim, setInterim] = useState("");
  const [error, setError] = useState(""); // "" | unsupported | mic-denied | send-failed

  const recognitionRef = useRef(null);
  const activeRef = useRef(false); // true for the duration of a call
  const finalRef = useRef(""); // accumulated final transcript for the current utterance
  const startingRef = useRef(false); // guards against double .start()

  // TTS bookkeeping. utterRef pins the live utterance so Chrome can't GC it
  // mid-speech; the timers are the resume() keep-alive and the safety net.
  const utterRef = useRef(null);
  const keepAliveRef = useRef(null);
  const speakTimerRef = useRef(null);

  // Forward-references so the machine functions can call each other without
  // stale closures (all mutable state lives in refs above).
  const listenRef = useRef(() => {});
  const submitRef = useRef(async () => {});
  const speakRef = useRef(() => {});
  const onUtteranceRef = useRef(onUtterance);
  useEffect(() => { onUtteranceRef.current = onUtterance; });

  useEffect(() => {
    const hasStt = Boolean(getSpeechRecognition());
    const hasTts = typeof window !== "undefined" && "speechSynthesis" in window;
    dbg("feature-detect", { hasStt, hasTts });
    setSupported(hasStt && hasTts);
    // Warm the voice list (Chrome/Safari populate it lazily, sometimes only
    // after the voiceschanged event fires).
    if (hasTts) {
      const warm = () => { try { window.speechSynthesis.getVoices(); } catch { /* ignore */ } };
      warm();
      try { window.speechSynthesis.addEventListener("voiceschanged", warm); } catch { /* ignore */ }
      return () => { try { window.speechSynthesis.removeEventListener("voiceschanged", warm); } catch { /* ignore */ } };
    }
    return undefined;
  }, []);

  const clearSpeakTimers = useCallback(() => {
    if (keepAliveRef.current) { clearInterval(keepAliveRef.current); keepAliveRef.current = null; }
    if (speakTimerRef.current) { clearTimeout(speakTimerRef.current); speakTimerRef.current = null; }
  }, []);

  // --- Speak `text`, then invoke onDone exactly once ------------------------
  // Robust against Chrome's speechSynthesis quirks (see file header) — most
  // importantly, a speak() issued right after SpeechRecognition stops is often
  // silently dropped (the audio device is still held). We detect that the
  // engine never started, re-issue once, and bail fast rather than hang.
  const speakThen = useCallback((text, onDone) => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    if (!synth || !text) { onDone?.(); return; }

    let done = false;
    const finish = (why) => {
      if (done) return;
      done = true;
      clearSpeakTimers();
      dbg("tts finish", why);
      onDone?.();
    };

    const issue = () => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      const voice = pickVoice(lang);
      if (voice) u.voice = voice;
      u.onstart = () => dbg("tts onstart");
      u.onend = () => finish("onend");
      u.onerror = (e) => finish("onerror:" + (e?.error || "?"));
      utterRef.current = u; // pin against GC
      dbg("tts speak()", { len: text.length, voice: voice?.name || "(default)" });
      synth.speak(u);
      try { synth.resume(); } catch { /* ignore */ } // Chrome can start paused
    };

    try {
      synth.cancel(); // drop any prior/queued utterance
      issue();
      keepAliveRef.current = setInterval(() => { try { synth.resume(); } catch { /* ignore */ } }, 8000);
      // If the engine never actually started (dropped speak), re-issue once…
      setTimeout(() => {
        if (done || !activeRef.current) return;
        if (!synth.speaking && !synth.pending) {
          dbg("tts retry — engine idle after speak()");
          try { synth.cancel(); issue(); } catch { /* ignore */ }
          // …and if it STILL won't start, don't hang the call on "speaking".
          setTimeout(() => {
            if (done) return;
            if (!synth.speaking && !synth.pending) finish("no-audio");
          }, 500);
        }
      }, 350);
      // Backstop: if onend/onerror never fire mid-speech, release the loop.
      const estMs = Math.min(30000, Math.max(4000, text.length * 90));
      speakTimerRef.current = setTimeout(() => finish("timeout"), estMs);
    } catch (err) {
      dbg("tts threw", String(err));
      finish("throw");
    }
  }, [lang, clearSpeakTimers]);

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
    clearSpeakTimers();
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
  }, [clearSpeakTimers]);

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

    rec.onstart = () => { startingRef.current = false; dbg("recognition onstart"); };

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
      dbg("recognition onerror", e.error);
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
      dbg("recognition start()", { lang });
      rec.start();
    } catch (err) {
      // start() throws if a prior recognition is still tearing down.
      dbg("recognition start() threw", String(err));
      startingRef.current = false;
    }
  }, [lang, endCall]);

  // --- Submit: hand the transcript to the brain, then speak the reply ------
  const submit = useCallback(async (text) => {
    setStatus("thinking");
    setInterim("");
    // Fully release the just-ended recognition so the audio device is free
    // before we synthesize (see speakThen's dropped-speak defence).
    const rec = recognitionRef.current;
    if (rec) { try { rec.onend = null; rec.onresult = null; rec.onerror = null; rec.abort(); } catch { /* ignore */ } }
    recognitionRef.current = null;

    let reply = "";
    try {
      // Don't let a hung server turn freeze "thinking" forever.
      reply = (await Promise.race([
        Promise.resolve(onUtteranceRef.current?.(text)),
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 20000)),
      ])) || "";
    } catch {
      setError("send-failed");
      reply = "";
    }
    if (!activeRef.current) return;
    dbg("submit reply", { len: reply.length });
    if (reply) speakRef.current(reply);
    else listenRef.current(); // nothing to say — resume listening
  }, []);

  // --- Speak the reply, then resume listening ------------------------------
  const speak = useCallback((text) => {
    setStatus("speaking");
    speakThen(text, () => { if (activeRef.current) listenRef.current(); });
  }, [speakThen]);

  // Keep forward-references current (assigned in an effect, read only from
  // event handlers / async callbacks — never during render).
  useEffect(() => {
    listenRef.current = listen;
    submitRef.current = submit;
    speakRef.current = speak;
  });

  const startCall = useCallback(() => {
    dbg("startCall", { supported });
    if (!supported) { setError("unsupported"); return; }
    setError("");
    activeRef.current = true;
    setIsActive(true);
    setStatus("speaking");
    // Prime TTS inside the user gesture (unlocks Chrome audio) and greet;
    // start listening once the greeting finishes (or the safety timeout fires).
    speakThen(greeting || " ", () => { if (activeRef.current) listenRef.current(); });
  }, [supported, greeting, speakThen]);

  // Barge-in: cut the assistant off and go straight back to listening.
  const interrupt = useCallback(() => {
    if (!activeRef.current) return;
    clearSpeakTimers();
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
    listenRef.current();
  }, [clearSpeakTimers]);

  // Tear down on unmount.
  useEffect(() => endCall, [endCall]);

  return { supported, isActive, status, interim, error, startCall, endCall, interrupt };
}
