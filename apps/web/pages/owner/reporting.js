import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import AppShell from "../../components/AppShell";
import Badge from "../../components/ui/Badge";
import { authHeaders } from "../../lib/api";

import { cn } from "../../lib/utils";
/* ─── Constants ──────────────────────────────────────────────── */

const PREVIEW = 3; // rows shown before expand

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_FULL  = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function lastDayOfMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function periodStrings(year, month) {
  const m = String(month + 1).padStart(2, "0");
  const last = lastDayOfMonth(year, month);
  const from = `${year}-${m}-01`;
  const to   = `${year}-${m}-${last}`;
  // previous month
  const prevDate = new Date(year, month - 1, 1);
  const pm = String(prevDate.getMonth() + 1).padStart(2, "0");
  const plast = lastDayOfMonth(prevDate.getFullYear(), prevDate.getMonth());
  const prevFrom = `${prevDate.getFullYear()}-${pm}-01`;
  const prevTo   = `${prevDate.getFullYear()}-${pm}-${plast}`;
  return { from, to, prevFrom, prevTo };
}

function fmtChf(cents) {
  if (!Number.isFinite(cents)) return "—";
  const chf = cents / 100;
  if (Math.abs(chf) >= 1000) {
    return `CHF ${(chf / 1000).toFixed(1).replace(".", "'")}k`;
  }
  return `CHF ${chf.toFixed(0)}`;
}

function fmtPct(rate) {
  if (!Number.isFinite(rate)) return "—";
  return `${Math.round(rate * 100)}%`;
}

function delta(curr, prev, format) {
  if (!Number.isFinite(curr) || !Number.isFinite(prev) || prev === 0) return null;
  const pct = ((curr - prev) / Math.abs(prev)) * 100;
  const sign = pct >= 0 ? "+" : "";
  const tone = pct >= 0 ? "text-green-600" : "text-red-500";
  return { label: `${sign}${pct.toFixed(1)}% vs prev month`, tone };
}

/* ─── Shared expand toggle ───────────────────────────────────── */

function ExpandToggle({ expanded, total, onToggle }) {
  if (total <= PREVIEW) return null;
  return (
    <button
      onClick={onToggle}
      className="mt-3 w-full rounded-xl border border-slate-100 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
    >
      {expanded ? "Show less ↑" : `Show ${total - PREVIEW} more ↓`}
    </button>
  );
}

/* ─── Timeline header ────────────────────────────────────────── */

