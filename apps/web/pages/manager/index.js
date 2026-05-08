import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import Badge from "../../components/ui/Badge";
import ErrorBanner from "../../components/ui/ErrorBanner";
import { FilterToggle, FilterPanelBody, FilterSection, FilterSectionClear, SelectField, SortToggle, SortPanelBody, SortRow } from "../../components/ui/FilterPanel";
import {
  formatChf,
  formatChfCents,
  formatPercent,
  formatDate,
} from "../../lib/format";
import { authHeaders } from "../../lib/api";
import { cn } from "../../lib/utils";
import { withTranslations } from "../../lib/i18n";
import { useTranslation } from "next-i18next";

/* ─── YTD date range ─── */
function ytdRange() {
  const now = new Date();
  return {
    from: `${now.getFullYear()}-01-01`,
    to: now.toISOString().slice(0, 10),
  };
}

/* ─── Actionable KPI: same flat layout as InfoStat but clickable ─── */
function ActionStat({ label, value, href, tone }) {
  const valueColor = {
    warn: "text-amber-700",
    bad:  "text-red-600",
    good: "text-green-700",
  }[tone] ?? "text-slate-900";
  return (
    <Link href={href} className="no-underline group flex flex-col justify-between">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <span className={cn("mt-2 text-xl font-semibold tabular-nums leading-none underline-offset-2 group-hover:underline", valueColor)}>{value}</span>
    </Link>
  );
}

/* ─── Informational KPI: read-only, no hover affordance ─── */
function InfoStat({ label, value, tone }) {
  const valueColor = {
    good: "text-green-700",
    warn: "text-amber-700",
    bad:  "text-red-600",
  }[tone] ?? "text-slate-900";
  return (
    <div className="flex flex-col justify-between">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <span className={cn("mt-2 text-xl font-semibold tabular-nums leading-none", valueColor)}>{value}</span>
    </div>
  );
}

/* ─── Category chip used in the priority feed ─── */
// Labels are translated at render time via t(`manager:dashboard.chip.${category}`)
const CATEGORY_CHIP = {
  review:    { cls: "bg-blue-100 text-blue-700" },
  approval:  { cls: "bg-amber-100 text-amber-700" },
  disputed:  { cls: "bg-red-100 text-red-700" },
  stale:     { cls: "bg-amber-100 text-amber-700" },
  rfp:       { cls: "bg-indigo-100 text-indigo-700" },
};

const CARD_STYLE = {
  review:   "border-blue-200 bg-blue-50 hover:bg-blue-100",
  approval: "border-amber-200 bg-amber-50 hover:bg-amber-100",
  disputed: "border-red-200 bg-red-50 hover:bg-red-100",
  stale:    "border-amber-200 bg-amber-50 hover:bg-amber-100",
  rfp:      "border-indigo-200 bg-indigo-50 hover:bg-indigo-100",
};

