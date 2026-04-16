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
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-4 bg-slate-800 text-white px-5 py-3 rounded-lg shadow-xl text-sm font-medium animate-[undoToastSlideUp_0.25s_ease-out]"
    >
      <span>{message}</span>
      <button
        onClick={undo}
        className="border border-white/40 text-blue-400 px-3 py-1 rounded cursor-pointer font-semibold text-[13px] whitespace-nowrap hover:bg-white/10"
      >
        Undo
      </button>
      <button
        onClick={dismiss}
        className="border-none text-white/50 cursor-pointer text-base leading-none px-1 py-0.5 bg-transparent hover:text-white/80"
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
