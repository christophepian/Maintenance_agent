/**
 * InlineChatSection — embedded AI assistant for the tenant requests page.
 *
 * Always starts with an empty conversation (no history loaded) so each page
 * visit is a fresh session. Old messages are cleared server-side after 24h
 * of inactivity via the backend session-timeout logic.
 */

import { useState, useEffect, useRef } from "react";
import { useTranslation } from "next-i18next";
import { tenantFetch } from "../lib/api";
import { cn } from "../lib/utils";

function MessageBubble({ role, content }) {
  const isTenant = role === "TENANT";
  return (
    <div className={cn("flex", isTenant ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
          isTenant
            ? "rounded-br-sm bg-indigo-600 text-white"
            : "rounded-bl-sm bg-surface-hover text-foreground",
        )}
      >
        {content}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-bl-sm bg-surface-hover px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" />
        </div>
      </div>
    </div>
  );
}

export default function InlineChatSection() {
  const { t } = useTranslation("tenant");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const [hasTenantToken, setHasTenantToken] = useState(false);
  useEffect(() => {
    setHasTenantToken(
      !!localStorage.getItem("tenantToken") ||
      !!sessionStorage.getItem("authToken") ||
      !!localStorage.getItem("authToken"),
    );
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setError("");
    setMessages((prev) => [
      ...prev,
      { role: "TENANT", content: text, createdAt: new Date().toISOString() },
    ]);
    setSending(true);

    try {
      const res = await tenantFetch("/api/tenant/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error?.message ?? "Failed to send message");
      const reply = body?.data?.replyText ?? "…";
      setMessages((prev) => [
        ...prev,
        { role: "ASSISTANT", content: reply, createdAt: new Date().toISOString() },
      ]);
    } catch (err) {
      setError(err.message || t("chatWidget.error", { defaultValue: "Something went wrong. Please try again." }));
      setMessages((prev) => prev.slice(0, -1));
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

  if (!hasTenantToken) return null;

  const suggestions = [
    t("chatWidget.suggestion1"),
    t("chatWidget.suggestion2"),
    t("chatWidget.suggestion3"),
  ];

  return (
    <section className="mt-8 rounded-2xl border border-surface-border bg-surface overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-2.5 border-b border-surface-divider px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true">
            <path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.39.39 0 00-.297.17l-2.755 4.133a.75.75 0 01-1.248 0l-2.755-4.133a.39.39 0 00-.297-.17 48.9 48.9 0 01-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97z" clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground leading-tight">{t("chatWidget.assistantName")}</p>
          <p className="text-xs text-foreground-dim leading-tight">{t("chatWidget.assistantTagline")}</p>
        </div>
      </div>

      {/* Message area */}
      <div className="h-64 overflow-y-auto px-4 py-4 space-y-3 sm:h-72">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-2">
            <p className="text-sm font-medium text-muted-dark">{t("chatWidget.greeting")}</p>
            <p className="text-xs text-foreground-dim">{t("chatWidget.greetingHint")}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
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
        {error && <p className="text-xs text-red-500 text-center px-2">{error}</p>}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-surface-divider px-4 py-3">
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
            className="flex-1 resize-none rounded-xl border border-surface-border px-3 py-2 text-sm placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-60 max-h-24 overflow-y-auto bg-surface"
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
        <p className="mt-1.5 text-xs text-foreground-dim text-center">
          {t("chatWidget.enterHint", { defaultValue: "Press Enter to send · Shift+Enter for new line" })}
        </p>
      </div>
    </section>
  );
}
