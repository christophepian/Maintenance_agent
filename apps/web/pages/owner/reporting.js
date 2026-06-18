import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import AppShell from "../../components/AppShell";
import Badge from "../../components/ui/Badge";
import ScrollableTabs from "../../components/mobile/ScrollableTabs";
import { authHeaders } from "../../lib/api";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../../lib/utils";
import { withTranslations } from "../../lib/i18n";
import { useTranslation } from "next-i18next";
import { useDetailResource } from "../../lib/hooks/useDetailResource";

const PortfolioCanvasChart = dynamic(
  () => import("../../components/PortfolioCanvasChart"),
  { ssr: false },
);
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

function delta(curr, prev) {
  if (!Number.isFinite(curr) || !Number.isFinite(prev)) return null;
  if (curr === 0 && prev === 0) return null;
  const tone = curr > prev ? "text-green-600" : curr < prev ? "text-red-500" : "text-foreground-dim";
  return { tone };
}

/* ─── Portfolio appraisal ────────────────────────────────────── */

function deriveYtdAppraisal({ noi, prevNoi, collRate, t, isFullYear }) {
  let tier;
  if (!Number.isFinite(prevNoi) || prevNoi === 0) {
    tier = noi > 0 ? "ahead" : noi < 0 ? "behind" : "onpar";
  } else {
    const d = (noi - prevNoi) / Math.abs(prevNoi);
    tier = d > 0.10 ? "ahead" : d < -0.10 ? "behind" : "onpar";
  }

  const ns = isFullYear ? "reporting.appraisalFullYear" : "reporting.appraisalYtd";
  const headline = t(`${ns}.${tier}`);

  let reason;
  if (tier === "ahead" && prevNoi !== 0 && Number.isFinite(prevNoi)) {
    const pct = Math.round(Math.abs((noi - prevNoi) / prevNoi) * 100);
    reason = t(`${ns}.reason.noiAhead`, { pct });
  } else if (tier === "behind" && prevNoi !== 0 && Number.isFinite(prevNoi)) {
    const pct = Math.round(Math.abs((noi - prevNoi) / prevNoi) * 100);
    reason = t(`${ns}.reason.noiBehind`, { pct });
  } else {
    reason = t(`${ns}.reason.noiOnPar`, { rate: fmtPct(collRate) });
  }

  return { headline, reason };
}

function computeAppraisalScore(collRate, noi, occupancyRate, arrears) {
  const collScore = collRate >= 0.95 ? 1 : collRate >= 0.80 ? 0.5 : 0;
  const noiScore  = noi > 0 ? 1 : noi === 0 ? 0.5 : 0;
  const occScore  = occupancyRate === null ? 0.5 : occupancyRate >= 0.90 ? 1 : occupancyRate >= 0.75 ? 0.5 : 0;
  const arrScore  = !arrears || (arrears.overdue61plusCents === 0 && arrears.overdue31to60Cents === 0) ? 1
    : arrears.overdue61plusCents === 0 ? 0.5 : 0;
  return 0.4 * collScore + 0.3 * noiScore + 0.2 * occScore + 0.1 * arrScore;
}

