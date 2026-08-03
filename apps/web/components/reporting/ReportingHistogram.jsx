import { useRef, useState, useMemo, useEffect } from "react";
import { fmtChf, fmtPct } from "./ReportingShared";
import { cn } from "../../lib/utils";

// Compact CHF for the axis cap: "CHF 24k".
function fmtK(cents) {
  const k = Math.round(cents / 100 / 100) / 10;
  return `CHF ${k}k`;
}

// Round a value up to a "nice" axis maximum (1/2/5 × 10ⁿ).
function niceCeil(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const s = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return s * p;
}

/**
 * The reporting time navigator. Renders the building's income time-series as a
 * stacked histogram (expenses base + NOI top, one bar per bucket) and lets the
 * user pick the reporting period BY the chart: click a bar to focus it, or drag
 * across bars to select a span. Emits the selected index range via onFocusChange
 * — the parent turns that into the [from,to] fed to the period detail below.
 *
 * points: TimeSeriesPoint[] — each { periodStart, periodEnd, label, expensesCents,
 *   noiCents, collectedIncomeCents, collectionRate, noiMarginPct, occupancyRate }.
 * focus:  { s, e } inclusive index range. onFocusChange(s, e) on click/drag/keys.
 */
export default function ReportingHistogram({ points, focus, onFocusChange, t, bare }) {
  const [tip, setTip] = useState(null);   // { i, x, y } | null
  const [drag, setDrag] = useState(null); // live { s, e } while dragging — visual only
  const dragging = useRef(false);
  const startRef = useRef(0);
  const endRef = useRef(0);

  const axisMax = useMemo(() => niceCeil(Math.max(1, ...points.map((p) => p.collectedIncomeCents ?? 0))), [points]);
  const AREA = 190; // px height of the plot area (bars grow into this)

  // While dragging, highlight from local state and DON'T notify the parent —
  // committing the [from,to] on every bar would refetch the whole detail per bar.
  // The parent (and its expensive detail fetch) is only told on release.
  const hi = drag ?? { s: focus.s, e: focus.e };
  const f0 = Math.min(hi.s, hi.e);
  const f1 = Math.max(hi.s, hi.e);

  function commitDrag() {
    if (!dragging.current) return;
    dragging.current = false;
    const s = startRef.current, e = endRef.current;
    setDrag(null);
    onFocusChange(s, e);
  }

  // Commit even if the mouse is released outside the chart. Attach the listener
  // once and route through a ref to the latest handler (updated post-render) so
  // hover re-renders neither churn the listener nor read a ref during render.
  const commitRef = useRef(null);
  useEffect(() => { commitRef.current = commitDrag; });
  useEffect(() => {
    const h = () => commitRef.current && commitRef.current();
    window.addEventListener("mouseup", h);
    return () => window.removeEventListener("mouseup", h);
  }, []);

  function startDrag(i, e) {
    dragging.current = true;
    startRef.current = i;
    endRef.current = i;
    setDrag({ s: i, e: i });
    setTip(null);
    e.preventDefault();
  }
  function enterBar(i, e) {
    if (dragging.current) { endRef.current = i; setDrag({ s: startRef.current, e: i }); }
    else setTip({ i, x: e.clientX, y: e.clientY });
  }

  function onKeyDown(e) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    let i = Math.max(focus.s, focus.e) + (e.key === "ArrowRight" ? 1 : -1);
    i = Math.max(0, Math.min(points.length - 1, i));
    onFocusChange(i, i);
    e.preventDefault();
  }

  const tp = tip != null ? points[tip.i] : null;

  return (
    <div className={bare ? "" : "rounded-2xl border border-surface-border bg-surface p-4 shadow-sm"}>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted">
          <i className="inline-block h-2.5 w-2.5 rounded-sm bg-brand/40" />{t("buildingsId.reporting.histogram.expenses")}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted">
          <i className="inline-block h-2.5 w-2.5 rounded-sm bg-brand" />{t("buildingsId.reporting.histogram.noi")}
        </span>
        <span className="text-xs text-foreground-dim">{t("buildingsId.reporting.histogram.legendHint")}</span>
      </div>

      <div
        className="overflow-x-auto pb-1"
        role="group"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onMouseLeave={() => setTip(null)}
      >
        <div
          className="relative flex select-none items-end gap-[3px]"
          style={{ height: `${AREA + 20}px`, minWidth: `${points.length * 13}px` /* no-token: bar-count driven min width */ }}
        >
          {/* axis cap + baseline */}
          <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-surface-border" style={{ bottom: "20px" /* no-token: chart baseline */ }} />
          <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-surface-border" style={{ bottom: `${20 + AREA}px` /* no-token: chart axis cap */ }} />
          <span className="pointer-events-none absolute right-0 bg-surface px-1 text-[10px] text-foreground-dim" style={{ bottom: `${14 + AREA}px` /* no-token: axis label */ }}>{fmtK(axisMax)}</span>

          {points.map((p, i) => {
            const income = p.collectedIncomeCents ?? 0;
            const exp = Math.max(0, p.expensesCents ?? 0);
            const noi = p.noiCents ?? 0;
            const loss = noi < 0;
            const stackH = (income / axisMax) * AREA;
            const expH = (exp / axisMax) * AREA;
            const inFocus = i >= f0 && i <= f1;
            return (
              <button
                key={p.periodStart + i}
                type="button"
                className={cn(
                  "group relative flex h-full min-w-[10px] flex-1 cursor-pointer flex-col justify-end",
                  !inFocus && "opacity-40",
                )}
                onMouseDown={(e) => startDrag(i, e)}
                onMouseEnter={(e) => enterBar(i, e)}
                onMouseMove={(e) => !dragging.current && setTip({ i, x: e.clientX, y: e.clientY })}
                aria-label={p.label}
                aria-pressed={inFocus}
              >
                <div
                  className="flex flex-col justify-end overflow-hidden rounded-t transition-[filter] group-hover:brightness-105"
                  style={{ height: `${Math.max(2, stackH)}px`, marginBottom: "20px" /* no-token: leave room for tick */ }}
                >
                  <div
                    className={cn("shrink-0", loss ? "bg-destructive" : "bg-brand")}
                    style={{ height: loss ? "3px" : `${Math.max(0, stackH - expH)}px` /* no-token: NOI segment */ }}
                  />
                  <div className="min-h-0 flex-1 bg-brand/40" />
                </div>
                <span className={cn(
                  "absolute inset-x-0 bottom-0 truncate text-center text-[10px]",
                  inFocus ? "font-semibold text-brand" : "text-foreground-dim",
                )}>{p.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {tp && (
        <div
          className="pointer-events-none fixed z-40 min-w-[168px] rounded-xl border border-surface-border bg-surface p-2.5 text-xs shadow-lg"
          style={{
            /* no-token: dynamic cursor-following tooltip position */
            left: `${Math.min(tip.x + 14, (typeof window !== "undefined" ? window.innerWidth : 1200) - 190)}px`,
            top: `${tip.y + 14}px`,
          }}
        >
          <div className="mb-1.5 text-[12.5px] font-semibold text-foreground">{tp.label}</div>
          {[
            [t("buildingsId.reporting.histogram.income"), fmtChf(tp.collectedIncomeCents ?? 0), "text-foreground"],
            [t("buildingsId.reporting.histogram.expenses"), fmtChf(tp.expensesCents ?? 0), "text-foreground"],
            [t("buildingsId.reporting.histogram.noi"), fmtChf(tp.noiCents ?? 0), (tp.noiCents ?? 0) < 0 ? "text-destructive-text" : "text-success-text"],
          ].map(([k, v, c]) => (
            <div key={k} className="flex justify-between gap-4 text-muted"><span>{k}</span><b className={cn("font-semibold", c)}>{v}</b></div>
          ))}
          <div className="my-1.5 h-px bg-surface-border" />
          {[
            [t("buildingsId.reporting.histogram.collection"), fmtPct(tp.collectionRate ?? 0)],
            [t("buildingsId.reporting.histogram.occupancy"), tp.occupancyRate != null ? fmtPct(tp.occupancyRate) : "—"],
            [t("buildingsId.reporting.histogram.noiMargin"), tp.noiMarginPct != null ? fmtPct(tp.noiMarginPct) : "—"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 text-muted"><span>{k}</span><b className="font-semibold text-foreground">{v}</b></div>
          ))}
        </div>
      )}
    </div>
  );
}
