import { cn } from "../../lib/utils";

/**
 * Card — semantic wrapper for Panel. Provides surface + border + shadow.
 * Use directly or wrap in a <Link> for clickable cards.
 */
export default function Card({ className, children, ...props }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-surface-border bg-surface-raised shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Card header with optional actions slot */
Card.Header = function CardHeader({ title, actions, className, children }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-b border-surface-hover px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      {title ? (
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      ) : (
        children
      )}
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
};

/** Card body with default padding (overridable) */
Card.Body = function CardBody({ className, children }) {
  return <div className={cn("px-4 py-4", className)}>{children}</div>;
};
