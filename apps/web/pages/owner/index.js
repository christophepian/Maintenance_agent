/**
 * /owner — Owner Dashboard
 *
 * Portfolio snapshot at the top (read-only financial KPIs),
 * then urgency headline + actionable KPI chips,
 * then a unified priority feed of all items needing owner action.
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import ErrorBanner from "../../components/ui/ErrorBanner";
import StrategyProfileBanner from "../../components/StrategyProfileBanner";
import { FilterToggle, FilterPanelBody, FilterSection, FilterSectionClear, SortToggle, SortPanelBody, SortRow } from "../../components/ui/FilterPanel";
import { formatChf, formatPercent, formatDate } from "../../lib/format";
import { ownerAuthHeaders } from "../../lib/api";
import { cn } from "../../lib/utils";
import { withTranslations } from "../../lib/i18n";
import { useTranslation } from "next-i18next";

function ActionStat({ label, value, href, tone }) {
  const valueColor = { warn: "text-amber-700", bad: "text-red-600", good: "text-green-700" }[tone] ?? "text-slate-900";
  return (
    <Link href={href} className="no-underline group flex flex-col justify-between">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <span className={cn("mt-2 text-xl font-semibold tabular-nums leading-none underline-offset-2 group-hover:underline", valueColor)}>{value}</span>
    </Link>
  );
}

function InfoStat({ label, value, tone }) {
  const valueColor = { good: "text-green-700", warn: "text-amber-700", bad: "text-red-600" }[tone] ?? "text-slate-900";
  return (
    <div className="flex flex-col justify-between">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <span className={cn("mt-2 text-xl font-semibold tabular-nums leading-none", valueColor)}>{value}</span>
    </div>
  );
}

// Labels are translated at render time via t(`owner:dashboard.chip.${category}`)
const CATEGORY_CHIP = {
  approval: { cls: "bg-amber-100 text-amber-700" },
  invoice:  { cls: "bg-blue-100 text-blue-700" },
  rfp:      { cls: "bg-indigo-100 text-indigo-700" },
  vacancy:  { cls: "bg-red-100 text-red-700" },
};
const CARD_STYLE = {
  approval: "border-amber-200 bg-amber-50 hover:bg-amber-100",
  invoice:  "border-blue-200 bg-blue-50 hover:bg-blue-100",
  rfp:      "border-indigo-200 bg-indigo-50 hover:bg-indigo-100",
  vacancy:  "border-red-200 bg-red-50 hover:bg-red-100",
};

function ActionRow({ category, title, sub, building, date, href }) {
  const { t } = useTranslation("owner");
  const chip = CATEGORY_CHIP[category];
  return (
    <Link href={href} className="block no-underline">
      <div className={cn("flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors", CARD_STYLE[category])}>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", chip.cls)}>{t(`owner:dashboard.chip.${category}`)}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-900">{title}</div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
            {building && <span className="truncate text-xs text-slate-500">{building}</span>}
            {building && (date || sub) && <span className="shrink-0 text-xs text-slate-300" aria-hidden>·</span>}
            {date && <span className="shrink-0 text-xs text-slate-400">{formatDate(date)}</span>}
            {!building && sub && <span className="truncate text-xs text-slate-500">{sub}</span>}
            {building && sub && !date && <span className="truncate text-xs text-slate-400">{sub}</span>}
          </div>
        </div>
        <svg className="h-4 w-4 shrink-0 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

function heroHeadline(t, n) {
  if (n === 0) return t("owner:dashboard.hero.allClear");
  if (n === 1) return t("owner:dashboard.hero.one");
  return t("owner:dashboard.hero.many", { count: n });
}

function getLeaseRentTotal(lease) {
  if (typeof lease.rentTotalChf === "number") return lease.rentTotalChf;
  return (lease.netRentChf || 0) + (lease.garageRentChf || 0) + (lease.otherServiceRentChf || 0) + (lease.chargesTotalChf || 0);
}
function getInvoiceTotal(inv) {
  if (typeof inv.totalAmount === "number") return inv.totalAmount;
  if (typeof inv.amount === "number") return inv.amount;
  return 0;
}

export default function OwnerDashboard() {
  const { t } = useTranslation("owner");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [approvals, setApprovals] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [leases, setLeases] = useState([]);
  const [units, setUnits] = useState([]);
  const [rfps, setRfps] = useState([]);
  const [hasStrategyProfile, setHasStrategyProfile] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const fetchJson = async (path) => {
        const res = await fetch(path, { headers: ownerAuthHeaders() });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error?.message || data?.message || data?.error || "Request failed");
        return data;
      };
      const [approvalsRes, invoicesRes, leasesRes, unitsRes, rfpsRes] = await Promise.all([
        fetchJson("/api/owner/approvals"),
        fetchJson("/api/owner/invoices"),
        fetchJson("/api/leases?limit=200"),
        fetchJson("/api/units?limit=500"),
        fetchJson("/api/rfps"),
      ]);
      setApprovals(approvalsRes.data || []);
      setInvoices(invoicesRes.data || []);
      setLeases(leasesRes.data || []);
      setUnits(unitsRes.data || []);
      setRfps(rfpsRes.data || []);
      try {
        const profileRes = await fetchJson("/api/strategy/owner-profile-current");
        setHasStrategyProfile(!!profileRes.profile);
      } catch { setHasStrategyProfile(false); }
    } catch (e) { setError(e?.message || "Failed to load owner dashboard"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const residentialUnits = useMemo(() => units.filter((u) => u.type === "RESIDENTIAL"), [units]);
  const activeLeases = useMemo(() => leases.filter((l) => l.status === "ACTIVE"), [leases]);
  const activeLeaseUnitIds = useMemo(() => new Set(activeLeases.map((l) => l.unitId).filter(Boolean)), [activeLeases]);
  const vacantUnits = useMemo(() => residentialUnits.filter((u) => !activeLeaseUnitIds.has(u.id)), [residentialUnits, activeLeaseUnitIds]);
  const vacancyRate = residentialUnits.length ? vacantUnits.length / residentialUnits.length : 0;

  const expectedMonthlyRentChf = useMemo(() => activeLeases.reduce((s, l) => s + getLeaseRentTotal(l), 0), [activeLeases]);
  const outstandingLiabilitiesChf = useMemo(() => invoices.filter((i) => i.status === "APPROVED").reduce((s, i) => s + getInvoiceTotal(i), 0), [invoices]);
  const pendingApprovalCount = useMemo(() => approvals.length, [approvals]);
  const pendingInvoiceCount = useMemo(() => invoices.filter((i) => i.status === "DRAFT" || i.status === "APPROVED").length, [invoices]);
  const rfpsPendingApproval = useMemo(() => rfps.filter((r) => r.status === "PENDING_OWNER_APPROVAL"), [rfps]);
  const rfpsOpen = useMemo(() => rfps.filter((r) => r.status === "OPEN" || r.status === "EVALUATING"), [rfps]);

  /* ─── Priority action feed ─── */
  const actionFeed = useMemo(() => {
    const items = [];
    // Approval requests — highest priority
    approvals.forEach((r) => items.push({
      category: "approval",
      title: r.title || r.description || "Approval request",
      building: r.buildingName || null,
      date: r.createdAt,
      sub: r.estimatedCost ? formatChf(r.estimatedCost) : null,
      href: `/owner/requests/${r.id}`,
      sortOrder: 0,
    }));
    // RFPs needing owner approval
    rfpsPendingApproval.forEach((r) => items.push({
      category: "rfp",
      title: r.title || `RFP ${r.id?.slice(0, 8)}`,
      building: r.buildingName || null,
      date: r.createdAt,
      sub: null,
      href: `/owner/rfps/${r.id}`,
      sortOrder: 1,
    }));
    // Vacant units
    vacantUnits.slice(0, 5).forEach((u) => items.push({
      category: "vacancy",
      title: u.unitNumber ? `Unit ${u.unitNumber}` : u.id,
      building: u.buildingName || null,
      date: null,
      sub: "No active lease",
      href: `/owner/units/${u.id}`,
      sortOrder: 3,
    }));
    return items.sort((a, b) => a.sortOrder - b.sortOrder);
  }, [approvals, rfpsPendingApproval, invoices, vacantUnits]);

  const [feedExpanded, setFeedExpanded] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [filterBy, setFilterBy] = useState("all");
  const [sortBy, setSortBy] = useState("urgency");

  const FEED_PREVIEW = 7;

  const displayFeed = useMemo(() => {
    let items = filterBy === "all" ? actionFeed : actionFeed.filter((i) => i.category === filterBy);
    if (sortBy === "building") {
      items = [...items].sort((a, b) => (a.building || "").localeCompare(b.building || ""));
    } else if (sortBy === "date") {
      items = [...items].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    }
    return items;
  }, [actionFeed, sortBy, filterBy]);

  const visibleFeed = feedExpanded ? displayFeed : displayFeed.slice(0, FEED_PREVIEW);
  const totalActions = actionFeed.length;

  if (loading) {
    return (
      <AppShell role="OWNER">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="h-52 animate-pulse rounded-3xl bg-slate-100" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell role="OWNER">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
{!hasStrategyProfile && <StrategyProfileBanner />}
        <ErrorBanner error={error} />

        <div className="mb-8">
          {/* Portfolio snapshot */}
          <div className="mb-5 flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">{t("owner:index.text.portfolioSnapshot")}</span>
            <div className="flex-1 border-t border-slate-300" />
            <button onClick={loadDashboard} className="shrink-0 rounded-lg border border-slate-300 bg-transparent p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors" aria-label={t("owner:index.ariaLabel.refreshDashboard")}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
          {/* Financial KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <InfoStat label={t("owner:index.prop.monthlyRent")} value={formatChf(expectedMonthlyRentChf)} tone="good" />
            <InfoStat
              label={t("owner:index.prop.outstanding")}
              value={formatChf(outstandingLiabilitiesChf)}
              tone={outstandingLiabilitiesChf > 0 ? "warn" : "good"}
            />
            <InfoStat
              label={t("owner:index.prop.activeLeases")}
              value={String(activeLeases.length)}
            />
          </div>

          {/* Operational KPIs */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ActionStat label={t("owner:index.prop.pendingApprovals")} value={pendingApprovalCount} href="/owner/approvals" tone={pendingApprovalCount > 0 ? "warn" : "good"} />
            <ActionStat label={t("owner:index.prop.invoicesToReview")} value={pendingInvoiceCount} href="/owner/invoices" tone={pendingInvoiceCount > 0 ? "warn" : "good"} />
            <ActionStat label={t("owner:index.prop.vacancyRate")} value={`${vacantUnits.length} / ${residentialUnits.length}`} href="/owner/vacancies" tone={vacantUnits.length === 0 ? "good" : vacancyRate > 0.1 ? "bad" : "warn"} />
            <ActionStat label={t("owner:index.prop.vacantUnits")} value={vacantUnits.length} href="/owner/vacancies" tone={vacantUnits.length > 0 ? "bad" : "good"} />
          </div>

          <div className="mt-6 mb-5 border-t border-slate-200" />

          <h1 className="mb-5 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{heroHeadline(t, totalActions)}</h1>

        </div>

        {/* Priority feed */}
        <section className="mb-6">
          {/* Toolbar */}
          {totalActions > 0 && (
            <div className="mb-1 flex items-center justify-end gap-2">
              <FilterToggle open={filterOpen} onToggle={() => { setFilterOpen((v) => !v); setSortOpen(false); }} activeCount={filterBy !== "all" ? 1 : 0} />
              <SortToggle open={sortOpen} onToggle={() => { setSortOpen((v) => !v); setFilterOpen(false); }} active={sortBy !== "urgency"} />
            </div>
          )}

          {/* Collapsible filter panel */}
          {filterOpen && (
            <FilterPanelBody>
              <FilterSection title={t("owner:dashboard.sort.category")} first>
                <div className="flex flex-wrap gap-1.5">
                  {[["all",t("owner:dashboard.filter.all")],["approval","Needs approval"],["invoice","Invoice pending"],["rfp","RFP to review"],["vacancy","Vacant unit"]].map(([key, lbl]) => (
                    <button
                      key={key}
                      onClick={() => { setFilterBy(key); setFeedExpanded(false); }}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                        filterBy === key
                          ? "bg-slate-800 text-white"
                          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </FilterSection>
              <FilterSectionClear hasFilter={filterBy !== "all"} onClear={() => { setFilterBy("all"); setFeedExpanded(false); }} />
            </FilterPanelBody>
          )}

          {/* Collapsible sort panel */}
          {sortOpen && (
            <SortPanelBody>
              <SortRow active={sortBy === "urgency"} dir="asc" label={t("owner:dashboard.sort.urgency")} ascLabel="High → Low" descLabel="Low → High" onSelect={() => setSortBy("urgency")} />
              <SortRow active={sortBy === "building"} dir="asc" label={t("owner:dashboard.sort.building")} ascLabel="A → Z" descLabel="Z → A" onSelect={() => setSortBy("building")} />
              <SortRow active={sortBy === "date"} dir="desc" label={t("owner:dashboard.sort.date")} descLabel="Newest first" ascLabel="Oldest first" onSelect={() => setSortBy("date")} />
            </SortPanelBody>
          )}
          {totalActions === 0 ? (
            <div className="rounded-2xl border border-green-200 bg-green-50 px-5 py-8 text-center">
              <div className="text-2xl mb-2">✓</div>
              <div className="text-sm font-semibold text-green-800">{t("owner:index.text.allClearNoItemsNeedYourAttention")}</div>
              <div className="mt-1 text-xs text-green-600">{t("owner:index.text.checkBackAfterNewApprovalsOrInvoicesArrive")}</div>
            </div>
          ) : displayFeed.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-8 text-center">
              <div className="text-sm text-slate-500">{t("owner:dashboard.feed.noMatch")}</div>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleFeed.map((item, i) => <ActionRow key={i} {...item} />)}
              {displayFeed.length > FEED_PREVIEW && (
                <button onClick={() => setFeedExpanded((x) => !x)} className="mt-1 w-full rounded-xl border border-slate-100 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors">
                  {feedExpanded ? t("owner:dashboard.feed.showLess") : `Show ${displayFeed.length - FEED_PREVIEW} more items ↓`}
                </button>
              )}
            </div>
          )}
        </section>

        {/* Footer cross-links */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">{t("owner:index.heading.moreViews")}</h2>
              <p className="mt-1 text-sm text-slate-500">{t("owner:index.text.financeReportingStrategyAndLeaseManagement")}</p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Link href="/owner/reporting" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors no-underline">{t("owner:index.text.reporting")}</Link>
              <Link href="/owner/finance" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors no-underline">{t("owner:dashboard.moreTools.finance")}</Link>
              <Link href="/owner/leases" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors no-underline">{t("owner:index.text.leases")}</Link>
              <Link href="/owner/approvals" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors no-underline">{t("owner:index.text.allApprovals")}</Link>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

export const getStaticProps = withTranslations(["common","owner"]);
