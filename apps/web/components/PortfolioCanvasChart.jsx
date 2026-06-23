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

// ── Panel: CHF grouped bar chart ─────────────────────────────

const CHF_SERIES = [
  { key: "noiCents",          label: "NOI",            color: "rgba(59,130,246,0.85)"  },
  { key: "collectedIncomeCents", label: "Cash received", color: "rgba(16,185,129,0.85)"  },
  { key: "expensesCents",     label: "Expenses",       color: "rgba(239,68,68,0.75)"   },
];

function ChfPanel({ points, t }) {
  const ref  = useRef(null);
  const inst = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    inst.current?.destroy();

    inst.current = new Chart(ref.current, {
      type: "bar",
      data: {
        labels: points.map((p) => p.label),
        datasets: CHF_SERIES.map((s) => ({
          label:           t ? t(`reporting.canvas.metric.${s.key}`, { defaultValue: s.label }) : s.label,
          data:            points.map((p) => p[s.key] != null ? p[s.key] / 100 : null),
          backgroundColor: s.color,
          borderRadius:    3,
          borderSkipped:   false,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(ctx) {
                const raw = points[ctx.dataIndex][CHF_SERIES[ctx.datasetIndex].key];
                return `${ctx.dataset.label}: ${fmtChf(raw)}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: "#94a3b8", font: { size: 11 }, maxRotation: 45 },
          },
          y: {
            grid: { color: "rgba(0,0,0,0.04)" },
            ticks: {
              color: "#94a3b8",
              font: { size: 11 },
              callback: (v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v,
            },
          },
        },
      },
    });

    return () => { inst.current?.destroy(); inst.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  return (
    <div className="rounded-2xl border border-surface-border bg-surface shadow-sm p-5 mb-4">
      <div className="text-sm font-semibold text-foreground mb-1">
        {t ? t("reporting.canvas.chfPanel") : "CHF Performance"}
      </div>
      <div className="relative h-52">
        <canvas ref={ref} />
      </div>
      <ChartLegend
        items={CHF_SERIES.map((s) => ({
          label: t ? t(`reporting.canvas.metric.${s.key}`, { defaultValue: s.label }) : s.label,
          color: s.color,
          type:  "bar",
        }))}
      />
    </div>
  );
}

// ── Panel: % line chart ──────────────────────────────────────

const PCT_SERIES = [
  { key: "collectionRate", label: "On-time collection", color: "rgba(168,85,247,1)"  },
  { key: "noiMarginPct",   label: "NOI Margin",      color: "rgba(20,184,166,1)"  },
  { key: "opexRatioPct",   label: "OpEx Ratio",      color: "rgba(249,115,22,1)"  },
  { key: "occupancyRate",  label: "Occupancy",        color: "rgba(99,102,241,1)"  },
];

function PctPanel({ points, t }) {
  const ref  = useRef(null);
  const inst = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    inst.current?.destroy();

    inst.current = new Chart(ref.current, {
      type: "line",
      data: {
        labels: points.map((p) => p.label),
        datasets: PCT_SERIES.map((s) => ({
          label:               t ? t(`reporting.canvas.metric.${s.key}`, { defaultValue: s.label }) : s.label,
          data:                points.map((p) => p[s.key] != null ? p[s.key] * 100 : null),
          borderColor:         s.color,
          backgroundColor:     "transparent",
          pointBackgroundColor: s.color,
          borderWidth:         2,
          pointRadius:         points.length <= 14 ? 3 : 1.5,
          pointHoverRadius:    5,
          tension:             0.35,
          spanGaps:            true,
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
                const raw = points[ctx.dataIndex][PCT_SERIES[ctx.datasetIndex].key];
                return `${ctx.dataset.label}: ${fmtPct(raw)}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: "#94a3b8", font: { size: 11 }, maxRotation: 45 },
          },
          y: {
            min: 0,
            max: 100,
            grid: { color: "rgba(0,0,0,0.04)" },
            ticks: {
              color: "#94a3b8",
              font: { size: 11 },
              callback: (v) => `${v}%`,
            },
          },
        },
      },
    });

    return () => { inst.current?.destroy(); inst.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  return (
    <div className="rounded-2xl border border-surface-border bg-surface shadow-sm p-5">
      <div className="text-sm font-semibold text-foreground mb-1">
        {t ? t("reporting.canvas.pctPanel") : "Portfolio Health %"}
      </div>
      <div className="relative h-52">
        <canvas ref={ref} />
      </div>
      <ChartLegend
        items={PCT_SERIES.map((s) => ({
          label: t ? t(`reporting.canvas.metric.${s.key}`, { defaultValue: s.label }) : s.label,
          color: s.color,
          type:  "line",
        }))}
      />
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
      <PctPanel points={points} t={t} />
    </div>
  );
}
