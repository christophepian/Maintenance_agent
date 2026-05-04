import { useRef, useState, useEffect, useCallback } from "react";
import { cn } from "../../lib/utils";

/**
 * SwipeableCard — iOS-style swipe-left to reveal action buttons.
 *
 * Props:
 *   actions   — [{ label, onClick, variant, loading, disabled }]
 *               variant: "green" | "red" | "blue" | "indigo" | "slate"
 *   children  — card body content (rendered inside a bg-white sliding div)
 *   className — class on the outer overflow-hidden container
 *
 * Navigation note: this component does NOT call onCardClick itself.
 * When the panel is revealed, it calls e.stopPropagation() so the outer
 * ConfigurableTable row-click (navigation) is suppressed. When the panel
 * is closed, the click bubbles normally to the outer row handler.
 */

const VARIANT_CLASS = {
  green:  "bg-green-600 text-white",
  red:    "bg-red-600 text-white",
  blue:   "bg-blue-600 text-white",
  indigo: "bg-indigo-600 text-white",
  slate:  "bg-slate-100 text-slate-700",
};

const BTN_WIDTH = 80; // px per action button

export default function SwipeableCard({ actions = [], children, className = "" }) {
  const [offset, setOffset] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [animating, setAnimating] = useState(false);
  const touchRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startOffset: 0,
    startTime: 0,
    axisLocked: null,
  });
  const contentRef = useRef(null);
  const totalWidth = actions.length * BTN_WIDTH;

  const snapTo = useCallback(
    (open) => {
      setOffset(open ? -totalWidth : 0);
      setRevealed(open);
      setAnimating(true);
    },
    [totalWidth]
  );

  // Non-passive touchmove listener — required to call e.preventDefault()
  // which suppresses vertical scroll while the user is swiping horizontally.
  useEffect(() => {
    const el = contentRef.current;
    if (!el || !actions.length) return;

    function handleMove(e) {
      const ref = touchRef.current;
      if (!ref.active) return;
      const t = e.touches[0];
      const dx = t.clientX - ref.startX;
      const dy = t.clientY - ref.startY;

      // Lock axis on the first meaningful movement
      if (!ref.axisLocked) {
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
          ref.axisLocked = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
        }
        return;
      }
      if (ref.axisLocked !== "x") return;

      e.preventDefault(); // stop page scroll while swiping
      const raw = ref.startOffset + dx;
      setOffset(Math.max(-totalWidth, Math.min(0, raw)));
    }

    el.addEventListener("touchmove", handleMove, { passive: false });
    return () => el.removeEventListener("touchmove", handleMove);
  }, [actions.length, totalWidth]);

  function onTouchStart(e) {
    if (!actions.length) return;
    setAnimating(false); // disable CSS transition while dragging
    const t = e.touches[0];
    touchRef.current = {
      active: true,
      startX: t.clientX,
      startY: t.clientY,
      startOffset: offset,
      startTime: Date.now(),
      axisLocked: null,
    };
  }

  function onTouchEnd(e) {
    const ref = touchRef.current;
    ref.active = false;
    if (ref.axisLocked !== "x") return;

    const t = e.changedTouches[0];
    const dx = t.clientX - ref.startX;
    const dt = Math.max(Date.now() - ref.startTime, 1);
    const velocity = Math.abs(dx) / dt; // px/ms

    let open;
    if (velocity > 0.4) {
      // Fast flick — direction decides
      open = dx < 0;
    } else {
      // Slow drag — threshold: crossed 40% of panel width
      open = offset < -totalWidth * 0.4;
    }
    snapTo(open);
  }

  function handleBodyClick(e) {
    if (revealed) {
      e.stopPropagation(); // prevent outer row onClick (navigation)
      snapTo(false);
    }
    // Not revealed → let event bubble to outer row handler (navigation)
  }

  // No actions: render children directly (no swipe behaviour)
  if (!actions.length) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Action panel — sits at right edge, revealed as card body slides left */}
      <div
        className="absolute inset-y-0 right-0 flex"
        style={{ width: totalWidth }}
        aria-hidden={!revealed}
      >
        {actions.map((action, i) => (
          <button
            key={i}
            type="button"
            disabled={action.disabled || action.loading}
            onClick={(e) => {
              e.stopPropagation();
              action.onClick(e);
              snapTo(false);
            }}
            className={cn("flex-1 flex items-center justify-center text-xs font-semibold disabled:opacity-60", VARIANT_CLASS[action.variant] || VARIANT_CLASS.slate)}
          >
            {action.loading ? "…" : action.label}
          </button>
        ))}
      </div>

      {/* Card body — slides left on swipe, sits above action panel */}
      <div
        ref={contentRef}
        className="relative bg-white"
        style={{
          transform: `translateX(${offset}px)`,
          transition: animating ? "transform 0.22s ease" : "none",
          willChange: "transform",
          zIndex: 1,
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={handleBodyClick}
      >
        {children}
        {/* Swipe signifier — two stacked left-pointing chevrons, fades as card opens */}
        <div
          aria-hidden
          className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 flex gap-0.5"
          style={{ opacity: Math.max(0, 1 + offset / totalWidth) * 0.5 }}
        >
          {/* Leading chevron (dimmer) */}
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="opacity-50">
            <path d="M7 1L1 7l6 6" stroke="#64748b" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {/* Trailing chevron (full opacity) */}
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
            <path d="M7 1L1 7l6 6" stroke="#64748b" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </div>
  );
}
