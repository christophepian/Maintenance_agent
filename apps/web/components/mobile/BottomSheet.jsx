import { useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';

/**
 * BottomSheet — slides up from the bottom of the screen.
 *
 * Used on mobile in place of absolute-positioned popovers and centered modals.
 * Closes on backdrop tap, Escape key, or downward drag > 80px.
 * Animates via transform: translateY (60fps-safe).
 *
 * Props:
 *   open        — boolean controlling visibility
 *   onClose     — callback fired when the sheet should close
 *   title       — optional header label
 *   snapPoints  — 'half' (default, max-h-[60vh]) | 'full' (max-h-[95vh])
 *   children    — sheet body content
 */
export default function BottomSheet({ open, onClose, title, children, snapPoints = 'half' }) {
  const startYRef = useRef(null);
  const dragRef = useRef(0);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Prevent body scroll while sheet is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  function handleTouchStart(e) {
    startYRef.current = e.touches[0].clientY;
    dragRef.current = 0;
  }

  function handleTouchMove(e) {
    if (startYRef.current === null) return;
    dragRef.current = e.touches[0].clientY - startYRef.current;
  }

  function handleTouchEnd() {
    if (dragRef.current > 80) onClose();
    startYRef.current = null;
    dragRef.current = 0;
  }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title || 'Panel'}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet panel */}
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-xl flex flex-col',
          snapPoints === 'full' ? 'max-h-[95vh]' : 'max-h-[60vh]',
        )}
        style={{ animation: 'mobileSheetSlideUp 0.25s ease-out' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-300" aria-hidden="true" />
        </div>

        {title && (
          <div className="px-5 pb-3 pt-1 border-b border-slate-100 shrink-0">
            <h2 className="text-base font-semibold text-slate-800">{title}</h2>
          </div>
        )}

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}
