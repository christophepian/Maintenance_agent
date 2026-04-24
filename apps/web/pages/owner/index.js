import { useEffect, useMemo, useState } from "react";
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
import ScrollableTabs from "../../components/mobile/ScrollableTabs";


function formatCurrency(value) {
  const safeValue = Number.isFinite(value) ? value : 0;
  // Use manual formatting to avoid Intl.NumberFormat hydration mismatch
  // (Node.js uses U+00A0 non-breaking space, browsers use U+202F narrow NBSP)
  const formatted = safeValue.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `CHF ${formatted}`;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "0%";
  return `${(value * 100).toFixed(1)}%`;
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

/* ─── Action Items tabs ─────────────────────────────────────── */

const ACTION_TABS = ["Pending approvals", "Invoices needing action", "Vacancies", "RFPs"];

function ActionItemsTabs({
  recentApprovals, draftInvoices, approvedInvoices,
  topVacancies, vacantUnits, rfpsPendingApproval, rfpsOpen,
  formatCurrency, getInvoiceTotal,
}) {
  const [active, setActive] = useState(0);

  const badges = [
    recentApprovals.length || null,
    (draftInvoices.length + approvedInvoices.length) || null,
    vacantUnits.length || null,
    (rfpsPendingApproval.length + rfpsOpen.length) || null,
  ];

  return (
    <div className="mb-5">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">
        Action Items
      </h2>

      {/* Tab strip */}
      <ScrollableTabs activeIndex={active}>
        {ACTION_TABS.map((label, i) => (
          <button
            key={label}
            onClick={() => setActive(i)}
            className={active === i ? "tab-btn-active" : "tab-btn"}
          >
            {label}
            {badges[i] != null && (
              <span className={[
                "ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold leading-none",
                active === i
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-slate-100 text-slate-600",
              ].join(" ")}>
                {badges[i]}
              </span>
            )}
          </button>
        ))}
      </ScrollableTabs>

      {/* Tab 0 — Pending approvals */}
      <div className={active === 0 ? "tab-panel-active" : "tab-panel"}>
        {recentApprovals.length === 0 ? (
          <p className="text-sm text-slate-500">No pending approvals.</p>
        ) : (
          <div className="space-y-2">
            {recentApprovals.map((req) => (
              <Link key={req.id} href={`/owner/requests/${req.id}`} className="link-card">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{req.description}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {req.unit?.building?.name || "—"} · Unit {req.unit?.unitNumber || "—"}
                    </div>
                  </div>
                  <div className="ml-6 shrink-0 text-right">
                    <div className="text-sm font-semibold text-slate-900">{formatCurrency(req.estimatedCost || 0)}</div>
                    <div className="mt-0.5 text-xs text-amber-600">Awaiting decision</div>
                  </div>
                </div>
              </Link>
            ))}
            <Link href="/owner/approvals" className="block text-xs font-medium text-indigo-600 hover:text-indigo-700 pt-1">
              View all approvals →
            </Link>
          </div>
        )}
      </div>

      {/* Tab 1 — Invoices needing action */}
      <div className={active === 1 ? "tab-panel-active" : "tab-panel"}>
        {draftInvoices.length === 0 && approvedInvoices.length === 0 ? (
          <p className="text-sm text-slate-500">No invoices require action.</p>
        ) : (
          <div className="space-y-2">
            {draftInvoices.map((invoice) => (
              <Link key={invoice.id} href={`/owner/invoices?invoiceId=${invoice.id}`} className="link-card">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {invoice.invoiceNumber || "Draft invoice"}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {invoice.contractor?.name || invoice.jobId || "—"}
                    </div>
                  </div>
                  <div className="ml-6 shrink-0 text-right">
                    <div className="text-sm font-semibold text-slate-900">{formatCurrency(getInvoiceTotal(invoice))}</div>
                    <div className="mt-0.5 text-xs font-medium text-amber-600">Draft</div>
                  </div>
                </div>
              </Link>
            ))}
            {approvedInvoices.map((invoice) => (
              <Link key={invoice.id} href={`/owner/invoices?invoiceId=${invoice.id}`} className="link-card">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {invoice.invoiceNumber || "Invoice"}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {invoice.contractor?.name || invoice.jobId || "—"}
                    </div>
                  </div>
                  <div className="ml-6 shrink-0 text-right">
                    <div className="text-sm font-semibold text-slate-900">{formatCurrency(getInvoiceTotal(invoice))}</div>
                    <div className="mt-0.5 text-xs font-medium text-green-600">Approved · due</div>
                  </div>
                </div>
              </Link>
            ))}
            <Link href="/owner/invoices" className="block text-xs font-medium text-indigo-600 hover:text-indigo-700 pt-1">
              View all invoices →
            </Link>
          </div>
        )}
      </div>

      {/* Tab 2 — Vacancies */}
      <div className={active === 2 ? "tab-panel-active" : "tab-panel"}>
        {topVacancies.length === 0 ? (
          <p className="text-sm text-slate-500">No vacant units detected.</p>
        ) : (
          <div className="space-y-2">
            {topVacancies.map((unit) => (
              <Link key={unit.id} href={`/admin-inventory/units/${unit.id}`} className="link-card">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">
                      Unit {unit.unitNumber || "—"}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {unit.building?.name || unit.buildingName || "—"}
                    </div>
                  </div>
                  <div className="ml-6 shrink-0">
                    <Badge variant="destructive" size="sm">
                      Vacant
                    </Badge>
                  </div>
                </div>
              </Link>
            ))}
            <Link href="/owner/vacancies" className="block text-xs font-medium text-indigo-600 hover:text-indigo-700 pt-1">
              View all vacancies →
            </Link>
          </div>
        )}
      </div>

      {/* Tab 3 — RFPs */}
      <div className={active === 3 ? "tab-panel-active" : "tab-panel"}>
        {rfpsPendingApproval.length === 0 && rfpsOpen.length === 0 ? (
          <p className="text-sm text-slate-500">No RFPs require attention.</p>
        ) : (
          <div className="space-y-2">
            {rfpsPendingApproval.map((rfp) => (
              <Link key={rfp.id} href={`/owner/rfps/${rfp.id}`} className="link-card">
                <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 hover:bg-amber-100 transition-colors">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{rfp.category || "RFP"}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {rfp.building?.name || "—"} · {rfp.quoteCount ?? 0} quote{rfp.quoteCount !== 1 ? "s" : ""} received
                    </div>
                  </div>
                  <div className="ml-6 shrink-0">
                    <Badge variant="warning" size="sm">
                      Awaiting approval
                    </Badge>
                  </div>
                </div>
              </Link>
            ))}
            {rfpsOpen.map((rfp) => (
              <Link key={rfp.id} href={`/owner/rfps/${rfp.id}`} className="link-card">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{rfp.category || "RFP"}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {rfp.building?.name || "—"} · {rfp.quoteCount ?? 0} quote{rfp.quoteCount !== 1 ? "s" : ""} received
                    </div>
                  </div>
                  <div className="ml-6 shrink-0">
                    <Badge variant="info" size="sm">
                      Open
                    </Badge>
                  </div>
                </div>
              </Link>
            ))}
            <Link href="/owner/approvals?tab=rfps" className="block text-xs font-medium text-indigo-600 hover:text-indigo-700 pt-1">
              View all RFPs →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OwnerDashboard() {
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
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Vacant units</div>
                <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                  {vacantUnits.length}
                </div>
                <div className="text-sm text-slate-600">
                  {formatPercent(vacancyRate)} vacancy · {residentialUnits.length} residential
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Expected monthly rent
                </div>
                <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                  {formatCurrency(expectedMonthlyRentChf)}
                </div>
                <div className="text-sm text-slate-600">
                  From {activeLeases.length} active lease{activeLeases.length !== 1 ? "s" : ""}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Outstanding liabilities
                </div>
                <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                  {formatCurrency(outstandingLiabilitiesChf)}
                </div>
                <div className="text-sm text-slate-600">
                  Drafts: {formatCurrency(draftInvoicesChf)}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Pending approval exposure
                </div>
                <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                  {formatCurrency(pendingApprovalExposureChf)}
                </div>
                <div className="text-sm text-slate-600">
                  {approvals.length} requests awaiting decision
                </div>
              </div>
              <Link
                href="/owner/reporting"
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm flex flex-col justify-between hover:bg-slate-100 transition-colors no-underline"
              >
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Performance report</div>
                <div className="mt-2 text-sm font-medium text-slate-700">Monthly income, expenses, and building breakdown.</div>
                <div className="mt-3 text-sm font-semibold text-indigo-600">View report →</div>
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
              formatCurrency={formatCurrency}
              getInvoiceTotal={getInvoiceTotal}
            />
          )}


        </PageContent>
      </PageShell>
    </AppShell>
  );
}
