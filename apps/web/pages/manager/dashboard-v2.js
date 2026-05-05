/**
 * /manager/dashboard-v2 — Redesigned Manager Dashboard (prototype)
 *
 * Same data + same CTAs as /manager/index.js, but a more dynamic layout
 * inspired by /owner/reporting:
 *   • Gradient hero with urgency headline
 *   • KPI cards with tone-aware colour accents
 *   • Unified priority action feed (no tabs — everything visible at once)
 *   • Two-column body: action feed + sidebar (quick links + building health)
 *   • Building performance as colour-accent cards, not a plain table
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import Badge from "../../components/ui/Badge";
import ErrorBanner from "../../components/ui/ErrorBanner";
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

/* ─── Actionable KPI: clickable chip with count + label + arrow ─── */
function ActionStat({ label, value, href, tone }) {
  const countColor = {
    warn: "text-amber-700",
    bad:  "text-red-600",
    good: "text-green-700",
  }[tone] ?? "text-slate-900";
  return (
    <Link href={href} className="no-underline group">
      <div className="flex h-full flex-col justify-between rounded-xl bg-white px-4 py-3 ring-1 ring-slate-300 transition-all hover:shadow-sm hover:ring-indigo-300 active:scale-[0.98]">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
        <div className="mt-2 flex items-end justify-between gap-1">
          <span className={cn("text-2xl font-semibold tabular-nums leading-none", countColor)}>{value}</span>
          <svg className="mb-0.5 h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
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
const CATEGORY_CHIP = {
  review:    { label: "Pending review",    cls: "bg-slate-100 text-slate-600" },
  approval:  { label: "Owner approval",    cls: "bg-amber-100 text-amber-700" },
  disputed:  { label: "Disputed invoice",  cls: "bg-red-100 text-red-700" },
  stale:     { label: "Stale job",         cls: "bg-amber-100 text-amber-700" },
  rfp:       { label: "RFP routed",        cls: "bg-indigo-100 text-indigo-700" },
};

const CARD_STYLE = {
  review:   "border-slate-200 bg-white hover:bg-slate-50",
  approval: "border-amber-200 bg-amber-50 hover:bg-amber-100",
  disputed: "border-red-200 bg-red-50 hover:bg-red-100",
  stale:    "border-amber-200 bg-amber-50 hover:bg-amber-100",
  rfp:      "border-slate-200 bg-white hover:bg-slate-50",
};

/* ─── Single action item row ─── */
function ActionRow({ category, title, sub, building, date, href }) {
  const chip = CATEGORY_CHIP[category];

  const cardBody = (
    <div className={cn(
      "flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
      CARD_STYLE[category],
    )}>
      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", chip.cls)}>
        {chip.label}
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
function heroHeadline(totalActions, openRequests) {
  if (totalActions === 0) return "Everything looks good — no items need attention right now.";
  if (totalActions === 1) return "1 item needs your attention today.";
  return `${totalActions} items need your attention today.`;
}

/* ──────────────────────────────────────────────────────────────
   Main page
   ────────────────────────────────────────────────────────────── */
export default function ManagerDashboardV2() {
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
        sub: "In progress > 7 days",
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
  const FEED_PREVIEW = 7;
  const visibleFeed = feedExpanded ? actionFeed : actionFeed.slice(0, FEED_PREVIEW);

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
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{t("manager:dashboard_V2.text.portfolioOverview")}</span>
            <div className="flex-1 border-t border-slate-300" />
          </div>

          {/* ─ Informational KPIs ─ */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            <InfoStat
              label={t("manager:dashboard_V2.prop.spendMtd")}
              value={formatChf(spendThisMonth)}
            />
            <InfoStat
              label={t("manager:dashboard_V2.prop.avgDaysDone")}
              value={avgDaysToComplete ?? "—"}
              tone={avgDaysToComplete != null && avgDaysToComplete > 14 ? "warn" : undefined}
            />
            {portfolio ? (
              <>
                <InfoStat
                  label={t("manager:dashboard_V2.prop.collectionRate")}
                  value={formatPercent(portfolio.avgCollectionRate)}
                  tone={portfolio.avgCollectionRate >= 0.95 ? "good" : portfolio.avgCollectionRate >= 0.8 ? "warn" : "bad"}
                />
                <InfoStat
                  label={t("manager:dashboard_V2.prop.nOIYtd")}
                  value={formatChfCents(portfolio.totalNetIncomeCents)}
                  tone={portfolio.totalNetIncomeCents >= 0 ? "good" : "bad"}
                />
                {portfolio.buildingsInRed > 0 && (
                  <InfoStat
                    label={t("manager:dashboard_V2.prop.buildingsInRed")}
                    value={`${portfolio.buildingsInRed} / ${portfolio.buildingCount}`}
                    tone="bad"
                  />
                )}
              </>
            ) : (
              <InfoStat label={t("manager:dashboard_V2.prop.portfolio")} value={portfolioLoading ? "…" : "—"} />
            )}
          </div>

          {/* ─ Divider ─ */}
          <div className="mt-6 mb-5 border-t border-slate-200" />

          {/* Top row: eyebrow + refresh */}
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t("manager:dashboard_V2.text.managerDashboard")}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{t("manager:dashboard_V2.text.v2Preview")}</span>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                {heroHeadline(totalActions, openRequestsCount)}
              </h1>
            </div>
            <button
              onClick={() => { loadDashboardData(); loadPortfolio(); }}
              className="rounded-lg border border-slate-300 bg-transparent p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors"
              aria-label={t("manager:dashboardV2.ariaLabel.refreshDashboard")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          {/* ─ Actionable KPIs ─ */}
          <div className="grid grid-cols-3 gap-3">
            <ActionStat
              label={t("manager:dashboard_V2.prop.openRequests")}
              value={openRequestsCount}
              href="/manager/requests"
              tone={openRequestsCount > 20 ? "warn" : openRequestsCount > 0 ? "warn" : "good"}
            />
            <ActionStat
              label={t("manager:dashboard_V2.prop.openJobs")}
              value={openJobsCount}
              href="/manager/requests?tab=active"
              tone={openJobsCount > 15 ? "warn" : openJobsCount > 0 ? "warn" : "good"}
            />
            <ActionStat
              label={t("manager:dashboard_V2.prop.pendingInvoices")}
              value={pendingInvoicesCount}
              href="/manager/finance/invoices"
              tone={pendingInvoicesCount > 0 ? "warn" : "good"}
            />
          </div>
        </div>

        {/* ── PRIORITY FEED (full width) ───────────────────────── */}
        <section className="mb-6">
          <div className="mb-3 flex items-baseline justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">{t("manager:dashboardV2.heading.priorityFeed")}</h2>
              <p className="text-xs text-slate-400">{t("manager:dashboard_V2.text.allItemsRequiringActionSortedByUrgency")}</p>
            </div>
            {totalActions > 0 && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {totalActions} item{totalActions !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {totalActions === 0 ? (
            <div className="rounded-2xl border border-green-200 bg-green-50 px-5 py-8 text-center">
              <div className="text-2xl mb-2">✓</div>
              <div className="text-sm font-semibold text-green-800">{t("manager:dashboard_V2.text.allClearNoItemsNeedAction")}</div>
              <div className="mt-1 text-xs text-green-600">{t("manager:dashboard_V2.text.checkBackAfterNewRequestsOrInvoicesArrive")}</div>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleFeed.map((item, i) => (
                <ActionRow key={i} {...item} />
              ))}

              {actionFeed.length > FEED_PREVIEW && (
                <button
                  onClick={() => setFeedExpanded((x) => !x)}
                  className="mt-1 w-full rounded-xl border border-slate-100 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  {feedExpanded
                    ? "Show less ↑"
                    : `Show ${actionFeed.length - FEED_PREVIEW} more items ↓`}
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
              <h2 className="text-base font-semibold text-slate-900">{t("manager:dashboardV2.heading.moreTools")}</h2>
              <p className="mt-1 text-sm text-slate-500">{t("manager:dashboard_V2.text.deeperViewsForFinanceStrategyAndTenantPortal")}</p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Link href="/manager/finance" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors no-underline">
                Finance overview
              </Link>
              <Link href="/manager/finance/ledger" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors no-underline">
                Ledger
              </Link>
              <Link href="/manager/settings" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors no-underline">
                Settings
              </Link>
              <Link href="/manager/requests" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors no-underline">
                All requests
              </Link>
            </div>
          </div>
        </section>

      </div>
    </AppShell>
  );
}

export const getStaticProps = withTranslations(["common","manager"]);
