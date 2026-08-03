/**
 * HoverTip — wraps an element and shows a styled popover with context on hover/focus.
 *
 * Unlike Tooltip.js (which renders a separate "?" trigger), this makes the wrapped
 * element itself the trigger — ideal for adding provenance to a badge/tag. The
 * popover is portalled to <body> with fixed positioning so it is never clipped by
 * an ancestor's overflow (e.g. the renovation accordion's scroll container).
 *
 * Usage:
 *   <HoverTip content={provenanceText}>
 *     <Badge>{status}</Badge>
 *   </HoverTip>
 */
import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils";

export default function HoverTip({ content, children, className }) {
  const [coords, setCoords] = useState(null);
  const ref = useRef(null);

  const show = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoords({ top: r.top, left: r.left + r.width / 2 });
  }, []);
  const hide = useCallback(() => setCoords(null), []);

  if (!content) return children;

  return (
    <span
      ref={ref}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      tabIndex={0}
      className={cn("inline-flex cursor-help focus:outline-none", className)}
    >
      {children}
      {coords && typeof document !== "undefined" && createPortal(
        <span
          role="tooltip"
          style={{ position: "fixed", top: coords.top - 8, left: coords.left, transform: "translate(-50%, -100%)" }} /* no-token: dynamic tooltip anchor position */
          className="z-50 max-w-[16rem] rounded-md bg-foreground text-surface text-xs leading-relaxed px-3 py-2 shadow-lg pointer-events-none"
        >
          {content}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
        </span>,
        document.body,
      )}
    </span>
  );
}
