import { useRef, useEffect } from "react";
import {
  Chart,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

Chart.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler);

// Fixed metric definitions matching the KPI table
const METRICS = [
  { key: "noiCents",          label: "NOI",             format: "chf",  color: "59,130,246"  }, // blue-500
  { key: "earnedIncomeCents", label: "Rent Collected",  format: "chf",  color: "16,185,129"  }, // emerald-500
  { key: "expensesCents",     label: "Total Expenses",  format: "chf",  color: "239,68,68"   }, // red-500
  { key: "collectionRate",    label: "Collection Rate", format: "pct",  color: "168,85,247"  }, // purple-500
  { key: "noiMarginPct",      label: "NOI Margin",      format: "pct",  color: "20,184,166"  }, // teal-500
  { key: "opexRatioPct",      label: "OpEx Ratio",      format: "pct",  color: "249,115,22"  }, // orange-500
  { key: "occupancyRate",     label: "Occupancy",       format: "pct",  color: "99,102,241"  }, // indigo-500
];

function fmtChf(cents) {
  if (cents == null) return "—";
  const chf = cents / 100;
  if (Math.abs(chf) >= 1000) return `CHF ${(chf / 1000).toFixed(1)}k`;
  return `CHF ${chf.toFixed(0)}`;
}

function fmtPct(val) {
  if (val == null) return "—";
  return `${(val * 100).toFixed(1)}%`;
}

function formatValue(val, format) {
  if (format === "chf") return fmtChf(val);
  return fmtPct(val);
}

export default function PortfolioCanvasChart({ points = [], range, activeMetrics, t }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  const metrics = METRICS.filter((m) => activeMetrics.includes(m.key));

  useEffect(() => {
    if (!canvasRef.current || points.length === 0) return;

    const labels = points.map((p) => p.label);

    const datasets = metrics.map((m) => ({
      label:           t ? t(`reporting.canvas.metric.${m.key}`, { defaultValue: m.label }) : m.label,
      data:            points.map((p) => {
        const v = p[m.key];
        if (v == null) return null;
        // Convert cents to CHF for display, keep ratios as 0-100 %
        return m.format === "chf" ? v / 100 : v * 100;
      }),
      borderColor:     `rgba(${m.color},1)`,
      backgroundColor: `rgba(${m.color},0.08)`,
      pointBackgroundColor: `rgba(${m.color},1)`,
      borderWidth:     2,
      pointRadius:     points.length <= 14 ? 4 : 2,
      pointHoverRadius: 6,
      tension:         0.35,
      fill:            false,
      spanGaps:        true,
    }));

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "top",
            labels: {
              usePointStyle: true,
              pointStyleWidth: 8,
              font: { size: 12 },
              color: "#64748b",
              padding: 16,
            },
          },
          tooltip: {
            callbacks: {
              label(ctx) {
                const m = metrics[ctx.datasetIndex];
                if (ctx.parsed.y == null) return `${ctx.dataset.label}: —`;
                const raw = points[ctx.dataIndex][m.key];
                return `${ctx.dataset.label}: ${formatValue(raw, m.format)}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { color: "rgba(0,0,0,0.04)" },
            ticks: { color: "#94a3b8", font: { size: 11 }, maxRotation: 45 },
          },
          y: {
            grid: { color: "rgba(0,0,0,0.04)" },
            ticks: {
              color: "#94a3b8",
              font: { size: 11 },
              callback(val) {
                // Mixed axes: if any active metric is CHF show k suffix, else %
                const hasChf = metrics.some((m) => m.format === "chf");
                if (hasChf) return val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val;
                return `${val.toFixed(0)}%`;
              },
            },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, activeMetrics]);

  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-foreground-dim">
        {t ? t("reporting.canvas.noData") : "No data for this range yet."}
      </div>
    );
  }

  return (
    <div className="relative h-64 sm:h-80">
      <canvas ref={canvasRef} />
    </div>
  );
}

export { METRICS };