function TimelineHeader({ year, month, mode, onSelect, onYearNav, onModeToggle }) {
  const scrollRef = useRef(null);

  // Auto-scroll selected month into view
  useEffect(() => {
    if (mode !== "month" || !scrollRef.current) return;
    const el = scrollRef.current.querySelector("[data-selected='true']");
    if (el) el.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
  }, [month, mode]);

  // Year range: show a 9-year window centred on selected year
  const yearRange = useMemo(() => {
    const start = Math.floor((year - 1) / 4) * 4 - 2;
    return Array.from({ length: 9 }, (_, i) => start + i);
  }, [year]);

  return (
    <div className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 py-3">

          {/* Year nav / breadcrumb */}
          {mode === "month" ? (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onYearNav(-1)}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors text-sm"
                aria-label="Previous year"
              >
                ‹
              </button>
              <button
                onClick={onModeToggle}
                className="rounded-full px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors tabular-nums"
              >
                {year}
              </button>
              <button
                onClick={() => onYearNav(1)}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors text-sm"
                aria-label="Next year"
              >
                ›
              </button>
            </div>
          ) : (
            <button
              onClick={onModeToggle}
              className="shrink-0 rounded-full px-3 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100 transition-colors"
            >
              ← Months
            </button>
          )}

          <div className="w-px h-5 bg-slate-200 shrink-0" />

          {/* Month strip or year grid */}
          <div
            ref={scrollRef}
            className="flex gap-1.5 overflow-x-auto scrollbar-none flex-1"
          >
            {mode === "month"
              ? MONTHS_SHORT.map((m, i) => {
                  const isSelected = i === month;
                  const isFuture = new Date(year, i, 1) > new Date();
                  return (
                    <button
                      key={m}
                      data-selected={isSelected ? "true" : "false"}
                      disabled={isFuture}
                      onClick={() => onSelect(year, i)}
                      className={[
                        "shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors",
                        isSelected
                          ? "bg-slate-900 text-white"
                          : isFuture
                          ? "text-slate-300 cursor-not-allowed"
                          : "text-slate-600 hover:bg-slate-100",
                      ].join(" ")}
                    >
                      {m}
                    </button>
                  );
                })
              : yearRange.map((y) => {
                  const isSelected = y === year;
                  const isFuture = y > new Date().getFullYear();
                  return (
                    <button
                      key={y}
                      disabled={isFuture}
                      onClick={() => { onSelect(y, month); onModeToggle(); }}
                      className={[
                        "shrink-0 rounded-full px-4 py-1 text-sm font-medium tabular-nums transition-colors",
                        isSelected
                          ? "bg-slate-900 text-white"
                          : isFuture
                          ? "text-slate-300 cursor-not-allowed"
                          : "text-slate-600 hover:bg-slate-100",
                      ].join(" ")}
                    >
                      {y}
                    </button>
                  );
                })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Small components ───────────────────────────────────────── */

function KpiCard({ label, value, delta, isLoading }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</div>
      {isLoading ? (
        <div className="mt-3 h-8 w-24 animate-pulse rounded bg-slate-100" />
      ) : (
        <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
      )}
      {!isLoading && delta && (
        <div className={cn("mt-1.5 text-xs", delta.tone)}>{delta.label}</div>
      )}
    </div>
  );
}

function DriverCard({ number, title, body, impact }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
        {number}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <span className="shrink-0 text-xs text-slate-400">{impact}</span>
        </div>
        <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

function BuildingRow({ name, earned, expenses, net, collectionRate }) {
  const netPositive = net >= 0;
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-sm font-medium text-slate-800 truncate mr-4">{name}</div>
      <div className="flex items-center gap-6 shrink-0 text-right">
        <div className="hidden sm:block">
          <div className="text-xs text-slate-400">Income</div>
          <div className="text-sm font-medium text-slate-700">{fmtChf(earned)}</div>
        </div>
        <div className="hidden sm:block">
          <div className="text-xs text-slate-400">Expenses</div>
          <div className="text-sm font-medium text-slate-700">{fmtChf(expenses)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Net</div>
          <div className={cn("text-sm font-semibold", netPositive ? "text-green-700" : "text-red-600")}>
            {fmtChf(net)}
          </div>
        </div>
        <div className="hidden md:block">
          <div className="text-xs text-slate-400">Collection</div>
          <div className="text-sm text-slate-700">{fmtPct(collectionRate)}</div>
        </div>
      </div>
    </div>
  );
}

function OccupancyEvent({ type, tenantName, unitLabel, buildingName, date }) {
  const isMoveIn = type === "in";
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className={[
        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        isMoveIn ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500",
      ].join(" ")}>
        {isMoveIn ? "↓" : "↑"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-slate-900 truncate">{tenantName}</span>
          <span className="shrink-0 text-xs text-slate-400">
            {date ? new Date(date).toLocaleDateString("fr-CH", { day: "numeric", month: "short" }) : "—"}
          </span>
        </div>
        <div className="text-xs text-slate-500 truncate">
          {isMoveIn ? "Moving in" : "Moving out"} · {unitLabel}{buildingName ? ` · ${buildingName}` : ""}
        </div>
      </div>
    </div>
  );
}

function RecommendationCard({ number, text }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-700">
          {number}
        </div>
        <p className="text-sm leading-relaxed text-slate-700">{text}</p>
      </div>
    </div>
  );
}

/* ─── Derive narrative from real data ────────────────────────── */

function buildDrivers(curr, prev) {
  const drivers = [];

  if (curr && prev) {
    const netDiff = curr.totalNetIncomeCents - prev.totalNetIncomeCents;
    const expDiff = curr.totalExpensesCents - prev.totalExpensesCents;
    const incDiff = curr.totalEarnedIncomeCents - prev.totalEarnedIncomeCents;

    if (Math.abs(netDiff) > 0) {
      drivers.push({
        title: netDiff >= 0 ? "Net income improved" : "Net income declined",
        body: netDiff >= 0
          ? `Portfolio net result rose by ${fmtChf(Math.abs(netDiff))} compared to the previous month.`
          : `Portfolio net result fell by ${fmtChf(Math.abs(netDiff))} compared to the previous month.`,
        impact: (netDiff >= 0 ? "+" : "") + fmtChf(netDiff),
      });
    }

    if (expDiff > 0) {
      drivers.push({
        title: "Maintenance and operating costs increased",
        body: `Total expenses rose by ${fmtChf(expDiff)} this month. Review the ledger for the largest contributors.`,
        impact: `+${fmtChf(expDiff)} costs`,
      });
    } else if (expDiff < 0) {
      drivers.push({
        title: "Operating costs came down",
        body: `Expenses reduced by ${fmtChf(Math.abs(expDiff))} vs the prior month.`,
        impact: `${fmtChf(expDiff)} savings`,
      });
    }
  }

  if (curr && curr.totalExpensesCents > 0 && drivers.length < 3) {
    drivers.push({
      title: "Maintenance spend is active",
      body: `${fmtChf(curr.totalExpensesCents)} in maintenance costs were logged this period across ${curr.buildingCount} building${curr.buildingCount !== 1 ? "s" : ""}.`,
      impact: fmtChf(curr.totalExpensesCents),
    });
  }

  if (!drivers.length) {
    drivers.push({
      title: "No significant movements this period",
      body: "No invoices were issued or paid in the selected month. Ledger activity will appear here once invoices are processed.",
      impact: "—",
    });
  }

  return drivers;
}

function buildInsights(curr, prev, moveIns, moveOuts) {
  const insights = [];
  if (!curr) return ["No data available for this period."];

  // Collection shortfall — structural framing, not a task
  if (curr.avgCollectionRate < 0.95 && curr.avgCollectionRate > 0) {
    const shortfall = 0.95 - curr.avgCollectionRate;
    insights.push(
      `Collection rate was ${fmtPct(curr.avgCollectionRate)}, leaving a ${fmtPct(shortfall)} gap against the 95% benchmark. ` +
      `Consider reviewing payment terms or tenant communication patterns to close this gap in future periods.`
    );
  }

  // Buildings in red — cost-structure framing
  if (curr.buildingsInRed > 0) {
    insights.push(
      `${curr.buildingsInRed} building${curr.buildingsInRed !== 1 ? "s" : ""} posted a net loss this period. ` +
      `Recurring maintenance charges may be compressing margins — review service contract costs before the next period.`
    );
  }

  // High payables relative to expenses — concentration risk, not a task
  if (
    curr.totalPayablesCents > 0 &&
    curr.totalExpensesCents > 0 &&
    curr.totalPayablesCents / curr.totalExpensesCents > 0.5
  ) {
    insights.push(
      `Accrued payables (${fmtChf(curr.totalPayablesCents)}) represent more than half of total period expenses — ` +
      `contractor cost concentration may warrant a cost review before the next budget cycle.`
    );
  }

  // Occupancy churn — forward-looking observation
  const totalChurn = (moveIns?.length ?? 0) + (moveOuts?.length ?? 0);
  if (totalChurn > 0) {
    insights.push(
      `${totalChurn} occupancy change${totalChurn !== 1 ? "s" : ""} recorded this period. ` +
      `Monitor the effect on collection continuity and vacancy costs in the following month.`
    );
  }

  // Month-over-month expense trend — structural observation
  if (prev && curr.totalExpensesCents > 0) {
    const ratio = prev.totalExpensesCents > 0
      ? curr.totalExpensesCents / prev.totalExpensesCents
      : null;
    if (ratio !== null && ratio > 1.3) {
      insights.push(
        `Expenses rose by ${fmtPct(ratio - 1)} compared to the prior month. If this reflects non-recurring work, ` +
        `no action is needed — if recurring, consider renegotiating maintenance contracts.`
      );
    }
  }

  if (!insights.length) {
    insights.push("Portfolio is performing within normal parameters this period. No structural anomalies detected.");
  }
  return insights;
}

/* ─── Main page ──────────────────────────────────────────────── */

export default function OwnerReportingPage() {
  const today = new Date();
  const [tlMode, setTlMode]   = useState("month");
  const [selYear, setSelYear]  = useState(today.getFullYear());
  const [selMonth, setSelMonth] = useState(today.getMonth());

  const [currData, setCurrData] = useState(null);
  const [prevData, setPrevData] = useState(null);
  const [loading, setLoading]   = useState(true);

  const [moveIns, setMoveIns]   = useState([]);
  const [moveOuts, setMoveOuts] = useState([]);

  const [insExpanded,   setInsExpanded]   = useState(false);
  const [outsExpanded,  setOutsExpanded]  = useState(false);
  const [propsExpanded, setPropsExpanded] = useState(false);

  const { from, to, prevFrom, prevTo } = useMemo(
    () => periodStrings(selYear, selMonth),
    [selYear, selMonth]
  );

  const fetchPeriod = useCallback(async (f, t) => {
    const res = await fetch(
      `/api/financials/portfolio-summary?from=${f}&to=${t}`,
      { headers: authHeaders() }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setCurrData(null);
    setPrevData(null);
    setMoveIns([]);
    setMoveOuts([]);
    setInsExpanded(false);
    setOutsExpanded(false);
    setPropsExpanded(false);

    const fetchLeases = async (params) => {
      const qs = new URLSearchParams(params).toString();
      const res = await fetch(`/api/leases?${qs}`, { headers: authHeaders() });
      if (!res.ok) return [];
      const json = await res.json();
      return json?.data ?? [];
    };

    Promise.all([
      fetchPeriod(from, to),
      fetchPeriod(prevFrom, prevTo),
      fetchLeases({ startDateFrom: from, startDateTo: to, limit: 50 }),
      fetchLeases({ endDateFrom: from, endDateTo: to, limit: 50 }),
    ]).then(([curr, prev, ins, outs]) => {
      if (!cancelled) {
        setCurrData(curr);
        setPrevData(prev);
        setMoveIns(ins);
        setMoveOuts(outs);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [from, to, prevFrom, prevTo, fetchPeriod]);

  // Derived values
  const netIncome     = currData?.totalNetIncomeCents ?? 0;
  const prevNet       = prevData?.totalNetIncomeCents ?? 0;
  const expenses      = currData?.totalExpensesCents ?? 0;
  const prevExpenses  = prevData?.totalExpensesCents ?? 0;
  const earned        = currData?.totalEarnedIncomeCents ?? 0;
  const prevEarned    = prevData?.totalEarnedIncomeCents ?? 0;
  const collRate      = currData?.avgCollectionRate ?? 0;
  const prevCollRate  = prevData?.avgCollectionRate ?? 0;
  const totalUnits    = currData?.totalActiveUnits ?? 0;

  const netDelta      = (currData && prevData) ? delta(netIncome, prevNet) : null;
  const expDelta      = (currData && prevData) ? delta(expenses, prevExpenses) : null;
  const earnedDelta   = (currData && prevData) ? delta(earned, prevEarned) : null;
  const collDelta     = (currData && prevData) ? delta(collRate, prevCollRate) : null;

  const drivers  = useMemo(() => buildDrivers(currData, prevData), [currData, prevData]);
  const insights = useMemo(() => buildInsights(currData, prevData, moveIns, moveOuts), [currData, prevData, moveIns, moveOuts]);

  // Highlight: pick best story
  const highlight = useMemo(() => {
    if (!currData) return null;
    if (currData.buildingsInRed === 0 && currData.buildingCount > 0) {
      return { title: "All properties in the green", body: `Every building in your portfolio posted a positive net result this ${MONTHS_FULL[selMonth]}.` };
    }
    if (collRate >= 0.95) {
      return { title: "Strong rent collection", body: `${fmtPct(collRate)} of projected rent was collected — well above the 95% benchmark.` };
    }
    if (netIncome > 0) {
      return { title: "Positive net result", body: `The portfolio generated ${fmtChf(netIncome)} net income in ${MONTHS_FULL[selMonth]} ${selYear}.` };
    }
    return null;
  }, [currData, selMonth, selYear, collRate, netIncome]);

  const periodLabel = `${MONTHS_FULL[selMonth]} ${selYear}`;

  return (
    <AppShell role="OWNER">
      {/* Timeline header — sticky */}
      <TimelineHeader
        year={selYear}
        month={selMonth}
        mode={tlMode}
        onSelect={(y, m) => { setSelYear(y); setSelMonth(m); }}
        onYearNav={(dir) => setSelYear((y) => y + dir)}
        onModeToggle={() => setTlMode((m) => (m === "month" ? "year" : "month"))}
      />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

        {/* ── HERO ─────────────────────────────────────────────── */}
        <header className="mb-6 rounded-3xl border border-slate-200 bg-gradient-to-br from-violet-50 via-sky-50 to-green-50 p-6 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <Badge variant="default" size="lg" className="mb-3">
                {periodLabel} · Monthly Owner Report
              </Badge>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                {loading ? "Loading your report…" : netIncome > 0
                  ? `Your portfolio had a ${currData?.buildingsInRed === 0 ? "strong" : "mixed"} month.`
                  : "Here's your portfolio summary."}
              </h1>
              {!loading && currData && (
                <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
                  {earned > 0
                    ? <>Rent collected: <span className="font-semibold text-slate-900">{fmtChf(earned)}</span>. </>
                    : ""}
                  {expenses > 0
                    ? <>Operating costs: <span className="font-semibold text-slate-900">{fmtChf(expenses)}</span>. </>
                    : ""}
                  {totalUnits > 0
                    ? <>{totalUnits} unit{totalUnits !== 1 ? "s" : ""} leased this period across {currData.buildingCount} building{currData.buildingCount !== 1 ? "s" : ""}.</>
                    : ""}
                </p>
              )}
            </div>

            <div className="grid min-w-[260px] grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs text-slate-400">Net result</div>
                {loading
                  ? <div className="mt-2 h-7 w-20 animate-pulse rounded bg-slate-100" />
                  : <div className="mt-2 text-2xl font-semibold text-slate-900">{fmtChf(netIncome)}</div>}
                {!loading && netDelta && (
                  <div className={cn("mt-1 text-xs", netDelta.tone)}>{netDelta.label}</div>
                )}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs text-slate-400">Accrued payables</div>
                {loading
                  ? <div className="mt-2 h-7 w-20 animate-pulse rounded bg-slate-100" />
                  : <div className="mt-2 text-2xl font-semibold text-slate-900">{fmtChf(currData?.totalPayablesCents ?? 0)}</div>}
                {!loading && (currData?.totalPayablesCents ?? 0) > 0 && (
                  <div className="mt-1 text-xs text-slate-400">Period-end balance</div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* ── KPI ROW ──────────────────────────────────────────── */}
        <section className="kpi-grid mb-8 gap-4 xl:grid-cols-4">
          <KpiCard label="Net Income"       value={fmtChf(netIncome)}     delta={netDelta}    isLoading={loading} />
          <KpiCard label="Rent Collected"   value={fmtChf(earned)}        delta={earnedDelta} isLoading={loading} />
          <KpiCard label="Total Expenses"   value={fmtChf(expenses)}      delta={expDelta}    isLoading={loading} />
          <KpiCard label="Collection Rate"  value={fmtPct(collRate)}      delta={collDelta}   isLoading={loading} />
        </section>

        {/* ── HIGHLIGHT ────────────────────────────────────────── */}
        {!loading && highlight && (
          <section className="mb-8">
            <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-green-50 via-white to-transparent p-6">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Highlight</div>
              <div className="mt-2 text-xl font-semibold text-slate-900">{highlight.title}</div>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">{highlight.body}</p>
            </div>
          </section>
        )}

        {/* ── PERFORMANCE DRIVERS ──────────────────────────────── */}
        <section className="mb-8">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">What drove performance</h2>
            <p className="text-sm text-slate-400">The main forces behind this month's numbers.</p>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1,2].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {drivers.map((d, i) => (
                <DriverCard key={i} number={i + 1} title={d.title} body={d.body} impact={d.impact} />
              ))}
            </div>
          )}
        </section>

        {/* ── PER-BUILDING BREAKDOWN ───────────────────────────── */}
        {!loading && currData && currData.buildings?.length > 0 && (() => {
          const activeBuildings = currData.buildings
            .filter((b) => b.expensesTotalCents > 0 || b.earnedIncomeCents > 0)
            .sort((a, b) => b.netIncomeCents - a.netIncomeCents);
          const visibleBuildings = propsExpanded ? activeBuildings : activeBuildings.slice(0, PREVIEW);
          return (
            <section className="mb-8">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-slate-900">By property</h2>
                <p className="text-sm text-slate-400">Net result per building for {periodLabel}.</p>
              </div>
              <div className="space-y-2">
                {visibleBuildings.map((b) => (
                  <BuildingRow
                    key={b.buildingId}
                    name={b.buildingName}
                    earned={b.earnedIncomeCents}
                    expenses={b.expensesTotalCents}
                    net={b.netIncomeCents}
                    collectionRate={b.collectionRate}
                  />
                ))}
                <ExpandToggle
                  expanded={propsExpanded}
                  total={activeBuildings.length}
                  onToggle={() => setPropsExpanded((x) => !x)}
                />
              </div>
            </section>
          );
        })()}

        {/* ── OCCUPANCY MOVEMENTS ──────────────────────────────── */}
        {!loading && (moveIns.length > 0 || moveOuts.length > 0) && (
          <section className="mb-8">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Tenant movements</h2>
              <p className="text-sm text-slate-400">Move-ins and move-outs in {periodLabel}.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Move-ins */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-xs font-semibold text-green-700">↓</span>
                  <span className="text-sm font-semibold text-slate-800">
                    Move-ins <span className="ml-1 text-slate-400 font-normal">({moveIns.length})</span>
                  </span>
                </div>
                {moveIns.length === 0 ? (
                  <p className="text-sm text-slate-400">No move-ins this period.</p>
                ) : (
                  <>
                    {(insExpanded ? moveIns : moveIns.slice(0, PREVIEW)).map((l) => (
                      <OccupancyEvent
                        key={l.id}
                        type="in"
                        tenantName={l.tenantName}
                        unitLabel={l.unit?.unitNumber || l.unitId?.slice(0, 8)}
                        buildingName={l.unit?.building?.name}
                        date={l.startDate}
                      />
                    ))}
                    <ExpandToggle
                      expanded={insExpanded}
                      total={moveIns.length}
                      onToggle={() => setInsExpanded((x) => !x)}
                    />
                  </>
                )}
              </div>
              {/* Move-outs */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">↑</span>
                  <span className="text-sm font-semibold text-slate-800">
                    Move-outs <span className="ml-1 text-slate-400 font-normal">({moveOuts.length})</span>
                  </span>
                </div>
                {moveOuts.length === 0 ? (
                  <p className="text-sm text-slate-400">No move-outs this period.</p>
                ) : (
                  <>
                    {(outsExpanded ? moveOuts : moveOuts.slice(0, PREVIEW)).map((l) => (
                      <OccupancyEvent
                        key={l.id}
                        type="out"
                        tenantName={l.tenantName}
                        unitLabel={l.unit?.unitNumber || l.unitId?.slice(0, 8)}
                        buildingName={l.unit?.building?.name}
                        date={l.endDate}
                      />
                    ))}
                    <ExpandToggle
                      expanded={outsExpanded}
                      total={moveOuts.length}
                      onToggle={() => setOutsExpanded((x) => !x)}
                    />
                  </>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── PERIOD INSIGHTS ──────────────────────────────────── */}
        <section className="mb-8">
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Period insights</h2>
              <p className="text-sm text-slate-400">What this period's data suggests for future planning.</p>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[1,2].map((i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-slate-100" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {insights.map((insight, i) => (
                  <RecommendationCard key={i} number={i + 1} text={insight} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── FOOTER ───────────────────────────────────────────── */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Full financial detail</h2>
              <p className="mt-1 text-sm text-slate-500">
                Drill into ledger entries, trial balance, and per-building financials in the Finance section.
              </p>
            </div>
            <div className="flex gap-3 shrink-0">
              <a
                href="/manager/finance"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors no-underline"
              >
                Finance overview
              </a>
              <a
                href="/manager/finance/ledger"
                className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors no-underline"
              >
                Open ledger
              </a>
            </div>
          </div>
        </section>

      </div>
    </AppShell>
  );
}
