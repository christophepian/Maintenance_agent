import { cn } from "../../lib/utils";
import { useTranslation } from "next-i18next";

export const MONTH_HERO_GRADIENTS = [
  "from-slate-50  via-blue-50   to-cyan-50",
  "from-rose-50   via-pink-50   to-fuchsia-50",
  "from-emerald-50 via-green-50 to-teal-50",
  "from-green-50  via-lime-50   to-yellow-50",
  "from-pink-50   via-rose-50   to-orange-50",
  "from-sky-50    via-blue-50   to-indigo-50",
  "from-yellow-50 via-amber-50  to-orange-50",
  "from-amber-50  via-yellow-50 to-lime-50",
  "from-orange-50 via-amber-50  to-red-50",
  "from-red-50    via-orange-50 to-amber-50",
  "from-stone-50  via-gray-50   to-slate-50",
  "from-indigo-50 via-blue-50   to-violet-50",
];

export function fmtChf(cents) {
  if (!Number.isFinite(cents)) return "—";
  const chf = cents / 100;
  if (Math.abs(chf) >= 1000) return `CHF ${(chf / 1000).toFixed(1).replace(".", "'")}k`;
  return `CHF ${chf.toFixed(0)}`;
}

export function fmtPct(rate) {
  if (!Number.isFinite(rate)) return "—";
  return `${Math.round(rate * 100)}%`;
}

export function TrendArrow({ delta }) {
  if (!delta) return null;
  const up   = delta.tone === "text-green-600";
  const down = delta.tone === "text-red-500";
  const arrow = up ? "↑" : down ? "↓" : "→";
  const cls   = up ? "text-green-600" : down ? "text-red-500" : "text-foreground-dim";
  return <span className={cn("text-sm font-semibold leading-none", cls)}>{arrow}</span>;
}

export function KpiRow({ label, value, delta, isLoading }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 px-4">
      <span className="text-sm text-foreground-dim">{label}</span>
      {isLoading ? (
        <div className="h-4 w-20 animate-pulse rounded bg-surface-hover" />
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground tabular-nums">{value}</span>
          <TrendArrow delta={delta} />
        </div>
      )}
    </div>
  );
}

export function KpiTable({ left, right, isLoading, attached = false }) {
  return (
    <div className={cn(
      "border border-surface-border bg-surface shadow-sm overflow-hidden",
      attached ? "rounded-b-2xl rounded-t-none border-t-0" : "rounded-2xl"
    )}>
      <div className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x sm:divide-surface-divider">
        <div>
          {left.map((row, i) => (
            <div key={row.label} className={cn(i > 0 && "border-t border-surface-divider")}>
              <KpiRow label={row.label} value={row.value} delta={row.delta} isLoading={isLoading} />
            </div>
          ))}
        </div>
        <div>
          {right.map((row, i) => (
            <div key={row.label} className={cn("border-t border-surface-divider", i === 0 && "sm:border-t-0")}>
              <KpiRow label={row.label} value={row.value} delta={row.delta} isLoading={isLoading} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// `positive` (optional boolean) marks whether the driver helped (true → green ↑)
// or hurt (false → red ↓) performance. When omitted the driver is informational
// and renders a neutral numbered circle.
export function DriverItem({ number, title, body, impact, positive }) {
  const hasDir = typeof positive === "boolean";
  const circleCls = !hasDir
    ? "bg-surface-hover text-muted"
    : positive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700";
  const impactCls = !hasDir
    ? "text-foreground-dim"
    : positive ? "text-green-700" : "text-red-600";
  return (
    <div className="flex gap-4 py-4 border-b border-surface-divider last:border-0 last:pb-0 first:pt-0">
      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold", circleCls)}>
        {hasDir ? (positive ? "↑" : "↓") : number}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <span className="text-sm font-semibold text-foreground leading-snug">{title}</span>
          {impact && <span className={cn("shrink-0 text-xs whitespace-nowrap", impactCls)}>{impact}</span>}
        </div>
        <p className="mt-1.5 text-sm text-muted-text leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

export function WatchItem({ number, text, severity, action }) {
  const colors = {
    red:    { bg: "bg-red-100",    text: "text-red-700" },
    amber:  { bg: "bg-amber-100",  text: "text-amber-700" },
    violet: { bg: "bg-violet-100", text: "text-violet-700" },
  };
  const { bg, text: tc } = colors[severity] ?? colors.violet;
  return (
    <div className="flex gap-4 py-4 border-b border-surface-divider last:border-0 last:pb-0 first:pt-0">
      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold", bg, tc)}>
        {number}
      </div>
      <div className="flex-1 min-w-0 self-center">
        <p className="text-sm leading-relaxed text-muted-dark">{text}</p>
        {action && (
          <a href={action.href} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors no-underline">
            {action.label} →
          </a>
        )}
      </div>
    </div>
  );
}

export function MonthlyTrendChart({ data }) {
  if (!data || data.length === 0) return null;
  const CHART_H = 80, LABEL_H = 18, BAR_W = 28, GAP = 6;
  const TOTAL_H = CHART_H + LABEL_H;
  const WIDTH = data.length * (BAR_W + GAP) - GAP;
  const ZERO_Y = CHART_H / 2;
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.noiCents)), 1);
  const ml = (m) => new Intl.DateTimeFormat("en", { month: "short" }).format(new Date(2024, m - 1, 1));
  return (
    <svg viewBox={`0 0 ${WIDTH} ${TOTAL_H}`} className="w-full" style={{ maxHeight: 98 }}>
      <line x1="0" y1={ZERO_Y} x2={WIDTH} y2={ZERO_Y} stroke="#e5e7eb" strokeWidth="1" />
      {data.map((d, i) => {
        const x = i * (BAR_W + GAP);
        const barH = Math.max(2, (Math.abs(d.noiCents) / maxAbs) * (ZERO_Y - 6));
        const isPos = d.noiCents >= 0;
        const barY = isPos ? ZERO_Y - barH : ZERO_Y;
        return (
          <g key={d.month}>
            <rect x={x} y={barY} width={BAR_W} height={barH} rx="3" fill={isPos ? "#16a34a" : "#dc2626"} fillOpacity="0.72" />
            <text x={x + BAR_W / 2} y={TOTAL_H - 2} textAnchor="middle" fontSize="8" fill="#9ca3af">{ml(d.month)}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function OccupancyRow({ type, tenantName, unitLabel, date }) {
  const { t, i18n } = useTranslation("common");
  const isMoveIn = type === "in";
  return (
    <div className="flex items-start gap-3 py-3 border-b border-surface-divider last:border-0">
      <div className={cn(
        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        isMoveIn ? "bg-green-100 text-green-700" : "bg-surface-hover text-muted",
      )}>
        {isMoveIn ? "↓" : "↑"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-foreground truncate">{tenantName}</span>
          <span className="shrink-0 text-xs text-foreground-dim">
            {date ? new Date(date).toLocaleDateString(i18n.language || "en", { day: "numeric", month: "short" }) : "—"}
          </span>
        </div>
        <div className="text-xs text-muted">{isMoveIn ? t("reporting.movingIn") : t("reporting.movingOut")} · {t("reporting.unit", { number: unitLabel })}</div>
      </div>
    </div>
  );
}
