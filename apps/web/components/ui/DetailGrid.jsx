import { cn } from "../../lib/utils";

/**
 * DetailGrid — responsive grid for label/value pairs.
 *
 * Usage:
 *   <DetailGrid>
 *     <DetailItem label="Status"><Badge …>{status}</Badge></DetailItem>
 *     <DetailItem label="Amount">{fmt(cents)}</DetailItem>
 *   </DetailGrid>
 *
 * Accepts `cols` prop for custom column count (default: "grid-cols-2 md:grid-cols-4").
 */
export function DetailGrid({ children, cols, className }) {
  return (
    <div
      className={cn(
        "grid gap-4 text-sm",
        cols || "grid-cols-2 md:grid-cols-4",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * DetailItem — a single label/value cell in a DetailGrid.
 *
 * Renders a muted label above the value. Accepts `valueClassName` for
 * custom value styling (e.g. "font-semibold", "text-xl").
 */
export function DetailItem({ label, valueClassName, children }) {
  return (
    <div>
      <span className="text-muted-text block">{label}</span>
      <span className={cn("font-medium", valueClassName)}>{children}</span>
    </div>
  );
}
