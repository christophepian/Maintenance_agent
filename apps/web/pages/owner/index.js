import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Section from "../../components/layout/Section";
import ErrorBanner from "../../components/ui/ErrorBanner";
import Badge from "../../components/ui/Badge";
import { ownerAuthHeaders } from "../../lib/api";
import StrategyProfileBanner from "../../components/StrategyProfileBanner";
import { formatChf, formatPercent } from "../../lib/format";
import { cn } from "../../lib/utils";

// ─── Summary card (matches manager/finance SummaryCard) ───────────────────────
function SummaryCard({ label, value, sub, accent }) {
  const accentClass =
    accent === "green" ? "text-success-text" :
    accent === "red"   ? "text-destructive-text" :
    accent === "amber" ? "text-amber-700" :
    "text-slate-900";
  return (
    <div className="card mb-0 flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
      <span className={cn("text-xl font-bold", accentClass)}>{value}</span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
  );
}


function getLeaseRentTotal(lease) {
  if (typeof lease.rentTotalChf === "number") return lease.rentTotalChf;
  const net = typeof lease.netRentChf === "number" ? lease.netRentChf : 0;
  const garage = typeof lease.garageRentChf === "number" ? lease.garageRentChf : 0;
  const other = typeof lease.otherServiceRentChf === "number" ? lease.otherServiceRentChf : 0;
  const charges = typeof lease.chargesTotalChf === "number" ? lease.chargesTotalChf : 0;
  return net + garage + other + charges;
}

function getInvoiceTotal(invoice) {
  if (typeof invoice.totalAmount === "number") return invoice.totalAmount;
  if (typeof invoice.amount === "number") return invoice.amount;
  return 0;
}

function sortByDateDesc(items, dateKey) {
  return [...items].sort((a, b) => {
    const aTime = new Date(a[dateKey] || 0).getTime();
    const bTime = new Date(b[dateKey] || 0).getTime();
    return bTime - aTime;
  });
}

const ACTION_TABS = [
  { key: "approvals", label: "Approvals" },
  { key: "invoices",  label: "Invoices" },
  { key: "vacancies", label: "Vacancies" },
  { key: "rfps",      label: "RFPs" },
];