/* ─── Single action item row ─── */
function ActionRow({ category, title, sub, building, date, href }) {
  const { t } = useTranslation("manager");
  const chip = CATEGORY_CHIP[category];

  const cardBody = (
    <div className={cn(
      "flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
      CARD_STYLE[category],
    )}>
      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", chip.cls)}>
        {t(`manager:dashboard.chip.${category}`)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-900">{title}</div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
          {building && (
            <span className="truncate text-xs text-slate-500">{building}</span>
          )}
          {building && (date || sub) && (
            <span className="shrink-0 text-xs text-slate-300" aria-hidden>·</span>
          )}
          {date && (
            <span className="shrink-0 text-xs text-slate-400">{formatDate(date)}</span>
          )}
          {!building && sub && (
            <span className="truncate text-xs text-slate-500">{sub}</span>
          )}
          {building && sub && !date && (
            <span className="truncate text-xs text-slate-400">{sub}</span>
          )}
        </div>
      </div>
      <svg className="h-4 w-4 shrink-0 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );

  return (
    <Link href={href} className="block no-underline">
      {cardBody}
    </Link>
  );
}

/* ─── Hero urgency headline ─── */
function heroHeadline(t, totalActions) {
  if (totalActions === 0) return t("manager:dashboard.hero.allClear");
  if (totalActions === 1) return t("manager:dashboard.hero.one");
  return t("manager:dashboard.hero.many", { count: totalActions });
}

/* ──────────────────────────────────────────────────────────────
   Main page
   ────────────────────────────────────────────────────────────── */
export default function ManagerDashboard() {
  const { t } = useTranslation("manager");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requests, setRequests] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [portfolioError, setPortfolioError] = useState("");

  /* ─── Data fetching ─── */
  const loadPortfolio = useCallback(async () => {
    setPortfolioLoading(true);
    setPortfolioError("");
    try {
      const { from, to } = ytdRange();
      const res = await fetch(`/api/financials/portfolio-summary?from=${from}&to=${to}`, {
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to load portfolio");
      setPortfolio(json.data);
    } catch (e) {
      setPortfolioError(String(e?.message || e));
    } finally {
      setPortfolioLoading(false);
    }
  }, []);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [reqRes, jobRes, invRes] = await Promise.all([
        fetch("/api/requests?view=summary", { headers: authHeaders() }),
        fetch("/api/jobs?view=summary", { headers: authHeaders() }),
        fetch("/api/invoices?view=summary", { headers: authHeaders() }),
      ]);
      const reqData = await reqRes.json();
      const jobData = await jobRes.json();
      const invData = await invRes.json();
      if (!reqRes.ok) throw new Error(reqData?.error?.message || "Failed to load requests");
      if (!jobRes.ok) throw new Error(jobData?.error?.message || "Failed to load jobs");
      if (!invRes.ok) throw new Error(invData?.error?.message || "Failed to load invoices");
      setRequests(reqData?.data || []);
      setJobs(jobData?.data || []);
      setInvoices(invData?.data || []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboardData(); loadPortfolio(); }, [loadDashboardData, loadPortfolio]);

  /* ─── Derived KPIs ─── */
  const pendingReviewRequests = useMemo(
    () => requests.filter((r) => r.status === "PENDING_REVIEW"), [requests]
  );
  const pendingOwnerApprovalRequests = useMemo(
    () => requests.filter((r) => r.status === "PENDING_OWNER_APPROVAL"), [requests]
  );
  const rfpPendingRequests = useMemo(
    () => requests.filter((r) => r.status === "RFP_PENDING"), [requests]
  );
  const disputedInvoices = useMemo(
    () => invoices.filter((inv) => inv.status === "DISPUTED"), [invoices]
  );
  const staleJobs = useMemo(() => {
    const threshold = 7 * 24 * 60 * 60 * 1000;
    return jobs.filter((j) => {
      if (j.status !== "IN_PROGRESS") return false;
      const t = j.startedAt ? new Date(j.startedAt).getTime() : new Date(j.createdAt).getTime();
      return Date.now() - t > threshold;
    });
  }, [jobs]);

  const openRequestsCount = useMemo(
    () => requests.filter((r) =>
      ["PENDING_REVIEW", "PENDING_OWNER_APPROVAL", "RFP_PENDING", "APPROVED", "ASSIGNED"].includes(r.status)
    ).length,
    [requests]
  );
  const openJobsCount = useMemo(
    () => jobs.filter((j) => ["PENDING", "IN_PROGRESS"].includes(j.status)).length,
    [jobs]
  );
  const spendThisMonth = useMemo(() => {
    const now = new Date();
    return invoices
      .filter((inv) => {
        if (inv.status !== "PAID" || !inv.paidAt) return false;
        const d = new Date(inv.paidAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, inv) => s + (inv.totalAmount || inv.amount || 0), 0);
  }, [invoices]);
  const pendingInvoicesCount = useMemo(
    () => invoices.filter((i) => i.status === "ISSUED").length, [invoices]
  );
  const avgDaysToComplete = useMemo(() => {
    const done = jobs.filter((j) => j.status === "COMPLETED" && j.completedAt && j.createdAt);
    if (!done.length) return null;
    const total = done.reduce((s, j) =>
      s + (new Date(j.completedAt) - new Date(j.createdAt)) / 86_400_000, 0);
    return Math.round(total / done.length);
  }, [jobs]);

  /* ─── Priority action feed (all items in urgency order) ─── */
  const actionFeed = useMemo(() => {
    const items = [];
    pendingOwnerApprovalRequests.forEach((r) =>
      items.push({
        category: "approval",
        title: r.description || "Untitled request",
        building: [r.unit?.building?.name, r.unit?.unitNumber ? `Unit ${r.unit.unitNumber}` : null].filter(Boolean).join(" · "),
        date: r.createdAt,
        sub: null,
        href: `/manager/requests/${r.id}`,
        sortOrder: 0,
      })
    );
    disputedInvoices.forEach((inv) =>
      items.push({
        category: "disputed",
        title: inv.invoiceNumber || "Invoice",
        building: inv.unit?.building?.name || inv.building?.name || null,
        date: inv.createdAt,
        sub: inv.contractor?.name || null,
        href: `/manager/finance/invoices?invoiceId=${inv.id}`,
        sortOrder: 1,
      })
    );
    staleJobs.forEach((j) =>
      items.push({
        category: "stale",
        title: j.requestDescription || `Job #${j.id?.slice(0, 8)}`,
        building: [j.buildingName, j.unitNumber ? `Unit ${j.unitNumber}` : null].filter(Boolean).join(" · ") || null,
        date: j.createdAt,
        sub: t("manager:dashboard.feed.inProgressStale"),
        href: j.requestId ? `/manager/requests/${j.requestId}` : "/manager/requests?tab=active",
        sortOrder: 2,
      })
    );
    pendingReviewRequests.forEach((r) =>
      items.push({
        category: "review",
        title: r.description || "Untitled request",
        building: [r.unit?.building?.name, r.unit?.unitNumber ? `Unit ${r.unit.unitNumber}` : null].filter(Boolean).join(" · ") || null,
        date: r.createdAt,
        sub: null,
        href: `/manager/requests/${r.id}`,
        sortOrder: 3,
      })
    );
    rfpPendingRequests.forEach((r) =>
      items.push({
        category: "rfp",
        title: r.description || "RFP request",
        building: [r.unit?.building?.name, r.unit?.unitNumber ? `Unit ${r.unit.unitNumber}` : null].filter(Boolean).join(" · ") || null,
        date: r.createdAt,
        sub: null,
        href: `/manager/requests/${r.id}`,
        sortOrder: 4,
      })
    );
    return items.sort((a, b) => a.sortOrder - b.sortOrder);
  }, [pendingOwnerApprovalRequests, disputedInvoices, staleJobs, pendingReviewRequests, rfpPendingRequests]);

  const [feedExpanded, setFeedExpanded] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [filterBy, setFilterBy] = useState("all"); // "all" | category key
  const [sortBy, setSortBy] = useState("urgency"); // "urgency" | "building" | "date"

  const FEED_PREVIEW = 7;

  const displayFeed = useMemo(() => {
    let items = filterBy === "all" ? actionFeed : actionFeed.filter((i) => i.category === filterBy);
    if (sortBy === "building") {
      items = [...items].sort((a, b) => (a.building || "").localeCompare(b.building || ""));
    } else if (sortBy === "date") {
      items = [...items].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    }
    // "urgency" keeps the existing sortOrder from actionFeed
    return items;
  }, [actionFeed, sortBy, filterBy]);

  const visibleFeed = feedExpanded ? displayFeed : displayFeed.slice(0, FEED_PREVIEW);

  const totalActions = actionFeed.length;

  if (loading) {
    return (
      <AppShell role="MANAGER">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="h-52 animate-pulse rounded-3xl bg-slate-100" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell role="MANAGER">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

        <ErrorBanner error={error} />
        <ErrorBanner error={portfolioError} />

        {/* ── HEADLINE + KPIs ── */}
        <div className="mb-8">
          {/* ─ Portfolio overview ─ */}
          <div className="mb-5 flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">{t("manager:dashboard.portfolioOverview")}</span>
            <div className="flex-1 border-t border-slate-300" />
            <button
              onClick={() => { loadDashboardData(); loadPortfolio(); }}
              className="shrink-0 rounded-lg border border-slate-300 bg-transparent p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors"
              aria-label={t("manager:index.ariaLabel.refreshDashboard")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          {/* ─ Financial KPIs ─ */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {portfolio ? (
              <>
                <InfoStat
                  label={t("manager:dashboard.kpi.noiYtd")}
                  value={formatChfCents(portfolio.totalNetIncomeCents)}
                  tone={portfolio.totalNetIncomeCents >= 0 ? "good" : "bad"}
                />
                <InfoStat
                  label={t("manager:dashboard.kpi.spendMtd")}
                  value={formatChf(spendThisMonth)}
                />
                <InfoStat
                  label={t("manager:dashboard.kpi.collectionRate")}
                  value={formatPercent(portfolio.avgCollectionRate)}
                  tone={portfolio.avgCollectionRate >= 0.95 ? "good" : portfolio.avgCollectionRate >= 0.8 ? "warn" : "bad"}
                />
                {portfolio.buildingsInRed > 0 && (
                  <InfoStat
                    label={t("manager:dashboard.kpi.buildingsInRed")}
                    value={`${portfolio.buildingsInRed} / ${portfolio.buildingCount}`}
                    tone="bad"
                  />
                )}
              </>
            ) : (
              <>
                <InfoStat
                  label={t("manager:dashboard.kpi.spendMtd")}
                  value={formatChf(spendThisMonth)}
                />
                <InfoStat label={t("manager:index.prop.portfolio")} value={portfolioLoading ? "…" : "—"} />
              </>
            )}
          </div>

          {/* ─ Operational KPIs ─ */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ActionStat
              label={t("manager:dashboard.kpi.openRequests")}
              value={openRequestsCount}
              href="/manager/requests"
              tone={openRequestsCount > 0 ? "warn" : "good"}
            />
            <ActionStat
              label={t("manager:dashboard.kpi.openJobs")}
              value={openJobsCount}
              href="/manager/requests?tab=active"
              tone={openJobsCount > 0 ? "warn" : "good"}
            />
            <InfoStat
              label={t("manager:dashboard.kpi.jobAvgDuration")}
              value={avgDaysToComplete != null ? `${avgDaysToComplete}d` : "—"}
              tone={avgDaysToComplete != null && avgDaysToComplete > 14 ? "warn" : undefined}
            />
            <ActionStat
              label={t("manager:dashboard.kpi.pendingInvoices")}
              value={pendingInvoicesCount}
              href="/manager/finance/invoices"
              tone={pendingInvoicesCount > 0 ? "warn" : "good"}
            />
          </div>

          {/* ─ Divider ─ */}
          <div className="mt-6 mb-5 border-t border-slate-200" />

          <h1 className="mb-5 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {heroHeadline(t, totalActions)}
          </h1>

        </div>

        {/* ── PRIORITY FEED (full width) ───────────────────────── */}
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
              <FilterSection title={t("manager:dashboard.sort.category")} first>
                <div className="flex flex-wrap gap-1.5">
                  {[["all",t("manager:dashboard.filter.all")],["approval","Owner approval"],["disputed",t("manager:dashboard.filter.disputed")],["stale",t("manager:dashboard.filter.stale")],["review","Pending review"],["rfp",t("manager:dashboard.filter.rfps")]].map(([key, lbl]) => (
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
              <SortRow active={sortBy === "urgency"} dir="asc" label={t("manager:dashboard.sort.urgency")} ascLabel="High → Low" descLabel="Low → High" onSelect={() => setSortBy("urgency")} />
              <SortRow active={sortBy === "building"} dir="asc" label={t("manager:dashboard.sort.building")} ascLabel="A → Z" descLabel="Z → A" onSelect={() => setSortBy("building")} />
              <SortRow active={sortBy === "date"} dir="desc" label={t("manager:dashboard.sort.date")} descLabel="Newest first" ascLabel="Oldest first" onSelect={() => setSortBy("date")} />
            </SortPanelBody>
          )}
          {totalActions === 0 ? (
            <div className="rounded-2xl border border-green-200 bg-green-50 px-5 py-8 text-center">
              <div className="text-2xl mb-2">✓</div>
              <div className="text-sm font-semibold text-green-800">{t("manager:dashboard.feed.allClearTitle")}</div>
              <div className="mt-1 text-xs text-green-600">{t("manager:dashboard.feed.allClearSub")}</div>
            </div>
          ) : displayFeed.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-8 text-center">
              <div className="text-sm text-slate-500">{t("manager:dashboard.feed.noMatch")}</div>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleFeed.map((item, i) => (
                <ActionRow key={i} {...item} />
              ))}

              {displayFeed.length > FEED_PREVIEW && (
                <button
                  onClick={() => setFeedExpanded((x) => !x)}
                  className="mt-1 w-full rounded-xl border border-slate-100 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  {feedExpanded
                    ? t("manager:dashboard.feed.showLess")
                    : `Show ${displayFeed.length - FEED_PREVIEW} more items ↓`}
                </button>
              )}

              {/* Category summary links */}
              <div className="mt-3 flex flex-wrap gap-2 pt-1">
                {pendingReviewRequests.length > 0 && (
                  <Link href="/manager/requests?tab=pending" className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-indigo-600 hover:bg-slate-50 no-underline">
                    {pendingReviewRequests.length} pending review →
                  </Link>
                )}
                {disputedInvoices.length > 0 && (
                  <Link href="/manager/finance/invoices" className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-100 no-underline">
                    {disputedInvoices.length} disputed →
                  </Link>
                )}
                {staleJobs.length > 0 && (
                  <Link href="/manager/requests?tab=active" className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 no-underline">
                    {staleJobs.length} stale jobs →
                  </Link>
                )}
                {rfpPendingRequests.length > 0 && (
                  <Link href="/manager/requests?tab=rfp_open" className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-100 no-underline">
                    {rfpPendingRequests.length} RFPs →
                  </Link>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ── FOOTER / CROSS-LINKS ─────────────────────────────── */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">{t("manager:dashboard.moreTools.title")}</h2>
              <p className="mt-1 text-sm text-slate-500">{t("manager:dashboard.moreTools.sub")}</p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Link href="/manager/finance" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors no-underline">{t("manager:dashboard.moreTools.finance")}</Link>
              <Link href="/manager/finance/ledger" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors no-underline">
                Ledger
              </Link>
              <Link href="/manager/settings" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors no-underline">{t("manager:dashboard.moreTools.settings")}</Link>
              <Link href="/manager/requests" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors no-underline">{t("manager:dashboard.moreTools.allRequests")}</Link>
            </div>
          </div>
        </section>

      </div>
    </AppShell>
  );
}

export const getStaticProps = withTranslations(["common","manager"]);
