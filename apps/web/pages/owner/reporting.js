import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import AppShell from "../../components/AppShell";
import Badge from "../../components/ui/Badge";
import { authHeaders } from "../../lib/api";

import { cn } from "../../lib/utils";
import { withTranslations } from "../../lib/i18n";
import { useTranslation } from "next-i18next";
/* ─── Constants ──────────────────────────────────────────────── */

const PREVIEW = 3;

// One gradient per calendar month (0 = Jan … 11 = Dec).
// All stops use Tailwind's *-50 palette (~96-98 % lightness) so that
// foreground text (#111827 / gray-900) achieves ≥ 12:1 contrast and
// muted text (~#6B7280 / gray-500) achieves ≥ 4.5:1 — both WCAG AA.
const MONTH_HERO_GRADIENTS = [
  "from-slate-50  via-blue-50   to-cyan-50",    // Jan — cold, crisp
  "from-rose-50   via-pink-50   to-fuchsia-50", // Feb — soft warmth
  "from-emerald-50 via-green-50 to-teal-50",    // Mar — spring
  "from-green-50  via-lime-50   to-yellow-50",  // Apr — fresh growth
  "from-pink-50   via-rose-50   to-orange-50",  // May — blossom
  "from-sky-50    via-blue-50   to-indigo-50",  // Jun — summer sky
  "from-yellow-50 via-amber-50  to-orange-50",  // Jul — peak heat
  "from-amber-50  via-yellow-50 to-lime-50",    // Aug — late summer
  "from-orange-50 via-amber-50  to-red-50",     // Sep — early autumn
  "from-red-50    via-orange-50 to-amber-50",   // Oct — deep autumn
  "from-stone-50  via-gray-50   to-slate-50",   // Nov — bare, neutral
  "from-indigo-50 via-blue-50   to-violet-50",  // Dec — winter night
];

function lastDayOfMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function periodStrings(year, month) {
  const m = String(month + 1).padStart(2, "0");
  const last = lastDayOfMonth(year, month);
  const from = `${year}-${m}-01`;
  const to   = `${year}-${m}-${last}`;
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

function ExpandToggle({ expanded, total, onToggle, label }) {
  const { t } = useTranslation("owner");
  if (total <= PREVIEW) return null;
  return (
    <button
      onClick={onToggle}
      className="mt-3 w-full rounded-xl border border-surface-divider py-1.5 text-xs font-medium text-muted hover:bg-surface-subtle transition-colors"
    >
      {expanded
        ? (label?.less ?? t("reporting.text.showLess"))
        : (label?.more ?? t("reporting.text.showMore", { count: total - PREVIEW }))}
    </button>
  );
}

/* ─── Timeline header ────────────────────────────────────────── */

function TimelineHeader({ year, month, mode, onSelect, onYearNav, onModeToggle, ytdActive, onYtdToggle }) {
  const { t } = useTranslation("owner");
  const { locale } = useRouter();
  const scrollRef = useRef(null);

  useEffect(() => {
    if (mode !== "month" || !scrollRef.current) return;
    const el = scrollRef.current.querySelector("[data-selected='true']");
    if (el) el.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
  }, [month, mode]);

  const monthsShort = useMemo(() =>
    Array.from({ length: 12 }, (_, i) =>
      new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(2024, i, 1))
    ), [locale]);

  const yearRange = useMemo(() => {
    const start = Math.floor((year - 1) / 4) * 4 - 2;
    return Array.from({ length: 9 }, (_, i) => start + i);
  }, [year]);

  return (
    <div className="sticky top-0 z-10 bg-surface border-b border-surface-border shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 py-3">

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

          <button
            onClick={onYtdToggle}
            className={[
              "shrink-0 rounded-full px-3 py-1 text-sm font-semibold transition-colors",
              ytdActive
                ? "bg-violet-600 text-white"
                : "text-muted-text hover:bg-surface-hover",
            ].join(" ")}
          >
            YTD
          </button>

          <div className="w-px h-5 bg-surface-border shrink-0" />

          <div
            ref={scrollRef}
            className="flex gap-1.5 overflow-x-auto scrollbar-none flex-1"
          >
            {mode === "month"
              ? monthsShort.map((m, i) => {
                  const isSelected = i === month && !ytdActive;
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

function DriverItem({ number, title, body, impact }) {
  return (
    <div className="flex gap-4 py-4 border-b border-surface-divider last:border-0 last:pb-0 first:pt-0">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-700">
        {number}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <span className="text-sm font-semibold text-foreground leading-snug">{title}</span>
          {impact && <span className="shrink-0 text-xs text-foreground-dim whitespace-nowrap">{impact}</span>}
        </div>
        <p className="mt-1.5 text-sm text-muted-text leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

function WatchItem({ number, text, severity, action }) {
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
          <a
            href={action.href}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors no-underline"
          >
            {action.label} →
          </a>
        )}
      </div>
    </div>
  );
}

function BuildingRow({ name, earned, expenses, net, collectionRate, occupancy }) {
  const { t } = useTranslation("owner");
  const netPositive = net >= 0;
  return (
    <div className="flex items-center justify-between rounded-2xl border border-surface-border bg-surface-subtle px-4 py-3">
      <div className="text-sm font-medium text-foreground truncate mr-4">{name}</div>
      <div className="flex items-center gap-5 shrink-0 text-right">
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
        {occupancy !== null && (
          <div className="hidden lg:block">
            <div className="text-xs text-foreground-dim">Occupancy</div>
            <div className={cn("text-sm font-medium", occupancy < 0.9 ? "text-amber-600" : "text-muted-dark")}>
              {fmtPct(occupancy)}
            </div>
          </div>
        )}
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

/* ─── Narrative builders ─────────────────────────────────────── */

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
      body: t("reporting.driver.maintenanceSpend.body", {
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
      impact: "",
    });
  }

  return drivers;
}

function buildWatchItems(curr, prev, moveIns, moveOuts, { arrears, occupancyRate, allUnits, totalUnits, incomeVariance, projected, receivables, activeBuildings } = {}) {
  const items = [];

  // Arrears 61+ days — highest severity
  if (arrears?.overdue61plusCents > 0) {
    items.push({
      text: `${fmtChf(arrears.overdue61plusCents)} in rent is over 60 days overdue — consider initiating a formal debt collection notice.`,
      severity: "red",
      action: { label: "View overdue invoices", href: "/manager/finance/invoices" },
    });
  }

  // Arrears 31–60 days
  if (arrears?.overdue31to60Cents > 0) {
    items.push({
      text: `${fmtChf(arrears.overdue31to60Cents)} in rent is 31–60 days overdue. Send a formal payment reminder to the tenants concerned.`,
      severity: "amber",
      action: { label: "View overdue invoices", href: "/manager/finance/invoices" },
    });
  }

  // Collection rate below threshold
  if (curr?.avgCollectionRate < 0.95 && curr?.avgCollectionRate > 0) {
    const shortfall = 0.95 - curr.avgCollectionRate;
    items.push({
      text: `Collection rate is ${fmtPct(curr.avgCollectionRate)}, ${fmtPct(shortfall)} below the 95% target.`,
      severity: "amber",
      action: { label: "View unpaid invoices", href: "/manager/finance/invoices" },
    });
  }

  // Vacancy
  if (occupancyRate !== null && occupancyRate < 0.9 && allUnits > 0) {
    const vacantCount = allUnits - totalUnits;
    items.push({
      text: `${vacantCount} of ${allUnits} units are currently vacant (${fmtPct(occupancyRate)} occupancy). Each empty unit represents forgone rental income.`,
      severity: "amber",
    });
  }

  // Income below projection — precise cause derived from receivables vs gap
  if (incomeVariance !== null && projected > 0 && incomeVariance < -(projected * 0.05)) {
    const gap = Math.abs(incomeVariance);
    const awaitingPayment = Math.min(receivables ?? 0, gap);
    const uninvoiced = gap - awaitingPayment;
    let text;
    if (uninvoiced <= 0) {
      text = `${fmtChf(gap)} in rent invoices for this period are awaiting payment — all expected income has been invoiced but not yet marked paid.`;
    } else if (awaitingPayment > 0) {
      text = `${fmtChf(awaitingPayment)} awaiting payment; ${fmtChf(uninvoiced)} in expected rent was not invoiced this period (likely a mid-month move-in).`;
    } else {
      text = `${fmtChf(gap)} in expected rent was not invoiced this period.`;
    }
    items.push({
      text,
      severity: "amber",
      action: { label: "View unpaid invoices", href: "/manager/finance/invoices" },
    });
  }

  // Buildings in red — computed from the visible activeBuildings array so count always matches the table
  const buildingsInRedList = (activeBuildings ?? []).filter((b) => b.netIncomeCents < 0);
  if (buildingsInRedList.length > 0) {
    const names = buildingsInRedList.map((b) => b.buildingName).join(", ");
    const verb = buildingsInRedList.length === 1 ? "is" : "are";
    items.push({
      text: `${names} ${verb} running at a net loss this period.`,
      severity: "red",
      action: { label: "View finance overview", href: "/manager/finance" },
    });
  }

  // Payables concentration
  if (
    curr?.totalPayablesCents > 0 &&
    curr?.totalExpensesCents > 0 &&
    curr.totalPayablesCents / curr.totalExpensesCents > 0.5
  ) {
    items.push({
      text: `${fmtChf(curr.totalPayablesCents)} in contractor invoices remain unpaid — more than half of this period's expense spend.`,
      severity: "amber",
      action: { label: "View unpaid invoices", href: "/manager/finance/invoices" },
    });
  }

  // Expense spike vs prior period
  if (prev && curr?.totalExpensesCents > 0) {
    const ratio = prev.totalExpensesCents > 0
      ? curr.totalExpensesCents / prev.totalExpensesCents
      : null;
    if (ratio !== null && ratio > 1.3) {
      items.push({
        text: `Operating costs are ${fmtPct(ratio - 1)} higher than last period — review the expense breakdown to identify the driver.`,
        severity: "amber",
        action: { label: "View expenses", href: "/manager/finance/expenses" },
      });
    }
  }

  // Tenant churn
  const totalChurn = (moveIns?.length ?? 0) + (moveOuts?.length ?? 0);
  if (totalChurn > 0) {
    items.push({
      text: `${totalChurn} tenant ${totalChurn === 1 ? "movement" : "movements"} this period — check for any gap between a move-out and the next lease start to minimise vacancy loss.`,
      severity: "violet",
    });
  }

  return items;
}

/* ─── Main page ──────────────────────────────────────────────── */

export default function OwnerReportingPage() {
  const { t } = useTranslation("owner");
  const { locale } = useRouter();
  const today = new Date();
  const [tlMode, setTlMode]   = useState("month");
  const [selYear, setSelYear]  = useState(today.getFullYear());
  const [selMonth, setSelMonth] = useState(today.getMonth());
  const [ytdMode, setYtdMode]  = useState(false);

  const [currData, setCurrData] = useState(null);
  const [prevData, setPrevData] = useState(null);
  const [loading, setLoading]   = useState(true);

  const [moveIns, setMoveIns]   = useState([]);
  const [moveOuts, setMoveOuts] = useState([]);

  const [insExpanded,   setInsExpanded]   = useState(false);
  const [outsExpanded,  setOutsExpanded]  = useState(false);
  const [propsExpanded, setPropsExpanded] = useState(false);

  const { from, to, prevFrom, prevTo } = useMemo(() => {
    if (ytdMode) {
      const y = selYear;
      const m = String(today.getMonth() + 1).padStart(2, "0");
      const d = String(today.getDate()).padStart(2, "0");
      return {
        from: `${y}-01-01`,
        to: `${y}-${m}-${d}`,
        prevFrom: `${y - 1}-01-01`,
        prevTo: `${y - 1}-${m}-${d}`,
      };
    }
    return periodStrings(selYear, selMonth);
  }, [selYear, selMonth, ytdMode]);

  const periodLabel = useMemo(() => {
    if (ytdMode) return `YTD ${selYear}`;
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(selYear, selMonth, 1));
  }, [locale, selYear, selMonth, ytdMode]);

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

  // Core values
  const netIncome   = currData?.totalNetIncomeCents ?? 0;
  const prevNet     = prevData?.totalNetIncomeCents ?? 0;
  const noi         = currData?.totalNetOperatingIncomeCents ?? 0;
  const prevNoi     = prevData?.totalNetOperatingIncomeCents ?? 0;
  const expenses    = currData?.totalExpensesCents ?? 0;
  const prevExpenses = prevData?.totalExpensesCents ?? 0;
  const earned      = currData?.totalEarnedIncomeCents ?? 0;
  const prevEarned  = prevData?.totalEarnedIncomeCents ?? 0;
  const projected   = currData?.totalProjectedIncomeCents ?? 0;
  const operating   = currData?.totalOperatingCents ?? 0;
  const collRate    = currData?.avgCollectionRate ?? 0;
  const prevCollRate = prevData?.avgCollectionRate ?? 0;
  const totalUnits  = currData?.totalActiveUnits ?? 0;
  const allUnits    = currData?.totalUnits ?? 0;
  const receivables = currData?.totalReceivablesCents ?? 0;
  const arrears     = currData?.arrears ?? null;

  // Derived ratios
  const occupancyRate  = allUnits > 0 ? totalUnits / allUnits : null;
  const opexRatio      = earned > 0 ? operating / earned : null;
  const noiMargin      = earned > 0 ? noi / earned : null;
  const incomeVariance = projected > 0 ? earned - projected : null;

  // Deltas vs prior period
  const noiDelta    = (currData && prevData) ? delta(noi, prevNoi, t) : null;
  const expDelta    = (currData && prevData) ? delta(expenses, prevExpenses, t) : null;
  const earnedDelta = (currData && prevData) ? delta(earned, prevEarned, t) : null;
  const collDelta   = (currData && prevData) ? delta(collRate, prevCollRate, t) : null;
  const netDelta    = (currData && prevData) ? delta(netIncome, prevNet, t) : null;

  const drivers = useMemo(
    () => buildDrivers(currData, prevData, t),
    [currData, prevData, t]
  );

  // By-property list — sorted by net income desc, auto-collapsed when > 3
  const activeBuildings = useMemo(() => {
    if (!currData?.buildings) return [];
    return currData.buildings
      .filter((b) => b.expensesTotalCents > 0 || b.earnedIncomeCents > 0)
      .sort((a, b) => b.netIncomeCents - a.netIncomeCents);
  }, [currData]);

  const watchItems = useMemo(
    () => buildWatchItems(currData, prevData, moveIns, moveOuts, {
      arrears, occupancyRate, allUnits, totalUnits, incomeVariance, projected,
      receivables, activeBuildings,
    }),
    [currData, prevData, moveIns, moveOuts, arrears, occupancyRate, allUnits, totalUnits, incomeVariance, projected, receivables, activeBuildings]
  );

  // Auto-expand when ≤ 3 buildings
  const autoExpanded = activeBuildings.length <= 3;
  const visibleBuildings = (propsExpanded || autoExpanded)
    ? activeBuildings
    : activeBuildings.slice(0, PREVIEW);

  const heroMessage = loading
    ? t("reporting.text.loadingReport")
    : netIncome > 0
      ? (activeBuildings.every((b) => b.netIncomeCents >= 0) ? t("reporting.text.strongMonth") : t("reporting.text.mixedMonth"))
      : t("reporting.text.portfolioSummary");

  return (
    <AppShell role="OWNER">
      <TimelineHeader
        year={selYear}
        month={selMonth}
        mode={tlMode}
        onSelect={(y, m) => { setSelYear(y); setSelMonth(m); setYtdMode(false); }}
        onYearNav={(dir) => setSelYear((y) => y + dir)}
        onModeToggle={() => setTlMode((m) => (m === "month" ? "year" : "month"))}
        ytdActive={ytdMode}
        onYtdToggle={() => setYtdMode((v) => !v)}
      />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

        {/* ── HERO ─────────────────────────────────────────────── */}
        <header className={cn(
          "mb-6 rounded-3xl border border-surface-border bg-gradient-to-br p-6 shadow-sm",
          "dark:from-brand-light dark:via-info-light dark:to-transparent",
          ytdMode ? "from-violet-50 via-sky-50 to-green-50" : MONTH_HERO_GRADIENTS[selMonth]
        )}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <Badge variant="default" size="lg" className="mb-3 bg-transparent border-black/20 dark:border-white/20 text-foreground/70">
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
                    ? t("reporting.text.unitsLeased", { count: totalUnits, units: totalUnits, allUnits, buildings: activeBuildings.length })
                    : ""}
                </p>
              )}
            </div>

            <div className="grid min-w-[260px] grid-cols-2 gap-3">
              {/* Net result — transparent so gradient shows through, black stroke */}
              <div className="rounded-2xl border border-black/20 dark:border-white/20 bg-transparent p-4">
                <div className="text-xs font-medium text-foreground/60">{t("reporting.text.netResult")}</div>
                {loading
                  ? <div className="mt-2 h-7 w-20 animate-pulse rounded bg-black/10" />
                  : <div className="mt-2 text-2xl font-semibold text-foreground">{fmtChf(netIncome)}</div>}
                {!loading && netDelta && (
                  <div className={cn("mt-1 text-xs", netDelta.tone)}>{netDelta.label}</div>
                )}
              </div>
              {/* Rent outstanding — amber tint when overdue, transparent otherwise */}
              <div className={cn(
                "rounded-2xl border p-4",
                !loading && receivables > 0
                  ? "border-amber-500/40 bg-amber-400/20 dark:border-amber-700/50 dark:bg-amber-900/20"
                  : "border-black/20 dark:border-white/20 bg-transparent"
              )}>
                <div className={cn("text-xs font-medium", !loading && receivables > 0 ? "text-amber-800 dark:text-amber-400" : "text-foreground/60")}>
                  Rent outstanding
                </div>
                {loading
                  ? <div className="mt-2 h-7 w-20 animate-pulse rounded bg-black/10" />
                  : <div className={cn("mt-2 text-2xl font-semibold", receivables > 0 ? "text-amber-800 dark:text-amber-400" : "text-foreground")}>{fmtChf(receivables)}</div>}
                {!loading && receivables > 0 && (
                  <div className="mt-1 text-xs text-amber-700 dark:text-amber-500">Invoiced, not yet paid</div>
                )}
                {!loading && receivables === 0 && (
                  <div className="mt-1 text-xs text-foreground/50">All rents cleared</div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* ── KPI ROW 1 ────────────────────────────────────────── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 mb-2 gap-4">
          <KpiCard label="NOI"                                 value={fmtChf(noi)}      delta={noiDelta}    isLoading={loading} />
          <KpiCard label={t("reporting.prop.rentCollected")}  value={fmtChf(earned)}   delta={earnedDelta} isLoading={loading} />
          <KpiCard label={t("reporting.prop.totalExpenses")}  value={fmtChf(expenses)} delta={expDelta}    isLoading={loading} />
          <KpiCard label={t("reporting.prop.collectionRate")} value={fmtPct(collRate)} delta={collDelta}   isLoading={loading} />
        </section>

        {/* ── KPI ROW 2 ────────────────────────────────────────── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 mb-6 gap-4">
          <KpiCard
            label="NOI margin"
            value={!loading && noiMargin !== null ? fmtPct(noiMargin) : "—"}
            isLoading={loading}
          />
          <KpiCard
            label="OpEx ratio"
            value={!loading && opexRatio !== null ? fmtPct(opexRatio) : "—"}
            isLoading={loading}
          />
          <KpiCard
            label="Occupancy"
            value={!loading && occupancyRate !== null ? fmtPct(occupancyRate) : "—"}
            isLoading={loading}
          />
          <KpiCard
            label="Rent vs projected"
            value={!loading && incomeVariance !== null
              ? (incomeVariance >= 0 ? `+${fmtChf(incomeVariance)}` : fmtChf(incomeVariance))
              : "—"}
            isLoading={loading}
          />
        </section>

        {/* ── ALERTS (receivables + arrears aging) ─────────────── */}
        {!loading && receivables > 0 && (
          <section className="mb-4">
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 px-5 py-4">
              <span className="mt-0.5 text-amber-500 text-lg shrink-0">⚠</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-0.5">
                  {fmtChf(receivables)} in rent invoices not yet reconciled
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Rent invoices have been sent to tenants but no payment has been recorded.
                  Once the rent arrives in your bank, open the invoice in Finance → Outgoing and click <strong>Mark Paid</strong>.
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

        {!loading && arrears && (arrears.totalOverdueCents > 0 || arrears.currentCents > 0) && (
          <section className="mb-6">
            <div className="rounded-2xl border border-surface-border bg-surface p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Rent arrears aging</h2>
                  <p className="text-xs text-foreground-dim mt-0.5">Unpaid outgoing invoices by days overdue</p>
                </div>
                {arrears.totalOverdueCents > 0 && (
                  <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                    {fmtChf(arrears.totalOverdueCents)} overdue
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Current",    cents: arrears.currentCents,        color: "text-green-700",  bg: "bg-green-50 border-green-200" },
                  { label: "1–30 days",  cents: arrears.overdue1to30Cents,   color: "text-amber-700",  bg: "bg-amber-50 border-amber-200" },
                  { label: "31–60 days", cents: arrears.overdue31to60Cents,  color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
                  { label: "61+ days",   cents: arrears.overdue61plusCents,  color: "text-red-700",    bg: "bg-red-50 border-red-200" },
                ].map(({ label, cents, color, bg }) => (
                  <div key={label} className={cn("rounded-xl border p-4", cents > 0 ? bg : "border-surface-border bg-surface-subtle")}>
                    <div className="text-xs text-foreground-dim">{label}</div>
                    <div className={cn("mt-2 text-lg font-semibold", cents > 0 ? color : "text-foreground-dim")}>
                      {cents > 0 ? fmtChf(cents) : "—"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── PERFORMANCE ANALYSIS — merged drivers + watch ────── */}
        <section className="mb-6">
          <div className="rounded-3xl border border-surface-border bg-surface overflow-hidden">
            <div className="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-surface-border">

              {/* Left — What drove it */}
              <div className="flex flex-col">
                <div className="px-7 py-4 bg-green-50 dark:bg-green-950/20 border-b border-green-100 dark:border-green-900">
                  <div className="flex items-center gap-2.5 mb-0.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 dark:bg-green-900 text-xs font-bold text-green-700 dark:text-green-400">↑</div>
                    <h2 className="text-sm font-semibold text-green-900 dark:text-green-200">{t("reporting.heading.whatDrovePerformance")}</h2>
                  </div>
                  <p className="text-xs text-green-700/70 dark:text-green-400/70 ml-[34px]">{t("reporting.text.theMainForcesBehindThisMonthsNumbers")}</p>
                </div>
                <div className="px-7 py-5 flex-1">
                  {loading ? (
                    <div className="space-y-4">
                      {[1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-hover" />)}
                    </div>
                  ) : (
                    <div>
                      {drivers.map((d, i) => (
                        <DriverItem key={i} number={i + 1} title={d.title} body={d.body} impact={d.impact} />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right — What to watch */}
              <div className="flex flex-col">
                <div className="px-7 py-4 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-100 dark:border-amber-900">
                  <div className="flex items-center gap-2.5 mb-0.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900 text-xs font-bold text-amber-700 dark:text-amber-400">!</div>
                    <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">What to watch</h2>
                  </div>
                  <p className="text-xs text-amber-700/70 dark:text-amber-400/70 ml-[34px]">Flags and action items for this period</p>
                </div>
                <div className="px-7 py-5 flex-1">
                  {loading ? (
                    <div className="space-y-4">
                      {[1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-hover" />)}
                    </div>
                  ) : watchItems.length > 0 ? (
                    <div>
                      {watchItems.map((item, i) => (
                        <WatchItem key={i} number={i + 1} text={item.text} severity={item.severity} action={item.action} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-start gap-4 pt-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">✓</div>
                      <p className="text-sm text-muted-text leading-relaxed self-center">
                        No flags this period — collection on track, occupancy healthy, no overdue invoices.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── PER-BUILDING BREAKDOWN ───────────────────────────── */}
        {!loading && activeBuildings.length > 0 && (
          <section className="mb-6">
            <div className="rounded-3xl border border-surface-border bg-surface p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground">{t("reporting.heading.byProperty")}</h2>
                  <p className="text-xs text-foreground-dim mt-0.5">{t("reporting.text.netResultForPeriod", { period: periodLabel })}</p>
                </div>
                {!autoExpanded && (
                  <button
                    onClick={() => setPropsExpanded((x) => !x)}
                    className="text-xs font-medium text-muted-dark hover:text-foreground transition-colors"
                  >
                    {propsExpanded ? "Collapse ↑" : `Show all ${activeBuildings.length} ↓`}
                  </button>
                )}
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
                    occupancy={b.totalUnitsCount > 0 ? b.activeUnitsCount / b.totalUnitsCount : null}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── OCCUPANCY MOVEMENTS ──────────────────────────────── */}
        {!loading && (moveIns.length > 0 || moveOuts.length > 0) && (
          <section className="mb-6">
            <div className="rounded-3xl border border-surface-border bg-surface p-5">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-foreground">{t("reporting.heading.tenantMovements")}</h2>
                <p className="text-xs text-foreground-dim mt-0.5">{t("reporting.text.moveInsAndMoveoutsIn", { period: periodLabel })}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-xs font-semibold text-green-700">↓</span>
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
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-hover text-xs font-semibold text-muted">↑</span>
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
            </div>
          </section>
        )}

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
