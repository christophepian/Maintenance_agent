import { cn } from "../../lib/utils";

/**
 * KpiCard — standardized KPI display card.
 * Replaces the 3 competing KPI variants across the codebase.
 *
 * Usage:
 *   <KpiCard label="Open Requests" value={42} accent="warning" />
 */
export default function KpiCard({
  label,
  value,
  subtitle,
  accent = "brand",
  href,
  icon,
  className,
}) {
  const accentColors = {
    brand: "text-brand-dark",
    destructive: "text-destructive-text",
    success: "text-success-text",
    warning: "text-amber-700",
    muted: "text-muted-dark",
  };

  const Wrapper = href ? "a" : "div";
  const wrapperProps = href
    ? { href, className: cn("link-card", className) }
    : { className };

  return (
    <Wrapper {...wrapperProps}>
      <div className="rounded-2xl border border-surface-border bg-surface p-5 shadow-sm">
        <div className="flex justify-between items-baseline">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted">
              {icon && <span className="mr-1">{icon}</span>}
              {label}
            </div>
            {subtitle && (
              <div className="text-sm text-muted mt-0.5">{subtitle}</div>
            )}
          </div>
          <div
            className={cn(
              "mt-3 text-2xl font-semibold tracking-tight",
              accentColors[accent] || accentColors.brand
            )}
          >
            {value}
          </div>
        </div>
      </div>
    </Wrapper>
  );
}
