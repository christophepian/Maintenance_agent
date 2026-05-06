/**
 * ChatWidget — Floating AI assistant for tenant portal pages.
 *
 * Renders a fixed chat bubble at the bottom-right. On click, opens a
 * slide-up panel with conversation history and a message input.
 *
 * Uses POST /api/tenant/conversation and GET /api/tenant/conversation/history.
 * Auth: tenantToken from localStorage (same as tenantFetch).
 *
 * Alternative intake path — supplements the structured request form.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "next-i18next";
import { tenantFetch } from "../lib/api";
import { cn } from "../lib/utils";

// ─── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ role, content }) {
  const isTenant = role === "TENANT";
  return (
    <div className={cn("flex", isTenant ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
          isTenant
            ? "rounded-br-sm bg-indigo-600 text-white"
            : "rounded-bl-sm bg-slate-100 text-slate-800"
        )}
      >
        {content}
      </div>
    </div>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-3">
        <div className="flex gap-1 items-center">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" />
        </div>
      </div>
    </div>
  );
}

// ─── Chat icon ────────────────────────────────────────────────────────────────

function ChatIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.39.39 0 00-.297.17l-2.755 4.133a.75.75 0 01-1.248 0l-2.755-4.133a.39.39 0 00-.297-.17 48.9 48.9 0 01-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// ─── Main widget ──────────────────────────────────────────────────────────────

export default function ChatWidget() {
  const { t } = useTranslation("tenant");
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(null); // null = not yet loaded
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Don't render if no tenant session
  const [hasTenantToken, setHasTenantToken] = useState(false);
  useEffect(() => {
    setHasTenantToken(!!localStorage.getItem("tenantToken"));
  }, []);

  // Scroll to bottom whenever messages change or widget opens
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Focus input when widget opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  // Load history on first open
  const loadHistory = useCallback(async () => {
    try {
      const res = await tenantFetch("/api/tenant/conversation/history");
      if (!res.ok) {
        setMessages([]);
        return;
      }
      const body = await res.json();
      setMessages(body?.data ?? []);
    } catch {
      setMessages([]);
    }
  }, []);

  function handleOpen() {
    setIsOpen(true);
    if (messages === null) {
      loadHistory();
    }
  }

  function handleClose() {
    setIsOpen(false);
    setError("");
  }

  async function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setError("");
    // Optimistic: add user message immediately
    setMessages((prev) => [...(prev ?? []), { role: "TENANT", content: text, createdAt: new Date().toISOString() }]);
    setSending(true);

    try {
      const res = await tenantFetch("/api/tenant/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error?.message ?? "Failed to send message");
      }
      const reply = body?.data?.replyText ?? "…";
      setMessages((prev) => [
        ...(prev ?? []),
        { role: "ASSISTANT", content: reply, createdAt: new Date().toISOString() },
      ]);
    } catch (err) {
        setError(err.message || t("chatWidget.error", { defaultValue: "Something went wrong. Please try again." }));
      // Remove the optimistic tenant message on failure so they can retry
      setMessages((prev) => prev?.slice(0, -1) ?? []);
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  }

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);

  if (!hasTenantToken) return null;

  return (
    <>
      {/* Floating trigger button */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          aria-label={t("chatWidget.openLabel")}
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 transition-transform hover:scale-105 sm:h-14 sm:w-auto sm:rounded-full sm:px-4 sm:gap-2"
        >
          <ChatIcon className="h-6 w-6 shrink-0" />
          <span className="hidden sm:inline text-sm font-medium">{t("chatWidget.askAi")}</span>
        </button>
      )}

      {/* Chat panel — slide up from bottom on mobile, fixed bottom-right on desktop */}
      {isOpen && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/30 sm:hidden"
            onClick={handleClose}
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-label={t("chatWidget.dialogLabel")}
            className={cn(
              "fixed z-50 flex flex-col overflow-hidden bg-white shadow-2xl",
              // Mobile: full-width sheet from bottom
              "inset-x-0 bottom-0 rounded-t-2xl h-[80dvh]",
              // Desktop: fixed bottom-right panel
              "sm:inset-auto sm:bottom-6 sm:right-6 sm:rounded-2xl sm:h-[520px] sm:w-[380px]"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-white">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100">
                  <ChatIcon className="h-4 w-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 leading-tight">{t("chatWidget.assistantName")}</p>
                  <p className="text-xs text-slate-400 leading-tight">{t("chatWidget.assistantTagline")}</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                aria-label={t("chatWidget.closeLabel")}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-slate-300"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Message list */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages === null ? (
                <p className="text-xs text-slate-400 text-center pt-8">{t("chatWidget.loading")}</p>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
                    <ChatIcon className="h-6 w-6 text-indigo-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">{t("chatWidget.greeting")}</p>
                  <p className="text-xs text-slate-400">
                    {t("chatWidget.greetingHint")}
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 mt-1">
                    {[t("chatWidget.suggestion1"), t("chatWidget.suggestion2"), t("chatWidget.suggestion3")].map((s) => (
                      <button
                        key={s}
                        onClick={() => { setInput(s); inputRef.current?.focus(); }}
                        className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs text-indigo-700 hover:bg-indigo-100 transition"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((m, i) => (
                    <MessageBubble key={i} role={m.role} content={m.content} />
                  ))}
                  {sending && <TypingIndicator />}
                </>
              )}
              {error && (
                <p className="text-xs text-red-500 text-center px-2">{error}</p>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="border-t border-slate-100 px-4 py-3 bg-white">
              <form onSubmit={handleSend} className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={sending}
                  placeholder={t("chatWidget.placeholder")}
                  rows={1}
                  aria-label={t("chatWidget.inputLabel")}
                  className="flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-60 max-h-24 overflow-y-auto"
                  style={{ fieldSizing: "content" }}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || sending}
                  aria-label={t("chatWidget.sendLabel")}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-indigo-500 transition"
                >
                  <svg className="h-4 w-4 -rotate-90" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                </button>
              </form>
              <p className="mt-1.5 text-[10px] text-slate-400 text-center">
                Press Enter to send · Shift+Enter for new line
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
