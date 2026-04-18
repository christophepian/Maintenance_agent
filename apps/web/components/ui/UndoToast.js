import { useState, useEffect, useCallback, useRef } from "react";
import * as RToast from "@radix-ui/react-toast";

const UNDO_TIMEOUT_MS = 8000;

/**
 * Add <ToastProvider> once in _app.js to enable toast rendering.
 * It renders the fixed viewport where all toasts appear.
 */
export function ToastProvider({ children }) {
  return (
    <RToast.Provider swipeDirection="down">
      {children}
      <RToast.Viewport className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 outline-none" />
    </RToast.Provider>
  );
}

/**
 * Usage:
 *   const toast = useUndoToast();
 *   toast.show("Template deleted", async () => { await restore(); refresh(); });
 *   <UndoToast {...toast} />
 */
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
    if (timerRef.current) clearTimeout(timerRef.current);
    setMessage(msg);
    undoFnRef.current = undoFn;
    // Brief reset so Radix re-triggers open animation when called repeatedly
    setVisible(false);
    requestAnimationFrame(() => setVisible(true));
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setMessage("");
      undoFnRef.current = null;
      timerRef.current = null;
    }, UNDO_TIMEOUT_MS);
  }, []);

  const undo = useCallback(async () => {
    if (undoFnRef.current) await undoFnRef.current();
    dismiss();
  }, [dismiss]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return { visible, message, undo, dismiss, show };
}

export default function UndoToast({ visible, message, undo, dismiss }) {
  return (
    <RToast.Root
      open={visible}
      onOpenChange={(open) => { if (!open) dismiss(); }}
      duration={Infinity}
      className="flex items-center gap-4 bg-slate-800 text-white px-5 py-3 rounded-lg shadow-xl text-sm font-medium animate-[undoToastSlideUp_0.25s_ease-out]"
    >
      <RToast.Description>{message}</RToast.Description>
      <RToast.Action altText="Undo" asChild>
        <button
          onClick={undo}
          className="border border-white/40 text-blue-400 px-3 py-1 rounded cursor-pointer font-semibold text-[13px] whitespace-nowrap hover:bg-white/10"
        >
          Undo
        </button>
      </RToast.Action>
      <RToast.Close asChild>
        <button
          className="border-none text-white/50 cursor-pointer text-base leading-none px-1 py-0.5 bg-transparent hover:text-white/80"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </RToast.Close>
    </RToast.Root>
  );
}
