import { useRef, useEffect } from "react";
import { Chart, registerables } from "chart.js";
import { cn } from "../lib/utils";

Chart.register(...registerables);

// ── Helpers ──────────────────────────────────────────────────

function fmtChf(cents) {
  if (cents == null) return "—";
  const chf = cents / 100;
  if (Math.abs(chf) >= 1_000_000) return `CHF ${(chf / 1_000_000).toFixed(1)}M`;
  if (Math.abs(chf) >= 1_000)     return `CHF ${(chf / 1_000).toFixed(0)}k`;
  return `CHF ${chf.toFixed(0)}`;
}

function fmtPct(val) {
  if (val == null) return "—";
  return `${(val * 100).toFixed(1)}%`;
}

// ── Legend component ─────────────────────────────────────────

function ChartLegend({ items }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
      {items.map(({ label, color, type }) => (
        <div key={label} className="flex items-center gap-1.5">
          {type === "bar" ? (
            <span
              className="inline-block w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: color }}
            />
          ) : (
            <span
              className="inline-block w-5 h-0.5 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
          )}
          <span className="text-xs text-foreground-dim">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Panel: CHF stacked bar — Income = Expenses + NOI ─────────
// One bar per month whose height IS income (cash received): the red base is what
// was spent (Expenses), the green top is what was kept (NOI). Since
// Income = Expenses + NOI, the bar itself is the subtraction. A loss month
// (expenses > income) dips the NOI segment below zero in red.

const CHF_EXPENSE_COLOR = "rgba(239,68,68,0.80)";
const CHF_NOI_COLOR     = "rgba(16,185,129,0.90)";
const CHF_LOSS_COLOR    = "rgba(220,38,38,0.85)";
const CHF_STACK = [
  { key: "expensesCents", label: "Expenses", color: CHF_EXPENSE_COLOR },
  { key: "noiCents",      label: "NOI",      color: CHF_NOI_COLOR     },
];

function ChfPanel({ points, t }) {
  const ref      = useRef(null);
  const inst     = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    inst.current?.destroy();
    // Read the panel's surface colour so the 2px inter-segment gap is theme-correct.
    const surface = panelRef.current ? getComputedStyle(panelRef.current).backgroundColor : "#ffffff";

    inst.current = new Chart(ref.current, {
      type: "bar",
      data: {
        labels: points.map((p) => p.label),
        datasets: CHF_STACK.map((s) => ({
          label:           t ? t(`reporting.canvas.metric.${s.key}`, { defaultValue: s.label }) : s.label,
          data:            points.map((p) => p[s.key] != null ? p[s.key] / 100 : null),
          backgroundColor: s.key === "noiCents"
            ? points.map((p) => (p.noiCents ?? 0) >= 0 ? CHF_NOI_COLOR : CHF_LOSS_COLOR)
            : s.color,
          stack:           "chf",
          borderRadius:    3,
          borderSkipped:   false,
          borderColor:     surface,   // 2px surface gap between the two segments
          borderWidth:     2,
          maxBarThickness: 40,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(ctx) {
                const raw = points[ctx.dataIndex][CHF_STACK[ctx.datasetIndex].key];
                return `${ctx.dataset.label}: ${fmtChf(raw)}`;
              },
              footer(items) {
                return `Income: ${fmtChf(points[items[0].dataIndex].collectedIncomeCents)}`;
              },
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: "#94a3b8", font: { size: 11 }, maxRotation: 45 },
          },
          y: {
            stacked: true,
            grid: { color: "rgba(148,163,184,0.15)" },
            ticks: {
              color: "#94a3b8",
              font: { size: 11 },
              callback: (v) => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v,
            },
          },
        },
      },
    });

    return () => { inst.current?.destroy(); inst.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  return (
    <div ref={panelRef} className="rounded-2xl border border-surface-border bg-surface shadow-sm p-5 mb-4">
      <div className="text-sm font-semibold text-foreground mb-0.5">
        {t ? t("reporting.canvas.chfPanel") : "CHF Performance"}
      </div>
      <div className="text-xs text-foreground-dim mb-2">
        {t ? t("reporting.canvas.chfSub", { defaultValue: "Bar height = income · red = expenses · green = NOI kept" })
           : "Bar height = income · red = expenses · green = NOI kept"}
      </div>
      <div className="relative h-52">
        <canvas ref={ref} />
      </div>
      <ChartLegend
        items={CHF_STACK.map((s) => ({
          label: t ? t(`reporting.canvas.metric.${s.key}`, { defaultValue: s.label }) : s.label,
          color: s.color,
          type:  "bar",
        }))}
      />
    </div>
  );
}

// ── Health KPIs — shared metadata + helpers ──────────────────
// PROTOTYPE: three ways to present the four rate KPIs, rendered together so we
// can pick one on staging. Collapse to the chosen one afterwards.

const PCT_META = {
  collectionRate: { label: "On-time collection", color: "rgba(168,85,247,1)" },
  occupancyRate:  { label: "Occupancy",          color: "rgba(99,102,241,1)" },
  noiMarginPct:   { label: "NOI margin",         color: "rgba(20,184,166,1)" },
  opexRatioPct:   { label: "OpEx ratio",         color: "rgba(249,115,22,1)" },
};

const seriesPct = (points, key) => points.map((p) => (p[key] != null ? p[key] * 100 : null));

function lastAndDelta(vals) {
  const clean = vals.filter((v) => v != null);
  const last = clean.length ? clean[clean.length - 1] : null;
  const prev = clean.length > 1 ? clean[clean.length - 2] : null;
  return { last, delta: last != null && prev != null ? last - prev : null };
}

function Sparkline({ vals, color, width = 72, height = 22 }) {
  const nums = vals.filter((v) => v != null);
  if (nums.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...nums), max = Math.max(...nums), span = max - min || 1, n = vals.length;
  const pts = vals
    .map((v, i) => (v == null ? null : `${((i / (n - 1)) * (width - 2) + 1).toFixed(1)},${(height - 1 - ((v - min) / span) * (height - 2)).toFixed(1)}`))
    .filter(Boolean)
    .join(" ");
  return (
    <svg width={width} height={height}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function AreaMini({ vals, color }) {
  const clean = vals.map((v) => (v == null ? null : Math.max(0, Math.min(100, v))));
  const nums = clean.filter((v) => v != null);
  if (nums.length < 1) return <div className="h-16" />;
  const W = 100, H = 40, n = clean.length;
  const line = clean.map((v, i) => (v == null ? null : `${n <= 1 ? W : ((i / (n - 1)) * W).toFixed(1)},${(H - (v / 100) * H).toFixed(1)}`)).filter(Boolean);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-16">
      <polygon points={`0,${H} ${line.join(" ")} ${W},${H}`} fill={color} opacity="0.14" />
      <polyline points={line.join(" ")} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

// ── Option A: KPI tiles + sparklines ─────────────────────────

function HealthTiles({ points }) {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface shadow-sm p-5 mb-4">
      <div className="text-sm font-semibold text-foreground mb-3">Health — Option A · KPI tiles</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(PCT_META).map(([key, m]) => {
          const vals = seriesPct(points, key);
          const { last, delta } = lastAndDelta(vals);
          const up = delta != null && delta >= 0;
          return (
            <div key={key} className="rounded-xl border border-surface-border p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <svg width="8" height="8" className="shrink-0"><rect width="8" height="8" rx="2" fill={m.color} /></svg>
                <span className="text-xs text-foreground-dim truncate">{m.label}</span>
              </div>
              <div className="text-xl font-semibold text-foreground tabular-nums">{last != null ? `${last.toFixed(0)}%` : "—"}</div>
              <div className="mt-1 flex items-center justify-between">
                <Sparkline vals={vals} color={m.color} />
                {delta != null && Math.abs(delta) >= 0.5 && (
                  <span className={cn("text-xs tabular-nums", up ? "text-green-600" : "text-red-600")}>
                    {up ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Option B: small multiples ────────────────────────────────

function HealthSmallMultiples({ points }) {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface shadow-sm p-5 mb-4">
      <div className="text-sm font-semibold text-foreground mb-3">Health — Option B · Small multiples</div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        {Object.entries(PCT_META).map(([key, m]) => {
          const vals = seriesPct(points, key);
          const { last } = lastAndDelta(vals);
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className="flex items-center gap-1.5 text-xs text-foreground-dim">
                  <svg width="8" height="8" className="shrink-0"><rect width="8" height="8" rx="2" fill={m.color} /></svg>
                  {m.label}
                </span>
                <span className="text-sm font-semibold text-foreground tabular-nums">{last != null ? `${last.toFixed(0)}%` : "—"}</span>
              </div>
              <AreaMini vals={vals} color={m.color} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Option C: one cleaned-up line chart (3 series, no smoothing) ──

const PCT_CLEAN = ["collectionRate", "occupancyRate", "noiMarginPct"];

function HealthLinesClean({ points }) {
  const ref = useRef(null);
  const inst = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    inst.current?.destroy();
    inst.current = new Chart(ref.current, {
      type: "line",
      data: {
        labels: points.map((p) => p.label),
        datasets: PCT_CLEAN.map((key) => ({
          label: PCT_META[key].label,
          data: seriesPct(points, key),
          borderColor: PCT_META[key].color,
          backgroundColor: "transparent",
          pointBackgroundColor: PCT_META[key].color,
          borderWidth: 2,
          pointRadius: points.length <= 14 ? 3 : 0,
          pointHoverRadius: 5,
          tension: 0,
          spanGaps: true,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(ctx) {
                const raw = points[ctx.dataIndex][PCT_CLEAN[ctx.datasetIndex]];
                return `${ctx.dataset.label}: ${fmtPct(raw)}`;
              },
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: "#94a3b8", font: { size: 11 }, maxRotation: 45 } },
          y: { min: 0, max: 100, grid: { color: "rgba(148,163,184,0.15)" }, ticks: { color: "#94a3b8", font: { size: 11 }, callback: (v) => `${v}%` } },
        },
      },
    });
    return () => { inst.current?.destroy(); inst.current = null; };
  }, [points]);

  return (
    <div className="rounded-2xl border border-surface-border bg-surface shadow-sm p-5">
      <div className="text-sm font-semibold text-foreground mb-3">Health — Option C · Cleaned line chart</div>
      <div className="relative h-52">
        <canvas ref={ref} />
      </div>
      <ChartLegend items={PCT_CLEAN.map((key) => ({ label: PCT_META[key].label, color: PCT_META[key].color, type: "line" }))} />
    </div>
  );
}

// ── Root export ──────────────────────────────────────────────

export default function PortfolioCanvasChart({ points = [], range, t }) {
  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-foreground-dim">
        {t ? t("reporting.canvas.noData") : "No data for this range yet."}
      </div>
    );
  }

  return (
    <div>
      <ChfPanel points={points} t={t} />
      <div className="rounded-lg border border-brand-ring bg-brand-light px-3 py-2 mb-4 text-xs text-brand-dark">
        Prototype — three ways to show “Portfolio Health”. Pick the one to keep.
      </div>
      <HealthTiles points={points} />
      <HealthSmallMultiples points={points} />
      <HealthLinesClean points={points} />
    </div>
  );
}
