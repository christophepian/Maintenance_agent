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
import { formatChf, formatPercent, formatDate } from "../../lib/format";
import { ownerAuthHeaders } from "../../lib/api";
import { cn } from "../../lib/utils";

function ActionStat({ label, value, href, tone }) {
  const countColor = { warn: "text-amber-700", bad: "text-red-600", good: "text-green-700" }[tone] ?? "text-slate-900";
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

function InfoStat({ label, value, tone }) {
  const valueColor = { good: "text-green-700", warn: "text-amber-700", bad: "text-red-600" }[tone] ?? "text-slate-900";
  return (
    <div className="flex flex-col justify-between">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <span className={cn("mt-2 text-xl font-semibold tabular-nums leading-none", valueColor)}>{value}</span>
    </div>
  );
}

const CATEGORY_CHIP = {
  approval: { label: "Needs approval",    cls: "bg-amber-100 text-amber-700" },
  invoice:  { label: "Invoice pending",   cls: "bg-slate-100 text-slate-600" },
  rfp:      { label: "RFP to review",     cls: "bg-indigo-100 text-indigo-700" },
  vacancy:  { label: "Vacant unit",       cls: "bg-red-100 text-red-700" },
};
const CARD_STYLE = {
  approval: "border-amber-200 bg-amber-50 hover:bg-amber-100",
  invoice:  "border-slate-200 bg-white hover:bg-slate-50",
  rfp:      "border-indigo-200 bg-indigo-50 hover:bg-indigo-100",
  vacancy:  "border-red-200 bg-red-50 hover:bg-red-100",
};

function ActionRow({ category, title, sub, building, date, href }) {
  const chip = CATEGORY_CHIP[category];
  return (
    <Link href={href} className="block no-underline">
      <div className={cn("flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors", CARD_STYLE[category])}>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", chip.cls)}>{chip.label}</span>
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

function heroHeadline(n) {
  if (n === 0) return "Everything looks good — no items need attention right now.";
  if (n === 1) return "1 item needs your attention today.";
  return `${n} items need your attention today.`;
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
        if (!res.ok) throw new Error(data?.error || data?.message || "Request failed");
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
    // Invoices awaiting review (draft + approved)
    invoices.filter((i) => i.status === "DRAFT" || i.status === "APPROVED").forEach((inv) => items.push({
      category: "invoice",
      title: inv.reference || inv.invoiceNumber || "Invoice",
      building: inv.unit?.building?.name || inv.buildingName || null,
      date: inv.createdAt,
      sub: formatChf(getInvoiceTotal(inv)),
      href: `/owner/invoices/${inv.id}`,
      sortOrder: 2,
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
  const FEED_PREVIEW = 7;
  const visibleFeed = feedExpanded ? actionFeed : actionFeed.slice(0, FEED_PREVIEW);
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
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Portfolio snapshot</span>
            <div className="flex-1 border-t border-slate-300" />
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            <InfoStat label="Monthly rent" value={formatChf(expectedMonthlyRentChf)} tone="good" />
            <InfoStat
              label="Vacancy rate"
              value={`${vacantUnits.length} / ${residentialUnits.length}`}
              tone={vacantUnits.length === 0 ? "good" : vacancyRate > 0.1 ? "bad" : "warn"}
            />
            <InfoStat
              label="Outstanding"
              value={formatChf(outstandingLiabilitiesChf)}
              tone={outstandingLiabilitiesChf > 0 ? "warn" : "good"}
            />
            <InfoStat
              label="Active leases"
              value={String(activeLeases.length)}
            />
          </div>

          <div className="mt-6 mb-5 border-t border-slate-200" />

          {/* Headline + refresh */}
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Owner Dashboard</span>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{heroHeadline(totalActions)}</h1>
            </div>
            <button onClick={loadDashboard} className="shrink-0 rounded-lg border border-slate-300 bg-transparent p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors" aria-label="Refresh dashboard">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          {/* Actionable KPI chips */}
          <div className="grid grid-cols-3 gap-3">
            <ActionStat label="Pending approvals" value={pendingApprovalCount} href="/owner/approvals" tone={pendingApprovalCount > 0 ? "warn" : "good"} />
            <ActionStat label="Invoices to review" value={pendingInvoiceCount} href="/owner/invoices" tone={pendingInvoiceCount > 0 ? "warn" : "good"} />
            <ActionStat label="Vacant units" value={vacantUnits.length} href="/owner/vacancies" tone={vacantUnits.length > 0 ? "bad" : "good"} />
          </div>
        </div>

        {/* Priority feed */}
        <section className="mb-6">
          <div className="mb-3 flex items-baseline justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Priority feed</h2>
              <p className="text-xs text-slate-400">All items requiring your decision, sorted by urgency.</p>
            </div>
            {totalActions > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{totalActions} item{totalActions !== 1 ? "s" : ""}</span>}
          </div>
          {totalActions === 0 ? (
            <div className="rounded-2xl border border-green-200 bg-green-50 px-5 py-8 text-center">
              <div className="text-2xl mb-2">✓</div>
              <div className="text-sm font-semibold text-green-800">All clear — no items need your attention</div>
              <div className="mt-1 text-xs text-green-600">Check back after new approvals or invoices arrive.</div>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleFeed.map((item, i) => <ActionRow key={i} {...item} />)}
              {actionFeed.length > FEED_PREVIEW && (
                <button onClick={() => setFeedExpanded((x) => !x)} className="mt-1 w-full rounded-xl border border-slate-100 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors">
                  {feedExpanded ? "Show less ↑" : `Show ${actionFeed.length - FEED_PREVIEW} more items ↓`}
                </button>
              )}
              <div className="mt-3 flex flex-wrap gap-2 pt-1">
                {pendingApprovalCount > 0 && <Link href="/owner/approvals" className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 no-underline">{pendingApprovalCount} pending approval →</Link>}
                {rfpsPendingApproval.length > 0 && <Link href="/owner/rfps" className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-100 no-underline">{rfpsPendingApproval.length} RFPs →</Link>}
                {pendingInvoiceCount > 0 && <Link href="/owner/invoices" className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 no-underline">{pendingInvoiceCount} invoices →</Link>}
                {vacantUnits.length > 0 && <Link href="/owner/vacancies" className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-100 no-underline">{vacantUnits.length} vacant →</Link>}
              </div>
            </div>
          )}
        </section>

        {/* Footer cross-links */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">More views</h2>
              <p className="mt-1 text-sm text-slate-500">Finance reporting, strategy, and lease management.</p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Link href="/owner/reporting" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors no-underline">Reporting</Link>
              <Link href="/owner/finance" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors no-underline">Finance</Link>
              <Link href="/owner/leases" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors no-underline">Leases</Link>
              <Link href="/owner/approvals" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors no-underline">All approvals</Link>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
