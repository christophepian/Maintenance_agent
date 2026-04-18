import { cn } from "../../lib/utils";

/**
 * ActionBar — horizontal wrapper for action button clusters.
 *
 * Usage:
 *   <ActionBar>
 *     <Button variant="primary" …>Save</Button>
 *     <Button variant="secondary" …>Cancel</Button>
 *   </ActionBar>
 */
export default function ActionBar({ children, className }) {
  return (
    <div className={cn("mt-6 flex flex-wrap gap-3", className)}>
      {children}
    </div>
  );
}
