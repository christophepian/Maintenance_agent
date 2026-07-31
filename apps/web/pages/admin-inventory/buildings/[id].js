import { useRouter } from "next/router";
import { useEffect, useState, useMemo, useRef } from "react";
import {
  fmtChf as rFmtChf,
  fmtPct as rFmtPct,
  KpiTable,
  DriverItem,
  WatchItem,
  OccupancyRow,
} from "../../../components/reporting/ReportingShared";
// Statically imported (SSR-safe: all canvas work is in useEffect). Previously a
// dynamic(ssr:false) import, which created a Suspense boundary that — under React
// 19's stylesheet handling in the pages router — dropped the global Tailwind
// stylesheet on subsequent client-side navigations. See fix/unit-css-regression.

function CorrespondenceTab({ buildingId }) {
  const [letters, setLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!buildingId) return;
    fetch(`/api/owner/letters?buildingId=${buildingId}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => { setLetters(d?.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [buildingId]);
  if (loading) return <p className="text-sm text-muted py-4">Chargement…</p>;
  if (letters.length === 0) return <p className="text-sm text-muted italic py-4">Aucune correspondance envoyée pour cet immeuble.</p>;
  return (
    <div className="space-y-2">
      {letters.map((l) => (
        <div key={l.id} className="card border px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-foreground truncate">{l.subject}</p>
            <div className="shrink-0 text-right">
              <p className="text-xs text-foreground-dim">{l.sentAt ? new Date(l.sentAt).toLocaleDateString("de-CH") : "—"}</p>
              <p className="text-xs text-foreground-dim">{l.recipientCount} destinataire{l.recipientCount !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import UndoToast, { useUndoToast } from "../../../components/ui/UndoToast";
import Badge from "../../../components/ui/Badge";
import AssetInventoryPanel from "../../../components/AssetInventoryPanel";
import { authHeaders } from "../../../lib/api";
import ScrollableTabs from "../../../components/mobile/ScrollableTabs";
import PackageOnboardingPanel from "../../../components/PackageOnboardingPanel";
import UnitProfitabilityPanel from "../../../components/reporting/UnitProfitabilityPanel";
import YieldGoalSeekPanel from "../../../components/YieldGoalSeekPanel";
import SortableHeader from "../../../components/SortableHeader";
import { useLocalSort, clientSort } from "../../../lib/tableUtils";
import { formatDate, formatChfCents, formatPercent, formatChf, formatNumber } from "../../../lib/format";
import { cn } from "../../../lib/utils";
import { ARCHETYPE_LABELS, ARCHETYPE_EXPLANATION_COPY } from "../../../lib/archetypes";
import KpiInlineGrid from "../../../components/ui/KpiInlineGrid";
import { withServerTranslations } from "../../../lib/i18n";
import { useTranslation } from "next-i18next";

/* ── Building reporting helpers ─────────────────────────── */

const PREVIEW_UNITS = 5;
const INCOME_PREVIEW = 5; // revex income column: units shown before "Show all"
const EXPENSE_PREVIEW = 6; // revex expense column: rows shown before "Show all"

// The invoices / entries behind a unit's "Direct costs" figure — lazily fetched
// when the row is expanded, so a manager can verify the number line by line.
function UnitCostDetail({ detail, expenses, t, buildingId, from, to }) {
  if (!detail || detail.loading) return <p className="px-4 py-3 text-xs text-foreground-dim">{t("buildingsId.reporting.unitCosts.loading")}</p>;
  if (detail.error || !detail.data) return <p className="px-4 py-3 text-xs text-destructive-text">{t("buildingsId.reporting.unitCosts.error")}</p>;
  const { lines = [], totalCents = 0 } = detail.data;
  if (lines.length === 0) return <p className="px-4 py-3 text-xs text-foreground-dim">{t("buildingsId.reporting.unitCosts.none")}</p>;
  const reconciles = Math.abs(totalCents - (expenses ?? 0)) <= 1; // cents rounding tolerance
  const kindLabel = (k) => k === "charges" ? t("buildingsId.reporting.unitCosts.kindCharges")
    : k === "invoice" ? t("buildingsId.reporting.unitCosts.kindInvoice")
    : t("buildingsId.reporting.unitCosts.kindLedger");
  return (
    <div className="border-t border-surface-border px-4 py-3">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-foreground-dim">
              <th className="py-1 pr-2 text-left font-semibold">{t("buildingsId.reporting.unitCosts.date")}</th>
              <th className="py-1 px-2 text-left font-semibold">{t("buildingsId.reporting.unitCosts.item")}</th>
              <th className="py-1 px-2 text-left font-semibold">{t("buildingsId.reporting.unitCosts.account")}</th>
              <th className="py-1 pl-2 text-right font-semibold">{t("buildingsId.reporting.unitCosts.amount")}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const name = l.vendor || l.description || kindLabel(l.kind);
              // Drill to the incoming-invoices list filtered to this vendor + window
              // (same params the Revenue & expenses vendor lens uses).
              const invHref = l.invoiceId && l.vendor
                ? `/manager/finance?${new URLSearchParams({ tab: "invoices", direction: "incoming", buildingId, issueDateFrom: from, issueDateTo: to, issuerName: l.vendor }).toString()}`
                : null;
              return (
                <tr key={l.id} className="border-t border-surface-divider align-top">
                  <td className="py-1.5 pr-2 whitespace-nowrap text-foreground-dim tabular-nums">{l.date ?? "—"}</td>
                  <td className="py-1.5 px-2">
                    <span className="text-foreground">{invHref ? <a href={invHref} className="text-brand no-underline hover:underline">{name}</a> : name}</span>
                    {l.reference ? <span className="text-foreground-dim"> · {l.reference}</span> : null}
                    {l.vendor && l.description && l.description !== l.vendor
                      ? <div className="truncate text-foreground-dim">{l.description}</div> : null}
                    {l.kind !== "ledger" && <span className="ml-1 rounded bg-surface-hover px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted">{kindLabel(l.kind)}</span>}
                  </td>
                  <td className="py-1.5 px-2 text-foreground-dim">{l.accountCode ? <span className="tabular-nums">{l.accountCode} </span> : null}{l.accountName ?? (l.accountCode ? "" : "—")}</td>
                  <td className="py-1.5 pl-2 text-right font-medium tabular-nums text-foreground">{rFmtChf(l.amountCents)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-surface-border">
              <td colSpan={3} className="py-1.5 pr-2 text-right font-semibold text-foreground">{t("buildingsId.reporting.unitCosts.total")}</td>
              <td className="py-1.5 pl-2 text-right font-bold tabular-nums text-foreground">{rFmtChf(totalCents)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className={cn("mt-2 flex items-center gap-1.5 text-[11px]", reconciles ? "text-success-text" : "text-warning-text")}>
        <span aria-hidden>{reconciles ? "✓" : "⚠"}</span>
        <span>{reconciles
          ? t("buildingsId.reporting.unitCosts.reconciles")
          : t("buildingsId.reporting.unitCosts.mismatch", { total: rFmtChf(totalCents), figure: rFmtChf(expenses ?? 0) })}</span>
      </p>
    </div>
  );
}

function UnitRow({ unitNumber, floor, tenantName, earned, expenses, charges, net, collectionRate, occupancyRate, expandable, expanded, onToggle, detail, buildingId, from, to }) {
  const { t } = useTranslation("manager");
  const netPositive = net >= 0;
  const label = floor
    ? t("buildingsId.reporting.unitLabelFloor", { number: unitNumber, floor })
    : t("buildingsId.reporting.unitLabel", { number: unitNumber });
  const sub   = tenantName || (occupancyRate === 1 ? t("buildingsId.reporting.occupied") : t("buildingsId.reporting.vacant"));
  const RowTag = expandable ? "button" : "div";
  return (
    <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-subtle">
      <RowTag
        {...(expandable ? { type: "button", onClick: onToggle, "aria-expanded": expanded } : {})}
        className={cn("flex w-full items-center justify-between px-4 py-3 text-left", expandable && "transition-colors hover:bg-surface-hover")}>
        <div className="mr-4 flex min-w-0 items-center gap-2">
          {expandable && <span className={cn("shrink-0 text-foreground-dim transition-transform", expanded && "rotate-90")} aria-hidden>▸</span>}
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground truncate">{label}</div>
            <div className="text-xs text-foreground-dim truncate">{sub}</div>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0 text-right">
          <div className="hidden sm:block">
            <div className="text-xs text-foreground-dim">{t("buildingsId.reporting.income")}</div>
            <div className="text-sm font-medium text-muted-dark">{rFmtChf(earned)}</div>
          </div>
          <div className="hidden sm:block">
            <div className="text-xs text-foreground-dim">{t("buildingsId.reporting.directCosts")}</div>
            <div className="text-sm font-medium text-muted-dark">{rFmtChf(expenses)}</div>
          </div>
          {charges > 0 && (
            <div className="hidden md:block">
              <div className="text-xs text-foreground-dim">{t("buildingsId.reporting.charges")}</div>
              <div className="text-sm font-medium text-muted-dark" title={t("buildingsId.reporting.chargesTooltip")}>{rFmtChf(charges)}</div>
            </div>
          )}
          <div>
            <div className="text-xs text-foreground-dim">{t("buildingsId.reporting.contribution")}</div>
            <div className={cn("text-sm font-semibold", netPositive ? "text-success-text" : "text-destructive-text")}>{rFmtChf(net)}</div>
          </div>
          <div className="hidden md:block">
            <div className="text-xs text-foreground-dim">{t("buildingsId.reporting.collection")}</div>
            <div className="text-sm text-muted-dark">{rFmtPct(collectionRate)}</div>
          </div>
          <div className="hidden lg:block">
            <div className="text-xs text-foreground-dim">{t("buildingsId.reporting.occupancy")}</div>
            <div className={cn("text-sm font-medium", occupancyRate < 1 ? "text-amber-600" : "text-muted-dark")}>{rFmtPct(occupancyRate)}</div>
          </div>
        </div>
      </RowTag>
      {expandable && expanded && <UnitCostDetail detail={detail} expenses={expenses} t={t} buildingId={buildingId} from={from} to={to} />}
    </div>
  );
}

function buildingDelta(curr, prev) {
  if (!Number.isFinite(curr) || !Number.isFinite(prev) || curr === prev) return null;
  const diff = curr - prev;
  const tone = diff > 0 ? "text-green-600" : "text-red-500";
  return { tone };
}

// KPI-strip deltas vs the prior period. `better` (+1/−1) says which direction is
// good, so the colour reflects meaning (lower expenses = green). Null when there's
// no prior value or no change.
function kpiDeltaChf(cur, prev, better) {
  if (!Number.isFinite(cur) || !Number.isFinite(prev) || cur === prev) return null;
  const d = cur - prev;
  const good = better > 0 ? d > 0 : d < 0;
  return { txt: `${d > 0 ? "▲ " : "▼ "}${rFmtChf(Math.abs(d))}`, cls: good ? "text-success-text" : "text-destructive-text" };
}
function kpiDeltaPp(cur, prev, better) {
  if (!Number.isFinite(cur) || !Number.isFinite(prev)) return null;
  const pp = Math.round((cur - prev) * 100);
  if (pp === 0) return null;
  const good = better > 0 ? pp > 0 : pp < 0;
  return { txt: `${pp > 0 ? "▲ +" : "▼ "}${Math.abs(pp)}pp`, cls: good ? "text-success-text" : "text-destructive-text" };
}

function buildingHeadline(bf, t) {
  if (!bf) return t("buildingsId.reporting.headline.loading");
  const noi = bf.netOperatingIncomeCents;
  const coll = bf.collectionRate;
  const occ  = bf.totalUnitsCount > 0 ? bf.activeUnitsCount / bf.totalUnitsCount : 0;
  if (noi > 0 && coll >= 0.95 && occ >= 0.9) return t("buildingsId.reporting.headline.strong");
  if (noi > 0 && coll >= 0.8)  return t("buildingsId.reporting.headline.solid");
  if (coll < 0.6)               return t("buildingsId.reporting.headline.collectionAttention");
  if (noi <= 0 && bf.collectedIncomeCents > 0) return t("buildingsId.reporting.headline.expensesOutpaced");
  if (bf.collectedIncomeCents === 0) return t("buildingsId.reporting.headline.noIncome");
  return t("buildingsId.reporting.headline.closed");
}

function buildBuildingDrivers(bf, prevBf, benchmark, t) {
  const drivers = [];
  if (!bf) return drivers;
  if (prevBf) {
    const netDiff = bf.collectedIncomeCents - prevBf.collectedIncomeCents;
    if (netDiff > 0) drivers.push({ title: t("buildingsId.reporting.driver.incomeUp.title"), body: t("buildingsId.reporting.driver.incomeUp.body", { amount: rFmtChf(netDiff) }), impact: `+${rFmtChf(netDiff)}`, positive: true });
    else if (netDiff < 0) drivers.push({ title: t("buildingsId.reporting.driver.incomeDown.title"), body: t("buildingsId.reporting.driver.incomeDown.body", { amount: rFmtChf(Math.abs(netDiff)) }), impact: `-${rFmtChf(Math.abs(netDiff))}`, positive: false });
    const expDiff = bf.expensesTotalCents - prevBf.expensesTotalCents;
    if (expDiff > 0) drivers.push({ title: t("buildingsId.reporting.driver.costsUp.title"), body: t("buildingsId.reporting.driver.costsUp.body", { amount: rFmtChf(expDiff) }), impact: `-${rFmtChf(expDiff)}`, positive: false });
    else if (expDiff < 0) drivers.push({ title: t("buildingsId.reporting.driver.costsDown.title"), body: t("buildingsId.reporting.driver.costsDown.body", { amount: rFmtChf(Math.abs(expDiff)) }), impact: `+${rFmtChf(Math.abs(expDiff))}`, positive: true });
  }
  // Portfolio position — outperformance reads as a positive driver (folded in
  // from the retired executive summary's benchmark clause).
  if (benchmark && benchmark.count >= 2 && bf.collectedIncomeCents > 0) {
    const margin = bf.netOperatingIncomeCents / bf.collectedIncomeCents;
    if (margin > benchmark.noiMarginMedian + 0.03) {
      drivers.push({ title: t("buildingsId.reporting.driver.benchmark.title"), body: t("buildingsId.reporting.summary.benchmark.above", { margin: rFmtPct(margin), median: rFmtPct(benchmark.noiMarginMedian) }), impact: "", positive: true });
    }
  }
  if (bf.expensesTotalCents > 0 && drivers.length < 3) {
    drivers.push({ title: t("buildingsId.reporting.driver.spend.title"), body: t("buildingsId.reporting.driver.spend.body", { amount: rFmtChf(bf.expensesTotalCents) }), impact: rFmtChf(bf.expensesTotalCents) });
  }
  if (!drivers.length) drivers.push({ title: t("buildingsId.reporting.driver.stable.title"), body: t("buildingsId.reporting.driver.stable.body"), impact: "" });
  return drivers;
}

function buildBuildingWatchItems(bf, arrears, unitData, moveIns, moveOuts, benchmark, leaseExpiries, t) {
  const items = [];
  if (!bf) return items;
  const viewInvoices = { label: t("buildingsId.reporting.viewInvoices"), href: "/manager/finance/invoices" };
  if (arrears?.overdue61plusCents > 0) items.push({ text: t("buildingsId.reporting.watch.overdue61", { amount: rFmtChf(arrears.overdue61plusCents) }), severity: "red", action: viewInvoices });
  if (arrears?.overdue31to60Cents > 0) items.push({ text: t("buildingsId.reporting.watch.overdue31", { amount: rFmtChf(arrears.overdue31to60Cents) }), severity: "amber" });
  if (bf.collectionRate < 0.8 && bf.accruedIncomeCents > 0) items.push({ text: t("buildingsId.reporting.watch.collectionRate", { rate: rFmtPct(bf.collectionRate) }), severity: "amber", action: viewInvoices });
  // Unbilled rent = recognized (lease terms) − invoiced this period. Flag only a
  // material gap (>10% and >CHF 200) so proration noise doesn't trigger it. This
  // is the "earned but not yet invoiced" signal — distinct from arrears (invoiced
  // but unpaid), which the collection-rate item above covers.
  const unbilledCents = (bf.accruedIncomeCents ?? 0) - (bf.invoicedForPeriodCents ?? 0);
  if (bf.accruedIncomeCents > 0 && unbilledCents > Math.max(20000, bf.accruedIncomeCents * 0.1)) {
    items.push({ text: t("buildingsId.reporting.watch.unbilled", { amount: rFmtChf(unbilledCents) }), severity: "amber", action: { label: t("buildingsId.reporting.reviewBilling"), href: "/manager/finance/invoices" } });
  }
  const vacantUnits = (unitData ?? []).filter((u) => u.occupancyRate === 0);
  if (vacantUnits.length > 0) items.push({ text: t("buildingsId.reporting.watch.vacant", { count: vacantUnits.length, units: vacantUnits.map((u) => t("buildingsId.reporting.unitLabel", { number: u.unitNumber })).join(", ") }), severity: "amber" });
  if (moveOuts?.length > 0) items.push({ text: t("buildingsId.reporting.watch.movedOut", { count: moveOuts.length }), severity: "violet" });
  // Folded in from the retired executive summary: below-median position + the
  // forward outlook's lease-expiry signal.
  if (benchmark && benchmark.count >= 2 && bf.collectedIncomeCents > 0) {
    const margin = bf.netOperatingIncomeCents / bf.collectedIncomeCents;
    if (margin < benchmark.noiMarginMedian - 0.03) {
      items.push({ text: t("buildingsId.reporting.summary.benchmark.below", { margin: rFmtPct(margin), median: rFmtPct(benchmark.noiMarginMedian) }), severity: "amber" });
    }
  }
  if (leaseExpiries?.length > 0) items.push({ text: t("buildingsId.reporting.summary.expiries", { count: leaseExpiries.length, units: leaseExpiries.map((e) => e.unitNumber).join(", ") }), severity: "amber" });
  if (!items.length) items.push({ text: t("buildingsId.reporting.watch.allClear"), severity: "violet" });
  return items;
}

const catLabel = (cat, t) => t(`buildingFinancials.category.${cat}`, { defaultValue: cat.charAt(0) + cat.slice(1).toLowerCase() });

// Biggest expense-account moves between two periods (current vs benchmark),
// signed (d>0 = cost rose), ≥ CHF 200, top 5 by magnitude. Shared by the
// prior/last-year comparison and the multi-period card's narrative.
function computeExpenseMovers(bf, benchBf) {
  if (!bf || !benchBf) return [];
  const beMap = new Map((benchBf.expensesByAccount ?? []).map((a) => [a.accountId ?? a.accountName, a]));
  const seen = new Set();
  const rows = (bf.expensesByAccount ?? []).map((a) => { const k = a.accountId ?? a.accountName; seen.add(k); return { name: a.accountName ?? a.accountCode ?? "—", d: a.totalCents - (beMap.get(k)?.totalCents ?? 0) }; });
  for (const a of (benchBf.expensesByAccount ?? [])) { const k = a.accountId ?? a.accountName; if (!seen.has(k)) rows.push({ name: a.accountName ?? a.accountCode ?? "—", d: -a.totalCents }); }
  return rows.filter((x) => Math.abs(x.d) >= 20000).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 5);
}

// Plain-language read of a period-over-period comparison: what happened to NOI,
// what drove it (income vs costs, then the biggest cost movers), the effect on
// the building's net yield, and what to monitor next. Deterministic — every
// number comes straight from the compared DTOs; each sentence is a standalone
// i18n string (no fragment concatenation). Empty until a benchmark is loaded.
function buildComparisonNarrative({ curNoi, beNoi, curIncome, beIncome, curExp, beExp, curColl, beColl, curOcc, beOcc, movers, curYield, beYield, periodLabel, cmpPeriodLabel, t }) {
  const s = [];
  if (!Number.isFinite(curNoi) || !Number.isFinite(beNoi)) return s;
  const K = "buildingsId.reporting.compare.narrative";
  const noiDelta = curNoi - beNoi;
  const noiPct = beNoi ? `${Math.abs(Math.round((noiDelta / Math.abs(beNoi)) * 100))}%` : "—";
  const flatThreshold = Math.max(20000, Math.abs(beNoi) * 0.02);

  if (Math.abs(noiDelta) < flatThreshold) {
    s.push(t(`${K}.noiFlat`, { prevPeriod: cmpPeriodLabel, period: periodLabel, to: rFmtChf(curNoi) }));
  } else {
    s.push(t(`${K}.${noiDelta > 0 ? "noiRose" : "noiFell"}`, {
      from: rFmtChf(beNoi), to: rFmtChf(curNoi), prevPeriod: cmpPeriodLabel, period: periodLabel,
      delta: rFmtChf(Math.abs(noiDelta)), pct: noiPct,
    }));
    // Decompose the NOI move: income lifts NOI by +incomeΔ, expenses by −expΔ.
    // Attribute to whichever contribution actually pushed NOI in the direction it
    // moved (largest magnitude) — so the driver never contradicts the headline.
    const incomeDelta = curIncome - beIncome;
    const expDelta = curExp - beExp;
    const aligned = (contrib) => (noiDelta > 0 ? contrib > 0 : contrib < 0);
    const candidates = [];
    if (aligned(incomeDelta)) candidates.push({ kind: "income", mag: Math.abs(incomeDelta), up: incomeDelta > 0 });
    if (aligned(-expDelta)) candidates.push({ kind: "cost", mag: Math.abs(expDelta), up: expDelta > 0 });
    candidates.sort((a, b) => b.mag - a.mag);
    const drv = candidates[0];
    if (drv?.kind === "cost") {
      s.push(t(`${K}.driverCosts${drv.up ? "Up" : "Down"}`, { amount: rFmtChf(drv.mag) }));
      const rising = (movers ?? []).filter((m) => m.d > 0).slice(0, 3).map((m) => m.name);
      if (drv.up && rising.length) s.push(t(`${K}.movers`, { items: rising.join(", ") }));
    } else if (drv?.kind === "income") {
      s.push(t(`${K}.driverIncome${drv.up ? "Up" : "Down"}`, { amount: rFmtChf(drv.mag) }));
    }
  }

  if (curYield != null && beYield != null) {
    const yd = Math.round((curYield - beYield) * 10) / 10;
    s.push(t(`${K}.yieldMoved`, { from: `${beYield.toFixed(1)}%`, to: `${curYield.toFixed(1)}%`, delta: `${yd > 0 ? "+" : ""}${yd.toFixed(1)}` }));
  } else if (curYield != null) {
    s.push(t(`${K}.yieldStands`, { value: `${curYield.toFixed(1)}%` }));
  }

  const monitor = [];
  const rising = (movers ?? []).filter((m) => m.d > 0);
  if (curExp - beExp > 0 && rising.length) monitor.push(rising[0].name);
  if (curColl != null && beColl != null && curColl < beColl - 0.02) monitor.push(t(`${K}.monitorCollection`));
  if (curOcc != null && beOcc != null && curOcc < beOcc - 0.001) monitor.push(t(`${K}.monitorVacancy`));
  if (monitor.length) s.push(t(`${K}.monitor`, { items: monitor.join(", ") }));

  return s;
}

// The "What this means" read-out shown under the comparison table — a friendly
// explainer callout (icon + heading + plain-language sentences). Styled to stand
// out as the hand-holding layer for non-financial owners: this is the part that
// says, in words, what the numbers above mean.
function ComparisonNarrative({ lines, t }) {
  if (!lines?.length) return null;
  return (
    <div className="rounded-xl border border-info-ring bg-info-light px-5 py-4">
      <div className="mb-2.5 flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-info text-sm font-bold text-white">i</span>
        <p className="text-sm font-semibold text-info-text">{t("buildingsId.reporting.compare.narrative.heading")}</p>
      </div>
      <div className="space-y-2 pl-[38px]">
        {lines.map((line, i) => <p key={i} className="text-sm leading-6 text-foreground">{line}</p>)}
      </div>
    </div>
  );
}

// The reporting detail for one period. The period ([from,to] + its label) is
// chosen by the period navigator above (BuildingReportingView); the time-series
// points + focus are passed in so the Revenue & expenses slide can render the
// histogram and let a bar click/brush re-drive the period.
function BuildingPeriodAnalysis({ buildingId, etatLocatifNet, from, to, periodLabel }) {
  const { t } = useTranslation("manager");
  const router = useRouter();
  const [unitsExpanded, setUnitsExpanded] = useState(false);
  const [insExpanded, setInsExpanded]     = useState(false);
  const [outsExpanded, setOutsExpanded]   = useState(false);
  const [whyOpen, setWhyOpen]             = useState(false); // exec-summary narrative disclosure
  const [reclassMode, setReclassMode]     = useState(false); // reclassify cost-centre categories
  const [refreshKey, setRefreshKey]       = useState(0);     // bumps to refetch after a reclassify
  const [report, setReport]   = useState(null);
  const [unitData, setUnitData] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [profit, setProfit]   = useState(null);   // building value + net yield (for the KPI strip)
  const [movesOpen, setMovesOpen] = useState(false); // tenant-movements disclosure
  const [expView, setExpView] = useState("acc"); // Revenue & expenses: cost-center | vendor
  const [incomeExpanded, setIncomeExpanded] = useState(false); // revex income column: show all units
  const [expExpanded, setExpExpanded] = useState(false);       // revex expense column: show all rows
  const [expandedUnitId, setExpandedUnitId] = useState(null);  // by-unit: which row's cost detail is open
  const [unitLines, setUnitLines] = useState({});              // by-unit: unitId → { loading, error, data }
  const [breakdownView, setBreakdownView] = useState("ie"); // breakdown sub-view: ie | unit | prof
  const [metricsOpen, setMetricsOpen] = useState(false);    // "All financial metrics" disclosure
  const [benchmark, setBenchmark] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  // Display bits derived from the focused window's end.
  const toDate = new Date(to);
  const year = toDate.getFullYear();
  const month = toDate.getMonth();

  useEffect(() => {
    if (!buildingId) return;
    setLoading(true);
    setError("");
    setExpandedUnitId(null);   // per-unit drill-down cache is window-scoped
    setUnitLines({});
    const q = new URLSearchParams({ from, to }).toString();
    Promise.all([
      fetch(`/api/buildings/${buildingId}/period-report?${q}`, { headers: authHeaders() }).then((r) => r.json()),
      fetch(`/api/buildings/${buildingId}/unit-financials?from=${from}&to=${to}`, { headers: authHeaders() }).then((r) => r.json()),
      fetch(`/api/buildings/${buildingId}/vendor-spend?from=${from}&to=${to}`, { headers: authHeaders() }).then((r) => r.json()).catch(() => null),
      fetch(`/api/financials/portfolio-summary?from=${from}&to=${to}`, { headers: authHeaders() }).then((r) => r.json()).catch(() => null),
      fetch(`/api/buildings/${buildingId}/unit-profitability?from=${from}&to=${to}`, { headers: authHeaders() }).then((r) => r.json()).catch(() => null),
    ])
      .then(([rpt, uf, vs, ps, pr]) => {
        setReport(rpt?.data ?? null); setUnitData(uf?.data ?? []); setVendors(vs?.data ?? []); setProfit(pr?.data ?? null);
        // Portfolio benchmark: median NOI margin / OpEx ratio across the org's buildings.
        const bs = (ps?.data?.buildings ?? []).filter((b) => b.collectedIncomeCents > 0);
        const median = (arr) => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : 0; };
        setBenchmark(bs.length >= 2
          ? { count: bs.length, noiMarginMedian: median(bs.map((b) => b.netOperatingIncomeCents / b.collectedIncomeCents)), opexRatioMedian: median(bs.map((b) => b.operatingTotalCents / b.collectedIncomeCents)) }
          : null);
      })
      .catch(() => setError(t("buildingsId.reporting.failedToLoad")))
      .finally(() => setLoading(false));
  }, [buildingId, from, to, t, refreshKey]);

  // Persist a manager's cost-category override on the account, then refetch.
  async function reclassifyAccount(accountId, category) {
    if (!accountId) return;
    try {
      await fetch(`/api/coa/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ costCategory: category }),
      });
      setRefreshKey((k) => k + 1);
    } catch { /* leave numbers as-is on failure */ }
  }

  // Lazily load the invoices behind a unit's "Direct costs" figure (drill-down).
  // Cached per unit for the focused window; the cache is cleared when from/to change.
  function toggleUnitLines(unitId) {
    setExpandedUnitId((cur) => (cur === unitId ? null : unitId));
    if (unitLines[unitId]) return;
    setUnitLines((m) => ({ ...m, [unitId]: { loading: true } }));
    fetch(`/api/units/${unitId}/expense-lines?from=${from}&to=${to}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setUnitLines((m) => ({ ...m, [unitId]: { loading: false, data: d?.data ?? null } })))
      .catch(() => setUnitLines((m) => ({ ...m, [unitId]: { loading: false, error: true } })));
  }

  const bf   = report?.financials ?? null;
  const prev = report?.prevFinancials ?? null;
  const arrears   = report?.arrears ?? null;
  const moveIns   = report?.moveIns  ?? [];
  const moveOuts  = report?.moveOuts ?? [];

  const noi      = bf?.netOperatingIncomeCents ?? 0;
  const earned   = bf?.collectedIncomeCents       ?? 0;
  const expenses = bf?.expensesTotalCents       ?? 0;
  const coll     = bf?.collectionRate           ?? 0;
  const occ      = bf && bf.totalUnitsCount > 0 ? bf.activeUnitsCount / bf.totalUnitsCount : null;
  // Operating basis: NOI excludes capex + financing (régie P&Ls bundle them in).
  const operatingCents  = bf?.operatingTotalCents ?? expenses;
  const capexCents      = bf?.capexTotalCents ?? 0;
  const financingCents  = bf?.financingTotalCents ?? 0;
  const recoverableCents = bf?.recoverableAncillaryCents ?? 0;
  const tenantRechargeCents = bf?.tenantRechargeCents ?? 0;
  const netResultCents  = bf?.netIncomeCents ?? noi; // after capex + financing
  const noiMargin = earned > 0 ? noi / earned : null;
  const opexRatio = earned > 0 ? operatingCents / earned : null;

  // ── Owner-first headline metrics ──
  // Net yield needs a valuation (from the profitability endpoint); "—" without one.
  const yieldPct = profit?.buildingNetYieldPct ?? null;
  const buildingValueChf = profit?.buildingIntrinsicValueChf ?? null;
  // Free cash flow = NOI − capex − financing (mortgage interest). Financing is 0 on
  // the operational path, so FCF = NOI − capex there. Principal is not yet deducted.
  const fcfCents = noi - capexCents - financingCents;
  const prevFcfCents = prev ? (prev.netOperatingIncomeCents - (prev.capexTotalCents ?? 0) - (prev.financingTotalCents ?? 0)) : null;
  const prevOcc = prev && prev.totalUnitsCount > 0 ? prev.activeUnitsCount / prev.totalUnitsCount : null;
  const prevYieldFrac = buildingValueChf && prev ? (prev.netOperatingIncomeCents / 100) / buildingValueChf : null;

  // Net rent roll (contractual potential income), scaled to the selected period so
  // it's comparable to the period's actuals. etatLocatifNet is the ANNUAL figure (CHF).
  // Months spanned by the focused window (inclusive), for scaling the rent roll.
  const fromDate = new Date(from);
  const periodMonths = Math.max(1, (year - fromDate.getFullYear()) * 12 + (month - fromDate.getMonth()) + 1);
  const rentRollCents = etatLocatifNet != null
    ? Math.round(etatLocatifNet * 100 * periodMonths / 12)
    : null;

  // No P&L for the period: not an approved imported statement, and no posted
  // ledger actuals (revenue / expense / accrual all zero). Occupancy + rent roll
  // still render from lease/unit data, so the financial cards would sit silently
  // blank — surface a CTA to import/approve an income statement instead.
  const noPnlData = !!bf
    && bf.source !== "imported"
    && earned === 0
    && expenses === 0
    && (bf.accruedIncomeCents ?? 0) === 0
    && noi === 0;

  const headline  = buildingHeadline(bf, t);
  // "What drove it" + "What to watch" — the merged panel that the header's Why?
  // disclosure now expands (the separate executive-summary prose + Drivers tab
  // were consolidated here: benchmark → driver/watch, lease expiries → watch).
  const drivers   = buildBuildingDrivers(bf, prev, benchmark, t);
  const watchItems = buildBuildingWatchItems(bf, arrears, unitData, moveIns, moveOuts, benchmark, report?.leaseExpiries ?? [], t);

  const visibleUnits = unitsExpanded ? unitData : unitData.slice(0, PREVIEW_UNITS);

  return (
    <div>
      {error && <p className="text-sm text-red-600 p-4">{error}</p>}
      {/* First load only — once we have data we keep it on screen during refetch
          (stale-while-revalidate) so period changes don't blank/reset the tab. */}
      {!bf && loading && <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-24 rounded-3xl animate-pulse bg-surface-hover" />)}</div>}

      {bf && (() => {
        // ── Result — a calm header (verdict + Why?), an always-visible KPI strip,
        //    and a single consolidated flags row (arrears · opening balances). The
        //    gradient hero and the three separate alert blocks are retired here. ──
        const topSection = (
          <header className="p-5 sm:p-6 border-b border-surface-border">
            <div className="flex flex-wrap items-center gap-2 mb-2.5">
              <span className="inline-flex items-center rounded-full border border-surface-border bg-surface-subtle px-3 py-1 text-xs font-medium text-muted">
                {periodLabel} · {t("buildingsId.reporting.monthlyReport")}
              </span>
              {bf.source === "imported" && (
                <span className="inline-flex items-center rounded-full border border-brand-ring bg-brand-light px-3 py-1 text-xs font-medium text-brand-dark" title={t("buildingsId.reporting.importedActualsTooltip")}>
                  {t("buildingsId.reporting.importedActuals", { year })}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">{headline}</h1>
              <button onClick={() => setWhyOpen((v) => !v)} aria-expanded={whyOpen} className="text-sm font-semibold text-brand hover:underline">
                {whyOpen ? t("buildingsId.reporting.why.hide") : t("buildingsId.reporting.why.show")}
              </button>
            </div>
          </header>
        );

        // 5 owner-first headline KPIs — return, cash, operating result, health.
        const kpiStripItems = [
          { k: t("buildingsId.reporting.kpi.netYield", { defaultValue: "Net yield" }),
            v: yieldPct != null ? `${yieldPct.toFixed(2)}%` : "—",
            tip: yieldPct != null && buildingValueChf ? t("buildingsId.reporting.kpi.netYieldTip", { defaultValue: "NOI ÷ building value ({{val}})", val: rFmtChf(buildingValueChf * 100) }) : t("buildingsId.reporting.kpi.netYieldNoVal", { defaultValue: "Add a valuation to compute yield" }),
            flag: yieldPct != null && yieldPct < 3,
            d: prevYieldFrac != null ? kpiDeltaPp(yieldPct / 100, prevYieldFrac, 1) : null },
          { k: t("buildingsId.reporting.kpi.freeCashFlow", { defaultValue: "Free cash flow" }),
            v: rFmtChf(fcfCents),
            tip: t("buildingsId.reporting.kpi.fcfTip", { defaultValue: "NOI − capex − mortgage interest. Before debt principal." }),
            d: prevFcfCents != null ? kpiDeltaChf(fcfCents, prevFcfCents, 1) : null },
          { k: t("buildingsId.reporting.kpi.noi"),              v: rFmtChf(noi),                     d: prev ? kpiDeltaChf(noi, prev.netOperatingIncomeCents, 1) : null },
          { k: t("buildingsId.reporting.kpi.occupancy"),        v: occ != null ? rFmtPct(occ) : "—", d: prevOcc != null ? kpiDeltaPp(occ, prevOcc, 1) : null },
          { k: t("buildingsId.reporting.kpi.onTimeCollection"), v: rFmtPct(coll),                    d: prev ? kpiDeltaPp(coll, prev.collectionRate, 1) : null },
        ];
        const kpiStripEl = (
          <div className="grid grid-cols-2 gap-px border-b border-surface-border bg-surface-border sm:grid-cols-3 lg:grid-cols-5">
            {kpiStripItems.map((x, i) => (
              <div key={i} className="bg-surface p-3">
                <div className="text-[10.5px] font-medium uppercase tracking-wide text-foreground-dim" title={x.tip || undefined}>
                  {x.tip ? <span className="cursor-help underline decoration-dotted decoration-foreground-dim underline-offset-2">{x.k}</span> : x.k}
                </div>
                <div className={cn("mt-1 text-lg font-semibold tabular-nums tracking-tight", x.flag ? "text-warning-text" : "text-foreground")}>{x.v}</div>
                {x.d
                  ? <div className={cn("mt-0.5 text-[11px] font-medium tabular-nums", x.d.cls)}>{x.d.txt}</div>
                  : <div className="mt-0.5 text-[11px] text-foreground-dim">—</div>}
              </div>
            ))}
          </div>
        );

        // Consolidated flags — arrears + opening-balance carry-in, one quiet row.
        const flags = [];
        if (bf.receivablesCents > 0) flags.push({
          tone: "warn",
          text: t("buildingsId.reporting.arrears.uncollectedShort", { amount: rFmtChf(bf.receivablesCents) })
            + (arrears && arrears.totalOverdueCents > 0 ? " · " + t("buildingsId.reporting.arrears.overdueShort", { amount: rFmtChf(arrears.totalOverdueCents) }) : ""),
        });
        if (bf.openingReceivablesCents > 0 || bf.openingPayablesCents > 0) flags.push({
          tone: "info",
          text: [
            bf.openingReceivablesCents > 0 ? t("buildingsId.reporting.openingReceivable", { amount: rFmtChf(bf.openingReceivablesCents) }) : null,
            bf.openingPayablesCents > 0 ? t("buildingsId.reporting.openingPayable", { amount: rFmtChf(bf.openingPayablesCents) }) : null,
          ].filter(Boolean).join(" · "),
        });
        // Ledger integrity: a non-zero trial-balance means unbalanced entries were
        // posted (typically an imported opening balance that didn't tie out).
        const ledgerImbalanceCents = report?.ledgerImbalanceCents ?? 0;
        if (Math.abs(ledgerImbalanceCents) >= 100) flags.push({
          tone: "danger",
          text: t("buildingsId.reporting.ledgerImbalance", { amount: rFmtChf(Math.abs(ledgerImbalanceCents)) }),
        });
        const flagsRow = flags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-surface-border bg-surface-subtle px-5 py-3">
            {flags.map((f, i) => (
              <span key={i} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
                f.tone === "danger" ? "border-destructive-ring bg-destructive-light text-destructive-text"
                  : f.tone === "warn" ? "border-warning-ring bg-warning-light text-warning-text"
                    : "border-info-ring bg-info-light text-info-text")}>
                {f.tone === "danger" ? "⛔" : f.tone === "warn" ? "⚠" : "↪"} {f.text}
              </span>
            ))}
            {bf.receivablesCents > 0 && (
              <a href="/manager/finance/invoices" className="ml-auto text-xs font-semibold text-brand no-underline hover:underline">{t("buildingsId.reporting.viewInvoices")} →</a>
            )}
          </div>
        );

        // No P&L for the period — occupancy/rent roll are lease-derived, but income
        // & expenses need an approved statement or ledger actuals. Calm empty state.
        const noPnlBlock = (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-surface-border bg-info-light px-5 py-4">
            <span className="shrink-0 text-info-text">ℹ</span>
            <span className="text-sm font-medium text-foreground">{t("buildingsId.reporting.noPnl.message", { year })}</span>
            <a href="/manager/finance" className="ml-auto shrink-0 rounded-lg border border-info-ring px-3 py-1.5 text-xs font-semibold text-info-text transition-colors hover:bg-info hover:text-white no-underline">
              {t("buildingsId.reporting.noPnl.cta")} →
            </a>
          </div>
        );

        // Grouped detail — everything the 5-KPI headline strip doesn't show: the
        // secondary performance ratios/figures, income, costs and balances.
        const kpiGroups = [
          { label: t("buildingsId.reporting.kpiGroup.performance", { defaultValue: "Performance" }),
            left: [
              { label: t("buildingsId.reporting.kpi.noiMargin"), value: noiMargin != null ? rFmtPct(noiMargin) : "—", delta: prev && prev.collectedIncomeCents > 0 ? kpiDeltaPp(noiMargin, prev.netOperatingIncomeCents / prev.collectedIncomeCents, 1) : null },
              { label: t("buildingsId.reporting.kpi.opexRatio"), value: opexRatio != null ? rFmtPct(opexRatio) : "—", delta: prev && prev.collectedIncomeCents > 0 ? kpiDeltaPp(opexRatio, prev.expensesTotalCents / prev.collectedIncomeCents, -1) : null },
            ],
            right: [
              { label: t("buildingsId.reporting.kpi.cashReceived"), value: rFmtChf(earned), delta: prev ? kpiDeltaChf(earned, prev.collectedIncomeCents, 1) : null },
              { label: t("buildingsId.reporting.revex.operating"),  value: rFmtChf(operatingCents), delta: prev ? kpiDeltaChf(operatingCents, prev.operatingTotalCents ?? prev.expensesTotalCents, -1) : null },
            ] },
          { label: t("buildingsId.reporting.kpiGroup.income"),
            left: [
              { label: t("buildingsId.reporting.kpi.accruedIncome"), value: rFmtChf(bf.accruedIncomeCents), delta: null },
              { label: t("buildingsId.reporting.kpi.rentalIncome"),  value: rFmtChf(bf.rentalIncomeCents), delta: null },
            ],
            right: [
              { label: t("buildingsId.reporting.kpi.serviceCharges"), value: rFmtChf(bf.serviceChargeIncomeCents), delta: null },
            ] },
          { label: t("buildingsId.reporting.kpiGroup.costs"),
            left: [
              { label: t("buildingsId.reporting.kpi.totalExpenses"),    value: rFmtChf(expenses), delta: prev ? buildingDelta(-expenses, -prev.expensesTotalCents) : null },
              { label: t("buildingsId.reporting.kpi.maintenance"),      value: rFmtChf(bf.maintenanceTotalCents), delta: null },
              { label: t("buildingsId.reporting.kpi.maintenanceRatio"), value: bf.maintenanceRatio != null ? rFmtPct(bf.maintenanceRatio) : "—", delta: null },
            ],
            right: [
              ...(financingCents > 0 ? [{ label: t("buildingsId.reporting.kpi.mortgageInterest", { defaultValue: "Mortgage interest" }), value: rFmtChf(financingCents), delta: null }] : []),
              { label: t("buildingsId.reporting.kpi.capex"),       value: rFmtChf(bf.capexTotalCents), delta: null },
              { label: t("buildingsId.reporting.kpi.costPerUnit"), value: rFmtChf(bf.costPerUnitCents), delta: null },
            ] },
          { label: t("buildingsId.reporting.kpiGroup.balances"),
            left: [
              { label: t("buildingsId.reporting.kpi.receivables"), value: bf.receivablesCents > 0 ? rFmtChf(bf.receivablesCents) : "—", delta: null },
              { label: t("buildingsId.reporting.kpi.payables"),    value: bf.payablesCents > 0 ? rFmtChf(bf.payablesCents) : "—", delta: null },
            ],
            right: [
              { label: t("buildingsId.reporting.kpi.rentRoll"), value: rentRollCents != null ? rFmtChf(rentRollCents) : "—", delta: null },
            ] },
        ];
        const normalKpis = (
          <div className="space-y-4">
            {kpiGroups.map((g) => (
              <div key={g.label}>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-dim">{g.label}</p>
                <KpiTable flush isLoading={false} left={g.left} right={g.right} />
              </div>
            ))}
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs">
              <a href="/manager/finance/ledger" className="text-brand no-underline hover:underline">{t("buildingsId.reporting.generalLedger")} →</a>
              <a href="/manager/finance/chart-of-accounts" className="text-brand no-underline hover:underline">{t("buildingsId.reporting.chartOfAccounts")} →</a>
            </div>
          </div>
        );
        // The income/cost/balance detail disclosure under the KPI strip — the
        // metrics the strip doesn't already show (no longer a duplicating superset).
        const metricsCollapsible = (
          <div className="border-b border-surface-border">
            <button onClick={() => setMetricsOpen((v) => !v)} aria-expanded={metricsOpen}
              className="flex w-full items-center justify-between gap-2 px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-hover">
              <span>{t("buildingsId.reporting.moreMetrics", { defaultValue: "More metrics" })}</span>
              <span className="text-foreground-dim">{metricsOpen ? "▾" : "▸"}</span>
            </button>
            {metricsOpen && <div className="px-5 pb-5">{normalKpis}</div>}
          </div>
        );


        // ── Slide 2: What drove it / What to watch ──
        const driversSlide = (
          <div className="overflow-hidden">
            <div className="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-surface-border">
              <div className="flex flex-col">
                <div className="px-7 py-4 bg-surface-subtle border-b border-surface-border">
                  <div className="flex items-center gap-2.5 mb-0.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-hover text-xs font-bold text-muted">⇅</div>
                    <h2 className="text-sm font-semibold text-foreground">{t("buildingsId.reporting.whatDrove")}</h2>
                  </div>
                  <p className="text-xs text-foreground-dim ml-[34px]">{t("buildingsId.reporting.whatDroveSub")}</p>
                </div>
                <div className="px-7 py-5 flex-1">
                  {drivers.map((d, i) => <DriverItem key={i} number={i + 1} title={d.title} body={d.body} impact={d.impact} positive={d.positive} />)}
                </div>
              </div>
              <div className="flex flex-col">
                <div className="px-7 py-4 bg-warning-light border-b border-warning-ring">
                  <div className="flex items-center gap-2.5 mb-0.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-warning-light text-xs font-bold text-warning-text">!</div>
                    <h2 className="text-sm font-semibold text-warning-text">{t("buildingsId.reporting.whatToWatch")}</h2>
                  </div>
                  <p className="text-xs text-warning-text/80 ml-[34px]">{t("buildingsId.reporting.whatToWatchSub")}</p>
                </div>
                <div className="px-7 py-5 flex-1">
                  {watchItems.length > 0
                    ? watchItems.map((item, i) => <WatchItem key={i} number={i + 1} text={item.text} severity={item.severity} action={item.action} />)
                    : <div className="flex items-start gap-4 pt-2"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-light text-success-text">✓</div><p className="text-sm text-muted-text leading-relaxed self-center">{t("buildingsId.reporting.noFlags")}</p></div>}
                </div>
              </div>
            </div>
          </div>
        );

        // ── Slide 3: By unit ──
        const byUnitSlide = (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">{t("buildingsId.reporting.byUnit")}</h2>
                <p className="text-xs text-foreground-dim mt-0.5">{t("buildingsId.reporting.byUnitSub", { period: periodLabel })}</p>
              </div>
              {unitData.length > PREVIEW_UNITS && (
                <button onClick={() => setUnitsExpanded((v) => !v)} className="text-xs font-medium text-muted-dark hover:text-foreground transition-colors">
                  {unitsExpanded ? `${t("buildingsId.reporting.collapse")} ↑` : `${t("buildingsId.reporting.showAll", { count: unitData.length })} ↓`}
                </button>
              )}
            </div>
            {unitData.length === 0
              ? <p className="text-sm text-muted italic">{t("buildingsId.reporting.noUnits")}</p>
              : <>
                <div className="space-y-2">{visibleUnits.map((u) => <UnitRow key={u.unitId} unitNumber={u.unitNumber} floor={u.floor} tenantName={u.tenantName} earned={u.collectedIncomeCents} expenses={u.expensesCents} charges={u.apportionedChargesCents} net={u.netIncomeCents} collectionRate={u.collectionRate} occupancyRate={u.occupancyRate} expandable={u.expensesCents > 0} expanded={expandedUnitId === u.unitId} onToggle={() => toggleUnitLines(u.unitId)} detail={unitLines[u.unitId]} buildingId={buildingId} from={from} to={to} />)}</div>
                <p className="mt-3 flex items-start gap-1.5 text-xs text-foreground-dim">
                  <span aria-hidden>ℹ</span>
                  <span>{t("buildingsId.reporting.byUnitDirectNote")}</span>
                </p>
              </>}
          </div>
        );

        // ── Revenue & expenses (P&L): trend histogram + income vs expense attribution ──
        // Drill from a row into the invoices view, filtered to this period + vendor/account.
        const drillHref = ({ contractorId, issuerName, accountId, ctxVendor }) => {
          const p = new URLSearchParams({ tab: "invoices", direction: "incoming", buildingId, issueDateFrom: from, issueDateTo: to, ctxPeriod: periodLabel });
          if (ctxVendor) p.set("ctxVendor", ctxVendor);
          if (contractorId) p.set("vendorContractorId", contractorId);
          else if (issuerName) p.set("issuerName", issuerName);
          if (accountId) p.set("accountId", accountId);
          return `/manager/finance?${p.toString()}`;
        };
        // Cost-centers come from the financials' ledger decomposition (reconciles to
        // the expense total), NOT invoices — so they're populated even when a period's
        // expenses are ledger-only. Any gap to the total lands in an "Other" row.
        // Capital works + financing are excluded here (they're shown below NOI), so
        // the cost-centre list sums to OPERATING, matching the bridge above.
        const allAcctRows = (bf.expensesByAccount ?? [])
          .map((a) => ({ accountId: a.accountId, accountCode: a.accountCode, accountName: a.accountName, totalCents: a.totalCents, category: a.category }));
        const acctRows = allAcctRows.filter((a) => a.category !== "CAPEX" && a.category !== "FINANCING" && a.category !== "TENANT_RECHARGE");
        const acctSum = acctRows.reduce((s, a) => s + a.totalCents, 0);
        const otherCents = operatingCents - acctSum;
        const periodAccounts = otherCents > 5000
          ? [...acctRows, { accountId: null, accountCode: null, accountName: t("buildingsId.reporting.revex.otherExpenses"), totalCents: otherCents }]
          : acctRows;
        // Vendor lens is invoice-based and may cover only part of the total.
        const vendItemised = vendors.reduce((s, v) => s + v.totalCents, 0);
        const uncoveredCents = expenses - vendItemised;
        const incomeUnits = [...unitData].sort((a, b) => (b.collectedIncomeCents ?? 0) - (a.collectedIncomeCents ?? 0));
        const incMax = Math.max(1, ...incomeUnits.map((u) => u.collectedIncomeCents ?? 0));
        const categoryRows = (bf.expensesByCategory ?? []).map((c) => ({ name: catLabel(c.category, t), totalCents: c.totalCents })).sort((a, b) => b.totalCents - a.totalCents);
        // In reclassify mode the cost-centre view shows EVERY account (incl. the
        // capex/financing ones filtered out above) so any can be re-categorised.
        const expRows = expView === "vend" ? vendors : expView === "cat" ? categoryRows : (reclassMode && expView === "acc" ? allAcctRows : periodAccounts);
        const catShort = (c) => c === "RECOVERABLE" ? t("buildingsId.reporting.revex.catRecoverable")
          : c === "TENANT_RECHARGE" ? t("buildingsId.reporting.revex.catTenantRecharge")
          : c === "CAPEX" ? t("buildingsId.reporting.kpi.capex")
          : c === "FINANCING" ? t("buildingsId.reporting.revex.financing")
          : t("buildingsId.reporting.revex.catOwner");
        const CAT_CHIP = { OWNER_OPEX: "bg-surface-hover text-muted", RECOVERABLE: "bg-warning-light text-warning-text", TENANT_RECHARGE: "bg-success-light text-success-text", CAPEX: "bg-brand-light text-brand-dark", FINANCING: "bg-info-light text-info-text" };

        const revexSlide = (
          <div className="p-5 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-foreground mb-1">{t("buildingsId.reporting.revex.title")}</h2>
              <p className="text-xs text-foreground-dim">{t("buildingsId.reporting.revex.sub")}</p>
            </div>

            {/* Income − Operating = NOI (capex + financing are pulled out, below) */}
            <div className="flex items-stretch overflow-hidden rounded-2xl border border-surface-border text-center">
              <div className="flex-1 px-3 py-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground-dim">{t("buildingsId.reporting.histogram.income")}</div>
                <div className="text-base font-bold tabular-nums text-foreground">{rFmtChf(earned)}</div>
              </div>
              <div className="grid w-7 place-items-center bg-surface-hover text-foreground-dim">−</div>
              <div className="flex-1 px-3 py-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground-dim">{t("buildingsId.reporting.revex.operating")}</div>
                <div className="text-base font-bold tabular-nums text-foreground">{rFmtChf(operatingCents)}</div>
              </div>
              <div className="grid w-7 place-items-center bg-surface-hover text-foreground-dim">=</div>
              <div className="flex-1 bg-surface-hover px-3 py-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground-dim">{t("buildingsId.reporting.histogram.noi")}</div>
                <div className={cn("text-base font-bold tabular-nums", noi >= 0 ? "text-success-text" : "text-destructive-text")}>{rFmtChf(noi)}</div>
              </div>
            </div>

            {/* Below operating NOI: capital works + financing + tenant recharges, and the net result */}
            {(capexCents > 0 || financingCents > 0 || tenantRechargeCents > 0) && (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-xl border border-surface-border bg-surface-subtle px-4 py-2.5 text-sm">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-dim">{t("buildingsId.reporting.revex.belowNoi")}</span>
                {capexCents > 0 && <span className="text-muted">{t("buildingsId.reporting.kpi.capex")} <b className="tabular-nums text-foreground">{rFmtChf(capexCents)}</b></span>}
                {financingCents > 0 && <span className="text-muted">{t("buildingsId.reporting.revex.financing")} <b className="tabular-nums text-foreground">{rFmtChf(financingCents)}</b></span>}
                {tenantRechargeCents > 0 && <span className="text-muted">{t("buildingsId.reporting.revex.catTenantRecharge")} <b className="tabular-nums text-foreground">{rFmtChf(tenantRechargeCents)}</b></span>}
                <span className="ml-auto text-muted">{t("buildingsId.reporting.revex.netResult")} <b className={cn("tabular-nums", netResultCents >= 0 ? "text-success-text" : "text-destructive-text")}>{rFmtChf(netResultCents)}</b></span>
              </div>
            )}
            {tenantRechargeCents > 0 && (
              <p className="flex items-start gap-1.5 text-xs text-foreground-dim">
                <span aria-hidden>ℹ</span>
                <span>{t("buildingsId.reporting.revex.tenantRechargeNote", { amount: rFmtChf(tenantRechargeCents) })}</span>
              </p>
            )}
            {recoverableCents > 0 && (
              <p className="flex items-start gap-1.5 text-xs text-foreground-dim">
                <span aria-hidden>ℹ</span>
                <span>{t("buildingsId.reporting.revex.recoverableNote", { amount: rFmtChf(recoverableCents) })}</span>
              </p>
            )}

            {/* Income sources (units) | Expense sinks (vendors / cost centers) */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center justify-between gap-2 px-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-dim">{t("buildingsId.reporting.revex.income")}</p>
                  {incomeUnits.length > INCOME_PREVIEW && (
                    <button onClick={() => setIncomeExpanded((v) => !v)} className="text-xs font-medium text-muted-dark hover:text-foreground transition-colors">
                      {incomeExpanded ? `${t("buildingsId.reporting.collapse")} ↑` : `${t("buildingsId.reporting.showAll", { count: incomeUnits.length })} ↓`}
                    </button>
                  )}
                </div>
                {incomeUnits.length === 0
                  ? <p className="text-sm text-muted italic px-1">{t("buildingsId.reporting.noUnits")}</p>
                  : <div className="space-y-1">
                      {(incomeExpanded ? incomeUnits : incomeUnits.slice(0, INCOME_PREVIEW)).map((u) => {
                        const vacant = !u.collectedIncomeCents;
                        return (
                          <div key={u.unitId} className="min-w-0 px-2 py-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="truncate text-sm text-foreground">{u.unitNumber}{u.tenantName ? <span className="text-foreground-dim"> · {u.tenantName}</span> : null}</span>
                              <span className={cn("shrink-0 text-sm font-medium tabular-nums", vacant ? "text-destructive-text" : "text-foreground")}>{vacant ? t("buildingsId.reporting.revex.vacant") : rFmtChf(u.collectedIncomeCents)}</span>
                            </div>
                            {!vacant && <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-hover"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(4, Math.round((u.collectedIncomeCents / incMax) * 100))}%` /* no-token: dynamic income-bar width */ }} /></div>}
                          </div>
                        );
                      })}
                    </div>}
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between gap-2 px-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-dim">{t("buildingsId.reporting.histogram.expenses")}</p>
                  <div className="flex items-center gap-2">
                    {bf.source === "imported" && expView === "acc" && (
                      <button onClick={() => setReclassMode((v) => !v)} aria-pressed={reclassMode}
                        className={cn("rounded-md border px-2 py-0.5 text-xs font-medium transition-colors", reclassMode ? "border-brand bg-brand-light text-brand-dark" : "border-surface-border text-muted hover:border-brand hover:text-brand")}>
                        {reclassMode ? `✓ ${t("buildingsId.reporting.revex.reclassifyDone")}` : t("buildingsId.reporting.revex.reclassify")}
                      </button>
                    )}
                    <div className="inline-flex rounded-lg border border-surface-border bg-surface-hover p-0.5 gap-0.5">
                      {[["acc", t("buildingsId.reporting.revex.byCostCenter")], ["cat", t("buildingsId.reporting.revex.byCategory")], ["vend", t("buildingsId.reporting.revex.byVendor")]].map(([k, l]) => (
                        <button key={k} onClick={() => setExpView(k)} aria-pressed={expView === k}
                          className={cn("rounded-md px-2 py-0.5 text-xs font-medium transition-colors", expView === k ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-muted-dark")}>{l}</button>
                      ))}
                    </div>
                  </div>
                </div>
                {expRows.length === 0
                  ? <p className="text-sm text-muted italic px-1">{t("buildingsId.reporting.revex.noExpenses")}</p>
                  : <div className="space-y-1">
                      {expRows.slice(0, reclassMode && expView === "acc" ? 40 : (expExpanded ? expRows.length : EXPENSE_PREVIEW)).map((r, i) => {
                        const isVend = expView === "vend";
                        const isCat = expView === "cat";
                        const isAcc = !isVend && !isCat;
                        const name = isVend ? r.vendorName : isCat ? r.name : (r.accountName ?? t("buildingsId.reporting.expenseBreakdown.unclassified"));
                        const drillable = isVend ? true : isCat ? false : !!r.accountId; // category isn't an invoice filter; "Other" remainder isn't either
                        // Reclassify mode: a category picker instead of a drill link.
                        if (isAcc && reclassMode && r.accountId) {
                          return (
                            <div key={r.accountId} className="flex items-center gap-2 px-2 py-1">
                              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{r.accountCode ? <span className="text-foreground-dim tabular-nums">{r.accountCode} </span> : null}{name}</span>
                              <select value={r.category ?? "OWNER_OPEX"} onChange={(e) => reclassifyAccount(r.accountId, e.target.value)}
                                className="rounded-md border border-surface-border bg-surface px-1.5 py-0.5 text-xs text-foreground">
                                {["OWNER_OPEX", "RECOVERABLE", "TENANT_RECHARGE", "CAPEX", "FINANCING"].map((c) => <option key={c} value={c}>{catShort(c)}</option>)}
                              </select>
                              <span className="w-20 shrink-0 text-right text-sm font-medium tabular-nums text-foreground">{rFmtChf(r.totalCents)}</span>
                            </div>
                          );
                        }
                        const catTag = isAcc && r.category ? <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide", CAT_CHIP[r.category] ?? CAT_CHIP.OWNER_OPEX)}>{catShort(r.category)}</span> : null;
                        const inner = (
                          <>
                            <span className="min-w-0 flex-1 truncate text-sm text-foreground">{isAcc && r.accountCode ? <span className="text-foreground-dim tabular-nums">{r.accountCode} </span> : null}{name}{isVend && r.invoiceCount ? <span className="text-xs text-foreground-dim"> · {r.invoiceCount}×</span> : null}</span>
                            {catTag}
                            <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium tabular-nums text-foreground">{rFmtChf(r.totalCents)}{drillable && <span className="text-foreground-dim opacity-0 group-hover:opacity-100 transition-opacity">→</span>}</span>
                          </>
                        );
                        return drillable ? (
                          <a key={(isVend ? r.contractorId : r.accountId) || `${name}-${i}`}
                            href={drillHref(isVend ? { contractorId: r.contractorId, issuerName: r.vendorName, ctxVendor: r.vendorName } : { accountId: r.accountId, ctxVendor: r.accountCode ? `${r.accountCode} · ${r.accountName ?? ""}`.trim() : name })}
                            className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-surface-hover no-underline group">{inner}</a>
                        ) : (
                          <div key={`${name}-${i}`} className="flex items-center justify-between gap-2 px-2 py-1">{inner}</div>
                        );
                      })}
                    </div>}
                {!(reclassMode && expView === "acc") && expRows.length > EXPENSE_PREVIEW && (
                  <button onClick={() => setExpExpanded((v) => !v)} className="mt-1.5 px-2 text-xs font-medium text-muted-dark hover:text-foreground transition-colors">
                    {expExpanded ? `${t("buildingsId.reporting.collapse")} ↑` : `${t("buildingsId.reporting.showAll", { count: expRows.length })} ↓`}
                  </button>
                )}
                {/* Vendor lens is invoice-based — flag when it covers only part of the ledger total. */}
                {expView === "vend" && uncoveredCents > 5000 && (
                  <p className="mt-2 flex items-start gap-1.5 px-1 text-[11.5px] text-warning-text">
                    <span aria-hidden>⚠</span>
                    <span>{t("buildingsId.reporting.revex.itemisedNote", { itemised: rFmtChf(vendItemised), total: rFmtChf(expenses) })}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        );

        const unitProfitSlide = (
          <UnitProfitabilityPanel buildingId={buildingId} from={from} to={to} />
        );

        // The three "numbers sliced" views behind one sub-switch. (Comparison used
        // to be a sibling tab here; it's now the page-level Compare mode.)
        const breakdownPanel = breakdownView === "unit" ? byUnitSlide
          : breakdownView === "prof" ? unitProfitSlide
          : revexSlide;
        return (
          <>
            {/* ── Result: calm header + (Why? → drivers/watch) + KPI strip + flags ── */}
            {topSection}
            {whyOpen && <div className="border-b border-surface-border">{driversSlide}</div>}
            {noPnlData ? noPnlBlock : (<>{kpiStripEl}{flagsRow}{metricsCollapsible}</>)}

            {/* ── Detail: Income & expenses · By unit · Profitability (one sub-switch) ── */}
            <div className="border-t border-surface-border">
              <div className="px-4 pb-3 pt-3">
                <div className="inline-flex gap-0.5 rounded-lg border border-surface-border bg-surface-subtle p-0.5">
                  {[["ie", t("buildingsId.reporting.revex.title")], ["unit", t("buildingsId.reporting.byUnit")], ["prof", t("buildingsId.reporting.unitProfitTab")]].map(([k, l]) => (
                    <button key={k} onClick={() => setBreakdownView(k)} aria-pressed={breakdownView === k}
                      className={cn("rounded-md px-3 py-1 text-xs font-medium transition-colors", breakdownView === k ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-muted-dark")}>{l}</button>
                  ))}
                </div>
              </div>
              <div className={cn("border-t border-surface-border", loading && "opacity-60 transition-opacity")}>{breakdownPanel}</div>
            </div>

            {/* ── How it can perform better — the prospective companion to the figures
                   above. Ranked for the owner's mandate; hands off to Planning. ── */}
            <div className="border-t border-surface-border p-4">
              <p className="mb-2.5 text-[13px] italic text-muted">{t("buildingsId.reporting.valueCreation.retro", { defaultValue: "These figures tell you how the asset performed." })}</p>
              <div id="yield-goalseek" className="scroll-mt-20">
                <YieldGoalSeekPanel
                  building={{ id: buildingId }}
                  onPlanImprovements={(opts) => {
                    const p = new URLSearchParams({ tab: "planning", buildingId });
                    if (opts?.simulate) p.set("simulate", "accretive");
                    router.push(`/manager/finance?${p.toString()}`);
                  }}
                />
              </div>
            </div>

            {/* ── Occupancy movements — one-line summary that expands ── */}
            {(moveIns.length > 0 || moveOuts.length > 0) && (
              <div className="border-t border-surface-border">
                <button onClick={() => setMovesOpen((v) => !v)} aria-expanded={movesOpen}
                  className="flex w-full items-center gap-2 px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-hover">
                  <span>{t("buildingsId.reporting.tenantMovements")}</span>
                  <span className="font-normal text-muted">· {t("buildingsId.reporting.movesSummary", { defaultValue: "{{in}} in · {{out}} out", in: moveIns.length, out: moveOuts.length })}</span>
                  <span className="ml-auto text-foreground-dim">{movesOpen ? "▾" : "▸"}</span>
                </button>
                {movesOpen && (
                <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success-light text-xs font-semibold text-success-text">↓</span>
                      <span className="text-sm font-semibold text-foreground">{t("buildingsId.reporting.moveIns")} <span className="ml-1 text-foreground-dim font-normal">({moveIns.length})</span></span>
                    </div>
                    {moveIns.length === 0
                      ? <p className="text-sm text-foreground-dim">{t("buildingsId.reporting.noMoveIns")}</p>
                      : (insExpanded ? moveIns : moveIns.slice(0, 3)).map((l) => <OccupancyRow key={l.id} type="in" tenantName={l.tenantName} unitLabel={l.unitNumber} date={l.startDate} />)}
                    {moveIns.length > 3 && <button onClick={() => setInsExpanded((v) => !v)} className="mt-2 text-xs font-medium text-muted-dark hover:text-foreground">{insExpanded ? t("buildingsId.reporting.showLess") : t("buildingsId.reporting.moreCount", { count: moveIns.length - 3 })}</button>}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-hover text-xs font-semibold text-muted">↑</span>
                      <span className="text-sm font-semibold text-foreground">{t("buildingsId.reporting.moveOuts")} <span className="ml-1 text-foreground-dim font-normal">({moveOuts.length})</span></span>
                    </div>
                    {moveOuts.length === 0
                      ? <p className="text-sm text-foreground-dim">{t("buildingsId.reporting.noMoveOuts")}</p>
                      : (outsExpanded ? moveOuts : moveOuts.slice(0, 3)).map((l) => <OccupancyRow key={l.id} type="out" tenantName={l.tenantName} unitLabel={l.unitNumber} date={l.endDate} />)}
                    {moveOuts.length > 3 && <button onClick={() => setOutsExpanded((v) => !v)} className="mt-2 text-xs font-medium text-muted-dark hover:text-foreground">{outsExpanded ? t("buildingsId.reporting.showLess") : t("buildingsId.reporting.moreCount", { count: moveOuts.length - 3 })}</button>}
                  </div>
                </div>
                )}
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}

const REPORTING_GRANS = ["month", "quarter", "year"];
// Compare mode adds half-year (the extra grain the old multi-period card offered).
const COMPARE_GRANS = ["month", "quarter", "half", "year"];
const COMPARE_MAX = 5; // anchor + up to 4 comparison periods
// Period type → the backend time-series range that yields that granularity.
const GRAN_RANGE = { month: "2Y", quarter: "5Y", year: "10Y" };

// The KPI rows shared by the compare table, ordered as an income-statement story
// so the numbers read top-to-bottom: income in → operating expenses out → the
// resulting NOI (a subtotal) → the ratios that explain it → operational drivers →
// balances. (The net-yield row is appended by the caller.)
const multiKpis = (t) => [
  { label: t("buildingsId.reporting.kpi.cashReceived"),     type: "chf", better: 1,  get: (f) => f.collectedIncomeCents },
  { label: t("buildingsId.reporting.kpi.operatingExpenses"),type: "chf", better: -1, get: (f) => f.operatingTotalCents ?? f.expensesTotalCents },
  { label: t("buildingsId.reporting.kpi.noi"),              type: "chf", better: 1,  subtotal: true, get: (f) => f.netOperatingIncomeCents },
  { label: t("buildingsId.reporting.kpi.noiMargin"),        type: "pct", better: 1,  get: (f) => (f.collectedIncomeCents > 0 ? f.netOperatingIncomeCents / f.collectedIncomeCents : null) },
  { label: t("buildingsId.reporting.kpi.opexRatio"),        type: "pct", better: -1, get: (f) => (f.collectedIncomeCents > 0 ? (f.operatingTotalCents ?? f.expensesTotalCents) / f.collectedIncomeCents : null) },
  { label: t("buildingsId.reporting.kpi.onTimeCollection"), type: "pct", better: 1,  get: (f) => f.collectionRate },
  { label: t("buildingsId.reporting.kpi.occupancy"),        type: "pct", better: 1,  get: (f) => (f.totalUnitsCount > 0 ? f.activeUnitsCount / f.totalUnitsCount : null) },
  { label: t("buildingsId.reporting.kpi.receivables"),      type: "chf", better: -1, get: (f) => f.receivablesCents },
];

// ── Client-side period model for the reporting navigator ─────────────────────
// The navigator only needs the *list of selectable periods* and the current
// window's [from,to]+label — never the per-bucket financials (the detail panel
// fetches its own numbers). So we derive everything from a single anchor date
// on the client: switching Month/Quarter/Year is instant, and the selected
// position is preserved across switches and never reset by a background fetch.
function reportingPeriodStart(gran, d) {
  const y = d.getFullYear(), m = d.getMonth();
  if (gran === "year") return new Date(y, 0, 1);
  if (gran === "half") return new Date(y, m < 6 ? 0 : 6, 1);
  if (gran === "quarter") return new Date(y, Math.floor(m / 3) * 3, 1);
  return new Date(y, m, 1);
}
function reportingPeriodEnd(gran, start) {
  const y = start.getFullYear(), m = start.getMonth();
  if (gran === "year") return new Date(y, 11, 31);
  if (gran === "half") return new Date(y, m + 6, 0);
  if (gran === "quarter") return new Date(y, m + 3, 0);
  return new Date(y, m + 1, 0);
}
function reportingIsoDay(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function reportingStepStart(gran, start, dir) {
  const d = new Date(start);
  if (gran === "year") d.setFullYear(d.getFullYear() + dir);
  else if (gran === "half") d.setMonth(d.getMonth() + 6 * dir);
  else if (gran === "quarter") d.setMonth(d.getMonth() + 3 * dir);
  else d.setMonth(d.getMonth() + dir);
  return reportingPeriodStart(gran, d);
}
function reportingLabel(gran, start, locale, qp) {
  const y = start.getFullYear();
  if (gran === "year") return String(y);
  if (gran === "half") return `H${start.getMonth() < 6 ? 1 : 2} ${y}`;
  if (gran === "quarter") return `${qp}${Math.floor(start.getMonth() / 3) + 1} ${y}`;
  return start.toLocaleDateString(locale, { month: "long", year: "numeric" });
}

// ── Compare mode body — 2–5 periods side by side. ────────────────────────────
// The periods (anchor first, then the hand-picked comparisons) are assembled in
// the top bar; this component just fetches each period's financials + net yield,
// then renders the side-by-side table, the plain-language explainer, and the
// biggest cost-centre moves between the earliest and latest period. It replaces
// both the old prior/last-year table and the multi-period card — one renderer.
function BuildingCompareView({ buildingId, periods }) {
  const { t } = useTranslation("manager");
  const [data, setData] = useState({ key: "", cols: [] });

  const periodsKey = periods.map((p) => `${p.from}_${p.to}`).join("|");
  useEffect(() => {
    if (periods.length === 0) return undefined;
    let cancelled = false;
    Promise.all(periods.map((p) =>
      Promise.all([
        fetch(`/api/buildings/${buildingId}/period-report?from=${p.from}&to=${p.to}`, { headers: authHeaders() })
          .then((r) => r.json()).then((d) => d?.data?.financials ?? null).catch(() => null),
        fetch(`/api/buildings/${buildingId}/unit-profitability?from=${p.from}&to=${p.to}`, { headers: authHeaders() })
          .then((r) => r.json()).then((d) => d?.data?.buildingNetYieldPct ?? null).catch(() => null),
      ]).then(([financials, yieldPct]) => ({ from: p.from, financials, yieldPct })),
    )).then((res) => { if (!cancelled) setData({ key: periodsKey, cols: res }); });
    return () => { cancelled = true; };
  }, [buildingId, periodsKey, periods]);

  const loaded = data.key === periodsKey;
  const loading = periods.length > 0 && !loaded;
  const financialsAt = (i) => (loaded ? data.cols[i]?.financials ?? null : null);

  // KPI rows (the income-statement-ordered set) + the net-yield row.
  const rows = [
    ...multiKpis(t).map((k) => ({ label: k.label, type: k.type, better: k.better, subtotal: k.subtotal, valAt: (i) => { const f = financialsAt(i); return f ? k.get(f) : null; } })),
    { label: t("buildingsId.reporting.unitProfit.buildingYield"), type: "yieldpct", better: 1, valAt: (i) => (loaded ? data.cols[i]?.yieldPct ?? null : null) },
  ];
  const fmt = (type, v) => (v == null ? "—" : type === "yieldpct" ? `${v.toFixed(1)}%` : type === "pct" ? rFmtPct(v) : rFmtChf(v));

  // Narrative + movers read the trend across the selection: earliest → latest.
  const occOf = (f) => (f && f.totalUnitsCount > 0 ? f.activeUnitsCount / f.totalUnitsCount : null);
  const be = loaded ? data.cols[0]?.financials : null;
  const cur = loaded ? data.cols[periods.length - 1]?.financials : null;
  const movers = be && cur ? computeExpenseMovers(cur, be) : [];
  const narrative = (be && cur && periods.length >= 2) ? buildComparisonNarrative({
    curNoi: cur.netOperatingIncomeCents, beNoi: be.netOperatingIncomeCents,
    curIncome: cur.collectedIncomeCents, beIncome: be.collectedIncomeCents,
    curExp: cur.expensesTotalCents, beExp: be.expensesTotalCents,
    curColl: cur.collectionRate, beColl: be.collectionRate,
    curOcc: occOf(cur), beOcc: occOf(be),
    movers, curYield: data.cols[periods.length - 1]?.yieldPct ?? null, beYield: data.cols[0]?.yieldPct ?? null,
    periodLabel: periods[periods.length - 1].label, cmpPeriodLabel: periods[0].label, t,
  }) : [];

  if (periods.length < 2) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-muted">{t("buildingsId.reporting.compare.emptyPrompt", { period: periods[0]?.label ?? "" })}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-5">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border">
              <th className="py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-foreground-dim">{t("buildingsId.reporting.compare.metric")}</th>
              {periods.map((p, i) => (
                <th key={p.key} className={cn("px-3 py-2 text-right text-xs font-semibold whitespace-nowrap", i === periods.length - 1 ? "text-brand" : "text-foreground")}>{p.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((k) => {
              const vals = periods.map((_, i) => k.valAt(i));
              const nums = vals.filter((v) => v != null);
              const best = nums.length >= 2 ? (k.better >= 0 ? Math.max(...nums) : Math.min(...nums)) : null;
              const worst = nums.length >= 2 ? (k.better >= 0 ? Math.min(...nums) : Math.max(...nums)) : null;
              return (
                <tr key={k.label} className={cn(k.subtotal ? "border-t-2 border-surface-border" : "border-b border-surface-border/60")}>
                  <td className={cn("py-2 pr-3 text-left", k.subtotal ? "font-semibold text-foreground" : "text-muted-dark")}>{k.label}</td>
                  {vals.map((v, ci) => (
                    <td key={`${k.label}-${periods[ci].key}`} className={cn("px-3 py-2 text-right tabular-nums whitespace-nowrap",
                      k.subtotal && "font-semibold",
                      !loaded ? "text-foreground-dim"
                        : v != null && best !== worst && v === best ? "font-semibold text-success-text"
                          : v != null && best !== worst && v === worst ? "text-destructive-text"
                            : "text-foreground")}>{!loaded ? "…" : fmt(k.type, v)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {loading && <p className="mt-2 text-xs text-muted">{t("buildingsId.reporting.compare.loading")}</p>}
      </div>

      <ComparisonNarrative lines={narrative} t={t} />

      {movers.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-foreground-dim">{t("buildingsId.reporting.compare.whatChanged")}</p>
          <div className="space-y-1">
            {movers.map((x, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 odd:bg-surface-subtle">
                <span className="truncate text-sm text-foreground">{x.name}</span>
                <span className={cn("shrink-0 text-sm font-semibold tabular-nums", x.d > 0 ? "text-destructive-text" : "text-success-text")}>{x.d > 0 ? "▲ +" : "▼ "}{rFmtChf(Math.abs(x.d))}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// The building reporting surface. A period bar (Month/Quarter/Year + stepper +
// presets) chooses the period the HERO reports on. Period navigation is fully
// client-side; a single background fetch only learns how far back real data
// goes so the navigator doesn't offer years of empty buckets.
function BuildingReportingView({ buildingId, etatLocatifNet }) {
  const { t, i18n } = useTranslation("manager");
  const locale = i18n?.language;
  const qp = locale && locale.startsWith("fr") ? "T" : "Q";

  const [mode, setMode]   = useState("single"); // "single" | "compare"
  const [gran, setGran]   = useState("month");
  const [anchor, setAnchor] = useState(() => reportingIsoDay(reportingPeriodStart("month", new Date())));
  const [ytd, setYtd]   = useState(false);
  const [customRange, setCustomRange] = useState(null); // { from, to } | null — arbitrary date range
  const [extras, setExtras] = useState([]); // compare mode: comparison periods added to the anchor (≤ COMPARE_MAX-1)
  const [spanStart, setSpanStart] = useState(null);     // Date | null — earliest period that has data
  const [tsError, setTsError]     = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);  // anchor-period picker popover
  const [pkYear, setPkYear] = useState(new Date().getFullYear());
  const [addOpen, setAddOpen] = useState(false);        // compare mode: "add period" picker popover
  const [addYear, setAddYear] = useState(new Date().getFullYear());
  const pickerRef = useRef(null);
  const addRef = useRef(null);
  const tRef = useRef(t); tRef.current = t;
  const spanFetched = useRef(false);

  // One non-blocking fetch: learn how far back real data goes. It only sets the
  // lower bound of the period list — it never touches the selected period, so it
  // can never "snap" the user back the way the old gran-keyed refetch did.
  useEffect(() => {
    if (!buildingId || spanFetched.current) return;
    spanFetched.current = true;
    fetch(`/api/buildings/${buildingId}/timeseries?range=${GRAN_RANGE.year}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => {
        const pts = d?.data?.points ?? [];
        if (pts.length) {
          const earliest = pts.reduce((min, p) => (p.periodStart < min ? p.periodStart : min), pts[0].periodStart);
          setSpanStart(new Date(`${earliest}T00:00:00`));
        }
        if (!d?.data) setTsError(d?.error?.message || tRef.current("buildingsId.reporting.failedToLoad"));
      })
      .catch(() => setTsError(tRef.current("buildingsId.reporting.failedToLoad")));
  }, [buildingId]);

  useEffect(() => {
    if (!pickerOpen && !addOpen) return undefined;
    const onDown = (e) => {
      if (pickerOpen && pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false);
      if (addOpen && addRef.current && !addRef.current.contains(e.target)) setAddOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [pickerOpen, addOpen]);

  // The current bucket start, re-derived from the anchor date under the active
  // granularity — this is what makes a Month→Year→Month round-trip land you back
  // on the same period instead of resetting.
  const anchorStart = useMemo(() => reportingPeriodStart(gran, new Date(`${anchor}T00:00:00`)), [gran, anchor]);

  // Selectable bucket-starts, ascending — pure client-side, no network.
  const periods = useMemo(() => {
    const now = new Date();
    const fallback = new Date(now.getFullYear() - 2, 0, 1); // sensible default until span loads
    const rawStart = spanStart && spanStart < now ? spanStart : fallback;
    const endStart = reportingPeriodStart(gran, now);
    const out = [];
    let cur = reportingPeriodStart(gran, rawStart);
    for (let guard = 0; cur <= endStart && guard < 600; guard++) {
      out.push(cur);
      cur = reportingStepStart(gran, cur, 1);
    }
    return out;
  }, [gran, spanStart]);

  // The selected window → [from,to] + label fed to the period detail + hero.
  const { from, to, periodLabel } = useMemo(() => {
    if (customRange?.from && customRange?.to) {
      return { from: customRange.from, to: customRange.to, periodLabel: `${customRange.from} → ${customRange.to}` };
    }
    if (ytd) {
      const y = anchorStart.getFullYear();
      return { from: `${y}-01-01`, to: reportingIsoDay(new Date()), periodLabel: `${t("buildingsId.reporting.histogram.jumpYtd")} ${y}` };
    }
    return {
      from: reportingIsoDay(anchorStart),
      to: reportingIsoDay(reportingPeriodEnd(gran, anchorStart)),
      periodLabel: reportingLabel(gran, anchorStart, locale, qp),
    };
  }, [gran, anchorStart, customRange, ytd, t, locale, qp]);

  const atStart = !periods.length || +anchorStart <= +periods[0];
  const atEnd   = !periods.length || +anchorStart >= +periods[periods.length - 1];

  function step(dir) {
    if (!periods.length) return;
    const next = reportingStepStart(gran, anchorStart, dir);
    if (+next < +periods[0] || +next > +periods[periods.length - 1]) return;
    setYtd(false);
    setAnchor(reportingIsoDay(next));
  }
  function changeGran(g) { setPickerOpen(false); setAddOpen(false); setYtd(false); setCustomRange(null); setExtras([]); setGran(g); }
  function selectStart(d) { setYtd(false); setCustomRange(null); setAnchor(reportingIsoDay(reportingPeriodStart(gran, d))); setPickerOpen(false); }
  function preset(kind) {
    setPickerOpen(false); setCustomRange(null);
    const now = new Date();
    if (kind === "latest") { setYtd(false); setGran("month"); setAnchor(reportingIsoDay(reportingPeriodStart("month", now))); }
    else if (kind === "year") { setYtd(false); setGran("year"); setAnchor(reportingIsoDay(reportingPeriodStart("year", now))); }
    else { setGran("month"); setAnchor(reportingIsoDay(reportingPeriodStart("month", now))); setYtd(true); }
  }

  // ── Single ⇄ Compare mode ──────────────────────────────────────────────────
  // Compare mode deals only in discrete grain-aligned periods, so it drops YTD /
  // custom range; leaving it drops the comparisons. Half-year is compare-only, so
  // snap an anchor on "half" back to a single-mode grain when switching to single.
  function switchMode(m) {
    setPickerOpen(false); setAddOpen(false);
    if (m === "compare") { setYtd(false); setCustomRange(null); }
    else { setExtras([]); if (gran === "half") setGran("quarter"); }
    setMode(m);
  }

  // A grain-aligned window object for a bucket start, labelled under the current grain.
  const winFromStart = (s) => {
    const wf = reportingIsoDay(s);
    const wt = reportingIsoDay(reportingPeriodEnd(gran, s));
    return { from: wf, to: wt, label: reportingLabel(gran, s, locale, qp), key: `${wf}_${wt}` };
  };
  function addExtra(win) {
    setExtras((prev) => {
      if (win.key === `${from}_${to}` || prev.some((p) => p.key === win.key)) return prev; // dup of anchor / existing
      if (prev.length >= COMPARE_MAX - 1) return prev;
      return [...prev, win];
    });
  }
  function addPrior() { addExtra(winFromStart(reportingStepStart(gran, anchorStart, -1))); }
  function addLastYear() { const d = new Date(anchorStart); d.setFullYear(d.getFullYear() - 1); addExtra(winFromStart(reportingPeriodStart(gran, d))); }
  function addPeriodAt(d) { addExtra(winFromStart(reportingPeriodStart(gran, d))); }
  const removeExtra = (key) => setExtras((prev) => prev.filter((p) => p.key !== key));

  // Anchor (column 1) + the added comparisons, deduped and ordered earliest→latest.
  const comparePeriods = useMemo(() => {
    const anchorWin = { from, to, label: periodLabel, key: `${from}_${to}` };
    const seen = new Set();
    return [anchorWin, ...extras]
      .filter((p) => (seen.has(p.key) ? false : (seen.add(p.key), true)))
      .sort((a, b) => (a.from < b.from ? -1 : 1))
      .slice(0, COMPARE_MAX);
  }, [from, to, periodLabel, extras]);

  const pickerYears = [...new Set(periods.map((p) => p.getFullYear()))];
  const monShort = Array.from({ length: 12 }, (_, mi) => new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(2024, mi, 1)));
  function openPicker() { setPkYear(anchorStart.getFullYear()); setAddOpen(false); setPickerOpen((v) => !v); }
  function openAdd() { setAddYear(anchorStart.getFullYear()); setPickerOpen(false); setAddOpen((v) => !v); }
  const isCur = (d) => !ytd && !customRange && d != null && +d === +anchorStart;
  const isExtra = (d) => { if (!d) return false; const s = reportingPeriodStart(gran, d); return extras.some((p) => p.key === `${reportingIsoDay(s)}_${reportingIsoDay(reportingPeriodEnd(gran, s))}`); };
  const findPeriod = (pred) => periods.find(pred) || null;
  const gridBtn = (label, d, key, pressed, onClick) => (
    <button key={key} disabled={!d} aria-pressed={pressed} onClick={() => d && onClick(d)}
      className={cn("rounded-md border px-2 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-30",
        pressed ? "border-brand bg-brand text-white" : "border-surface-border text-foreground hover:border-brand hover:text-brand")}>{label}</button>
  );
  // The year/quarter/half/month grid shared by the anchor picker and the "add
  // period" picker — only the onPick action and the pressed predicate differ.
  const pickerGrid = ({ pkYr, setPkYr, onPick, selPred }) => (
    gran === "year" ? (
      <div className="grid grid-cols-3 gap-1.5">{periods.map((p) => gridBtn(String(p.getFullYear()), p, p.getFullYear(), selPred(p), onPick))}</div>
    ) : (
      <>
        <div className="mb-2 flex items-center justify-between">
          <button onClick={() => setPkYr((y) => y - 1)} disabled={pkYr <= pickerYears[0]} className="grid h-6 w-6 place-items-center rounded-md border border-surface-border text-muted hover:border-brand hover:text-brand disabled:opacity-30">‹</button>
          <span className="text-sm font-semibold text-foreground tabular-nums">{pkYr}</span>
          <button onClick={() => setPkYr((y) => y + 1)} disabled={pkYr >= pickerYears[pickerYears.length - 1]} className="grid h-6 w-6 place-items-center rounded-md border border-surface-border text-muted hover:border-brand hover:text-brand disabled:opacity-30">›</button>
        </div>
        <div className={cn("grid gap-1.5", gran === "half" ? "grid-cols-2" : "grid-cols-4")}>
          {gran === "quarter"
            ? [1, 2, 3, 4].map((q) => { const d = findPeriod((p) => p.getFullYear() === pkYr && Math.floor(p.getMonth() / 3) + 1 === q); return gridBtn(`${qp}${q}`, d, q, selPred(d), onPick); })
            : gran === "half"
              ? [1, 2].map((h) => { const d = findPeriod((p) => p.getFullYear() === pkYr && (p.getMonth() < 6 ? 1 : 2) === h); return gridBtn(`H${h}`, d, h, selPred(d), onPick); })
              : monShort.map((mm, mi) => { const d = findPeriod((p) => p.getFullYear() === pkYr && p.getMonth() === mi); return gridBtn(mm, d, mi, selPred(d), onPick); })}
        </div>
      </>
    )
  );

  return (
    <div className="space-y-3">
      {/* ── Controls card — an underline tab strip (One period · Compare) heads a
          single card whose body is the mode-aware period bar. The tabs read as a
          view switch, visually distinct from the pill toggles inside; compare mode
          swaps the presets row for a "compare against" builder + half-year grain. ── */}
      <div className="rounded-xl border border-surface-border bg-surface shadow-sm">
        {/* Mode switch — a full-width segmented control flush to the card edges; its
            bottom border doubles as the header/body separator. */}
        <div className="flex border-b border-surface-border">
          {[["single", t("buildingsId.reporting.mode.single")], ["compare", t("buildingsId.reporting.mode.compare")]].map(([k, l], i) => (
            <button key={k} onClick={() => switchMode(k)} aria-pressed={mode === k}
              className={cn("flex-1 px-3 py-3 text-sm transition-colors",
                i === 0 ? "rounded-tl-xl" : "rounded-tr-xl border-l border-surface-border",
                mode === k
                  ? "bg-brand-light font-bold text-brand-dark shadow-[inset_0_2px_0_0_var(--color-brand)]"
                  : "bg-surface-subtle font-semibold text-muted hover:text-foreground")}>{l}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
        {!customRange && (<>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground-dim">{mode === "compare" ? t("buildingsId.reporting.compare.base") : t("buildingsId.reporting.period.label")}</span>
          <div className="inline-flex rounded-lg border border-surface-border bg-surface p-0.5 gap-0.5">
            {(mode === "compare" ? COMPARE_GRANS : REPORTING_GRANS).map((g) => (
              <button key={g} onClick={() => changeGran(g)} aria-pressed={!ytd && gran === g}
                className={cn("rounded-md px-3 py-1 text-sm font-medium transition-colors", !ytd && gran === g ? "bg-brand text-white" : "text-muted hover:text-muted-dark")}>{t(`buildingsId.reporting.period.${g}`)}</button>
            ))}
          </div>
        </div>
        <div className="relative flex items-center gap-1.5" ref={pickerRef}>
          <button onClick={() => step(-1)} disabled={atStart} aria-label={t("buildingsId.reporting.period.prev")}
            className="grid h-7 w-7 place-items-center rounded-lg border border-surface-border bg-surface text-muted transition-colors hover:border-brand hover:text-brand disabled:opacity-40 disabled:cursor-not-allowed">‹</button>
          <button onClick={openPicker} aria-expanded={pickerOpen}
            className="min-w-[128px] rounded-lg border border-transparent px-2 py-1 text-center text-sm font-semibold text-foreground transition-colors hover:border-surface-border hover:bg-surface">
            {periodLabel} <span className="text-foreground-dim">▾</span>
          </button>
          <button onClick={() => step(1)} disabled={atEnd} aria-label={t("buildingsId.reporting.period.next")}
            className="grid h-7 w-7 place-items-center rounded-lg border border-surface-border bg-surface text-muted transition-colors hover:border-brand hover:text-brand disabled:opacity-40 disabled:cursor-not-allowed">›</button>
          {pickerOpen && periods.length > 0 && (
            <div className="absolute left-1/2 top-full z-30 mt-2 w-64 -translate-x-1/2 rounded-xl border border-surface-border bg-surface p-3 shadow-lg">
              {pickerGrid({ pkYr: pkYear, setPkYr: setPkYear, onPick: selectStart, selPred: isCur })}
            </div>
          )}
        </div>
        </>)}
        {customRange && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground-dim">{t("buildingsId.reporting.period.custom")}</span>
            <input type="date" value={customRange.from} onChange={(e) => setCustomRange((r) => ({ ...r, from: e.target.value }))} className="rounded-lg border border-surface-border bg-surface px-2 py-1 text-sm text-foreground" />
            <span className="text-foreground-dim">→</span>
            <input type="date" value={customRange.to} onChange={(e) => setCustomRange((r) => ({ ...r, to: e.target.value }))} className="rounded-lg border border-surface-border bg-surface px-2 py-1 text-sm text-foreground" />
            <button onClick={() => setCustomRange(null)} aria-label={t("buildingsId.reporting.compare.clear")} className="rounded-lg border border-surface-border px-2 py-1 text-xs text-muted transition-colors hover:border-brand hover:text-brand">✕</button>
          </div>
        )}
        {mode === "single" && (
          <div className="flex gap-1.5">
            {[["latest", t("buildingsId.reporting.histogram.jumpMonth")], ["ytd", t("buildingsId.reporting.histogram.jumpYtd")], ["year", t("buildingsId.reporting.histogram.jumpYear")]].map(([k, l]) => (
              <button key={k} onClick={() => preset(k)} aria-pressed={k === "ytd" && ytd}
                className={cn("rounded-lg border px-2.5 py-1 text-xs transition-colors", k === "ytd" && ytd ? "border-brand bg-brand-light text-brand-dark" : "border-surface-border bg-surface text-muted hover:border-brand hover:text-brand")}>{l}</button>
            ))}
            <button onClick={() => setCustomRange((r) => (r ? null : { from, to }))} aria-pressed={!!customRange}
              className={cn("rounded-lg border px-2.5 py-1 text-xs transition-colors", customRange ? "border-brand bg-brand-light text-brand-dark" : "border-surface-border bg-surface text-muted hover:border-brand hover:text-brand")}>{t("buildingsId.reporting.period.custom")}</button>
          </div>
        )}
        {mode === "compare" && (() => {
          const full = extras.length >= COMPARE_MAX - 1;
          const addBtn = "rounded-lg border border-surface-border bg-surface px-2.5 py-1 text-xs text-muted transition-colors hover:border-brand hover:text-brand disabled:opacity-40 disabled:cursor-not-allowed";
          return (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground-dim">{t("buildingsId.reporting.compare.against")}</span>
              <button onClick={addPrior} disabled={full} className={addBtn}>+ {t("buildingsId.reporting.compare.prior")}</button>
              <button onClick={addLastYear} disabled={full} className={addBtn}>+ {t("buildingsId.reporting.compare.lastYear")}</button>
              <div className="relative" ref={addRef}>
                <button onClick={openAdd} aria-expanded={addOpen} disabled={full} className={addBtn}>+ {t("buildingsId.reporting.compare.addPeriod")} <span className="text-foreground-dim">▾</span></button>
                {addOpen && periods.length > 0 && (
                  <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-surface-border bg-surface p-3 shadow-lg">
                    {pickerGrid({ pkYr: addYear, setPkYr: setAddYear, onPick: addPeriodAt, selPred: isExtra })}
                  </div>
                )}
              </div>
              {extras.map((p) => (
                <span key={p.key} className="inline-flex items-center gap-1.5 rounded-lg border border-brand bg-brand-light px-2.5 py-1 text-xs font-medium text-brand-dark">
                  {p.label}
                  <button onClick={() => removeExtra(p.key)} aria-label={t("buildingsId.reporting.compare.clear")} className="text-brand-dark/60 transition-colors hover:text-brand-dark">✕</button>
                </span>
              ))}
              {extras.length > 0 && (
                <button onClick={() => setExtras([])} className="rounded-lg border border-surface-border px-2 py-1 text-xs text-muted transition-colors hover:border-destructive-ring hover:text-destructive-text">{t("buildingsId.reporting.compare.clear")}</button>
              )}
            </div>
          );
        })()}
        </div>
      </div>

      {tsError && <p className="text-sm text-destructive-text">{tsError}</p>}

      {/* ── Report card: single-period detail, or the compare table ── */}
      <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface shadow-sm">
        {mode === "single"
          ? <BuildingPeriodAnalysis buildingId={buildingId} etatLocatifNet={etatLocatifNet} from={from} to={to} periodLabel={periodLabel} />
          : <BuildingCompareView buildingId={buildingId} periods={comparePeriods} />}
      </div>
    </div>
  );
}

function displayDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

// Role-intent choices an owner can assign to a building (excludes "unspecified").
const ROLE_INTENT_OPTIONS = ["income", "long_term_quality", "stable_hold", "reposition", "sell"];

// Cadastral / valuation fields editable on the Overview tab. `type` drives both
// the input rendering and the form↔PATCH conversion below. Labels come from
// manager:buildingsId.fields.* (en/fr).
const BUILDING_CADASTRAL_FIELDS = [
  { key: "parcelNumber", type: "text" },
  { key: "easementsText", type: "textarea" },
  { key: "constructionDate", type: "date" },
  { key: "lastRenovationDate", type: "date" },
  { key: "ecaVolumeM3", type: "number", unit: "m³" },
  { key: "netAreaSqm", type: "number", unit: "m²" },
  { key: "weightedAreaSqm", type: "number", unit: "m²" },
  { key: "lotsApartments", type: "int" },
  { key: "lotsGarages", type: "int" },
  { key: "lotsExteriorParking", type: "int" },
  { key: "fiscalValueChf", type: "chf" },
  { key: "insuranceValueChf", type: "chf" },
  { key: "ppeEstimateChf", type: "chf" },
];

// Seed the edit-form object (all string values) from a loaded building.
function buildingToExtraForm(b) {
  const out = {};
  for (const f of BUILDING_CADASTRAL_FIELDS) {
    const v = b?.[f.key];
    out[f.key] = v == null ? "" : f.type === "date" ? String(v).slice(0, 10) : String(v);
  }
  return out;
}

// Convert the edit-form object back into a PATCH body (typed; "" → null).
function extraFormToPatch(extra) {
  const out = {};
  for (const f of BUILDING_CADASTRAL_FIELDS) {
    const raw = (extra?.[f.key] ?? "").toString().trim();
    if (raw === "") { out[f.key] = null; continue; }
    if (f.type === "int") out[f.key] = parseInt(raw, 10);
    else if (f.type === "number" || f.type === "chf") out[f.key] = Number(raw);
    else if (f.type === "date") out[f.key] = new Date(raw).toISOString();
    else out[f.key] = raw;
  }
  return out;
}

// Read-only display of a stored cadastral value.
function formatCadastralValue(field, value) {
  if (value == null || value === "") return "—";
  if (field.type === "chf") return formatChf(value);
  if (field.type === "date") return formatDate(value);
  if (field.type === "number") return `${formatNumber(value)}${field.unit ? ` ${field.unit}` : ""}`;
  return String(value);
}

export default function BuildingDetail() {
  const { t } = useTranslation("manager");
  const router = useRouter();
  const { id, from, role } = router.query;
  const isOwner = role === "owner";
  const backHref = from || (isOwner ? "/owner/properties" : "/manager/inventory?tab=buildings");
  const VALID_TABS = ["Building information", "Units", "Tenants", "Assets", "Documents", "Policies", "Reporting", "Requests", "Correspondence"];
  const initialTab = typeof router.query.tab === "string" && VALID_TABS.includes(router.query.tab)
    ? router.query.tab
    : "Building information";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [showPackageOnboard, setShowPackageOnboard] = useState(false);

  // Auto-open the importer when arriving from the inventory "Import" flow.
  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.onboard === "package") {
      setShowPackageOnboard(true);
      const rest = { ...router.query }; delete rest.onboard;
      router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
    }
  }, [router.isReady, router.query.onboard]);
  // Tracks tabs whose (tab-specific) data has been loaded, so config/rules/lease
  // templates are fetched once on first tab open rather than on every mount.
  const loadedTabsRef = useRef(new Set());

  // ui object removed — all styles now use Tailwind className

  const [building, setBuilding] = useState(null);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editYearBuilt, setEditYearBuilt] = useState("");
  const [editElevator, setEditElevator] = useState(false);
  const [editConcierge, setEditConcierge] = useState(false);
  const [editManagedSince, setEditManagedSince] = useState("");
  const [editExtra, setEditExtra] = useState({}); // cadastral/valuation fields
  const [marketPrice, setMarketPrice] = useState(null); // MarketPricePerZip record for this zip
  const [editMarketPrice, setEditMarketPrice] = useState(""); // CHF/m² input
  const [createUnitName, setCreateUnitName] = useState("");
  const [createUnitType, setCreateUnitType] = useState("RESIDENTIAL");
  const [createParkingKind, setCreateParkingKind] = useState("EXTERIOR");
  const [createLinkedFlatId, setCreateLinkedFlatId] = useState("");
  const [unitAction, setUnitAction] = useState(null);
  const [configMode, setConfigMode] = useState(null);
  const [configAutoApprove, setConfigAutoApprove] = useState("");
  const [configEmergency, setConfigEmergency] = useState(false);
  const [configOwnerThreshold, setConfigOwnerThreshold] = useState("");
  const [buildingConfig, setBuildingConfig] = useState(null);
  const [rules, setRules] = useState([]);
  const [createRuleMode, setCreateRuleMode] = useState(false);
  const [newRuleName, setNewRuleName] = useState("");
  const [newRulePriority, setNewRulePriority] = useState("0");
  const [newRuleConditions, setNewRuleConditions] = useState([{ field: "CATEGORY", operator: "EQUALS", value: "" }]);
  const [newRuleAction, setNewRuleAction] = useState("AUTO_APPROVE");
  const [message, setMessage] = useState("");
  const [leaseTemplates, setLeaseTemplates] = useState([]);
  const toast = useUndoToast();

  // ─── Unit filter state ───
  const [unitFilter, setUnitFilter] = useState("ALL");

  // ─── Ownership editing state ───
  const [ownerCandidates, setOwnerCandidates] = useState([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [ownerStrategyProfiles, setOwnerStrategyProfiles] = useState({});
  const [buildingStrategyProfile, setBuildingStrategyProfile] = useState(null);
  // ─── Owner-facing building-strategy editor (sets roleIntent on this building) ───
  const [ownerProfile, setOwnerProfile] = useState(null); // current owner's portfolio profile
  const [stratEditOpen, setStratEditOpen] = useState(false);
  const [stratRoleIntent, setStratRoleIntent] = useState("");
  const [stratSaving, setStratSaving] = useState(false);
  const [stratError, setStratError] = useState("");

  // ─── Asset inventory state ───
  const [assetInventory, setAssetInventory] = useState([]);
  const [assetInventoryLoading, setAssetInventoryLoading] = useState(false);
  const [assetAddMode, setAssetAddMode] = useState(false);
  const [assetSeeding, setAssetSeeding] = useState(false);

  // ─── Building KPI state ───
  const [buildingKpis, setBuildingKpis] = useState(null);
  const [kpisLoading, setKpisLoading] = useState(false);

  // ─── Building requests tab state ───
  const [buildingRequests, setBuildingRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsLoaded, setRequestsLoaded] = useState(false);
  const [buildingInvoices, setBuildingInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesLoaded, setInvoicesLoaded] = useState(false);

  // ─── House rules state ───
  const [houseRulesText, setHouseRulesText] = useState("");
  const [houseRulesEditing, setHouseRulesEditing] = useState(false);
  const [houseRulesSaving, setHouseRulesSaving] = useState(false);
  const [houseRulesPreviewUrl, setHouseRulesPreviewUrl] = useState(null);
  const [legalSources, setLegalSources] = useState([]);
  const [legalSourcesLoading, setLegalSourcesLoading] = useState(false);

  // ─── Sort state for Tenants + Requests tabs (must be here, before early returns) ───
  const { sortField: tenSF, sortDir: tenSD, handleSort: handleTenSort } = useLocalSort("name", "asc");
  const { sortField: reqSF, sortDir: reqSD, handleSort: handleReqSort } = useLocalSort("createdAt", "desc");
  const sortedBuildingTenants = useMemo(() => clientSort(building?.tenants ?? [], tenSF, tenSD, (ten, f) => {
    if (f === "name") return (ten.name || "").toLowerCase();
    if (f === "unit") return (ten.unitNumber || "").toLowerCase();
    if (f === "phone") return (ten.phone || "").toLowerCase();
    if (f === "email") return (ten.email || "").toLowerCase();
    if (f === "moveIn") return ten.moveInDate || "";
    if (f === "source") return (ten.source || "").toLowerCase();
    return "";
  }), [building?.tenants, tenSF, tenSD]);
  const sortedBuildingRequests = useMemo(() => clientSort(buildingRequests, reqSF, reqSD, (r, f) => {
    if (f === "status") return (r.status || "").toLowerCase();
    if (f === "category") return (r.category || "").toLowerCase();
    if (f === "unit") return (r.unit?.unitNumber || "").toLowerCase();
    if (f === "urgency") return ({ LOW: 1, MEDIUM: 2, HIGH: 3, EMERGENCY: 4 }[r.urgency] || 0);
    if (f === "contractor") return (r.contractor?.name || "").toLowerCase();
    if (f === "createdAt") return r.createdAt || "";
    return "";
  }), [buildingRequests, reqSF, reqSD]);

  useEffect(() => {
    if (activeTab === "Assets" && assetInventory.length === 0 && !assetInventoryLoading) {
      loadAssetInventory();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "Requests" && !requestsLoaded && !requestsLoading) {
      loadBuildingRequests();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "Invoices" && !invoicesLoaded && !invoicesLoading) {
      loadBuildingInvoices();
    }
  }, [activeTab]);

  // Load-once, tab-specific datasets deferred out of loadBuilding.
  useEffect(() => {
    if (activeTab === "Policies" && !loadedTabsRef.current.has("Policies")) {
      loadedTabsRef.current.add("Policies");
      loadBuildingConfig();
      loadApprovalRules();
    }
    if (activeTab === "Documents" && !loadedTabsRef.current.has("Documents")) {
      loadedTabsRef.current.add("Documents");
      loadLeaseTemplates();
    }
  }, [activeTab]);

  function setOk(message) {
    setNotice({ type: "ok", message });
    setTimeout(() => setNotice(null), 4000);
  }
  function setErr(message) {
    setNotice({ type: "err", message });
  }

  async function fetchJSON(path, options = {}) {
    const res = await fetch(`/api${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...authHeaders(), ...(options.headers || {}) },
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {}
    if (!res.ok) {
      const msg = (data && (data.error?.message || data.message || (typeof data.error === "string" && data.error))) || `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return data;
  }

  async function loadBuilding() {
    try {
      const res = await fetch(`/api/buildings/${id}`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to load building");
      const b = json?.data || json;
      if (!b) throw new Error("Building not found");
      setBuilding(b);
      setEditName(b.name);
      setEditAddress(b.address || "");
      setEditYearBuilt(b.yearBuilt != null ? String(b.yearBuilt) : "");
      setEditElevator(!!b.hasElevator);
      setEditConcierge(!!b.hasConcierge);
      setEditManagedSince(b.managedSince ? b.managedSince.slice(0, 10) : "");
      setEditExtra(buildingToExtraForm(b));
      setHouseRulesText(b.houseRulesText || "");
      // Reference market price for this building's postal code (zip-scoped table).
      if (b.postalCode) {
        try {
          const mp = await fetchJSON(`/market-prices/${encodeURIComponent(b.postalCode)}`);
          const rec = mp?.data ?? null;
          setMarketPrice(rec);
          setEditMarketPrice(rec?.pricePerSqmChf != null ? String(rec.pricePerSqmChf) : "");
        } catch { /* non-blocking */ }
      } else {
        setMarketPrice(null);
        setEditMarketPrice("");
      }
      await loadUnits();
      // buildingConfig + approvalRules (Policies tab) and leaseTemplates
      // (Documents tab) are deferred to their tabs — see the activeTab effects
      // below. Previously they were awaited serially on every building mount.
      loadLegalSources();
      loadBuildingKpis();
      if (b.owners && b.owners.length > 0) {
        loadOwnerStrategyProfiles(b.owners.map((o) => o.id));
      }
      loadBuildingStrategyProfile();
      if (isOwner) loadOwnerProfileCurrent();
    } catch (e) {
      setErr(`Failed to load building: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadBuildingKpis() {
    if (!id) return;
    setKpisLoading(true);
    const now = new Date();
    const from = `${now.getFullYear()}-01-01`;
    const to = now.toISOString().slice(0, 10);

    // Parse each endpoint independently. A single slow/failing call — e.g. the
    // portfolio fan-out timing out behind a gateway that returns an HTML 504,
    // which makes res.json() throw — must NOT blank every card. In particular
    // the cheap open-requests/open-jobs counts (GET /buildings/:id/kpis) should
    // still render even when the heavier financial endpoints are unavailable.
    // (These counts are scalar DB counts server-side; the page used to fetch up
    // to 2,000 requests + 2,000 jobs org-wide and filter them in the browser.)
    async function safeJson(url) {
      try {
        const res = await fetch(url, { headers: authHeaders() });
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    }

    const [kpiData, finData, portData] = await Promise.all([
      safeJson(`/api/buildings/${id}/kpis`),
      safeJson(`/api/buildings/${id}/financial-summary?from=${from}&to=${to}`),
      safeJson(`/api/financials/portfolio-summary?from=${from}&to=${to}`),
    ]);

    // null (not 0) when the counts endpoint itself failed, so the card shows
    // "—" (unknown) rather than a misleading "0".
    const openRequests = kpiData?.data?.openRequests ?? null;
    const openJobs = kpiData?.data?.openJobs ?? null;
    const financials = finData?.data || null;
    const portfolio = portData?.data || null;
    let portfolioComparison = null;
    if (portfolio && portfolio.buildingCount > 0 && financials) {
      const buildingNoi = financials.netIncomeCents ?? 0;
      const portfolioBuildings = portfolio.buildings || [];
      if (portfolioBuildings.length > 1) {
        const otherBuildings = portfolioBuildings.filter((b) => b.buildingId !== id);
        if (otherBuildings.length > 0) {
          const avgOtherNoi = otherBuildings.reduce((sum, b) => sum + (b.netIncomeCents ?? 0), 0) / otherBuildings.length;
          if (avgOtherNoi !== 0) {
            const pct = ((buildingNoi - avgOtherNoi) / Math.abs(avgOtherNoi)) * 100;
            portfolioComparison = { pct: Math.round(pct), better: pct >= 0 };
          }
        }
      }
    }
    setBuildingKpis({ openRequests, openJobs, financials, portfolioComparison });
    setKpisLoading(false);
  }

  async function loadOwnerStrategyProfiles(ownerIds) {
    const results = {};
    await Promise.all(
      ownerIds.map(async (ownerId) => {
        try {
          const res = await fetch(`/api/strategy/owner-profile/${ownerId}`, { headers: authHeaders() });
          if (res.ok) {
            const json = await res.json();
            if (json?.profile) results[ownerId] = json.profile;
          }
        } catch {
          // non-fatal
        }
      })
    );
    setOwnerStrategyProfiles(results);
  }

  async function loadBuildingStrategyProfile() {
    if (!id) return;
    try {
      const res = await fetch(`/api/strategy/building-profile/${id}`, { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json();
        setBuildingStrategyProfile(json?.profile ?? null);
      }
    } catch {
      // non-fatal
    }
  }

  // Current owner's portfolio strategy profile — anchors the building-strategy editor.
  async function loadOwnerProfileCurrent() {
    try {
      const res = await fetch(`/api/strategy/owner-profile-current`, { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json();
        setOwnerProfile(json?.profile ?? null);
      }
    } catch {
      // non-fatal
    }
  }

  // Owner sets/edits this building's role intent → upserts the BuildingStrategyProfile,
  // anchored to the editing owner's portfolio profile.
  async function saveBuildingStrategy() {
    if (!id || !ownerProfile?.id || !stratRoleIntent) return;
    setStratSaving(true);
    setStratError("");
    try {
      const res = await fetch(`/api/strategy/building-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          buildingId: id,
          ownerProfileId: ownerProfile.id,
          roleIntent: stratRoleIntent,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || json?.error || "Failed to save strategy");
      setStratEditOpen(false);
      await loadBuildingStrategyProfile();
    } catch (e) {
      setStratError(e.message);
    } finally {
      setStratSaving(false);
    }
  }

  async function loadBuildingInvoices() {
    if (!id) return;
    setInvoicesLoading(true);
    try {
      const res = await fetch(`/api/invoices?buildingId=${id}&limit=200&view=summary`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to load invoices");
      setBuildingInvoices(json?.data || []);
      setInvoicesLoaded(true);
    } catch (e) {
      setBuildingInvoices([]);
    } finally {
      setInvoicesLoading(false);
    }
  }

  async function loadBuildingRequests() {
    if (!id) return;
    setRequestsLoading(true);
    try {
      const res = await fetch("/api/requests?limit=2000&order=desc", { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to load requests");
      const all = json?.data || [];
      setBuildingRequests(all.filter((r) => r.unit?.building?.id === id));
      setRequestsLoaded(true);
    } catch (e) {
      setBuildingRequests([]);
    } finally {
      setRequestsLoading(false);
    }
  }

  async function loadBuildingConfig() {
    if (!id) return;
    try {
      const data = await fetchJSON(`/buildings/${id}/config`);
      const cfg = data?.data || null;
      setBuildingConfig(cfg);
      if (cfg) {
        setConfigAutoApprove(cfg.autoApproveLimit != null ? String(cfg.autoApproveLimit) : "");
        setConfigEmergency(cfg.emergencyAutoDispatch || false);
        setConfigOwnerThreshold(cfg.requireOwnerApprovalAbove != null ? String(cfg.requireOwnerApprovalAbove) : "");
      }
    } catch (e) {
      setErr(`Failed to load building config: ${e.message}`);
    }
  }

  async function loadApprovalRules() {
    if (!id) return;
    try {
      const data = await fetchJSON(`/approval-rules?buildingId=${id}`);
      setRules(Array.isArray(data) ? data : data?.data || []);
    } catch (e) {
      console.error("Failed to load approval rules:", e);
      setRules([]);
    }
  }

  async function loadLeaseTemplates() {
    if (!id) return;
    try {
      const data = await fetchJSON(`/lease-templates?buildingId=${id}`);
      setLeaseTemplates(Array.isArray(data) ? data : data?.data || []);
    } catch (e) {
      console.error("Failed to load lease templates:", e);
      setLeaseTemplates([]);
    }
  }

  async function loadLegalSources() {
    if (!id || legalSources.length > 0) return;
    setLegalSourcesLoading(true);
    try {
      const data = await fetchJSON(`/buildings/${id}/legal-sources`);
      setLegalSources(Array.isArray(data) ? data : data?.data || []);
    } catch (e) {
      console.error("Failed to load legal sources:", e);
      setLegalSources([]);
    } finally {
      setLegalSourcesLoading(false);
    }
  }

  async function loadUnits() {
    if (!id) return;
    try {
      const data = await fetchJSON(`/buildings/${id}/units`);
      setUnits(Array.isArray(data) ? data : data?.data || []);
    } catch (e) {
      setErr(`Failed to load units: ${e.message}`);
    }
  }

  async function loadAssetInventory() {
    if (!id) return;
    try {
      setAssetInventoryLoading(true);
      const data = await fetchJSON(`/buildings/${id}/asset-inventory`);
      setAssetInventory(Array.isArray(data) ? data : data?.data || []);
    } catch (e) {
      // Silently fail
    } finally {
      setAssetInventoryLoading(false);
    }
  }

  async function seedDefaultAssets() {
    if (!id || assetSeeding) return;
    setAssetSeeding(true);
    try {
      await fetchJSON(`/buildings/${id}/seed-default-assets`, { method: "POST" });
      await loadAssetInventory();
    } catch (e) {
      setErr(`Failed to populate default assets: ${e.message}`);
    } finally {
      setAssetSeeding(false);
    }
  }

  // ─── Owner management ───

  async function loadOwnerCandidates() {
    try {
      const res = await fetch(`/api/buildings/${id}/owners/candidates`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) return;
      setOwnerCandidates(json?.data || []);
    } catch (e) {
      console.error("Failed to load owner candidates:", e);
    }
  }

  async function onAddOwner() {
    if (!selectedCandidateId) return;
    try {
      setOwnerLoading(true);
      const res = await fetch(`/api/buildings/${id}/owners`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ userId: selectedCandidateId }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message || json?.message || `Failed (${res.status})`);
      }
      setSelectedCandidateId("");
      await loadBuilding();
      await loadOwnerCandidates();
      setOk("Owner added.");
    } catch (e) {
      setErr(`Failed to add owner: ${e.message}`);
    } finally {
      setOwnerLoading(false);
    }
  }

  async function onRemoveOwner(userId) {
    try {
      setOwnerLoading(true);
      await fetch(`/api/buildings/${id}/owners/${userId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      await loadBuilding();
      await loadOwnerCandidates();
      setOk("Owner removed.");
    } catch (e) {
      setErr(`Failed to remove owner: ${e.message}`);
    } finally {
      setOwnerLoading(false);
    }
  }

  useEffect(() => {
    // New building → reset lazy-tab load guards (page component is reused across
    // /buildings/[id] navigations).
    loadedTabsRef.current = new Set();
    if (id) loadBuilding();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onUpdateBuilding(e) {
    e.preventDefault();
    if (!editName.trim()) return setErr("Building name is required.");
    try {
      setLoading(true);
      await fetchJSON(`/buildings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName,
          address: editAddress,
          ...(editYearBuilt ? { yearBuilt: Number(editYearBuilt) } : {}),
          hasElevator: editElevator,
          hasConcierge: editConcierge,
          managedSince: editManagedSince ? new Date(editManagedSince).toISOString() : null,
          ...extraFormToPatch(editExtra),
        }),
      });
      // Persist the zip-scoped market price separately (not a Building column).
      const trimmedMp = editMarketPrice.toString().trim();
      const currentMp = marketPrice?.pricePerSqmChf != null ? String(marketPrice.pricePerSqmChf) : "";
      if (building?.postalCode && trimmedMp !== "" && trimmedMp !== currentMp) {
        await fetchJSON(`/market-prices`, {
          method: "PUT",
          body: JSON.stringify({
            postalCode: building.postalCode,
            city: building.city || null,
            pricePerSqmChf: Number(trimmedMp),
            source: "manual",
          }),
        });
      }
      await loadBuilding();
      setEditMode(false);
      setOk("Building updated.");
    } catch (e) {
      setErr(`Update failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function onSaveHouseRules() {
    try {
      setHouseRulesSaving(true);
      await fetchJSON(`/buildings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ houseRulesText: houseRulesText || null }),
      });
      setBuilding((b) => ({ ...b, houseRulesText: houseRulesText || null }));
      setHouseRulesEditing(false);
      setOk("House rules saved.");
    } catch (e) {
      setErr(`Failed to save house rules: ${e.message}`);
    } finally {
      setHouseRulesSaving(false);
    }
  }

  async function onPreviewHouseRulesPdf() {
    if (houseRulesPreviewUrl) { URL.revokeObjectURL(houseRulesPreviewUrl); setHouseRulesPreviewUrl(null); return; }
    try {
      const res = await fetch(`/api/buildings/${id}/house-rules-pdf`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      setHouseRulesPreviewUrl(URL.createObjectURL(blob));
    } catch (e) {
      setErr(`PDF preview failed: ${e.message}`);
    }
  }

  async function onDownloadHouseRulesPdf() {
    try {
      const res = await fetch(`/api/buildings/${id}/house-rules-pdf`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `house-rules-${id.slice(0, 8)}.pdf`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      setErr(`PDF download failed: ${e.message}`);
    }
  }

  async function onCreateUnit(e) {
    e.preventDefault();
    if (!createUnitName.trim()) return setErr("Unit name is required.");
    try {
      setLoading(true);
      const body = { unitNumber: createUnitName, type: createUnitType };
      if (createUnitType === "PARKING") {
        body.parkingKind = createParkingKind;
        if (createLinkedFlatId) body.linkedFlatId = createLinkedFlatId;
      }
      await fetchJSON(`/buildings/${id}/units`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      await loadUnits();
      setCreateUnitName("");
      setCreateUnitType("RESIDENTIAL");
      setCreateParkingKind("EXTERIOR");
      setCreateLinkedFlatId("");
      setUnitAction(null);
      setOk("Unit created.");
    } catch (e) {
      setErr(`Create unit failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function onDeactivateBuilding() {
    if (!confirm("Deactivate this building? This cannot be undone.")) return;
    try {
      setLoading(true);
      await fetchJSON(`/buildings/${id}`, { method: "DELETE" });
      setOk("Building deactivated. Redirecting...");
      setTimeout(() => router.push(isOwner ? "/owner/properties" : "/manager/inventory?tab=buildings"), 1500);
    } catch (e) {
      setErr(`Deactivate failed: ${e.message}`);
      setLoading(false);
    }
  }

  async function onSaveBuildingConfig(e) {
    e.preventDefault();
    try {
      setLoading(true);
      const payload = {};
      if (configAutoApprove.trim()) {
        const n = Number(configAutoApprove);
        if (!Number.isInteger(n) || n < 0 || n > 100000) {
          return setErr("Auto-approve limit must be an integer 0–100000 or blank.");
        }
        payload.autoApproveLimit = n;
      } else {
        payload.autoApproveLimit = null;
      }
      payload.emergencyAutoDispatch = configEmergency;
      if (configOwnerThreshold.trim()) {
        const n = Number(configOwnerThreshold);
        if (!Number.isInteger(n) || n < 0 || n > 100000) {
          return setErr("Owner threshold must be an integer 0–100000 or blank.");
        }
        payload.requireOwnerApprovalAbove = n;
      } else {
        payload.requireOwnerApprovalAbove = null;
      }
      await fetchJSON(`/buildings/${id}/config`, { method: "PUT", body: JSON.stringify(payload) });
      await loadBuildingConfig();
      setConfigMode(null);
      setOk("Building config saved.");
    } catch (e) {
      setErr(`Config save failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function onCreateRule(e) {
    e.preventDefault();
    if (!newRuleName.trim()) return setErr("Rule name is required.");
    const validConditions = newRuleConditions.filter((c) => c.value);
    if (validConditions.length === 0) return setErr("At least one condition with a value is required.");
    try {
      setLoading(true);
      const payload = {
        buildingId: id,
        name: newRuleName,
        priority: parseInt(newRulePriority) || 0,
        conditions: validConditions,
        action: newRuleAction,
      };
      await fetchJSON(`/approval-rules`, { method: "POST", body: JSON.stringify(payload) });
      await loadApprovalRules();
      setNewRuleName("");
      setNewRulePriority("0");
      setNewRuleConditions([{ field: "CATEGORY", operator: "EQUALS", value: "" }]);
      setNewRuleAction("AUTO_APPROVE");
      setCreateRuleMode(false);
      setOk("Approval rule created.");
    } catch (e) {
      setErr(`Create rule failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function onDeleteRule(ruleId) {
    if (!confirm("Delete this approval rule?")) return;
    try {
      setLoading(true);
      await fetchJSON(`/approval-rules/${ruleId}`, { method: "DELETE" });
      await loadApprovalRules();
      setOk("Approval rule deleted.");
    } catch (e) {
      setErr(`Delete rule failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function onToggleRuleActive(ruleId, currentActive) {
    try {
      setLoading(true);
      await fetchJSON(`/approval-rules/${ruleId}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !currentActive }),
      });
      await loadApprovalRules();
      setOk("Rule status updated.");
    } catch (e) {
      setErr(`Toggle rule failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  function addCondition() {
    setNewRuleConditions([...newRuleConditions, { field: "CATEGORY", operator: "EQUALS", value: "" }]);
  }

  function removeCondition(index) {
    setNewRuleConditions(newRuleConditions.filter((_, i) => i !== index));
  }

  function updateCondition(index, key, value) {
    const updated = [...newRuleConditions];
    updated[index][key] = value;
    setNewRuleConditions(updated);
  }

  if (loading && !building) {
    return (
      <AppShell role={isOwner ? "OWNER" : "MANAGER"}>
        <PageShell variant="embedded">
          <PageContent>
            <Panel>
              <p className="text-sm text-muted-text">Loading building...</p>
            </Panel>
          </PageContent>
        </PageShell>
      </AppShell>
    );
  }

  if (!building) {
    return (
      <AppShell role={isOwner ? "OWNER" : "MANAGER"}>
        <PageShell variant="embedded">
          <PageContent>
            <Panel>
              <p className="text-sm text-muted-text">Building not found.</p>
            </Panel>
          </PageContent>
        </PageShell>
      </AppShell>
    );
  }

  const residentialUnits = units.filter((u) => u.type === "RESIDENTIAL" || !u.type);
  const commonUnits = units.filter((u) => u.type === "COMMON_AREA");
  const parkingUnits = units.filter((u) => u.type === "PARKING");
  const flatLabelById = Object.fromEntries(units.map((u) => [u.id, u.unitNumber || u.name || "Unit"]));

  // ─── Occupancy counts (always across ALL units) ───
  // Occupancy (OCCUPIED/VACANT) and "listed" are independent axes — a vacant
  // unit may also be listed, so listedCount is not part of the occupied/vacant split.
  const occupiedCount = units.filter((u) => u.occupancyStatus === "OCCUPIED").length;
  const vacantCount = units.filter((u) => u.occupancyStatus === "VACANT").length;
  const listedCount = units.filter((u) => u.listed).length;

  // ─── Filter units by occupancy status (LISTED filters the marketing tag) ───
  const matchUnitFilter = (u) => unitFilter === "ALL" || (unitFilter === "LISTED" ? u.listed : u.occupancyStatus === unitFilter);
  const filteredResidential = residentialUnits.filter(matchUnitFilter);
  const filteredCommon = commonUnits.filter(matchUnitFilter);

  return (
    <AppShell role={isOwner ? "OWNER" : "MANAGER"}>
      <PageShell variant="embedded">
        <PageHeader
          title={building?.name || "Building"}
          subtitle={building?.address || "Building details and configuration."}
          backButton={
            <button
              onClick={() => router.push(backHref)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground hover:bg-surface-hover"
              aria-label={t("manager:buildingsId.ariaLabel.backToInventory")}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          }
          actions={
            !isOwner ? (
              <button className="button-secondary text-sm" onClick={() => setShowPackageOnboard((v) => !v)}>
                {showPackageOnboard ? t("buildingsId.hideImport") : t("buildingsId.importData")}
              </button>
            ) : null
          }
        />
        <PageContent>
          {notice && (
            <Panel>
              <div className={cn("text-sm", notice.type === "ok" ? "text-green-600" : "text-red-600")}>
                {notice.message}
              </div>
            </Panel>
          )}

          {showPackageOnboard && !isOwner && (
            <div className="mb-4">
              <PackageOnboardingPanel buildingId={id} onClose={() => setShowPackageOnboard(false)} onCommitted={loadUnits} />
            </div>
          )}

          {/* Tabs Navigation */}
          {(() => {
            const TAB_KEYS = ["Building information", "Units", "Tenants", "Assets", "Documents", "Policies", "Reporting", "Requests", "Correspondence"];
            const TAB_I18N = {
              "Building information": t("manager:buildingsId.tabs.buildingInformation"),
              "Units":                t("manager:buildingsId.tabs.units"),
              "Tenants":              t("manager:buildingsId.tabs.tenants"),
              "Assets":               t("manager:buildingsId.tabs.assets"),
              "Documents":            t("manager:buildingsId.tabs.documents"),
              "Policies":             t("manager:buildingsId.tabs.policies"),
              "Reporting":            "Reporting",
              "Requests":             t("manager:buildingsId.tabs.requests"),
              "Correspondence":       t("manager:buildingsId.tabs.correspondence"),
            };
            return (
              <ScrollableTabs activeIndex={TAB_KEYS.indexOf(activeTab)}>
                {TAB_KEYS.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={activeTab === tab ? "tab-btn-active" : "tab-btn"}
                    onClick={() => setActiveTab(tab)}
                  >
                    {TAB_I18N[tab]}
                  </button>
                ))}
              </ScrollableTabs>
            );
          })()}

          {/* Building information tab */}
          {activeTab === "Building information" && (
            <>
              {/* KPIs — mobile: compact inline grid */}
              <div className="sm:hidden mb-4">
                <KpiInlineGrid
                  items={[
                    { label: t("manager:buildingsId.kpi.openRequests"), value: kpisLoading ? "…" : (buildingKpis?.openRequests ?? "—"), tone: buildingKpis?.openRequests > 20 ? "warn" : undefined },
                    { label: t("manager:buildingsId.kpi.openJobs"),     value: kpisLoading ? "…" : (buildingKpis?.openJobs ?? "—"), tone: buildingKpis?.openJobs > 15 ? "warn" : undefined },
                    { label: t("manager:buildingsId.kpi.noiYtd"),       value: kpisLoading ? "…" : (buildingKpis?.financials ? formatChfCents(buildingKpis.financials.netIncomeCents) : "—"), tone: buildingKpis?.financials ? (buildingKpis.financials.netIncomeCents >= 0 ? "good" : "warn") : undefined },
                    { label: t("manager:buildingsId.kpi.vsPortfolio"),  value: kpisLoading ? "…" : (buildingKpis?.portfolioComparison ? `${buildingKpis.portfolioComparison.better ? "+" : ""}${buildingKpis.portfolioComparison.pct}%` : "—"), tone: buildingKpis?.portfolioComparison ? (buildingKpis.portfolioComparison.better ? "good" : "warn") : undefined },
                  ]}
                />
              </div>
              {/* KPIs — desktop: card grid */}
              <div className="hidden sm:grid kpi-grid gap-4 xl:grid-cols-4 mb-4">
                {/* Open Requests */}
                <div className="rounded-2xl border border-surface-border bg-surface p-5 shadow-sm">
                  <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.kpi.openRequests")}</div>
                  {kpisLoading ? (
                    <div className="mt-3 text-sm text-foreground-dim">{t("common:loading")}</div>
                  ) : (
                    <>
                      <div className={cn("mt-3 text-2xl font-semibold tracking-tight", buildingKpis?.openRequests > 20 ? "text-amber-700" : "text-foreground")}>
                        {buildingKpis?.openRequests ?? "—"}
                      </div>
                      <div className="text-sm text-muted-text">{t("manager:buildingsId.kpi.pendingApprovedAssigned")}</div>
                    </>
                  )}
                </div>
                {/* Open Jobs */}
                <div className="rounded-2xl border border-surface-border bg-surface p-5 shadow-sm">
                  <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.kpi.openJobs")}</div>
                  {kpisLoading ? (
                    <div className="mt-3 text-sm text-foreground-dim">{t("common:loading")}</div>
                  ) : (
                    <>
                      <div className={cn("mt-3 text-2xl font-semibold tracking-tight", buildingKpis?.openJobs > 15 ? "text-amber-700" : "text-foreground")}>
                        {buildingKpis?.openJobs ?? "—"}
                      </div>
                      <div className="text-sm text-muted-text">{t("manager:buildingsId.kpi.pendingPlusInProgress")}</div>
                    </>
                  )}
                </div>
                {/* Building NOI */}
                <div className="rounded-2xl border border-surface-border bg-surface p-5 shadow-sm">
                  <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.kpi.buildingNoiYtd")}</div>
                  {kpisLoading ? (
                    <div className="mt-3 text-sm text-foreground-dim">{t("common:loading")}</div>
                  ) : (
                    <>
                      <div className={cn("mt-3 text-2xl font-semibold tracking-tight", !buildingKpis?.financials ? "text-foreground-dim" : buildingKpis.financials.netIncomeCents >= 0 ? "text-green-700" : "text-red-700")}>
                        {buildingKpis?.financials ? formatChfCents(buildingKpis.financials.netIncomeCents) : "—"}
                      </div>
                      <div className="text-sm text-muted-text">
                        {buildingKpis?.financials ? `${formatPercent(buildingKpis.financials.collectionRate)} ${t("manager:buildingsId.kpi.collectionRate")}` : t("manager:buildingsId.kpi.noFinancialData")}
                      </div>
                    </>
                  )}
                </div>
                {/* Portfolio Comparison */}
                <div className="rounded-2xl border border-surface-border bg-surface p-5 shadow-sm">
                  <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.kpi.vsPortfolioLong")}</div>
                  {kpisLoading ? (
                    <div className="mt-3 text-sm text-foreground-dim">{t("common:loading")}</div>
                  ) : buildingKpis?.portfolioComparison ? (
                    <>
                      <div className={cn("mt-3 text-2xl font-semibold tracking-tight", buildingKpis.portfolioComparison.better ? "text-green-700" : "text-red-700")}>
                        {buildingKpis.portfolioComparison.better ? "+" : ""}{buildingKpis.portfolioComparison.pct}%
                      </div>
                      <div className="text-sm text-muted-text">
                        {buildingKpis.portfolioComparison.better ? t("manager:buildingsId.kpi.betterThanOtherAssets") : t("manager:buildingsId.kpi.worseThanOtherAssets")}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mt-3 text-2xl font-semibold tracking-tight text-foreground-dim">—</div>
                      <div className="text-sm text-muted-text">{t("manager:buildingsId.kpi.notEnoughPortfolioData")}</div>
                    </>
                  )}
                </div>
              </div>{/* end desktop grid */}

            <Panel
              title={t("manager:buildingsId.title.buildingInformation")}
              actions={!isOwner && editMode ? (
                <>
                  <button
                    type="button"
                    className="button-primary text-sm"
                    disabled={loading}
                    onClick={onUpdateBuilding}
                  >
                    {loading ? t("manager:buildingsId.btn.saving") : t("manager:buildingsId.btn.saveChanges")}
                  </button>
                  <button
                    type="button"
                    className="button-cancel text-sm"
                    onClick={() => {
                      setEditMode(false);
                      setEditName(building?.name || "");
                      setEditAddress(building?.address || "");
                      setEditYearBuilt(building?.yearBuilt != null ? String(building.yearBuilt) : "");
                      setEditElevator(!!building?.hasElevator);
                      setEditConcierge(!!building?.hasConcierge);
                      setEditManagedSince(building?.managedSince ? building.managedSince.slice(0, 10) : "");
                      setEditExtra(buildingToExtraForm(building));
                    }}
                  >
                    {t("manager:buildingsId.btn.cancel")}
                  </button>
                  <button
                    type="button"
                    className="button-danger text-sm"
                    onClick={onDeactivateBuilding}
                    disabled={loading}
                  >
                    {t("manager:buildingsId.btn.deactivate")}
                  </button>
                </>
              ) : !isOwner ? (
                <button
                  type="button"
                  className="button-primary text-sm"
                  onClick={() => { setEditMode(true); loadOwnerCandidates(); }}
                  disabled={loading}
                >
                  {t("manager:buildingsId.btn.edit")}
                </button>
              ) : null}
            >
              {editMode ? (
                <form onSubmit={onUpdateBuilding}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.label.name")}</span>
                      <input
                        className="input text-sm text-muted-dark"
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder={t("manager:buildingsId.placeholder.buildingName")}
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.placeholder.address")}</span>
                      <input
                        className="input text-sm text-muted-dark"
                        type="text"
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        placeholder={t("manager:buildingsId.placeholder.address")}
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.label.yearBuilt")}</span>
                      <input
                        className="input text-sm text-muted-dark"
                        type="number"
                        min="1800"
                        max={new Date().getFullYear()}
                        value={editYearBuilt}
                        onChange={(e) => setEditYearBuilt(e.target.value)}
                        placeholder={t("manager:buildingsId.placeholder.eG1995")}
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.label.managedSince")}</span>
                      <input
                        className="input text-sm text-muted-dark"
                        type="date"
                        value={editManagedSince}
                        onChange={(e) => setEditManagedSince(e.target.value)}
                      />
                    </label>
                    <div className="flex items-end gap-6 pb-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editElevator}
                          onChange={(e) => setEditElevator(e.target.checked)}
                        />
                        <span className="text-sm text-muted-dark">{t("manager:buildingsId.label.elevator")}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editConcierge}
                          onChange={(e) => setEditConcierge(e.target.checked)}
                        />
                        <span className="text-sm text-muted-dark">{t("manager:buildingsId.label.concierge")}</span>
                      </label>
                    </div>
                  </div>
                </form>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.label.name")}</div>
                      <div className="text-sm text-muted-dark mt-1">{building?.name}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.placeholder.address")}</div>
                      <div className="text-sm text-muted-dark mt-1">{building?.address || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.label.yearBuilt")}</div>
                      <div className="text-sm text-muted-dark mt-1">{building?.yearBuilt ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.label.amenities")}</div>
                      <div className="text-sm text-muted-dark mt-1 flex gap-3">
                        {building?.hasElevator && <Badge variant="info" size="sm">{t("manager:buildingsId.label.elevator")}</Badge>}
                        {building?.hasConcierge && <Badge variant="info" size="sm">{t("manager:buildingsId.label.concierge")}</Badge>}
                        {!building?.hasElevator && !building?.hasConcierge && "—"}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Cadastre & estimations — always visible; per-field editing in edit mode */}
              <div className="mt-6 pt-4 border-t border-surface-border">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">{t("manager:buildingsId.heading.cadastralValuation")}</h3>
                </div>

                {/* État locatif net — computed (annual net rent roll), read-only */}
                <div className="mb-4 rounded-xl border border-surface-border bg-surface-muted/40 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.fields.etatLocatifNetChf")}</div>
                  <div className="mt-1 text-lg font-semibold text-foreground">{building?.etatLocatifNetChf != null ? formatChf(building.etatLocatifNetChf) : "—"}</div>
                  <div className="text-xs text-muted-text mt-0.5">{t("manager:buildingsId.fields.etatLocatifNetHint")}</div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {BUILDING_CADASTRAL_FIELDS.map((f) => (
                    <label key={f.key} className={cn("grid gap-2", f.type === "textarea" && "sm:col-span-2")}>
                      <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t(`manager:buildingsId.fields.${f.key}`)}</span>
                      {editMode ? (
                        f.type === "textarea" ? (
                          <textarea
                            className="input text-sm text-muted-dark"
                            rows={2}
                            name={f.key}
                            autoComplete="off"
                            data-lpignore="true"
                            data-1p-ignore="true"
                            data-form-type="other"
                            value={editExtra[f.key] ?? ""}
                            onChange={(e) => setEditExtra((s) => ({ ...s, [f.key]: e.target.value }))}
                          />
                        ) : (
                          <input
                            className="input text-sm text-muted-dark"
                            type={f.type === "date" ? "date" : f.type === "text" ? "text" : "number"}
                            name={f.key}
                            inputMode={f.type === "int" || f.type === "chf" || f.type === "number" ? "decimal" : undefined}
                            autoComplete="off"
                            data-lpignore="true"
                            data-1p-ignore="true"
                            data-form-type="other"
                            step={f.type === "int" ? "1" : f.type === "chf" || f.type === "number" ? "any" : undefined}
                            min={f.type === "int" || f.type === "chf" || f.type === "number" ? "0" : undefined}
                            value={editExtra[f.key] ?? ""}
                            onChange={(e) => setEditExtra((s) => ({ ...s, [f.key]: e.target.value }))}
                          />
                        )
                      ) : (
                        <span className="text-sm text-muted-dark">{formatCadastralValue(f, building?.[f.key])}</span>
                      )}
                    </label>
                  ))}
                </div>

                {/* Market price reference (zip-scoped; NOT part of valeur intrinsèque) */}
                <div className="mt-4 grid gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.fields.marketPricePerSqm")}</span>
                  {editMode ? (
                    <>
                      <input
                        className="input text-sm text-muted-dark sm:max-w-xs"
                        type="number"
                        name="marketPricePerSqm"
                        inputMode="decimal"
                        autoComplete="off"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-form-type="other"
                        step="any"
                        min="0"
                        value={editMarketPrice}
                        onChange={(e) => setEditMarketPrice(e.target.value)}
                        disabled={!building?.postalCode}
                        placeholder={building?.postalCode ? "" : t("manager:buildingsId.fields.marketPriceNoZip")}
                      />
                      <span className="text-xs text-muted-text">{t("manager:buildingsId.fields.marketPriceHint", { zip: building?.postalCode || "—" })}</span>
                    </>
                  ) : (
                    <div className="text-sm text-muted-dark">
                      {marketPrice?.pricePerSqmChf != null ? formatChf(marketPrice.pricePerSqmChf) : "—"}
                      {marketPrice?.asOf && <span className="text-xs text-muted-text ml-2">({formatDate(marketPrice.asOf)})</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Ownership & Management — always visible regardless of edit mode */}
              <div className="mt-6 pt-4 border-t border-surface-border">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-foreground">{t("manager:buildingsId.heading.ownershipManagement")}</h3>
                    </div>

                    {/* Managed Since — inline date input when editing */}
                    <div className="grid gap-4 sm:grid-cols-2 mb-3">
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.label.managedSince")}</div>
                        {editMode ? (
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="date"
                              className="input text-sm text-muted-dark"
                              value={editManagedSince}
                              onChange={(e) => setEditManagedSince(e.target.value)}
                            />
                            <button
                              type="button"
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                              disabled={loading}
                              onClick={async () => {
                                try {
                                  setLoading(true);
                                  await fetchJSON(`/buildings/${id}`, {
                                    method: "PATCH",
                                    body: JSON.stringify({
                                      managedSince: editManagedSince ? new Date(editManagedSince).toISOString() : null,
                                    }),
                                  });
                                  await loadBuilding();
                                  setOk("Managed since updated.");
                                } catch (err) {
                                  setErr(`Update failed: ${err.message}`);
                                } finally {
                                  setLoading(false);
                                }
                              }}
                            >
                              {t("manager:buildingsId.btn.save")}
                            </button>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-dark mt-1">
                            {building?.managedSince ? displayDate(building.managedSince) : "—"}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Owners list */}
                    {building?.owners && building.owners.length > 0 ? (
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim mb-2">{t("manager:buildingsId.label.owners")}</div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {building.owners.map((owner) => {
                            const profile = ownerStrategyProfiles[owner.id];
                            const archetype = profile?.primaryArchetype;
                            const copy = archetype ? ARCHETYPE_EXPLANATION_COPY[archetype] : null;
                            const label = archetype ? ARCHETYPE_LABELS[archetype] : null;
                            return (
                              <div key={owner.id} className="border border-surface-border rounded-lg p-3 bg-surface-subtle">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="font-semibold text-sm text-foreground">{owner.name}</div>
                                    {owner.email && <div className="text-xs text-muted mt-0.5">{owner.email}</div>}
                                  </div>
                                  {editMode && (
                                    <button
                                      type="button"
                                      className="text-xs text-red-500 hover:text-red-700 font-medium ml-2 flex-shrink-0"
                                      disabled={ownerLoading}
                                      onClick={() => onRemoveOwner(owner.id)}
                                    >
                                      {t("manager:buildingsId.btn.remove")}
                                    </button>
                                  )}
                                </div>
                                {profile && (
                                  <div className="mt-2.5 pt-2.5 border-t border-surface-border">
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <span className="text-xs font-semibold text-muted-dark">{t("manager:buildingsId.label.strategy")}</span>
                                      {label && (
                                        <Badge variant="brand" size="sm">{label}</Badge>
                                      )}
                                      {profile.secondaryArchetype && ARCHETYPE_LABELS[profile.secondaryArchetype] && (
                                        <Badge variant="info" size="sm">{ARCHETYPE_LABELS[profile.secondaryArchetype]}</Badge>
                                      )}
                                    </div>
                                    {profile.userFacingGoalLabel && (
                                      <p className="text-xs text-muted italic mb-1.5">"{profile.userFacingGoalLabel}"</p>
                                    )}
                                    {copy && (
                                      <ul className="space-y-0.5">
                                        {copy.bullets.map((b, i) => (
                                          <li key={i} className="text-xs text-muted-text flex gap-1.5">
                                            <span className="text-foreground-dim flex-shrink-0">·</span>
                                            <span>{b}</span>
                                          </li>
                                        ))}
                                        <li className="text-xs text-foreground-dim flex gap-1.5 mt-1">
                                          <span className="flex-shrink-0">↓</span>
                                          <span>{copy.deprioritize}</span>
                                        </li>
                                      </ul>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted italic">{t("manager:buildingsId.label.noOwnersAssigned")}</div>
                    )}

                    {/* Add owner picker (visible when editing) */}
                    {editMode && (
                      <div className="mt-3 flex items-end gap-2">
                        <div className="flex-1">
                          <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim mb-1">{t("manager:buildingsId.label.owners")}</div>
                          <select
                            className="input text-sm text-muted-dark w-full"
                            value={selectedCandidateId}
                            onChange={(e) => setSelectedCandidateId(e.target.value)}
                          >
                            <option value="">{t("manager:buildingsId.select.selectOwner")}</option>
                            {ownerCandidates
                              .filter((c) => !(building?.owners || []).some((o) => o.id === c.id))
                              .map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}{c.email ? ` (${c.email})` : ""}
                                </option>
                              ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          className="button-primary text-sm"
                          disabled={!selectedCandidateId || ownerLoading}
                          onClick={onAddOwner}
                        >
                          {t("manager:buildingsId.btn.add")}
                        </button>
                      </div>
                    )}
                  </div>

              {/* Building Strategy Profile — read-only guidelines; owners can set/edit the role intent */}
              {(buildingStrategyProfile || (isOwner && ownerProfile)) && (() => {
                const bp = buildingStrategyProfile;
                const archLabel = bp?.primaryArchetype ? ARCHETYPE_LABELS[bp.primaryArchetype] : null;
                const copy = bp?.primaryArchetype ? ARCHETYPE_EXPLANATION_COPY[bp.primaryArchetype] : null;
                const secLabel = bp?.secondaryArchetype ? ARCHETYPE_LABELS[bp.secondaryArchetype] : null;
                const canEdit = isOwner && ownerProfile;
                return (
                  <div className="mt-6 pt-4 border-t border-surface-border">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-foreground">{t("manager:buildingsId.heading.managementGuidelines")}</h3>
                      <div className="flex items-center gap-1.5">
                        {archLabel && <Badge variant="brand" size="sm">{archLabel}</Badge>}
                        {secLabel && <Badge variant="info" size="sm">{secLabel}</Badge>}
                        {canEdit && !stratEditOpen && (
                          <button
                            type="button"
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors ml-1"
                            onClick={() => {
                              setStratRoleIntent(bp?.roleIntent && bp.roleIntent !== "unspecified" ? bp.roleIntent : "");
                              setStratError("");
                              setStratEditOpen(true);
                            }}
                          >
                            {bp ? t("manager:buildingsId.btn.edit") : t("manager:buildingsId.btn.setStrategy")}
                          </button>
                        )}
                      </div>
                    </div>

                    {canEdit && stratEditOpen ? (
                      <div className="space-y-3">
                        <p className="text-xs text-muted">{t("manager:buildingsId.strategyEditor.intro")}</p>
                        <div>
                          <label className="block text-xs font-medium uppercase tracking-wide text-foreground-dim mb-1">
                            {t("manager:buildingsId.label.roleIntent")}
                          </label>
                          <select
                            className="input text-sm w-full max-w-xs"
                            value={stratRoleIntent}
                            onChange={(e) => setStratRoleIntent(e.target.value)}
                          >
                            <option value="">{t("manager:buildingsId.select.roleIntent")}</option>
                            {ROLE_INTENT_OPTIONS.map((v) => (
                              <option key={v} value={v}>{v.replace(/_/g, " ")}</option>
                            ))}
                          </select>
                        </div>
                        {stratError && <p className="text-xs text-red-500">{stratError}</p>}
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            className="button-primary text-sm"
                            disabled={!stratRoleIntent || stratSaving}
                            onClick={saveBuildingStrategy}
                          >
                            {stratSaving ? t("manager:buildingsId.btn.saving") : t("manager:buildingsId.btn.save")}
                          </button>
                          <button
                            type="button"
                            className="text-sm font-medium text-muted-dark hover:text-foreground transition-colors"
                            onClick={() => setStratEditOpen(false)}
                          >
                            {t("manager:buildingsId.btn.cancel")}
                          </button>
                        </div>
                      </div>
                    ) : bp ? (
                      <>
                        <KpiInlineGrid
                          items={[
                            { label: t("manager:buildingsId.label.roleIntent"), value: bp.roleIntent ? bp.roleIntent.replace(/_/g, " ") : "—" },
                            { label: t("manager:buildingsId.label.buildingType"), value: bp.buildingType ? bp.buildingType.replace(/_/g, " ") : "—" },
                            { label: t("manager:buildingsId.label.condition"), value: bp.conditionRating != null ? `${bp.conditionRating}/10` : "—" },
                            { label: t("manager:buildingsId.label.approxUnits"), value: bp.approxUnits != null ? String(bp.approxUnits) : "—" },
                          ]}
                        />
                        {copy && (
                          <div className="mt-3">
                            <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim mb-1.5">{t("manager:buildingsId.label.guidelines")}</div>
                            <ul className="space-y-1">
                              {copy.bullets.map((b, i) => (
                                <li key={i} className="text-xs text-muted-text flex gap-1.5">
                                  <span className="text-foreground-dim flex-shrink-0">·</span>
                                  <span>{b}</span>
                                </li>
                              ))}
                              {copy.deprioritize && (
                                <li className="text-xs text-foreground-dim flex gap-1.5 mt-1">
                                  <span className="flex-shrink-0">↓ {t("manager:buildingsId.label.guidelines")}:</span>
                                  <span>{copy.deprioritize}</span>
                                </li>
                              )}
                            </ul>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-muted italic">{t("manager:buildingsId.strategyEditor.notSet")}</p>
                    )}
                  </div>
                );
              })()}
            </Panel>
            </>
          )}

          {/* Units tab */}
          {activeTab === "Units" && (
            <Panel
              title={t("manager:buildingsId.title.units")}
              actions={(
                <button
                  type="button"
                  className="button-primary text-sm"
                  onClick={() => setUnitAction(unitAction ? null : "create")}
                >
                  {unitAction ? t("manager:buildingsId.btn.cancel") : t("manager:buildingsId.btn.addUnit")}
                </button>
              )}
            >
              {unitAction === "create" && (
                <form onSubmit={onCreateUnit} className="bg-surface-subtle border border-surface-border rounded-lg p-4 mb-4">
                  <div className="grid gap-4 sm:grid-cols-2 mb-4">
                    <label className="grid gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">Unit number/label</span>
                      <input
                        className="input text-sm text-muted-dark"
                        value={createUnitName}
                        onChange={(e) => setCreateUnitName(e.target.value)}
                        placeholder={t("manager:buildingsId.placeholder.eG1013bCommonArea1")}
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.label.type")}</span>
                      <select
                        className="input text-sm text-muted-dark"
                        value={createUnitType}
                        onChange={(e) => setCreateUnitType(e.target.value)}
                      >
                        <option value="RESIDENTIAL">{t("manager:buildingsId.select.residential")}</option>
                        <option value="COMMON_AREA">{t("manager:buildingsId.select.commonArea")}</option>
                        <option value="PARKING">{t("manager:buildingsId.select.parking")}</option>
                      </select>
                    </label>
                    {createUnitType === "PARKING" && (
                      <>
                        <label className="grid gap-2">
                          <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.parking.kindLabel")}</span>
                          <select className="input text-sm text-muted-dark" value={createParkingKind} onChange={(e) => setCreateParkingKind(e.target.value)}>
                            <option value="EXTERIOR">{t("manager:buildingsId.parking.exteriorSpot")}</option>
                            <option value="GARAGE">{t("manager:buildingsId.parking.garageBox")}</option>
                          </select>
                        </label>
                        <label className="grid gap-2">
                          <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.parking.assignedToFlat")}</span>
                          <select className="input text-sm text-muted-dark" value={createLinkedFlatId} onChange={(e) => setCreateLinkedFlatId(e.target.value)}>
                            <option value="">{t("manager:buildingsId.parking.none")}</option>
                            {residentialUnits.map((f) => (
                              <option key={f.id} value={f.id}>{f.unitNumber || f.name || "Unit"}</option>
                            ))}
                          </select>
                        </label>
                      </>
                    )}
                  </div>
                  <button type="submit" className="button-primary" disabled={loading}>
                    {loading ? t("manager:buildingsId.btn.creating") : t("manager:buildingsId.btn.createUnit")}
                  </button>
                </form>
              )}

              {residentialUnits.length > 0 && (
                <>
                  {/* ─── Occupancy summary row ─── */}
                  <div className="text-sm text-muted-text mt-4 mb-2">
                    {units.length} {units.length !== 1 ? t("manager:buildingsId.text.units") : t("manager:buildingsId.text.unit")} — {occupiedCount} {t("manager:buildingsId.text.occupied").toLowerCase()}, {vacantCount} {t("manager:buildingsId.text.vacant").toLowerCase()}, {listedCount} {t("manager:buildingsId.text.listed").toLowerCase()}
                  </div>

                  {/* ─── Filter tabs ─── */}
                  <div className="flex gap-1 mb-4">
                    {[
                      { key: "ALL",      label: t("manager:buildingsId.text.all") },
                      { key: "OCCUPIED", label: t("manager:buildingsId.text.occupied") },
                      { key: "VACANT",   label: t("manager:buildingsId.text.vacant") },
                      { key: "LISTED",   label: t("manager:buildingsId.text.listed") },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setUnitFilter(tab.key)}
                        className={cn("px-3 py-1 text-xs font-medium rounded-full border transition", unitFilter === tab.key
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-surface text-muted-text border-muted-ring hover:bg-surface-subtle")}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {filteredResidential.length > 0 && (
                <>
                  <h3 className="font-semibold text-foreground mt-4 mb-3">{t("manager:buildingsId.heading.residentialUnits")}</h3>
                  <div className="space-y-2 mb-4">
                    {filteredResidential.map((u) => (
                      <Link key={u.id} href={`/admin-inventory/units/${u.id}${isOwner ? "?role=owner" : ""}`} className="block border border-surface-border rounded-lg p-3 hover:bg-surface-subtle transition">
                        <div className="flex justify-between items-center">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-foreground">{u.unitNumber || u.name || "Unit"}</span>
                              {u.floor && <span className="text-xs text-foreground-dim">Floor {u.floor}</span>}
                              {u.rooms != null && <span className="text-xs text-foreground-dim">{u.rooms} rooms</span>}
                              {u.livingAreaSqm != null && <span className="text-xs text-foreground-dim">{u.livingAreaSqm} m²</span>}
                              {/* ─── Occupancy badge ─── */}
                              {u.occupancyStatus === "OCCUPIED" && (
                                <Badge variant="success" size="sm">{t("manager:buildingsId.text.occupied")}</Badge>
                              )}
                              {u.occupancyStatus === "VACANT" && (
                                <Badge variant="destructive" size="sm">{t("manager:buildingsId.text.vacant")}</Badge>
                              )}
                              {u.listed && (
                                <Badge variant="warning" size="sm">{t("manager:buildingsId.text.listed")}</Badge>
                              )}
                            </div>
                            {/* ─── Tenant info for occupied units ─── */}
                            {u.occupancyStatus === "OCCUPIED" && u.tenantName && (
                              <div className="text-xs text-muted mt-1">
                                <span className="text-muted-dark">{u.tenantName}</span>
                                {u.moveInDate && (
                                  <span className="ml-2 text-foreground-dim">
                                    {t("manager:buildingsId.text.since")}{formatDate(u.moveInDate)}
                                  </span>
                                )}
                              </div>
                            )}
                            {/* ─── Listed note ─── */}
                            {u.listed && u.occupancyStatus === "VACANT" && (
                              <div className="text-xs text-yellow-600 mt-1">{t("manager:buildingsId.text.acceptingApplications")}</div>
                            )}
                            {(u.monthlyRentChf != null || u.monthlyChargesChf != null) && (
                              <div className="text-xs text-muted mt-1">
                                {u.monthlyRentChf != null && <span className="font-medium text-muted-dark">CHF {u.monthlyRentChf}.-</span>}
                                {u.monthlyChargesChf != null && <span className="ml-1 text-foreground-dim">+ {u.monthlyChargesChf} charges</span>}
                                {(u.monthlyRentChf != null || u.monthlyChargesChf != null) && (
                                  <span className="ml-1 text-muted-text font-medium">= CHF {(u.monthlyRentChf || 0) + (u.monthlyChargesChf || 0)}.- total</span>
                                )}
                              </div>
                            )}
                          </div>
                          <span className="text-blue-600 ml-2 flex-shrink-0">→</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              )}

              {filteredCommon.length > 0 && (
                <>
                  <h3 className="font-semibold text-foreground mt-4 mb-3">{t("manager:buildingsId.heading.commonAreas")}</h3>
                  <div className="space-y-2 mb-4">
                    {filteredCommon.map((u) => (
                      <Link key={u.id} href={`/admin-inventory/units/${u.id}${isOwner ? "?role=owner" : ""}`} className="block border border-surface-border rounded-lg p-3 hover:bg-surface-subtle transition">
                        <div className="flex justify-between items-center">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-foreground">{u.unitNumber || u.name || t("manager:buildingsId.text.commonArea")}</span>
                              {u.floor && <span className="text-xs text-foreground-dim">{u.floor}</span>}
                              {u.livingAreaSqm != null && <span className="text-xs text-foreground-dim">{u.livingAreaSqm} m²</span>}
                              {/* ─── Occupancy badge ─── */}
                              {u.occupancyStatus === "OCCUPIED" && (
                                <Badge variant="success" size="sm">{t("manager:buildingsId.text.occupied")}</Badge>
                              )}
                              {u.occupancyStatus === "VACANT" && (
                                <Badge variant="destructive" size="sm">{t("manager:buildingsId.text.vacant")}</Badge>
                              )}
                              {u.listed && (
                                <Badge variant="warning" size="sm">{t("manager:buildingsId.text.listed")}</Badge>
                              )}
                            </div>
                          </div>
                          <span className="text-blue-600 ml-2 flex-shrink-0">→</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              )}

              {parkingUnits.filter(matchUnitFilter).length > 0 && (
                <>
                  <h3 className="font-semibold text-foreground mt-4 mb-3">{t("manager:buildingsId.heading.parking")}</h3>
                  <div className="space-y-2 mb-4">
                    {parkingUnits.filter(matchUnitFilter).map((u) => (
                      <Link key={u.id} href={`/admin-inventory/units/${u.id}${isOwner ? "?role=owner" : ""}`} className="block border border-surface-border rounded-lg p-3 hover:bg-surface-subtle transition">
                        <div className="flex justify-between items-center">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-foreground">{u.unitNumber || u.name || t("manager:buildingsId.heading.parking")}</span>
                              <Badge variant="info" size="sm">{u.parkingKind === "GARAGE" ? t("manager:buildingsId.parking.garage") : t("manager:buildingsId.parking.exterior")}</Badge>
                              {u.linkedFlatId && flatLabelById[u.linkedFlatId] && (
                                <span className="text-xs text-foreground-dim">{t("manager:buildingsId.parking.linkedFlat", { label: flatLabelById[u.linkedFlatId] })}</span>
                              )}
                              {u.occupancyStatus === "OCCUPIED" && <Badge variant="success" size="sm">{t("manager:buildingsId.text.occupied")}</Badge>}
                              {u.occupancyStatus === "VACANT" && <Badge variant="destructive" size="sm">{t("manager:buildingsId.text.vacant")}</Badge>}
                              {u.listed && <Badge variant="warning" size="sm">{t("manager:buildingsId.text.listed")}</Badge>}
                            </div>
                            {(u.monthlyRentChf != null || u.monthlyChargesChf != null) && (
                              <div className="text-xs text-muted mt-1">
                                {u.monthlyRentChf != null && <span className="font-medium text-muted-dark">CHF {u.monthlyRentChf}.-</span>}
                                {u.monthlyChargesChf != null && <span className="ml-1 text-foreground-dim">+ {u.monthlyChargesChf} charges</span>}
                              </div>
                            )}
                          </div>
                          <span className="text-blue-600 ml-2 flex-shrink-0">→</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              )}

              {units.length === 0 && <div className="text-center text-muted italic text-sm py-6">{t("manager:buildingsId.text.noUnitsYet")}</div>}
            </Panel>
          )}

          {/* Tenants tab */}
          {activeTab === "Tenants" && (
            <Panel title={t("manager:buildingsId.title.tenants")}>
              {building?.tenants && building.tenants.length > 0 ? (
                <>
                {/* Mobile: card list */}
                <div className="sm:hidden space-y-2">
                  {sortedBuildingTenants.map((ten, idx) => (
                    <div key={ten.tenantId || idx} className="rounded-lg border border-surface-border bg-surface-subtle px-3 py-2.5">
                      <p className="text-sm font-medium text-foreground">{ten.name}</p>
                      <p className="text-xs text-muted mt-0.5">Unit {ten.unitNumber}{ten.phone ? ` · ${ten.phone}` : ""}</p>
                    </div>
                  ))}
                </div>
                {/* Desktop: table */}
                <table className="hidden sm:table data-table">
                  <thead>
                    <tr>
                      <SortableHeader label={t("manager:buildingsId.col.name")} field="name" sortField={tenSF} sortDir={tenSD} onSort={handleTenSort} />
                      <SortableHeader label={t("manager:buildingsId.col.unit")} field="unit" sortField={tenSF} sortDir={tenSD} onSort={handleTenSort} />
                      <SortableHeader label={t("manager:buildingsId.col.phone")} field="phone" sortField={tenSF} sortDir={tenSD} onSort={handleTenSort} />
                      <SortableHeader label={t("manager:buildingsId.col.email")} field="email" sortField={tenSF} sortDir={tenSD} onSort={handleTenSort} />
                      <SortableHeader label={t("manager:buildingsId.col.moveIn")} field="moveIn" sortField={tenSF} sortDir={tenSD} onSort={handleTenSort} />
                      <SortableHeader label={t("manager:buildingsId.col.source")} field="source" sortField={tenSF} sortDir={tenSD} onSort={handleTenSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedBuildingTenants.map((ten, idx) => {
                      const badgeVariant =
                        ten.source === "BOTH"
                          ? "success"
                          : ten.source === "LEASE"
                          ? "info"
                          : "muted";
                      return (
                        <tr key={ten.tenantId || idx} className="border-b border-surface-divider">
                          <td className="text-foreground font-medium">{ten.name}</td>
                          <td className="text-muted-dark">{ten.unitNumber}</td>
                          <td className="text-muted-dark">{ten.phone || "—"}</td>
                          <td className="text-muted-dark">{ten.email || "—"}</td>
                          <td className="text-muted-dark">{ten.moveInDate ? displayDate(ten.moveInDate) : "—"}</td>
                          <td>
                            <Badge variant={badgeVariant} size="sm">
                              {ten.source === "BOTH" ? t("manager:buildingsId.text.both") : ten.source === "LEASE" ? t("manager:buildingsId.text.lease") : t("manager:buildingsId.text.directory")}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </>
              ) : (
                <div className="text-center text-muted italic text-sm py-6">{t("manager:buildingsId.text.noTenantsYet")}</div>
              )}
            </Panel>
          )}

          {/* Assets tab */}
          {activeTab === "Assets" && (
            <Panel
              title={t("manager:buildingsId.title.assetInventoryDepreciation")}
              actions={!assetInventoryLoading && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="button-secondary text-sm"
                    onClick={seedDefaultAssets}
                    disabled={assetSeeding}
                  >
                    {assetSeeding ? "Seeding…" : "Populate defaults"}
                  </button>
                  <button
                    type="button"
                    className={assetAddMode ? "button-cancel text-sm" : "button-primary text-sm"}
                    onClick={() => setAssetAddMode((v) => !v)}
                  >
                    {assetAddMode ? t("manager:buildingsId.btn.cancel") : t("manager:buildingsId.btn.addAsset")}
                  </button>
                </div>
              )}
            >
              {assetInventoryLoading ? (
                <p className="text-center text-muted py-6">Loading assets…</p>
              ) : (
                <AssetInventoryPanel
                  assets={assetInventory}
                  onRefresh={loadAssetInventory}
                  scope="building"
                  parentId={id}
                  units={units.map((u) => ({ id: u.id, unitNumber: u.unitNumber }))}
                  showAddForm={assetAddMode}
                  setShowAddForm={setAssetAddMode}
                />
              )}
            </Panel>
          )}

          {/* Documents tab */}
          {activeTab === "Documents" && (
            <>
            <Panel title={t("manager:buildingsId.title.documents")}>
              <h3 className="font-semibold text-foreground mb-3">{t("manager:buildingsId.heading.leaseTemplate")}</h3>
              {leaseTemplates.length > 0 ? (
                <div className="space-y-2">
                  {leaseTemplates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="border border-surface-border rounded-lg p-4 hover:bg-surface-subtle transition"
                    >
                      <div className="flex justify-between items-center">
                        <Link href={`/manager/leases/${tpl.id}`} className="flex-1 min-w-0">
                          <span className="font-semibold text-foreground">{tpl.templateName || "Lease Template"}</span>
                          <Badge variant="brand" size="sm" className="ml-2">{t("manager:buildingsId.text.template")}</Badge>
                          {tpl.landlordName && (
                            <p className="text-xs text-muted mt-1">{t("manager:buildingsId.text.landlordPrefix")}{tpl.landlordName}</p>
                          )}
                          {tpl.netRentChf != null && (
                            <p className="text-xs text-muted">{t("manager:buildingsId.text.defaultRentPrefix")}{tpl.netRentChf}{t("manager:buildingsId.text.defaultRentSuffix")}</p>
                          )}
                        </Link>
                        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                          <Link href={`/manager/leases/${tpl.id}`} className="text-blue-600">→</Link>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const r = await fetch(`/api/lease-templates/${tpl.id}`, { method: "DELETE", headers: authHeaders() });
                                if (!r.ok) throw new Error("Delete failed");
                                await loadLeaseTemplates();
                                toast.show(`Template "${tpl.templateName || "Unnamed"}" deleted`, async () => {
                                  await fetch(`/api/lease-templates/${tpl.id}/restore`, { method: "POST", headers: authHeaders() });
                                  await loadLeaseTemplates();
                                });
                              } catch (e) {
                                setErr(`Failed to delete template: ${e.message}`);
                              }
                            }}
                            className="text-red-500 hover:text-red-700 text-sm font-medium"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm text-amber-700 font-medium mb-1">No lease template found for this building</p>
                  <p className="text-xs text-amber-600 mb-3">
                    {t("manager:buildingsId.text.leaseTemplateDesc")}
                  </p>
                  <Link
                    href="/manager/leases?tab=templates"
                    className="inline-flex items-center rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"
                  >
                    {t("manager:buildingsId.text.goToLeaseTemplates")}
                  </Link>
                </div>
              )}
            </Panel>

            {/* House Rules panel */}
            <Panel
              title="House Rules"
              actions={
                <div className="flex items-center gap-2">
                  {building?.houseRulesText && !houseRulesEditing && (
                    <>
                      <button type="button" onClick={onPreviewHouseRulesPdf} className="button-secondary text-sm">
                        {houseRulesPreviewUrl ? "Close Preview" : "Preview PDF"}
                      </button>
                      <button type="button" onClick={onDownloadHouseRulesPdf} className="button-secondary text-sm">
                        Download PDF
                      </button>
                    </>
                  )}
                  {houseRulesEditing ? (
                    <>
                      <button type="button" onClick={() => { setHouseRulesEditing(false); setHouseRulesText(building?.houseRulesText || ""); }} className="button-cancel text-sm">Cancel</button>
                      <button type="button" onClick={onSaveHouseRules} disabled={houseRulesSaving} className="button-primary text-sm">{houseRulesSaving ? "Saving…" : "Save"}</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setHouseRulesEditing(true)} className="button-secondary text-sm">{building?.houseRulesText ? "Edit" : "+ Add House Rules"}</button>
                  )}
                </div>
              }
            >
              {houseRulesEditing ? (
                <textarea
                  value={houseRulesText}
                  onChange={(e) => setHouseRulesText(e.target.value)}
                  rows={16}
                  className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand/40 resize-y"
                  placeholder="Enter house rules text. This will be attached to lease PDFs when 'Include house rules' is checked, and made available to tenants via the chatbot."
                />
              ) : building?.houseRulesText ? (
                <div className="space-y-2">
                  <pre className="whitespace-pre-wrap text-sm text-muted-dark font-sans leading-relaxed bg-surface-subtle rounded-lg border border-surface-border p-4 max-h-80 overflow-y-auto">{building.houseRulesText}</pre>
                  {houseRulesPreviewUrl && (
                    <div className="mt-3 rounded-lg overflow-hidden border border-surface-border h-[600px]">
                      <iframe src={houseRulesPreviewUrl} className="w-full h-full" title="House Rules PDF Preview" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-muted-ring bg-surface-subtle p-6 text-center">
                  <p className="text-sm text-muted mb-1">No house rules defined yet.</p>
                  <p className="text-xs text-foreground-dim">House rules will be attached to lease PDFs and accessible to tenants via the chatbot.</p>
                </div>
              )}
            </Panel>

            {/* Legal Reference Documents */}
            <Panel title="Legal Reference Documents">
              <p className="text-xs text-muted mb-4">
                Federal and canton-scoped legal sources applicable to this building. These documents are used by the tenant AI chatbot to answer questions about rights, obligations, and procedures.
                {building?.canton ? ` Canton: ${building.canton}.` : ""}
              </p>
              {legalSourcesLoading ? (
                <p className="text-sm text-muted">{t("common:loading")}</p>
              ) : legalSources.length === 0 ? (
                <div className="rounded-lg border border-dashed border-muted-ring bg-surface-subtle p-4 text-center">
                  <p className="text-sm text-muted">No legal sources configured.</p>
                  <p className="text-xs text-foreground-dim mt-1">Add sources in Settings → Legal to make them available here.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {legalSources.map((src) => (
                    <div key={src.id} className="flex items-start justify-between gap-3 rounded-lg border border-surface-border bg-surface p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-foreground">{src.name}</span>
                          <span className={src.scope === "FEDERAL" ? "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-brand-light text-brand-dark" : "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-info-light text-info-dark"}>
                            {src.scope === "FEDERAL" ? "Federal CH" : "Canton " + src.scope}
                          </span>
                          {src.fetcherType && (
                            <span className="inline-flex items-center rounded-full bg-surface-subtle border border-surface-border px-2 py-0.5 text-xs text-muted font-mono">
                              {src.fetcherType}
                            </span>
                          )}
                        </div>
                        {src.url && (
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 block truncate text-xs text-blue-600 hover:underline"
                          >
                            {src.url}
                          </a>
                        )}
                        {src.lastSuccessAt && (
                          <p className="mt-1 text-xs text-foreground-dim">
                            Last synced: {new Date(src.lastSuccessAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            </>
          )}

          {/* Policies tab */}
          {activeTab === "Policies" && (
            <>
              <Panel
                title={t("manager:buildingsId.title.policies")}
                actions={configMode === "edit" ? (
                  <button
                    type="button"
                    className="button-cancel text-sm"
                    onClick={() => setConfigMode(null)}
                  >
                    {t("manager:buildingsId.btn.cancelPolicies")}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="button-primary text-sm"
                    onClick={() => setConfigMode("edit")}
                  >
                    {t("manager:buildingsId.btn.editPolicies")}
                  </button>
                )}
              >
                <div className="text-sm text-muted-text mb-4">{t("manager:buildingsId.text.autoApproveDesc")}</div>
                {configMode === "edit" ? (
                  <form onSubmit={onSaveBuildingConfig} className="mt-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-2">
                        <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.label.autoApproveLimit")}</span>
                        <input
                          type="number"
                          className="input text-sm text-muted-dark"
                          value={configAutoApprove}
                          onChange={(e) => setConfigAutoApprove(e.target.value)}
                          placeholder={t("manager:buildingsId.placeholder.leaveBlankForOrgDefault")}
                        />
                        <span className="text-xs text-muted">{t("manager:buildingsId.label.blankOrgDefault")}</span>
                      </label>
                      <label className="grid gap-2">
                        <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.label.ownerThreshold")}</span>
                        <input
                          type="number"
                          className="input text-sm text-muted-dark"
                          value={configOwnerThreshold}
                          onChange={(e) => setConfigOwnerThreshold(e.target.value)}
                          placeholder={t("manager:buildingsId.placeholder.leaveBlankForOrgDefault")}
                        />
                        <span className="text-xs text-muted">{t("manager:buildingsId.label.blankOrgDefault")}</span>
                      </label>
                    </div>
                    <label className="flex items-center gap-2 my-4 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={configEmergency}
                        onChange={(e) => setConfigEmergency(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm font-semibold text-muted-dark">{t("manager:buildingsId.label.emergencyAutoDispatch")}</span>
                    </label>
                    <button type="submit" className="button-primary" disabled={loading}>
                      {loading ? t("manager:buildingsId.btn.saving") : t("manager:buildingsId.btn.savePolicies")}
                    </button>
                  </form>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2 mt-4">
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.label.autoApproveLimitView")}</div>
                        <div className="text-sm text-muted-dark mt-1">
                          {buildingConfig?.autoApproveLimit != null ? `${buildingConfig.autoApproveLimit} CHF` : t("manager:buildingsId.label.usingOrgDefault")}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.label.ownerThresholdView")}</div>
                        <div className="text-sm text-muted-dark mt-1">
                          {buildingConfig?.requireOwnerApprovalAbove != null ? `${buildingConfig.requireOwnerApprovalAbove} CHF` : t("manager:buildingsId.label.usingOrgDefault")}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.label.emergencyAutoDispatch")}</div>
                        <div className="text-sm text-muted-dark mt-1">
                          {buildingConfig?.emergencyAutoDispatch ? t("manager:buildingsId.label.enabled") : t("manager:buildingsId.label.disabled")}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </Panel>

              <Panel
                title={t("manager:buildingsId.title.overrides")}
                actions={createRuleMode ? (
                  <button
                    type="button"
                    className="button-cancel text-sm"
                    onClick={() => {
                      setCreateRuleMode(false);
                      setNewRuleName("");
                      setNewRulePriority("0");
                      setNewRuleConditions([{ field: "CATEGORY", operator: "EQUALS", value: "" }]);
                      setNewRuleAction("AUTO_APPROVE");
                    }}
                  >
                    {t("manager:buildingsId.btn.cancel")}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="button-primary text-sm"
                    onClick={() => setCreateRuleMode(true)}
                  >
                    {t("manager:buildingsId.btn.addOverride")}
                  </button>
                )}
              >
                <div className="text-sm text-muted-text mb-4">{t("manager:buildingsId.text.overrideDesc")}</div>

              {createRuleMode ? (
                <form onSubmit={onCreateRule} className="mt-4">
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-muted-dark mb-2">{t("manager:buildingsId.label.ruleName")}</label>
                    <input
                      className="input text-sm text-muted-dark w-full"
                      value={newRuleName}
                      onChange={(e) => setNewRuleName(e.target.value)}
                      placeholder={t("manager:buildingsId.placeholder.eGAutoApproveOvensChf500")}
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-muted-dark mb-2">{t("manager:buildingsId.label.priorityLabel")}</label>
                    <input
                      type="number"
                      className="input text-sm text-muted-dark"
                      value={newRulePriority}
                      onChange={(e) => setNewRulePriority(e.target.value)}
                      min="0"
                      max="100"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-muted-dark mb-2">{t("manager:buildingsId.label.conditions")}</label>
                    <div className="space-y-2 mb-3">
                      {newRuleConditions.map((cond, idx) => (
                        <div key={idx} className="flex gap-2 items-end">
                          <select
                            className="input text-sm text-muted-dark flex-1"
                            value={cond.field}
                            onChange={(e) => updateCondition(idx, "field", e.target.value)}
                          >
                            <option value="CATEGORY">{t("manager:buildingsId.select.category")}</option>
                            <option value="ESTIMATED_COST">{t("manager:buildingsId.select.estimatedCost")}</option>
                            <option value="UNIT_TYPE">{t("manager:buildingsId.select.unitType")}</option>
                            <option value="UNIT_NUMBER">Unit Number</option>
                          </select>
                          <select
                            className="input text-sm text-muted-dark flex-1"
                            value={cond.operator}
                            onChange={(e) => updateCondition(idx, "operator", e.target.value)}
                          >
                            <option value="EQUALS">{t("manager:buildingsId.select.equals")}</option>
                            <option value="NOT_EQUALS">{t("manager:buildingsId.select.notEquals")}</option>
                            {cond.field === "ESTIMATED_COST" && (
                              <>
                                <option value="LESS_THAN">{t("manager:buildingsId.select.lessThan")}</option>
                                <option value="LESS_THAN_OR_EQUAL">{t("manager:buildingsId.select.lessThanOrEqual")}</option>
                                <option value="GREATER_THAN">{t("manager:buildingsId.select.greaterThan")}</option>
                                <option value="GREATER_THAN_OR_EQUAL">{t("manager:buildingsId.select.greaterThanOrEqual")}</option>
                              </>
                            )}
                            {(cond.field === "CATEGORY" || cond.field === "UNIT_TYPE" || cond.field === "UNIT_NUMBER") && (
                              <>
                                <option value="CONTAINS">{t("manager:buildingsId.select.contains")}</option>
                                <option value="STARTS_WITH">{t("manager:buildingsId.select.startsWith")}</option>
                                <option value="ENDS_WITH">{t("manager:buildingsId.select.endsWith")}</option>
                              </>
                            )}
                          </select>
                          <input
                            className="input text-sm text-muted-dark flex-1"
                            type={cond.field === "ESTIMATED_COST" ? "number" : "text"}
                            value={cond.value}
                            onChange={(e) =>
                              updateCondition(idx, "value", cond.field === "ESTIMATED_COST" ? parseInt(e.target.value) || 0 : e.target.value)
                            }
                            placeholder={
                              cond.field === "CATEGORY"
                                ? "e.g., oven, stove"
                                : cond.field === "UNIT_TYPE"
                                ? "RESIDENTIAL or COMMON_AREA"
                                : cond.field === "UNIT_NUMBER"
                                ? "e.g., 101, 2xx, PH"
                                : "CHF amount"
                            }
                          />
                          {newRuleConditions.length > 1 && (
                            <button
                              type="button"
                              className="button-secondary px-2 py-1 text-xs"
                              onClick={() => removeCondition(idx)}
                            >
                              {t("manager:buildingsId.btn.remove")}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button type="button" className="button-secondary text-xs" onClick={addCondition}>
                      {t("manager:buildingsId.btn.addCondition")}
                    </button>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-muted-dark mb-2">{t("manager:buildingsId.label.action")}</label>
                    <select className="input text-sm text-muted-dark w-full" value={newRuleAction} onChange={(e) => setNewRuleAction(e.target.value)}>
                      <option value="AUTO_APPROVE">{t("manager:buildingsId.select.autoApprove")}</option>
                      <option value="REQUIRE_MANAGER_REVIEW">{t("manager:buildingsId.select.requireManagerReview")}</option>
                      <option value="REQUIRE_OWNER_APPROVAL">{t("manager:buildingsId.select.requireOwnerApproval")}</option>
                    </select>
                  </div>

                  <button type="submit" className="button-primary" disabled={loading}>
                    {loading ? t("manager:buildingsId.btn.creating") : t("manager:buildingsId.btn.createRule")}
                  </button>
                </form>
              ) : (
                <>
                  {rules.length > 0 && (
                    <div className="space-y-3 mt-4 mb-4">
                      {rules.map((rule) => (
                        <div key={rule.id} className="border border-surface-border rounded-lg p-3 bg-surface-subtle">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-semibold text-foreground">
                                {rule.name}
                                {!rule.isActive && <Badge variant="warning" size="sm" className="ml-2">{t("manager:buildingsId.label.inactive")}</Badge>}
                                <Badge variant="info" size="sm" className="ml-2">{t("manager:buildingsId.label.priorityPrefix")}{rule.priority}</Badge>
                              </div>
                              <div className="text-xs text-muted-text mt-1">
                                {rule.conditions.map((c, i) => (
                                  <span key={i}>
                                    {i > 0 && " AND "}
                                    <strong>{c.field}</strong> {c.operator.toLowerCase().replace(/_/g, " ")} <code>{c.value}</code>
                                  </span>
                                ))}
                                {" → "}
                                <strong>{rule.action.toLowerCase().replace(/_/g, " ")}</strong>
                              </div>
                            </div>
                            <div className="flex gap-2 ml-4">
                              <button
                                type="button"
                                className="button-secondary text-xs px-2 py-1"
                                onClick={() => onToggleRuleActive(rule.id, rule.isActive)}
                                disabled={loading}
                              >
                                {rule.isActive ? t("manager:buildingsId.btn.deactivate") : t("manager:buildingsId.btn.activate")}
                              </button>
                              <button
                                type="button"
                                className="button-danger text-xs px-2 py-1"
                                onClick={() => onDeleteRule(rule.id)}
                                disabled={loading}
                              >
                                {t("manager:buildingsId.btn.delete")}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {rules.length === 0 && <div className="text-center text-muted italic text-sm py-6">{t("manager:buildingsId.text.noApprovalRulesYet")}</div>}
                </>
              )}
              </Panel>
            </>
          )}

          {/* Requests tab */}
          {activeTab === "Requests" && (
            <Panel title={t("manager:buildingsId.title.requests")}>
              {requestsLoading ? (
                <p className="text-sm text-muted py-4">{t("manager:buildingsId.text.loadingRequests")}</p>
              ) : buildingRequests.length === 0 ? (
                <p className="text-sm text-muted italic py-4">{t("manager:buildingsId.text.noRequestsYet")}</p>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="sm:hidden divide-y divide-slate-100">
                    {sortedBuildingRequests.map((r) => (
                      <div
                        key={r.id}
                        className="py-3 flex flex-col gap-1 cursor-pointer hover:bg-surface-subtle"
                        onClick={() => router.push(`/manager/requests?id=${r.id}`)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-muted-dark">
                            #{r.requestNumber}{r.category ? ` · ${r.category}` : ""}
                          </span>
                          <Badge variant={
                            r.status === "COMPLETED" ? "success" :
                            r.status === "REJECTED" ? "destructive" :
                            r.status === "PENDING_REVIEW" || r.status === "PENDING_OWNER_APPROVAL" || r.status === "RFP_PENDING" ? "warning" :
                            r.status === "APPROVED" || r.status === "ASSIGNED" ? "info" : "default"
                          } size="sm">
                            {r.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted flex items-center gap-2">
                          {r.unit?.unitNumber && <span>Unit {r.unit.unitNumber}</span>}
                          {r.urgency && <span>· {r.urgency}</span>}
                          {r.assignedContractor?.name && <span>· {r.assignedContractor.name}</span>}
                        </div>
                        <span className="text-xs text-foreground-dim">
                          {r.createdAt ? new Date(r.createdAt).toLocaleDateString("de-CH") : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="data-table w-full">
                      <thead>
                        <tr>
                          <th>{t("manager:buildingsId.col.number")}</th>
                          <SortableHeader label={t("manager:buildingsId.col.status")} field="status" sortField={reqSF} sortDir={reqSD} onSort={handleReqSort} />
                          <SortableHeader label={t("manager:buildingsId.col.category")} field="category" sortField={reqSF} sortDir={reqSD} onSort={handleReqSort} />
                          <SortableHeader label={t("manager:buildingsId.col.unit")} field="unit" sortField={reqSF} sortDir={reqSD} onSort={handleReqSort} />
                          <SortableHeader label={t("manager:buildingsId.col.urgency")} field="urgency" sortField={reqSF} sortDir={reqSD} onSort={handleReqSort} />
                          <SortableHeader label={t("manager:buildingsId.col.contractor")} field="contractor" sortField={reqSF} sortDir={reqSD} onSort={handleReqSort} />
                          <SortableHeader label={t("manager:buildingsId.col.date")} field="createdAt" sortField={reqSF} sortDir={reqSD} onSort={handleReqSort} />
                        </tr>
                      </thead>
                      <tbody>
                        {sortedBuildingRequests.map((r) => (
                          <tr
                            key={r.id}
                            className="cursor-pointer hover:bg-surface-subtle"
                            onClick={() => router.push(`/manager/requests?id=${r.id}`)}
                          >
                            <td className="font-mono text-muted-text">#{r.requestNumber}</td>
                            <td>
                              <Badge variant={
                                r.status === "COMPLETED" ? "success" :
                                r.status === "REJECTED" ? "destructive" :
                                r.status === "PENDING_REVIEW" || r.status === "PENDING_OWNER_APPROVAL" || r.status === "RFP_PENDING" ? "warning" :
                                r.status === "APPROVED" || r.status === "ASSIGNED" ? "info" : "default"
                              } size="sm">
                                {r.status.replace(/_/g, " ")}
                              </Badge>
                            </td>
                            <td className="text-muted-dark">{r.category || "—"}</td>
                            <td className="text-muted-text">{r.unit?.unitNumber || "—"}</td>
                            <td className="text-muted-text">{r.urgency || "—"}</td>
                            <td className="text-muted-text">{r.assignedContractor?.name || "—"}</td>
                            <td className="text-foreground-dim">
                              {r.createdAt ? new Date(r.createdAt).toLocaleDateString("de-CH") : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Panel>
          )}

          {/* Reporting tab (the Financials tab was folded in here) */}
          {activeTab === "Reporting" && id && (
            <BuildingReportingView buildingId={id} etatLocatifNet={building?.etatLocatifNetChf} />
          )}

          {/* Correspondence tab — read-only view of letters sent to this building's tenants */}
          {activeTab === "Correspondence" && (
            <CorrespondenceTab buildingId={id} />
          )}
        </PageContent>
        <UndoToast {...toast} />
      </PageShell>
    </AppShell>
  );
}

export const getServerSideProps = withServerTranslations(["common","manager"]);
