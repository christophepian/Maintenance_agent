/**
 * Tooltip — lightweight hover/focus popover anchored to a '?' button.
 *
 * Usage:
 *   <Tooltip content="Discount rate: annualised cost of capital used to compute present value." />
 *
 * The trigger is a small circular '?' icon. The popover appears above the icon
 * on hover or keyboard focus, then disappears on mouse-leave / blur.
 */
import { useState } from "react";
import { cn } from "../lib/utils";

export default function Tooltip({ content, className }) {
  const [visible, setVisible] = useState(false);

  if (!content) return null;

  return (
    <span className={cn("relative inline-flex items-center", className)}>
      <button
        type="button"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-surface-border text-muted text-[9px] font-bold leading-none hover:bg-muted-ring focus:outline-none focus:ring-1 focus:ring-slate-400"
        aria-label="More information"
      >
        ?
      </button>
      {visible && (
        <span
          role="tooltip"
          className={cn(
            "absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 rounded-md shadow-lg",
            "bg-slate-800 text-white text-xs px-3 py-2 leading-relaxed whitespace-normal",
            "pointer-events-none",
          )}
        >
          {content}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </span>
      )}
    </span>
  );
}
