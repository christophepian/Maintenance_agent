import { cn } from "../../lib/utils";

/**
 * ErrorBanner — semantic error display.
 * Drop-in replacement for `<div className="error-banner">{error}</div>`.
 *
 * Props:
 *   error     — error string (renders nothing if falsy)
 *   onDismiss — optional callback to add a dismiss button
 *   className — extra classes merged via cn()
 *   children  — optional; if provided, renders children instead of `error`
 */
export default function ErrorBanner({ error, onDismiss, className, children }) {
  if (!error && !children) return null;

  return (
    <div role="alert" className={cn("error-banner", className)}>
      <span>{children || error}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="ml-3 opacity-60 hover:opacity-100"
          aria-label="Dismiss error"
        >
          ✕
        </button>
      )}
    </div>
  );
}
