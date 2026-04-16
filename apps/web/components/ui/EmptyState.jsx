import { cn } from "../../lib/utils";

/**
 * EmptyState — centered placeholder when no data exists.
 * Replaces raw div patterns with empty-state CSS class.
 */
export default function EmptyState({ icon, title, message, children, className }) {
  return (
    <div className={cn("empty-state", className)}>
      {icon && <div className="text-3xl mb-3">{icon}</div>}
      {title && <h3 className="text-base font-semibold text-slate-700 mb-1">{title}</h3>}
      {message && <p className="empty-state-text">{message}</p>}
      {children}
    </div>
  );
}
