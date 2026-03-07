import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Reusable undo-toast component for reversible delete actions.
 *
 * Usage:
 *   const toast = useUndoToast();
 *
 *   // On delete:
 *   toast.show("Template deleted", async () => {
 *     await fetch(`/api/lease-templates/${id}/restore`, { method: "POST" });
 *     refreshList();
 *   });
 *
 *   // In JSX:
 *   <UndoToast {...toast} />
 */

const UNDO_TIMEOUT_MS = 8000; // 8 seconds to undo

export function useUndoToast() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const undoFnRef = useRef(null);
  const timerRef = useRef(null);

  const dismiss = useCallback(() => {
    setVisible(false);
    setMessage("");
    undoFnRef.current = null;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const show = useCallback((msg, undoFn) => {
    // If a previous toast is showing, dismiss it first
    if (timerRef.current) clearTimeout(timerRef.current);

    setMessage(msg);
    undoFnRef.current = undoFn;
    setVisible(true);

    timerRef.current = setTimeout(() => {
      setVisible(false);
      setMessage("");
      undoFnRef.current = null;
      timerRef.current = null;
    }, UNDO_TIMEOUT_MS);
  }, []);

  const undo = useCallback(async () => {
    if (undoFnRef.current) {
      await undoFnRef.current();
    }
    dismiss();
  }, [dismiss]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { visible, message, undo, dismiss, show };
}

export default function UndoToast({ visible, message, undo, dismiss }) {
  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: "16px",
        background: "#1f2937",
        color: "#fff",
        padding: "12px 20px",
        borderRadius: "8px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
        fontSize: "14px",
        fontWeight: 500,
        animation: "undoToastSlideUp 0.25s ease-out",
      }}
    >
      <span>{message}</span>
      <button
        onClick={undo}
        style={{
          background: "none",
          border: "1px solid rgba(255,255,255,0.4)",
          color: "#60a5fa",
          padding: "4px 12px",
          borderRadius: "4px",
          cursor: "pointer",
          fontWeight: 600,
          fontSize: "13px",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => (e.target.style.background = "rgba(255,255,255,0.1)")}
        onMouseLeave={(e) => (e.target.style.background = "none")}
      >
        Undo
      </button>
      <button
        onClick={dismiss}
        style={{
          background: "none",
          border: "none",
          color: "rgba(255,255,255,0.5)",
          cursor: "pointer",
          fontSize: "16px",
          lineHeight: 1,
          padding: "2px 4px",
        }}
        title="Dismiss"
      >
        ✕
      </button>

      <style jsx global>{`
        @keyframes undoToastSlideUp {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