function deriveAppraisal({ collRate, noi, occupancyRate, arrears, activeBuildings, prevScore, prevNoi, t, ytdMode, isFullYear }) {
  if (ytdMode || isFullYear) return deriveYtdAppraisal({ noi, prevNoi, collRate, t, isFullYear });
  const score = computeAppraisalScore(collRate, noi, occupancyRate, arrears);
  const tier  = score >= 0.75 ? "strong" : score >= 0.40 ? "mixed" : "challenging";

  let trajectory = "stable";
  if (prevScore !== null) {
    if (score > prevScore + 0.10) trajectory = "improving";
    else if (score < prevScore - 0.10) trajectory = "declining";
  }

  const headline = t(`reporting.appraisal.${tier}.${trajectory}`);

  const buildingsInRed = (activeBuildings ?? []).filter((b) => b.netIncomeCents < 0);
  let reason;

  if (tier === "strong") {
    if (buildingsInRed.length === 0) {
      reason = t("reporting.appraisal.reason.strongCollectionAllGreen", { rate: fmtPct(collRate) });
    } else {
      reason = t("reporting.appraisal.reason.strongCollectionSomeRed", { rate: fmtPct(collRate), count: buildingsInRed.length });
    }
  } else if (tier === "mixed") {
    if (buildingsInRed.length > 0) {
      reason = t("reporting.appraisal.reason.buildingsInRed", { count: buildingsInRed.length });
    } else {
      reason = t("reporting.appraisal.reason.mixedCollection", { rate: fmtPct(collRate) });
    }
  } else {
    if (arrears?.overdue61plusCents > 0) {
      reason = t("reporting.appraisal.reason.hardArrears", { amount: fmtChf(arrears.overdue61plusCents) });
    } else if (collRate < 0.80) {
      reason = t("reporting.appraisal.reason.lowCollection", { rate: fmtPct(collRate) });
    } else {
      reason = t("reporting.appraisal.reason.negativeNoi", { amount: fmtChf(Math.abs(noi)) });
    }
  }

  return { headline, reason };
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
            {t("reporting.text.yearButton")}
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

function TrendArrow({ delta }) {
  if (!delta) return null;
  const up   = delta.tone === "text-green-600";
  const down = delta.tone === "text-red-500";
  const arrow = up ? "↑" : down ? "↓" : "→";
  const cls   = up ? "text-green-600" : down ? "text-red-500" : "text-foreground-dim";
  return <span className={cn("text-sm font-semibold leading-none", cls)}>{arrow}</span>;
}

function KpiRow({ label, value, delta, isLoading }) {
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

function KpiTable({ left, right, isLoading, attached = false }) {
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
            <div key={row.label} className={cn(
              "border-t border-surface-divider",
              i === 0 && "sm:border-t-0"
            )}>
              <KpiRow label={row.label} value={row.value} delta={row.delta} isLoading={isLoading} />
            </div>
          ))}
        </div>
      </div>
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

function BuildingRow({ name, earned, expenses, net, collectionRate, occupancy, href }) {
  const { t } = useTranslation("owner");
  const netPositive = net >= 0;
  const Wrapper = href ? "a" : "div";
  return (
    <Wrapper
      href={href}
      className={cn(
        "flex items-center justify-between rounded-2xl border border-surface-border bg-surface-subtle px-4 py-3",
        href && "hover:bg-surface-hover transition-colors cursor-pointer no-underline"
      )}
    >
      <div className="flex items-center gap-2 mr-4 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">{name}</div>
        {href && <span className="shrink-0 text-xs text-foreground-dim">↗</span>}
      </div>
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
            <div className="text-xs text-foreground-dim">{t("reporting.prop.occupancy")}</div>
            <div className={cn("text-sm font-medium", occupancy < 0.9 ? "text-amber-600" : "text-muted-dark")}>
              {fmtPct(occupancy)}
            </div>
          </div>
        )}
      </div>
    </Wrapper>
  );
}