function ActionItemsTabs({
  recentApprovals, draftInvoices, approvedInvoices,
  topVacancies, vacantUnits, rfpsPendingApproval, rfpsOpen,
  activeTab, setActiveTab, getInvoiceTotal,
}) {
  const badgeCounts = {
    approvals: recentApprovals.length,
    invoices:  draftInvoices.length + approvedInvoices.length,
    vacancies: vacantUnits.length,
    rfps:      rfpsPendingApproval.length + rfpsOpen.length,
  };

  return (
    <div>
      <div className="tab-strip" role="tablist">
        {ACTION_TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={activeTab === t.key}
            className={activeTab === t.key ? "tab-btn-active" : "tab-btn"}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
            {badgeCounts[t.key] > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-slate-200 px-1.5 py-0.5 text-xs font-semibold text-slate-700">
                {badgeCounts[t.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className={activeTab === "approvals" ? "tab-panel-active" : "tab-panel"}>
        <h3 className="section-title">Recent Approval Requests</h3>
        {recentApprovals.length === 0 ? (
          <p className="text-sm text-slate-500">No pending approvals.</p>
        ) : (
          <ul className="space-y-2">
            {recentApprovals.map((req) => (
              <li key={req.id} className="card mb-0">
                <Link href={`/owner/requests/${req.id}`} className="block text-sm font-medium text-slate-800 hover:text-indigo-600">
                  {req.title || req.description || req.id}
                </Link>
                <p className="text-xs text-slate-500 mt-0.5">
                  {req.status} · {req.estimatedCost ? formatChf(req.estimatedCost) : "No estimate"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={activeTab === "invoices" ? "tab-panel-active" : "tab-panel"}>
        <h3 className="section-title">Invoices Awaiting Review</h3>
        {draftInvoices.length === 0 && approvedInvoices.length === 0 ? (
          <p className="text-sm text-slate-500">No invoices to review.</p>
        ) : (
          <ul className="space-y-2">
            {[...draftInvoices, ...approvedInvoices].map((inv) => (
              <li key={inv.id} className="card mb-0">
                <Link href={`/owner/invoices/${inv.id}`} className="block text-sm font-medium text-slate-800 hover:text-indigo-600">
                  {inv.reference || inv.id}
                </Link>
                <p className="text-xs text-slate-500 mt-0.5">
                  {inv.status} · {formatChf(getInvoiceTotal(inv))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={activeTab === "vacancies" ? "tab-panel-active" : "tab-panel"}>
        <h3 className="section-title">Vacant Units</h3>
        {topVacancies.length === 0 ? (
          <p className="text-sm text-slate-500">No vacant units.</p>
        ) : (
          <ul className="space-y-2">
            {topVacancies.map((unit) => (
              <li key={unit.id} className="card mb-0">
                <Link href={`/owner/units/${unit.id}`} className="block text-sm font-medium text-slate-800 hover:text-indigo-600">
                  {unit.unitNumber || unit.id}
                </Link>
                <p className="text-xs text-slate-500 mt-0.5">{unit.buildingName || ""}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={activeTab === "rfps" ? "tab-panel-active" : "tab-panel"}>
        <h3 className="section-title">RFPs</h3>
        {rfpsPendingApproval.length === 0 && rfpsOpen.length === 0 ? (
          <p className="text-sm text-slate-500">No active RFPs.</p>
        ) : (
          <ul className="space-y-2">
            {[...rfpsPendingApproval, ...rfpsOpen].map((rfp) => (
              <li key={rfp.id} className="card mb-0">
                <Link href={`/owner/rfps/${rfp.id}`} className="block text-sm font-medium text-slate-800 hover:text-indigo-600">
                  {rfp.title || rfp.id}
                </Link>
                <p className="text-xs text-slate-500 mt-0.5">{rfp.status}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function OwnerDashboard() {
  const router = useRouter();
  const TAB_KEYS = ACTION_TABS.map((t) => t.key);
  const activeTab = router.isReady && TAB_KEYS.includes(router.query.tab) ? router.query.tab : "approvals";
  const setActiveTab = useCallback((key) => {
    router.push({ pathname: router.pathname, query: { ...router.query, tab: key } }, undefined, { shallow: true });
  }, [router]);

  const [approvals, setApprovals] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [leases, setLeases] = useState([]);
  const [units, setUnits] = useState([]);
  const [rfps, setRfps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasStrategyProfile, setHasStrategyProfile] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function fetchJson(path) {
    const res = await fetch(path, { headers: ownerAuthHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || data?.message || "Request failed");
    }
    return data;
  }

  async function loadDashboard() {
    setLoading(true);
    setError("");
    try {
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

      // Check if owner has a strategy profile
      try {
        const profileRes = await fetchJson("/api/strategy/owner-profile-current");
        setHasStrategyProfile(!!profileRes.profile);
      } catch {
        // Non-critical — keep banner visible
        setHasStrategyProfile(false);
      }
    } catch (err) {
      setError(err?.message || "Failed to load owner dashboard");
    } finally {
      setLoading(false);
    }
  }

  const residentialUnits = useMemo(
    () => units.filter((unit) => unit.type === "RESIDENTIAL"),
    [units]
  );

  const activeLeases = useMemo(
    () => leases.filter((lease) => lease.status === "ACTIVE"),
    [leases]
  );

  const activeLeaseUnitIds = useMemo(() => {
    return new Set(activeLeases.map((lease) => lease.unitId).filter(Boolean));
  }, [activeLeases]);

  const vacantUnits = useMemo(
    () => residentialUnits.filter((unit) => !activeLeaseUnitIds.has(unit.id)),
    [residentialUnits, activeLeaseUnitIds]
  );

  const vacancyRate = residentialUnits.length
    ? vacantUnits.length / residentialUnits.length
    : 0;

  const expectedMonthlyRentChf = useMemo(
    () => activeLeases.reduce((sum, lease) => sum + getLeaseRentTotal(lease), 0),
    [activeLeases]
  );

  const outstandingLiabilitiesChf = useMemo(
    () =>
      invoices
        .filter((invoice) => invoice.status === "APPROVED")
        .reduce((sum, invoice) => sum + getInvoiceTotal(invoice), 0),
    [invoices]
  );

  const draftInvoicesChf = useMemo(
    () =>
      invoices
        .filter((invoice) => invoice.status === "DRAFT")
        .reduce((sum, invoice) => sum + getInvoiceTotal(invoice), 0),
    [invoices]
  );

  const pendingApprovalExposureChf = useMemo(
    () =>
      approvals.reduce((sum, req) => sum + (req.estimatedCost || 0), 0),
    [approvals]
  );

  const recentApprovals = useMemo(
    () => sortByDateDesc(approvals, "createdAt").slice(0, 5),
    [approvals]
  );

  const draftInvoices = useMemo(
    () => invoices.filter((invoice) => invoice.status === "DRAFT").slice(0, 5),
    [invoices]
  );

  const approvedInvoices = useMemo(
    () => invoices.filter((invoice) => invoice.status === "APPROVED").slice(0, 5),
    [invoices]
  );

  const topVacancies = useMemo(() => vacantUnits.slice(0, 5), [vacantUnits]);

  const rfpsPendingApproval = useMemo(
    () => rfps.filter((r) => r.status === "PENDING_OWNER_APPROVAL"),
    [rfps]
  );

  const rfpsOpen = useMemo(
    () => rfps.filter((r) => r.status === "OPEN" || r.status === "EVALUATING"),
    [rfps]
  );

  return (
    <AppShell role="OWNER">
      <PageShell>
        <PageHeader
          title="Owner Dashboard"
          subtitle="Key performance indicators and action-required items"
          actions={
            <button
              onClick={loadDashboard}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>
          }
        />

        <PageContent>
          {!hasStrategyProfile && <StrategyProfileBanner />}
          <ErrorBanner error={error} className="text-sm" />

          <Section title="KPIs">
            <div className="kpi-grid md:grid-cols-5">
              <SummaryCard
                label="Vacant units"
                value={String(vacantUnits.length)}
                sub={`${formatPercent(vacancyRate)} vacancy · ${residentialUnits.length} residential`}
                accent={vacantUnits.length > 0 ? "amber" : ""}
              />
              <SummaryCard
                label="Expected monthly rent"
                value={formatChf(expectedMonthlyRentChf)}
                sub={`From ${activeLeases.length} active lease${activeLeases.length !== 1 ? "s" : ""}`}
                accent="green"
              />
              <SummaryCard
                label="Outstanding liabilities"
                value={formatChf(outstandingLiabilitiesChf)}
                sub={`Drafts: ${formatChf(draftInvoicesChf)}`}
                accent={outstandingLiabilitiesChf > 0 ? "amber" : ""}
              />
              <SummaryCard
                label="Pending approval exposure"
                value={formatChf(pendingApprovalExposureChf)}
                sub={`${approvals.length} requests awaiting decision`}
                accent={pendingApprovalExposureChf > 0 ? "amber" : ""}
              />
              <Link
                href="/owner/reporting"
                className="card mb-0 flex flex-col justify-between hover:bg-slate-50 transition-colors no-underline col-span-2 md:col-span-1"
              >
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Performance report</span>
                <span className="mt-2 text-sm font-medium text-slate-700">Monthly income, expenses, and building breakdown.</span>
                <span className="mt-3 text-sm font-semibold text-indigo-600">View report →</span>
              </Link>
            </div>
          </Section>

          {loading && <div className="text-sm text-slate-600">Loading dashboard data...</div>}

          {!loading && (
            <ActionItemsTabs
              recentApprovals={recentApprovals}
              draftInvoices={draftInvoices}
              approvedInvoices={approvedInvoices}
              topVacancies={topVacancies}
              vacantUnits={vacantUnits}
              rfpsPendingApproval={rfpsPendingApproval}
              rfpsOpen={rfpsOpen}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              getInvoiceTotal={getInvoiceTotal}
            />
          )}


        </PageContent>
      </PageShell>
    </AppShell>
  );
}
