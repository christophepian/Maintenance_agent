import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import Section from "../../components/layout/Section";

function authHeaders() {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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

export default function OwnerDashboard() {
  const [approvals, setApprovals] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [leases, setLeases] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function fetchJson(path) {
    const res = await fetch(path, { headers: authHeaders() });
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
      const [approvalsRes, invoicesRes, leasesRes, unitsRes] = await Promise.all([
        fetchJson("/api/owner/approvals"),
        fetchJson("/api/owner/invoices"),
        fetchJson("/api/leases?limit=200"),
        fetchJson("/api/units?limit=500"),
      ]);
      setApprovals(approvalsRes.data || []);
      setInvoices(invoicesRes.data || []);
      setLeases(leasesRes.data || []);
      setUnits(unitsRes.data || []);
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
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <Section title="KPIs">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase text-slate-500">Vacancy rate</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">
                  {formatPercent(vacancyRate)}
                </div>
                <div className="text-sm text-slate-600">
                  {vacantUnits.length} vacant of {residentialUnits.length} residential
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase text-slate-500">
                  Expected monthly rent
                </div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">
                  {formatCurrency(expectedMonthlyRentChf)}
                </div>
                <div className="text-sm text-slate-600">Active leases only</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase text-slate-500">
                  Outstanding liabilities
                </div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">
                  {formatCurrency(outstandingLiabilitiesChf)}
                </div>
                <div className="text-sm text-slate-600">
                  Drafts: {formatCurrency(draftInvoicesChf)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase text-slate-500">
                  Pending approval exposure
                </div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">
                  {formatCurrency(pendingApprovalExposureChf)}
                </div>
                <div className="text-sm text-slate-600">
                  {approvals.length} requests awaiting decision
                </div>
              </div>
            </div>
          </Section>

          {loading && <div className="text-sm text-slate-600">Loading dashboard data...</div>}

          {!loading && (
            <div className="grid gap-6 lg:grid-cols-3">
              <Panel
                title="Pending approvals"
                actions={
                  <Link
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                    href="/owner/approvals"
                  >
                    View all
                  </Link>
                }
              >
                {recentApprovals.length === 0 && (
                  <div className="text-sm text-slate-600">No pending approvals.</div>
                )}
                {recentApprovals.length > 0 && (
                  <div className="space-y-3">
                    {recentApprovals.map((req) => (
                      <div key={req.id} className="rounded-lg border border-slate-200 p-3">
                        <div className="text-sm font-semibold text-slate-900">
                          {req.description}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {req.unit?.building?.name || "—"} · Unit {req.unit?.unitNumber || "—"}
                        </div>
                        <div className="mt-1 text-sm text-slate-700">
                          {formatCurrency(req.estimatedCost || 0)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel
                title="Invoices needing action"
                actions={
                  <Link
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                    href="/owner/invoices"
                  >
                    View all
                  </Link>
                }
              >
                {draftInvoices.length === 0 && approvedInvoices.length === 0 && (
                  <div className="text-sm text-slate-600">No invoices require action.</div>
                )}
                {(draftInvoices.length > 0 || approvedInvoices.length > 0) && (
                  <div className="space-y-3">
                    {draftInvoices.map((invoice) => (
                      <div key={invoice.id} className="rounded-lg border border-slate-200 p-3">
                        <div className="text-xs font-semibold text-amber-700">Draft</div>
                        <div className="text-sm font-semibold text-slate-900">
                          {invoice.invoiceNumber || "Draft invoice"}
                        </div>
                        <div className="text-sm text-slate-700">
                          {formatCurrency(getInvoiceTotal(invoice))}
                        </div>
                      </div>
                    ))}
                    {approvedInvoices.map((invoice) => (
                      <div key={invoice.id} className="rounded-lg border border-slate-200 p-3">
                        <div className="text-xs font-semibold text-emerald-700">Approved</div>
                        <div className="text-sm font-semibold text-slate-900">
                          {invoice.invoiceNumber || "Invoice"}
                        </div>
                        <div className="text-sm text-slate-700">
                          {formatCurrency(getInvoiceTotal(invoice))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel
                title="Vacancies"
                actions={
                  <Link
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                    href="/owner/vacancies"
                  >
                    View all
                  </Link>
                }
              >
                {topVacancies.length === 0 && (
                  <div className="text-sm text-slate-600">No vacant units detected.</div>
                )}
                {topVacancies.length > 0 && (
                  <div className="space-y-3">
                    {topVacancies.map((unit) => (
                      <div key={unit.id} className="rounded-lg border border-slate-200 p-3">
                        <div className="text-sm font-semibold text-slate-900">
                          Unit {unit.unitNumber || "—"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {unit.building?.name || unit.buildingName || "Building"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </div>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
