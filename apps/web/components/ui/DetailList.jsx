import { cn } from "../../lib/utils";

/**
 * DetailList — vertical key-value list using <dl>.
 *
 * Usage:
 *   <DetailList>
 *     <DetailRow label="Status"><Badge …>{s}</Badge></DetailRow>
 *     <DetailRow label="Amount">{fmt(cents)}</DetailRow>
 *   </DetailList>
 */
export function DetailList({ children, className }) {
  return (
    <dl className={cn("space-y-2 text-sm", className)}>
      {children}
    </dl>
  );
}

/**
 * DetailRow — a single label/value row in a DetailList.
 *
 * Renders label on the left, value on the right, using flex justify-between.
 */
export function DetailRow({ label, ddClassName, children }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-text">{label}</dt>
      <dd className={ddClassName}>{children}</dd>
    </div>
  );
}
