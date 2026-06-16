import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import AppShell from "../../components/AppShell";
import Badge from "../../components/ui/Badge";
import { authHeaders } from "../../lib/api";

import { cn } from "../../lib/utils";
import { withTranslations } from "../../lib/i18n";
import { useTranslation } from "next-i18next";
/* ─── Constants ──────────────────────────────────────────────── */

const PREVIEW = 3; // rows shown before expand

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

function delta(curr, prev, t) {
  if (!Number.isFinite(curr) || !Number.isFinite(prev) || prev === 0) return null;
  const pct = ((curr - prev) / Math.abs(prev)) * 100;
  const sign = pct >= 0 ? "+" : "";
  const tone = pct >= 0 ? "text-green-600" : "text-red-500";
  const label = t
    ? t("reporting.text.vsPrevMonth", { delta: `${sign}${pct.toFixed(1)}` })
    : `${sign}${pct.toFixed(1)}% vs prev month`;
  return { label, tone };
}

/* ─── Shared expand toggle ───────────────────────────────────── */

function ExpandToggle({ expanded, total, onToggle }) {
  const { t } = useTranslation("owner");
  if (total <= PREVIEW) return null;
  return (
    <button
      onClick={onToggle}
      className="mt-3 w-full rounded-xl border border-surface-divider py-1.5 text-xs font-medium text-muted hover:bg-surface-subtle transition-colors"
    >
      {expanded
        ? t("reporting.text.showLess")
        : t("reporting.text.showMore", { count: total - PREVIEW })}
    </button>
  );
}

/* ─── Timeline header ────────────────────────────────────────── */

