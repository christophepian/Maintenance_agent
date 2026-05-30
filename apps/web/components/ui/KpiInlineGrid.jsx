import { cn } from "../../lib/utils";

/**
 * KpiInlineGrid — compact mobile KPI pattern.
 *
 * Renders a 2-col bordered grid where every cell shows
 * "label · value" on a single row. Roughly half the height
 * of the standard card-grid pattern.
 *
 * Props:
 *   items: Array<{
 *     label: string
 *     value: string | number
 *     tone?: 'warn' | 'good'   // omit for default (slate-900)
 *   }>
 *
 * Responsive usage (swap with KpiCard grid at sm):
 *   <div className="sm:hidden">
 *     <KpiInlineGrid items={kpiItems} />
 *   </div>
 *   <div className="hidden sm:grid kpi-grid">
 *     {kpiItems.map(item => <KpiCard key={item.label} ... />)}
 *   </div>
 */
export default function KpiInlineGrid({ items = [], className }) {
  const total = items.length;

  return (
    <div
      className={cn(
        "grid grid-cols-2 rounded-xl border border-surface-border overflow-hidden",
        className
      )}
    >
      {items.map((item, i) => {
        const isLastInRow = i % 2 === 1;
        const isLastRow = i >= total - (total % 2 === 0 ? 2 : 1);

        return (
          <div
            key={item.label}
            className={cn(
              "flex flex-col px-3.5 py-2.5 gap-0.5",
              !isLastRow && "border-b border-surface-divider",
              !isLastInRow && "border-r border-surface-divider"
            )}
          >
            <span className="text-xs font-medium text-muted uppercase tracking-wide leading-tight">
              {item.label}
            </span>
            <span
              className={cn(
                "text-base font-semibold tracking-tight tabular-nums leading-snug",
                item.tone === "warn" && "text-destructive-text",
                item.tone === "good" && "text-success-text",
                !item.tone && "text-foreground"
              )}
            >
              {item.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
