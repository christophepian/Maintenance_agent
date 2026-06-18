import { useState, useEffect, useRef, useCallback } from "react";
import { tenantFetch } from "../../lib/api";
import { cn } from "../../lib/utils";

function ChatMessage({ role, content }) {
  const isTenant = role === "TENANT";
  return (
    <div className={cn("flex mb-2", isTenant ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words",
          isTenant
            ? "bg-brand text-white rounded-br-sm"
            : "bg-surface-subtle text-foreground border border-surface-border rounded-bl-sm"
        )}
      >
        {content}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-2">
      <div className="bg-surface-subtle border border-surface-border rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
        <span className="w-1.5 h-1.5 rounded-full bg-muted-text animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-text animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-text animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Load history when widget first opens
  useEffect(() => {
    if (!open) return;
    if (messages.length > 0) {
      scrollToBottom();
      return;
    }
    setLoading(true);
    tenantFetch("/api/tenant/conversation/history")
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setMessages(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom whenever messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, sending, scrollToBottom]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on Escape; trap focus inside panel
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      // Basic focus trap
      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll(
          'button, [href], input, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setError(null);

    // Optimistically append the user message
    setMessages((prev) => [...prev, { role: "TENANT", content: text }]);
    setSending(true);

    try {
      const r = await tenantFetch("/api/tenant/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const json = await r.json();
      if (!r.ok || !json.data) {
        throw new Error(json.error || "Failed");
      }
      setMessages((prev) => [
        ...prev,
        { role: "ASSISTANT", content: json.data.replyText },
      ]);
    } catch {
      setError("Sorry, I couldn't process your message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 flex flex-col items-end gap-2">
      {/* Chat panel */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Tenant assistant chat"
          aria-modal="true"
          className="w-80 md:w-96 bg-surface border border-surface-border rounded-2xl shadow-xl flex flex-col overflow-hidden"
          style={{ maxHeight: "min(480px, calc(100vh - 140px))" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border bg-surface-subtle">
            <div>
              <div className="text-sm font-semibold text-foreground">Sencilo Assistant</div>
              <div className="text-xs text-muted-text">Ask about your apartment, requests, or invoices</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="p-1 rounded-lg text-muted-text hover:text-foreground hover:bg-surface-border transition-colors focus-visible:ring-2 focus-visible:ring-brand outline-none"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div
            role="log"
            aria-live="polite"
            aria-label="Conversation history"
            className="flex-1 overflow-y-auto px-3 py-3 min-h-0"
          >
            {loading && (
              <p className="text-xs text-muted-text text-center py-4">Loading history…</p>
            )}
            {!loading && messages.length === 0 && (
              <p className="text-xs text-muted-text text-center py-4">
                How can I help you today?
              </p>
            )}
            {messages.map((m, i) => (
              <ChatMessage key={i} role={m.role} content={m.content} />
            ))}
            {sending && <TypingIndicator />}
            {error && (
              <p role="alert" className="text-xs text-destructive text-center mt-1">
                {error}
              </p>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2 px-3 py-3 border-t border-surface-border">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message…"
              rows={1}
              disabled={sending}
              aria-label="Message input"
              className="flex-1 resize-none rounded-xl border border-surface-border bg-surface-subtle text-foreground text-sm px-3 py-2 placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-brand focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
              style={{ minHeight: "36px", maxHeight: "96px" }}
              onInput={(e) => {
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 96) + "px";
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              aria-label="Send message"
              className="flex-shrink-0 w-9 h-9 rounded-xl bg-brand text-white flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-brand outline-none"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close assistant" : "Open assistant chat"}
        aria-expanded={open}
        className="w-12 h-12 rounded-full bg-brand text-white shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 outline-none"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        )}
      </button>
    </div>
  );
}