function MonthlyTrendChart({ data, locale }) {
  if (!data || data.length === 0) return null;

  const CHART_H = 80;
  const LABEL_H = 18;
  const BAR_W   = 28;
  const GAP      = 6;
  const TOTAL_H  = CHART_H + LABEL_H;
  const WIDTH    = data.length * (BAR_W + GAP) - GAP;
  const ZERO_Y   = CHART_H / 2;

  const maxAbs = Math.max(...data.map((d) => Math.abs(d.noiCents)), 1);
  const monthLabel = (m) =>
    new Intl.DateTimeFormat(locale ?? "fr-CH", { month: "short" }).format(new Date(2024, m - 1, 1));

  return (
    <svg viewBox={`0 0 ${WIDTH} ${TOTAL_H}`} className="w-full" style={{ maxHeight: 98 }}>
      <line x1="0" y1={ZERO_Y} x2={WIDTH} y2={ZERO_Y} stroke="#e5e7eb" strokeWidth="1" />
      {data.map((d, i) => {
        const x    = i * (BAR_W + GAP);
        const barH = Math.max(2, (Math.abs(d.noiCents) / maxAbs) * (ZERO_Y - 6));
        const isPos = d.noiCents >= 0;
        const barY  = isPos ? ZERO_Y - barH : ZERO_Y;
        return (
          <g key={d.month}>
            <rect x={x} y={barY} width={BAR_W} height={barH} rx="3"
              fill={isPos ? "#16a34a" : "#dc2626"} fillOpacity="0.72" />
            <text x={x + BAR_W / 2} y={TOTAL_H - 2}
              textAnchor="middle" fontSize="8" fill="#9ca3af">
              {monthLabel(d.month)}
            </text>
          </g>
        );
      })}
    </svg>
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

function buildWatchItems(curr, prev, moveIns, moveOuts, { arrears, occupancyRate, allUnits, totalUnits, incomeVariance, projected, receivables, activeBuildings } = {}, t) {
  const items = [];

  if (arrears?.overdue61plusCents > 0) {
    items.push({
      text: t("reporting.watch.arrears61plus", { amount: fmtChf(arrears.overdue61plusCents) }),
      severity: "red",
      action: { label: t("reporting.action.viewOverdueInvoices"), href: "/manager/finance/invoices" },
    });
  }

  if (arrears?.overdue31to60Cents > 0) {
    items.push({
      text: t("reporting.watch.arrears31to60", { amount: fmtChf(arrears.overdue31to60Cents) }),
      severity: "amber",
      action: { label: t("reporting.action.viewOverdueInvoices"), href: "/manager/finance/invoices" },
    });
  }

  if (curr?.avgCollectionRate < 0.95 && curr?.avgCollectionRate > 0) {
    const shortfall = 0.95 - curr.avgCollectionRate;
    items.push({
      text: t("reporting.watch.collectionRate", { rate: fmtPct(curr.avgCollectionRate), shortfall: fmtPct(shortfall) }),
      severity: "amber",
      action: { label: t("reporting.action.viewUnpaidInvoices"), href: "/manager/finance/invoices" },
    });
  }

  if (occupancyRate !== null && occupancyRate < 0.9 && allUnits > 0) {
    const vacantCount = allUnits - totalUnits;
    items.push({
      text: t("reporting.watch.vacancy", { vacantCount, allUnits, rate: fmtPct(occupancyRate) }),
      severity: "amber",
    });
  }

  if (incomeVariance !== null && projected > 0 && incomeVariance < -(projected * 0.05)) {
    const gap = Math.abs(incomeVariance);
    const awaitingPayment = Math.min(receivables ?? 0, gap);
    const uninvoiced = gap - awaitingPayment;
    let text;
    if (uninvoiced <= 0) {
      text = t("reporting.watch.awaitingPayment", { amount: fmtChf(gap) });
    } else if (awaitingPayment > 0) {
      text = t("reporting.watch.awaitingAndUninvoiced", { awaitingPayment: fmtChf(awaitingPayment), uninvoiced: fmtChf(uninvoiced) });
    } else {
      text = t("reporting.watch.notInvoiced", { amount: fmtChf(gap) });
    }
    items.push({
      text,
      severity: "amber",
      action: { label: t("reporting.action.viewUnpaidInvoices"), href: "/manager/finance/invoices" },
    });
  }

  const buildingsInRedList = (activeBuildings ?? []).filter((b) => b.netIncomeCents < 0);
  if (buildingsInRedList.length > 0) {
    const names = buildingsInRedList.map((b) => b.buildingName).join(", ");
    const key = buildingsInRedList.length === 1 ? "reporting.watch.buildingsInRedSingle" : "reporting.watch.buildingsInRedMultiple";
    items.push({
      text: t(key, { names }),
      severity: "red",
      action: { label: t("reporting.action.viewFinanceOverview"), href: "/manager/finance" },
    });
  }

  if (curr?.totalPayablesCents > 0 && curr?.totalExpensesCents > 0 && curr.totalPayablesCents / curr.totalExpensesCents > 0.5) {
    items.push({
      text: t("reporting.watch.payablesConcentration", { amount: fmtChf(curr.totalPayablesCents) }),
      severity: "amber",
      action: { label: t("reporting.action.viewUnpaidInvoices"), href: "/manager/finance/invoices" },
    });
  }

  if (prev && curr?.totalExpensesCents > 0) {
    const ratio = prev.totalExpensesCents > 0 ? curr.totalExpensesCents / prev.totalExpensesCents : null;
    if (ratio !== null && ratio > 1.3) {
      items.push({
        text: t("reporting.watch.expenseSpike", { pct: fmtPct(ratio - 1) }),
        severity: "amber",
        action: { label: t("reporting.action.viewExpenses"), href: "/manager/finance/expenses" },
      });
    }
  }

  const totalChurn = (moveIns?.length ?? 0) + (moveOuts?.length ?? 0);
  if (totalChurn > 0) {
    items.push({
      text: t("reporting.watch.tenantChurn", { count: totalChurn }),
      severity: "violet",
    });
  }

  return items;
}

function buildPeriodNotes(curr, prev, moveIns, moveOuts, { arrears, occupancyRate, allUnits, totalUnits, incomeVariance, projected, receivables, activeBuildings } = {}, t) {
  const items = [];

  if (arrears?.overdue61plusCents > 0) {
    items.push({ text: t("reporting.note.arrears61plus", { amount: fmtChf(arrears.overdue61plusCents) }), severity: "red" });
  }
  if (arrears?.overdue31to60Cents > 0) {
    items.push({ text: t("reporting.note.arrears31to60", { amount: fmtChf(arrears.overdue31to60Cents) }), severity: "amber" });
  }
  if (curr?.avgCollectionRate < 0.95 && curr?.avgCollectionRate > 0) {
    const shortfall = 0.95 - curr.avgCollectionRate;
    items.push({ text: t("reporting.note.collectionRate", { rate: fmtPct(curr.avgCollectionRate), shortfall: fmtPct(shortfall) }), severity: "amber" });
  }
  if (occupancyRate !== null && occupancyRate < 0.9 && allUnits > 0) {
    const vacantCount = allUnits - totalUnits;
    items.push({ text: t("reporting.note.vacancy", { vacantCount, allUnits, rate: fmtPct(occupancyRate) }), severity: "amber" });
  }
  if (incomeVariance !== null && projected > 0 && incomeVariance < -(projected * 0.05)) {
    const gap = Math.abs(incomeVariance);
    const awaitingPayment = Math.min(receivables ?? 0, gap);
    const uninvoiced = gap - awaitingPayment;
    let text;
    if (uninvoiced <= 0)       text = t("reporting.note.awaitingPayment", { amount: fmtChf(gap) });
    else if (awaitingPayment > 0) text = t("reporting.note.awaitingAndUninvoiced", { awaitingPayment: fmtChf(awaitingPayment), uninvoiced: fmtChf(uninvoiced) });
    else                       text = t("reporting.note.notInvoiced", { amount: fmtChf(gap) });
    items.push({ text, severity: "amber" });
  }
  const buildingsInRedList = (activeBuildings ?? []).filter((b) => b.netIncomeCents < 0);
  if (buildingsInRedList.length > 0) {
    const names = buildingsInRedList.map((b) => b.buildingName).join(", ");
    const key = buildingsInRedList.length === 1 ? "reporting.note.buildingsInRedSingle" : "reporting.note.buildingsInRedMultiple";
    items.push({ text: t(key, { names }), severity: "red" });
  }
  if (curr?.totalPayablesCents > 0 && curr?.totalExpensesCents > 0 && curr.totalPayablesCents / curr.totalExpensesCents > 0.5) {
    items.push({ text: t("reporting.note.payablesConcentration", { amount: fmtChf(curr.totalPayablesCents) }), severity: "amber" });
  }
  if (prev && curr?.totalExpensesCents > 0) {
    const ratio = prev.totalExpensesCents > 0 ? curr.totalExpensesCents / prev.totalExpensesCents : null;
    if (ratio !== null && ratio > 1.3) {
      items.push({ text: t("reporting.note.expenseSpike", { pct: fmtPct(ratio - 1) }), severity: "amber" });
    }
  }
  const totalChurn = (moveIns?.length ?? 0) + (moveOuts?.length ?? 0);
  if (totalChurn > 0) {
    items.push({ text: t("reporting.note.tenantChurn", { count: totalChurn }), severity: "violet" });
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

  const [moveIns, setMoveIns]       = useState([]);
  const [moveOuts, setMoveOuts]     = useState([]);
  const [monthlyData, setMonthlyData] = useState(null);

  const [insExpanded,   setInsExpanded]   = useState(false);
  const [outsExpanded,  setOutsExpanded]  = useState(false);
  const [propsExpanded, setPropsExpanded] = useState(false);
  const [kpiOpen,       setKpiOpen]       = useState(false);

  // Canvas tab state
  const [activeTab,      setActiveTab]      = useState(0); // 0 = Period Analysis, 1 = Performance Canvas
  const [canvasRange,    setCanvasRange]    = useState("1Y");

  const { data: canvasData, loading: canvasLoading } = useDetailResource(
    activeTab === 1 ? `/api/financials/portfolio-timeseries?range=${canvasRange}` : null,
  );

  // Annual mode auto-adapts: past year → full Jan–Dec; current year → Jan–today
  const isFullYear = ytdMode && selYear < today.getFullYear();

  const { from, to, prevFrom, prevTo } = useMemo(() => {
    if (ytdMode) {
      const y = selYear;
      if (y < today.getFullYear()) {
        return {
          from: `${y}-01-01`,
          to: `${y}-12-31`,
          prevFrom: `${y - 1}-01-01`,
          prevTo: `${y - 1}-12-31`,
        };
      }
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

  // A period is historical when its end date is strictly before today
  const todayStr = today.toISOString().slice(0, 10);
  const isHistorical = to < todayStr;

  const periodLabel = useMemo(() => {
    if (ytdMode) return isFullYear ? String(selYear) : `YTD ${selYear}`;
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(selYear, selMonth, 1));
  }, [locale, selYear, selMonth, ytdMode, isFullYear]);

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

    const fetchMonthly = ytdMode
      ? fetch(`/api/financials/portfolio-monthly?year=${selYear}`, { headers: authHeaders() })
          .then((r) => r.ok ? r.json() : null)
          .then((d) => d?.data ?? null)
      : Promise.resolve(null);

    Promise.all([
      fetchPeriod(from, to),
      fetchPeriod(prevFrom, prevTo),
      fetchLeases({ startDateFrom: from, startDateTo: to, limit: 50 }),
      fetchLeases({ endDateFrom: from, endDateTo: to, limit: 50 }),
      fetchMonthly,
    ]).then(([curr, prev, ins, outs, monthly]) => {
      if (!cancelled) {
        setCurrData(curr);
        setPrevData(prev);
        setMoveIns(ins);
        setMoveOuts(outs);
        setMonthlyData(monthly);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [from, to, prevFrom, prevTo, fetchPeriod, ytdMode, selYear]);

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

  // Prev-period derived ratios (for row-2 KPI deltas)
  const prevAllUnits      = prevData?.totalUnits ?? 0;
  const prevActiveUnits   = prevData?.totalActiveUnits ?? 0;
  const prevEarnedForRatio = prevData?.totalEarnedIncomeCents ?? 0;
  const prevOccupancyRate = prevAllUnits > 0 ? prevActiveUnits / prevAllUnits : null;
  const prevOpexRatio     = prevEarnedForRatio > 0 ? (prevData?.totalOperatingCents ?? 0) / prevEarnedForRatio : null;
  const prevNoiMargin     = prevEarnedForRatio > 0 ? (prevData?.totalNetOperatingIncomeCents ?? 0) / prevEarnedForRatio : null;

  // Deltas vs prior period
  const noiDelta        = (currData && prevData) ? delta(noi, prevNoi) : null;
  const expDelta        = (currData && prevData) ? delta(expenses, prevExpenses) : null;
  const earnedDelta     = (currData && prevData) ? delta(earned, prevEarned) : null;
  const collDelta       = (currData && prevData) ? delta(collRate, prevCollRate) : null;
  const netDelta        = (currData && prevData) ? delta(netIncome, prevNet) : null;
  const occupancyDelta  = (currData && prevData && occupancyRate !== null && prevOccupancyRate !== null) ? delta(occupancyRate, prevOccupancyRate) : null;
  // OpEx ratio: lower is better — invert args so ↑ (green) means cost went up (bad direction shown correctly)
  const opexDelta       = (currData && prevData && opexRatio !== null && prevOpexRatio !== null) ? delta(prevOpexRatio, opexRatio) : null;
  const noiMarginDelta  = (currData && prevData && noiMargin !== null && prevNoiMargin !== null) ? delta(noiMargin, prevNoiMargin) : null;

  const drivers = useMemo(
    () => buildDrivers(currData, prevData, t),
    [currData, prevData, t]
  );

  // By-property list — sorted by net income desc; all buildings shown regardless of activity
  const activeBuildings = useMemo(() => {
    if (!currData?.buildings) return [];
    return [...currData.buildings].sort((a, b) => b.netIncomeCents - a.netIncomeCents);
  }, [currData]);

  const watchItems = useMemo(
    () => buildWatchItems(currData, prevData, moveIns, moveOuts, {
      arrears, occupancyRate, allUnits, totalUnits, incomeVariance, projected,
      receivables, activeBuildings,
    }, t),
    [currData, prevData, moveIns, moveOuts, arrears, occupancyRate, allUnits, totalUnits, incomeVariance, projected, receivables, activeBuildings, t]
  );

  const periodNotes = useMemo(
    () => isHistorical ? buildPeriodNotes(currData, prevData, moveIns, moveOuts, {
      arrears, occupancyRate, allUnits, totalUnits, incomeVariance, projected,
      receivables, activeBuildings,
    }, t) : [],
    [isHistorical, currData, prevData, moveIns, moveOuts, arrears, occupancyRate, allUnits, totalUnits, incomeVariance, projected, receivables, activeBuildings, t]
  );

  // Auto-expand when ≤ 3 buildings
  const autoExpanded = activeBuildings.length <= 3;
  const visibleBuildings = (propsExpanded || autoExpanded)
    ? activeBuildings
    : activeBuildings.slice(0, PREVIEW);

  const prevAppraisalScore = (currData && prevData)
    ? computeAppraisalScore(prevCollRate, prevNoi, prevOccupancyRate, null)
    : null;

  const appraisal = useMemo(() => {
    if (loading || !currData) return { headline: t("reporting.text.loadingReport"), reason: null };
    return deriveAppraisal({ collRate, noi, occupancyRate, arrears, activeBuildings, prevScore: prevAppraisalScore, prevNoi, t, ytdMode: ytdMode && !isFullYear, isFullYear });
  }, [loading, currData, collRate, noi, occupancyRate, arrears, activeBuildings, prevAppraisalScore, prevNoi, t, ytdMode, isFullYear]);

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

      {/* ── TAB STRIP ──────────────────────────────────────────── */}
      <div className="border-b border-surface-border bg-surface px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <ScrollableTabs activeIndex={activeTab}>
            <button
              type="button"
              onClick={() => setActiveTab(0)}
              className={cn("tab-btn", activeTab === 0 && "tab-btn-active")}
            >
              {t("reporting.canvas.tab.periodAnalysis")}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab(1)}
              className={cn("tab-btn", activeTab === 1 && "tab-btn-active")}
            >
              {t("reporting.canvas.tab.performanceCanvas")}
            </button>
          </ScrollableTabs>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

        {/* ── PERFORMANCE CANVAS TAB ───────────────────────────── */}
        {activeTab === 1 && (
          <div>
            {/* Range picker */}
            {(() => {
              const earliest = canvasData?.earliestDate;
              const now = new Date();
              const daysSinceEarliest = earliest
                ? Math.floor((now - new Date(earliest)) / 86400000)
                : 0;
              // 1W/1M need daily snapshots; 6M+ use monthly/quarterly/annual data always available
              const RANGES = [
                { key: "1W",  dailyOnly: true  },
                { key: "1M",  dailyOnly: true  },
                { key: "6M",  dailyOnly: false },
                { key: "1Y",  dailyOnly: false },
                { key: "2Y",  dailyOnly: false },
                { key: "5Y",  dailyOnly: false },
                { key: "10Y", dailyOnly: false },
              ];
              return (
                <div className="mb-5 flex items-center gap-1.5 flex-wrap">
                  {RANGES.map(({ key, dailyOnly }) => {
                    const enabled = !dailyOnly || daysSinceEarliest >= (key === "1W" ? 7 : 30);
                    return (
                      <button
                        key={key}
                        disabled={!enabled}
                        onClick={() => setCanvasRange(key)}
                        className={cn(
                          "rounded-full px-3 py-1 text-sm font-semibold transition-colors",
                          canvasRange === key
                            ? "bg-slate-900 text-white"
                            : enabled
                            ? "text-muted-text hover:bg-surface-hover"
                            : "text-foreground-dim cursor-not-allowed opacity-40",
                        )}
                      >
                        {key}
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            {canvasLoading ? (
              <>
                <div className="h-64 animate-pulse rounded-2xl bg-surface-hover mb-4" />
                <div className="h-64 animate-pulse rounded-2xl bg-surface-hover" />
              </>
            ) : (
              <PortfolioCanvasChart
                points={canvasData?.points ?? []}
                range={canvasRange}
                t={t}
              />
            )}
          </div>
        )}

        {/* ── PERIOD ANALYSIS TAB ──────────────────────────────── */}
        {activeTab === 0 && <>

        {/* ── HERO + KPI (expandable) ──────────────────────────── */}
        <div className="mb-6">
          <header className={cn(
            "border border-surface-border bg-gradient-to-br p-6 shadow-sm",
            "dark:from-brand-light dark:via-info-light dark:to-transparent",
            ytdMode ? "from-violet-50 via-sky-50 to-green-50" : MONTH_HERO_GRADIENTS[selMonth],
            kpiOpen ? "rounded-t-3xl" : "rounded-3xl"
          )}>
            <div className="max-w-2xl">
              <Badge variant="default" size="lg" className="mb-3 bg-transparent border-black/20 dark:border-white/20 text-foreground/70">
                {periodLabel} · {isFullYear ? t("reporting.text.fullYearReport") : ytdMode ? t("reporting.text.yearToDateReport") : t("reporting.text.monthlyReport")}
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground whitespace-nowrap">
              {appraisal.headline}
            </h1>
            {!loading && appraisal.reason && (
              <p className="mt-2 text-sm font-medium text-muted-dark max-w-2xl">
                {appraisal.reason}
              </p>
            )}
            {!loading && currData && (
              <p className="mt-2 text-sm leading-6 text-muted-text sm:text-base max-w-2xl">
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
            <button
              onClick={() => setKpiOpen((v) => !v)}
              className="mt-4 flex items-center gap-1.5 text-sm font-medium text-foreground/60 hover:text-foreground transition-colors"
              aria-expanded={kpiOpen}
            >
              {kpiOpen
                ? <><ChevronUp className="w-4 h-4" /> {t("reporting.text.hideDetails")}</>
                : <><ChevronDown className="w-4 h-4" /> {t("reporting.text.viewDetails")}</>
              }
            </button>
          </header>

          {kpiOpen && (
            <KpiTable
              attached
              isLoading={loading}
              left={[
                { label: t("reporting.prop.netOperatingIncome"), value: fmtChf(noi),      delta: noiDelta    },
                { label: t("reporting.prop.rentCollected"),       value: fmtChf(earned),   delta: earnedDelta },
                { label: t("reporting.prop.totalExpenses"),       value: fmtChf(expenses), delta: expDelta    },
                { label: t("reporting.prop.collectionRate"),      value: fmtPct(collRate), delta: collDelta   },
              ]}
              right={[
                { label: t("reporting.prop.noiMargin"),       value: !loading && noiMargin     !== null ? fmtPct(noiMargin)     : "—", delta: noiMarginDelta },
                { label: t("reporting.prop.opexRatio"),       value: !loading && opexRatio     !== null ? fmtPct(opexRatio)     : "—", delta: opexDelta      },
                { label: t("reporting.prop.occupancy"),       value: !loading && occupancyRate !== null ? fmtPct(occupancyRate) : "—", delta: occupancyDelta },
                { label: t("reporting.prop.rentOutstanding"), value: !loading ? (receivables > 0 ? fmtChf(receivables) : "—") : "—",  delta: null           },
              ]}
            />
          )}
        </div>

        {/* ── MONTHLY NOI TRENDLINES (YTD only) ───────────────── */}
        {ytdMode && !loading && monthlyData && monthlyData.length > 0 && (
          <section className="mb-6">
            <div className="rounded-3xl border border-surface-border bg-surface p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-foreground">{t("reporting.heading.monthlyNoi")}</h2>
                  <p className="text-xs text-foreground-dim mt-0.5">{t("reporting.text.noiPerMonth", { year: selYear })}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-foreground-dim">{t("reporting.text.bestMonth")}</div>
                  <div className="text-sm font-semibold text-green-700">
                    {(() => {
                      const best = [...monthlyData].sort((a, b) => b.noiCents - a.noiCents)[0];
                      return best ? fmtChf(best.noiCents) : "—";
                    })()}
                  </div>
                </div>
              </div>
              <MonthlyTrendChart data={monthlyData} locale={locale} />
            </div>
          </section>
        )}

        {/* ── ALERTS (receivables + arrears aging) ─────────────── */}
        {!loading && receivables > 0 && (
          <section className="mb-4">
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 px-5 py-4">
              <span className="mt-0.5 text-amber-500 text-lg shrink-0">⚠</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-0.5">
                  {t("reporting.text.rentInvoicesNotReconciled", { amount: fmtChf(receivables) })}
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {t("reporting.text.rentInvoicesMarkPaidInstruction")}
                </p>
              </div>
              <a
                href="/manager/finance/invoices"
                className="shrink-0 rounded-lg bg-amber-600 hover:bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors no-underline"
              >
                {t("reporting.text.goToInvoices")}
              </a>
            </div>
          </section>
        )}

        {!loading && arrears && (arrears.totalOverdueCents > 0 || arrears.currentCents > 0) && (
          <section className="mb-6">
            <div className="rounded-2xl border border-surface-border bg-surface p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-foreground">{t("reporting.heading.rentArrearsAging")}</h2>
                  <p className="text-xs text-foreground-dim mt-0.5">{t("reporting.text.unpaidInvoicesByDaysOverdue")}</p>
                </div>
                {arrears.totalOverdueCents > 0 && (
                  <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                    {fmtChf(arrears.totalOverdueCents)} {t("reporting.text.overdueLabel")}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { labelKey: "reporting.text.arrearsCurrentLabel", cents: arrears.currentCents,        color: "text-green-700",  bg: "bg-green-50 border-green-200" },
                  { labelKey: "reporting.text.arrears1to30Label",   cents: arrears.overdue1to30Cents,   color: "text-amber-700",  bg: "bg-amber-50 border-amber-200" },
                  { labelKey: "reporting.text.arrears31to60Label",  cents: arrears.overdue31to60Cents,  color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
                  { labelKey: "reporting.text.arrears61plusLabel",  cents: arrears.overdue61plusCents,  color: "text-red-700",    bg: "bg-red-50 border-red-200" },
                ].map(({ labelKey, cents, color, bg }) => (
                  <div key={labelKey} className={cn("rounded-xl border p-4", cents > 0 ? bg : "border-surface-border bg-surface-subtle")}>
                    <div className="text-xs text-foreground-dim">{t(labelKey)}</div>
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
                  <p className="text-xs text-green-700/70 dark:text-green-400/70 ml-[34px]">{ytdMode ? t("reporting.text.theMainForcesBehindThisYearsNumbers") : t("reporting.text.theMainForcesBehindThisMonthsNumbers")}</p>
                  {isFullYear && <p className="text-xs text-green-600/60 dark:text-green-500/50 ml-[34px] mt-0.5">{t("reporting.text.fullYearComparison", { year: selYear, prevYear: selYear - 1 })}</p>}
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

              {/* Right — What to watch (current) / Period notes (historical) */}
              <div className="flex flex-col">
                <div className="px-7 py-4 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-100 dark:border-amber-900">
                  <div className="flex items-center gap-2.5 mb-0.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900 text-xs font-bold text-amber-700 dark:text-amber-400">
                      {isHistorical ? "◎" : "!"}
                    </div>
                    <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                      {isHistorical ? t("reporting.heading.periodNotes") : t("reporting.heading.whatToWatch")}
                    </h2>
                  </div>
                  <p className="text-xs text-amber-700/70 dark:text-amber-400/70 ml-[34px]">
                    {isHistorical ? t("reporting.text.observationsOverPeriod") : t("reporting.text.flagsAndActionItems")}
                  </p>
                </div>
                <div className="px-7 py-5 flex-1">
                  {loading ? (
                    <div className="space-y-4">
                      {[1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-hover" />)}
                    </div>
                  ) : isHistorical ? (
                    periodNotes.length > 0 ? (
                      <div>
                        {periodNotes.map((item, i) => (
                          <WatchItem key={i} number={i + 1} text={item.text} severity={item.severity} />
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-start gap-4 pt-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">✓</div>
                        <p className="text-sm text-muted-text leading-relaxed self-center">{t("reporting.text.noPeriodNotes")}</p>
                      </div>
                    )
                  ) : watchItems.length > 0 ? (
                    <div>
                      {watchItems.map((item, i) => (
                        <WatchItem key={i} number={i + 1} text={item.text} severity={item.severity} action={item.action} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-start gap-4 pt-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">✓</div>
                      <p className="text-sm text-muted-text leading-relaxed self-center">{t("reporting.text.noFlags")}</p>
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
                    {propsExpanded ? t("reporting.text.collapseProps") : t("reporting.text.showAllProps", { count: activeBuildings.length })}
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
                    href={`/admin-inventory/buildings/${b.buildingId}?from=/owner/properties&role=owner`}
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

        </>}

      </div>
    </AppShell>
  );
}

export const getStaticProps = withTranslations(["common","owner"]);
