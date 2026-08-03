import { useRef, useEffect } from "react";
import { Chart, registerables } from "chart.js";

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
  return `${(val * 100).toFixed(0)}%`;
}

// ── Legend component ─────────────────────────────────────────

function ChartLegend({ items }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
      {items.map(({ label, color }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
          <span className="text-xs text-foreground-dim">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── CHF Performance — stacked income bar with health in the tooltip ──
// One bar per month whose height IS income (cash received): the red base is what
// was spent (Expenses), the green top is what was kept (NOI). Since
// Income = Expenses + NOI, the bar itself is the subtraction. A loss month
// (expenses > income) dips the NOI segment below zero in red. Hovering a bar
// surfaces that period's health rates (collection, occupancy, NOI margin, OpEx),
// so they read in the context of the month rather than as a separate chart.

// Two SOLID shades of the brand accent (both --color-brand and --color-brand-dark
// are opaque fills in light and dark — unlike --color-brand-light/-ring, which are
// translucent in dark and would render nearly invisible on the dark surface).
// Expenses is the base, NOI the contrasting shade on top; a loss (negative NOI)
// uses the warning token so it still stands out without reintroducing red/green.
const CHF_STACK = [
  { key: "expensesCents", label: "Expenses", varName: "--color-brand"      },
  { key: "noiCents",      label: "NOI",      varName: "--color-brand-dark" },
];
const CHF_LOSS_VAR = "--color-warning";

function ChfPanel({ points, t }) {
  const ref      = useRef(null);
  const inst     = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    inst.current?.destroy();
    // Resolve theme tokens to concrete colours (the canvas can't use CSS vars);
    // reading them here means light + dark both render correctly.
    const root = document.documentElement;
    const cssVar = (name, fb) => getComputedStyle(root).getPropertyValue(name).trim() || fb;
    const cExpense = cssVar("--color-brand", "#4f46e5");
    const cNoi     = cssVar("--color-brand-dark", "#818cf8");
    const cLoss    = cssVar(CHF_LOSS_VAR, "#d97706");
    const cTick    = cssVar("--color-foreground-dim", "#94a3b8");
    const cGrid    = cssVar("--color-surface-border", "rgba(148,163,184,0.25)");
    // The panel's own surface colour makes the 2px inter-segment gap theme-correct.
    const surface = panelRef.current ? getComputedStyle(panelRef.current).backgroundColor : "#ffffff";

    inst.current = new Chart(ref.current, {
      type: "bar",
      data: {
        labels: points.map((p) => p.label),
        datasets: CHF_STACK.map((s) => ({
          label:           t ? t(`reporting.canvas.metric.${s.key}`, { defaultValue: s.label }) : s.label,
          data:            points.map((p) => p[s.key] != null ? p[s.key] / 100 : null),
          backgroundColor: s.key === "noiCents"
            ? points.map((p) => (p.noiCents ?? 0) >= 0 ? cNoi : cLoss)
            : cExpense,
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
            padding: 10,
            callbacks: {
              label(ctx) {
                const raw = points[ctx.dataIndex][CHF_STACK[ctx.datasetIndex].key];
                return `${ctx.dataset.label}: ${fmtChf(raw)}`;
              },
              // Income (the bar total) plus the period's health rates, so the KPIs
              // read in the context of the hovered month.
              footer(items) {
                const p = points[items[0].dataIndex];
                return [
                  `Income: ${fmtChf(p.collectedIncomeCents)}`,
                  "",
                  `Collection ${fmtPct(p.collectionRate)}    Occupancy ${fmtPct(p.occupancyRate)}`,
                  `NOI margin ${fmtPct(p.noiMarginPct)}    OpEx ${fmtPct(p.opexRatioPct)}`,
                ];
              },
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: cTick, font: { size: 11 }, maxRotation: 45 },
          },
          y: {
            stacked: true,
            grid: { color: cGrid },
            ticks: {
              color: cTick,
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
    <div ref={panelRef} className="rounded-2xl border border-surface-border bg-surface shadow-sm p-5">
      <div className="text-sm font-semibold text-foreground mb-0.5">
        {t ? t("reporting.canvas.chfPanel") : "CHF Performance"}
      </div>
      <div className="text-xs text-foreground-dim mb-2">
        {t ? t("reporting.canvas.chfSub", { defaultValue: "Bar height = income · expenses at the base, the rest is your NOI margin · hover a month for its rates" })
           : "Bar height = income · expenses at the base, the rest is your NOI margin · hover a month for its rates"}
      </div>
      <div className="relative h-52">
        <canvas ref={ref} />
      </div>
      <ChartLegend
        items={CHF_STACK.map((s) => ({
          label: t ? t(`reporting.canvas.metric.${s.key}`, { defaultValue: s.label }) : s.label,
          color: `var(${s.varName})`,
        }))}
      />
    </div>
  );
}

// ── Root export ──────────────────────────────────────────────

export default function PortfolioCanvasChart({ points = [], t }) {
  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-foreground-dim">
        {t ? t("reporting.canvas.noData") : "No data for this range yet."}
      </div>
    );
  }

  return <ChfPanel points={points} t={t} />;
}