function TimelineHeader({ year, month, mode, onSelect, onYearNav, onModeToggle }) {
  const { t } = useTranslation("owner");
  const { locale } = useRouter();
  const scrollRef = useRef(null);

  // Auto-scroll selected month into view
  useEffect(() => {
    if (mode !== "month" || !scrollRef.current) return;
    const el = scrollRef.current.querySelector("[data-selected='true']");
    if (el) el.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
  }, [month, mode]);

  // Localized abbreviated month names
  const monthsShort = useMemo(() =>
    Array.from({ length: 12 }, (_, i) =>
      new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(2024, i, 1))
    ), [locale]);

  // Year range: show a 9-year window centred on selected year
  const yearRange = useMemo(() => {
    const start = Math.floor((year - 1) / 4) * 4 - 2;
    return Array.from({ length: 9 }, (_, i) => start + i);
  }, [year]);

  return (
    <div className="sticky top-0 z-10 bg-surface border-b border-surface-border shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 py-3">

          {/* Year nav / breadcrumb */}
          {mode === "month" ? (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onYearNav(-1)}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-surface-hover text-muted transition-colors text-sm"
                aria-label={t("reporting.ariaLabel.previousYear")}
              >
                ‹
              </button>
              <button
                onClick={onModeToggle}
                className="rounded-full px-3 py-1 text-sm font-semibold text-muted-dark hover:bg-surface-hover transition-colors tabular-nums"
              >
                {year}
              </button>
              <button
                onClick={() => onYearNav(1)}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-surface-hover text-muted transition-colors text-sm"
                aria-label={t("reporting.ariaLabel.nextYear")}
              >
                ›
              </button>
            </div>
          ) : (
            <button
              onClick={onModeToggle}
              className="shrink-0 rounded-full px-3 py-1 text-sm font-medium text-muted hover:bg-surface-hover transition-colors"
            >
              {t("reporting.text.backToMonths")}
            </button>
          )}

          <div className="w-px h-5 bg-surface-border shrink-0" />

          {/* Month strip or year grid */}
          <div
            ref={scrollRef}
            className="flex gap-1.5 overflow-x-auto scrollbar-none flex-1"
          >
            {mode === "month"
              ? monthsShort.map((m, i) => {
                  const isSelected = i === month;
                  const isFuture = new Date(year, i, 1) > new Date();
                  return (
                    <button
                      key={i}
                      data-selected={isSelected ? "true" : "false"}
                      disabled={isFuture}
                      onClick={() => onSelect(year, i)}
                      className={[
                        "shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors",
                        isSelected
                          ? "bg-slate-900 text-white"
                          : isFuture
                          ? "text-foreground-dim cursor-not-allowed"
                          : "text-muted-text hover:bg-surface-hover",
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
                          ? "text-foreground-dim cursor-not-allowed"
                          : "text-muted-text hover:bg-surface-hover",
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
    <div className="rounded-2xl border border-surface-border bg-surface p-5 shadow-sm">
      <div className="text-xs font-medium text-foreground-dim uppercase tracking-wide">{label}</div>
      {isLoading ? (
        <div className="mt-3 h-8 w-24 animate-pulse rounded bg-surface-hover" />
      ) : (
        <div className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{value}</div>
      )}
      {!isLoading && delta && (
        <div className={cn("mt-1.5 text-xs", delta.tone)}>{delta.label}</div>
      )}
    </div>
  );
}

function DriverCard({ number, title, body, impact }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-surface-border bg-surface p-5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-hover text-sm font-semibold text-muted-text">
        {number}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <span className="shrink-0 text-xs text-foreground-dim">{impact}</span>
        </div>
        <p className="mt-1.5 text-sm text-muted-text leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

function BuildingRow({ name, earned, expenses, net, collectionRate }) {
  const { t } = useTranslation("owner");
  const netPositive = net >= 0;
  return (
    <div className="flex items-center justify-between rounded-2xl border border-surface-border bg-surface-subtle px-4 py-3">
      <div className="text-sm font-medium text-foreground truncate mr-4">{name}</div>
      <div className="flex items-center gap-6 shrink-0 text-right">
        <div className="hidden sm:block">
          <div className="text-xs text-foreground-dim">{t("reporting.text.income")}</div>
          <div className="text-sm font-medium text-muted-dark">{fmtChf(earned)}</div>
        </div>
        <div className="hidden sm:block">
          <div className="text-xs text-foreground-dim">{t("reporting.text.expenses")}</div>
          <div className="text-sm font-medium text-muted-dark">{fmtChf(expenses)}</div>
        </div>
        <div>
          <div className="text-xs text-foreground-dim">{t("reporting.text.net")}</div>
          <div className={cn("text-sm font-semibold", netPositive ? "text-green-700" : "text-red-600")}>
            {fmtChf(net)}
          </div>
        </div>
        <div className="hidden md:block">
          <div className="text-xs text-foreground-dim">{t("reporting.text.collection")}</div>
          <div className="text-sm text-muted-dark">{fmtPct(collectionRate)}</div>
        </div>
      </div>
    </div>
  );
}

function OccupancyEvent({ type, tenantName, unitLabel, buildingName, date }) {
  const { t } = useTranslation("owner");
  const { locale } = useRouter();
  const isMoveIn = type === "in";
  return (
    <div className="flex items-start gap-3 py-3 border-b border-surface-divider last:border-0">
      <div className={[
        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        isMoveIn ? "bg-green-100 text-green-700" : "bg-surface-hover text-muted",
      ].join(" ")}>
        {isMoveIn ? "↓" : "↑"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-foreground truncate">{tenantName}</span>
          <span className="shrink-0 text-xs text-foreground-dim">
            {date ? new Date(date).toLocaleDateString(locale, { day: "numeric", month: "short" }) : "—"}
          </span>
        </div>
        <div className="text-xs text-muted truncate">
          {isMoveIn ? t("reporting.text.movingIn") : t("reporting.text.movingOut")} · {unitLabel}{buildingName ? ` · ${buildingName}` : ""}
        </div>
      </div>
    </div>
  );
}

function RecommendationCard({ number, text }) {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface-subtle p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-700">
          {number}
        </div>
        <p className="text-sm leading-relaxed text-muted-dark">{text}</p>
      </div>
    </div>
  );
}

/* ─── Derive narrative from real data ────────────────────────── */

function buildDrivers(curr, prev, t) {
  const drivers = [];

  if (curr && prev) {
    const netDiff = curr.totalNetIncomeCents - prev.totalNetIncomeCents;
    const expDiff = curr.totalExpensesCents - prev.totalExpensesCents;

    if (Math.abs(netDiff) > 0) {
      const key = netDiff >= 0 ? "netIncomeImproved" : "netIncomeDeclined";
      drivers.push({
        title: t(`reporting.driver.${key}.title`),
        body:  t(`reporting.driver.${key}.body`, { amount: fmtChf(Math.abs(netDiff)) }),
        impact: t(`reporting.driver.${key}.impact`, { amount: fmtChf(Math.abs(netDiff)) }),
      });
    }

    if (expDiff > 0) {
      drivers.push({
        title: t("reporting.driver.costsIncreased.title"),
        body:  t("reporting.driver.costsIncreased.body", { amount: fmtChf(expDiff) }),
        impact: t("reporting.driver.costsIncreased.impact", { amount: fmtChf(expDiff) }),
      });
    } else if (expDiff < 0) {
      drivers.push({
        title: t("reporting.driver.costsCameDown.title"),
        body:  t("reporting.driver.costsCameDown.body", { amount: fmtChf(Math.abs(expDiff)) }),
        impact: t("reporting.driver.costsCameDown.impact", { amount: fmtChf(Math.abs(expDiff)) }),
      });
    }
  }

  if (curr && curr.totalExpensesCents > 0 && drivers.length < 3) {
    drivers.push({
      title: t("reporting.driver.maintenanceSpend.title"),
      body: t(`reporting.driver.maintenanceSpend.body`, {
        count: curr.buildingCount,
        amount: fmtChf(curr.totalExpensesCents),
      }),
      impact: t("reporting.driver.maintenanceSpend.impact", { amount: fmtChf(curr.totalExpensesCents) }),
    });
  }

  if (!drivers.length) {
    drivers.push({
      title: t("reporting.driver.noMovements.title"),
      body:  t("reporting.driver.noMovements.body"),
      impact: t("reporting.driver.noMovements.impact"),
    });
  }

  return drivers;
}

function buildInsights(curr, prev, moveIns, moveOuts, t) {
  const insights = [];
  if (!curr) return [t("reporting.insight.noData")];

  if (curr.avgCollectionRate < 0.95 && curr.avgCollectionRate > 0) {
    const shortfall = 0.95 - curr.avgCollectionRate;
    insights.push(t("reporting.insight.collectionShortfall", {
      rate: fmtPct(curr.avgCollectionRate),
      gap: fmtPct(shortfall),
    }));
  }

  if (curr.buildingsInRed > 0) {
    insights.push(t("reporting.insight.buildingsInRed", { count: curr.buildingsInRed }));
  }

  if (
    curr.totalPayablesCents > 0 &&
    curr.totalExpensesCents > 0 &&
    curr.totalPayablesCents / curr.totalExpensesCents > 0.5
  ) {
    insights.push(t("reporting.insight.payablesConcentration", {
      amount: fmtChf(curr.totalPayablesCents),
    }));
  }

  const totalChurn = (moveIns?.length ?? 0) + (moveOuts?.length ?? 0);
  if (totalChurn > 0) {
    insights.push(t("reporting.insight.occupancyChurn", { count: totalChurn }));
  }

  if (prev && curr.totalExpensesCents > 0) {
    const ratio = prev.totalExpensesCents > 0
      ? curr.totalExpensesCents / prev.totalExpensesCents
      : null;
    if (ratio !== null && ratio > 1.3) {
      insights.push(t("reporting.insight.expenseTrend", { pct: fmtPct(ratio - 1) }));
    }
  }

  if (!insights.length) {
    insights.push(t("reporting.insight.normal"));
  }
  return insights;
}

/* ─── Main page ──────────────────────────────────────────────── */

export default function OwnerReportingPage() {
  const { t } = useTranslation("owner");
  const { locale } = useRouter();
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

  // Localized period label (e.g. "juin 2026" in French)
  const periodLabel = useMemo(() =>
    new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(selYear, selMonth, 1)),
    [locale, selYear, selMonth]
  );

  // Localized full month name for highlight body
  const monthFull = useMemo(() =>
    new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(selYear, selMonth, 1)),
    [locale, selYear, selMonth]
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
  // Outstanding rent invoices issued but not yet reconciled (receivables)
  const receivables   = currData?.totalReceivablesCents ?? 0;

  const netDelta      = (currData && prevData) ? delta(netIncome, prevNet, t) : null;
  const expDelta      = (currData && prevData) ? delta(expenses, prevExpenses, t) : null;
  const earnedDelta   = (currData && prevData) ? delta(earned, prevEarned, t) : null;
  const collDelta     = (currData && prevData) ? delta(collRate, prevCollRate, t) : null;

  const drivers  = useMemo(() => buildDrivers(currData, prevData, t), [currData, prevData, t]);
  const insights = useMemo(() => buildInsights(currData, prevData, moveIns, moveOuts, t), [currData, prevData, moveIns, moveOuts, t]);

  // Highlight: pick best story
  const highlight = useMemo(() => {
    if (!currData) return null;
    if (currData.buildingsInRed === 0 && currData.buildingCount > 0) {
      return {
        title: t("reporting.highlight.allGreen.title"),
        body: t("reporting.highlight.allGreen.body", { month: monthFull }),
      };
    }
    if (collRate >= 0.95) {
      return {
        title: t("reporting.highlight.strongCollection.title"),
        body: t("reporting.highlight.strongCollection.body", { rate: fmtPct(collRate) }),
      };
    }
    if (netIncome > 0) {
      return {
        title: t("reporting.highlight.positiveNet.title"),
        body: t("reporting.highlight.positiveNet.body", { amount: fmtChf(netIncome), month: monthFull, year: selYear }),
      };
    }
    return null;
  }, [currData, selYear, monthFull, collRate, netIncome, t]);

  const heroMessage = loading
    ? t("reporting.text.loadingReport")
    : netIncome > 0
      ? (currData?.buildingsInRed === 0 ? t("reporting.text.strongMonth") : t("reporting.text.mixedMonth"))
      : t("reporting.text.portfolioSummary");

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
        <header className="mb-6 rounded-3xl border border-surface-border bg-gradient-to-br from-violet-50 via-sky-50 to-green-50 dark:from-brand-light dark:via-info-light dark:to-transparent p-6 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <Badge variant="default" size="lg" className="mb-3">
                {periodLabel} · {t("reporting.text.monthlyReport")}
              </Badge>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {heroMessage}
              </h1>
              {!loading && currData && (
                <p className="mt-3 text-sm leading-6 text-muted-text sm:text-base">
                  {earned > 0
                    ? <>{t("reporting.text.rentCollected")} <span className="font-semibold text-foreground">{fmtChf(earned)}</span>. </>
                    : ""}
                  {expenses > 0
                    ? <>{t("reporting.text.operatingCosts")} <span className="font-semibold text-foreground">{fmtChf(expenses)}</span>. </>
                    : ""}
                  {totalUnits > 0
                    ? t("reporting.text.unitsLeased", { count: totalUnits, units: totalUnits, buildings: currData.buildingCount })
                    : ""}
                </p>
              )}
            </div>

            <div className="grid min-w-[260px] grid-cols-2 gap-3">
              <div className="rounded-2xl border border-surface-border bg-surface p-4">
                <div className="text-xs text-foreground-dim">{t("reporting.text.netResult")}</div>
                {loading
                  ? <div className="mt-2 h-7 w-20 animate-pulse rounded bg-surface-hover" />
                  : <div className="mt-2 text-2xl font-semibold text-foreground">{fmtChf(netIncome)}</div>}
                {!loading && netDelta && (
                  <div className={cn("mt-1 text-xs", netDelta.tone)}>{netDelta.label}</div>
                )}
              </div>
              <div className={cn(
                "rounded-2xl border p-4",
                !loading && receivables > 0
                  ? "border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800"
                  : "border-surface-border bg-surface"
              )}>
                <div className={cn("text-xs", !loading && receivables > 0 ? "text-amber-700 dark:text-amber-400" : "text-foreground-dim")}>
                  Rent outstanding
                </div>
                {loading
                  ? <div className="mt-2 h-7 w-20 animate-pulse rounded bg-surface-hover" />
                  : <div className={cn("mt-2 text-2xl font-semibold", receivables > 0 ? "text-amber-700 dark:text-amber-400" : "text-foreground")}>{fmtChf(receivables)}</div>}
                {!loading && receivables > 0 && (
                  <div className="mt-1 text-xs text-amber-600 dark:text-amber-500">Invoiced, not yet paid</div>
                )}
                {!loading && receivables === 0 && (
                  <div className="mt-1 text-xs text-foreground-dim">All rents cleared</div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* ── KPI ROW ──────────────────────────────────────────── */}
        <section className="kpi-grid mb-4 gap-4 xl:grid-cols-4">
          <KpiCard label={t("reporting.prop.netIncome")}       value={fmtChf(netIncome)}     delta={netDelta}    isLoading={loading} />
          <KpiCard label={t("reporting.prop.rentCollected")}   value={fmtChf(earned)}        delta={earnedDelta} isLoading={loading} />
          <KpiCard label={t("reporting.prop.totalExpenses")}   value={fmtChf(expenses)}      delta={expDelta}    isLoading={loading} />
          <KpiCard label={t("reporting.prop.collectionRate")}  value={fmtPct(collRate)}      delta={collDelta}   isLoading={loading} />
        </section>

        {/* ── OUTSTANDING RECEIVABLES ALERT ────────────────────── */}
        {!loading && receivables > 0 && (
          <section className="mb-8">
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 px-5 py-4">
              <span className="mt-0.5 text-amber-500 text-lg shrink-0">⚠</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-0.5">
                  {fmtChf(receivables)} in rent invoices not yet reconciled
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Rent invoices have been sent to tenants but no payment has been recorded in the system.
                  Once the rent arrives in your bank, open the invoice in Finance → Outgoing and click <strong>Mark Paid</strong> to update the ledger and unlock income reporting.
                </p>
              </div>
              <a
                href="/manager/finance/invoices"
                className="shrink-0 rounded-lg bg-amber-600 hover:bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors no-underline"
              >
                Go to invoices →
              </a>
            </div>
          </section>
        )}

        {/* ── HIGHLIGHT ────────────────────────────────────────── */}
        {!loading && highlight && (
          <section className="mb-8">
            <div className="rounded-3xl border border-surface-border bg-gradient-to-r from-green-50 via-white to-transparent dark:from-success-light dark:via-transparent p-6">
              <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("reporting.text.highlight")}</div>
              <div className="mt-2 text-xl font-semibold text-foreground">{highlight.title}</div>
              <p className="mt-2 max-w-2xl text-sm text-muted-text">{highlight.body}</p>
            </div>
          </section>
        )}

        {/* ── PERFORMANCE DRIVERS ──────────────────────────────── */}
        <section className="mb-8">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-foreground">{t("reporting.heading.whatDrovePerformance")}</h2>
            <p className="text-sm text-foreground-dim">{t("reporting.text.theMainForcesBehindThisMonthsNumbers")}</p>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1,2].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface-hover" />
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
                <h2 className="text-lg font-semibold text-foreground">{t("reporting.heading.byProperty")}</h2>
                <p className="text-sm text-foreground-dim">{t("reporting.text.netResultForPeriod", { period: periodLabel })}</p>
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
              <h2 className="text-lg font-semibold text-foreground">{t("reporting.heading.tenantMovements")}</h2>
              <p className="text-sm text-foreground-dim">{t("reporting.text.moveInsAndMoveoutsIn", { period: periodLabel })}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Move-ins */}
              <div className="rounded-2xl border border-surface-border bg-surface p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-xs font-semibold text-green-700">↓</span>
                  <span className="text-sm font-semibold text-foreground">
                    {t("reporting.text.moveIns")} <span className="ml-1 text-foreground-dim font-normal">({moveIns.length})</span>
                  </span>
                </div>
                {moveIns.length === 0 ? (
                  <p className="text-sm text-foreground-dim">{t("reporting.text.noMoveinsThisPeriod")}</p>
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
              <div className="rounded-2xl border border-surface-border bg-surface p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-hover text-xs font-semibold text-muted">↑</span>
                  <span className="text-sm font-semibold text-foreground">
                    {t("reporting.text.moveOuts")} <span className="ml-1 text-foreground-dim font-normal">({moveOuts.length})</span>
                  </span>
                </div>
                {moveOuts.length === 0 ? (
                  <p className="text-sm text-foreground-dim">{t("reporting.text.noMoveoutsThisPeriod")}</p>
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
          <div className="rounded-3xl border border-surface-border bg-surface p-5">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-foreground">{t("reporting.heading.periodInsights")}</h2>
              <p className="text-sm text-foreground-dim">{t("reporting.text.whatThisPeriodsDataSuggestsForFuturePlanning")}</p>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[1,2].map((i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-surface-hover" />)}
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
        <section className="rounded-3xl border border-surface-border bg-surface p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">{t("reporting.heading.fullFinancialDetail")}</h2>
              <p className="mt-1 text-sm text-muted">
                {t("reporting.text.financeDetail")}
              </p>
            </div>
            <div className="flex gap-3 shrink-0">
              <a
                href="/manager/finance"
                className="rounded-2xl border border-surface-border bg-surface px-4 py-2 text-sm font-medium text-muted-dark hover:bg-surface-subtle transition-colors no-underline"
              >
                {t("reporting.cta.financeOverview")}
              </a>
              <a
                href="/manager/finance/ledger"
                className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors no-underline"
              >
                {t("reporting.cta.openLedger")}
              </a>
            </div>
          </div>
        </section>

      </div>
    </AppShell>
  );
}

export const getStaticProps = withTranslations(["common","owner"]);
