import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import Section from "../../components/layout/Section";
import { authHeaders } from "../../lib/api";

/* ─── YTD date range ─── */
function ytdRange() {
  const now = new Date();
  return {
    from: `${now.getFullYear()}-01-01`,
    to: now.toISOString().slice(0, 10),
  };
}

/* ─── Health traffic-light dot ─── */
const HEALTH_DOT = {
  green: { bg: "bg-emerald-500", ring: "ring-emerald-200" },
  amber: { bg: "bg-amber-500", ring: "ring-amber-200" },
  red:   { bg: "bg-red-500",   ring: "ring-red-200" },
};
function HealthDot({ health }) {
  const c = HEALTH_DOT[health] || HEALTH_DOT.amber;
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${c.bg} ring-2 ${c.ring}`} />;
}

/* ─── Collapsible section with chevron ─── */
function CollapsibleSection({ title, badge, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full text-left group"
      >
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
        </svg>
        <span className="text-sm font-semibold uppercase tracking-wide text-slate-600 group-hover:text-slate-900 transition-colors">
          {title}
        </span>
        {badge != null && (
          <span className="ml-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {badge}
          </span>
        )}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
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

function formatChfCents(cents) {
  if (!Number.isFinite(cents)) return "CHF 0";
  const chf = Math.round(cents / 100);
  const formatted = Math.abs(chf).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return cents < 0 ? `CHF -${formatted}` : `CHF ${formatted}`;
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

  // ─── Portfolio summary ───
  const [portfolio, setPortfolio] = useState(null);
  const [portfolioLoading, setPortfolioLoading] = useState(true);

  const loadPortfolio = useCallback(async () => {
    setPortfolioLoading(true);
    try {
      const { from, to } = ytdRange();
      const res = await fetch(`/api/financials/portfolio-summary?from=${from}&to=${to}`, {
        headers: authHeaders(),
      });
      const json = await res.json();
      if (res.ok) setPortfolio(json.data);
    } catch (_) { /* swallow — non-critical widget */ }
    finally { setPortfolioLoading(false); }
  }, []);

  useEffect(() => { loadPortfolio(); }, [loadPortfolio]);

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
            <CollapsibleSection title="Action Items" badge={recentApprovals.length + draftInvoices.length + approvedInvoices.length + topVacancies.length || null}>
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
            </CollapsibleSection>
          )}

          {/* ─── Portfolio Financial Performance (YTD) ─── */}
          <CollapsibleSection title="Portfolio Performance (YTD)" badge={portfolio ? portfolio.buildingCount + " buildings" : null}>
            {portfolioLoading && !portfolio && (
              <p className="text-sm text-slate-500">Loading financial data…</p>
            )}

            {portfolio && (
              <>
                {/* Owner-focused aggregate KPIs */}
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-5">
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="text-xs font-semibold uppercase text-slate-500">Total Income</div>
                    <div className="mt-2 text-2xl font-semibold text-emerald-700">
                      {formatChfCents(portfolio.totalEarnedIncomeCents)}
                    </div>
                    <div className="text-sm text-slate-600">Rent collected YTD</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="text-xs font-semibold uppercase text-slate-500">Total Expenses</div>
                    <div className="mt-2 text-2xl font-semibold text-red-700">
                      {formatChfCents(portfolio.totalExpensesCents)}
                    </div>
                    <div className="text-sm text-slate-600">Maintenance + operating</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="text-xs font-semibold uppercase text-slate-500">Net Result</div>
                    <div className={`mt-2 text-2xl font-semibold ${portfolio.totalNetIncomeCents >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {formatChfCents(portfolio.totalNetIncomeCents)}
                    </div>
                    <div className="text-sm text-slate-600">Income − Expenses</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="text-xs font-semibold uppercase text-slate-500">Avg Maintenance Ratio</div>
                    <div className={`mt-2 text-2xl font-semibold ${portfolio.avgMaintenanceRatio > 0.3 ? "text-amber-700" : "text-slate-900"}`}>
                      {formatPercent(portfolio.avgMaintenanceRatio)}
                    </div>
                    <div className="text-sm text-slate-600">Maintenance ÷ Income</div>
                  </div>
                </div>

                {/* Per-building compact table — owner view emphasises yield */}
                {portfolio.buildings.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-left">
                          <th className="py-2.5 px-4 font-medium text-slate-600">Building</th>
                          <th className="py-2.5 px-3 font-medium text-slate-600 text-center w-16">Health</th>
                          <th className="py-2.5 px-3 font-medium text-slate-600 text-right">Income</th>
                          <th className="py-2.5 px-3 font-medium text-slate-600 text-right">Expenses</th>
                          <th className="py-2.5 px-3 font-medium text-slate-600 text-right">Net Result</th>
                          <th className="py-2.5 px-3 font-medium text-slate-600 text-right hidden sm:table-cell">Units</th>
                          <th className="py-2.5 px-3 w-16"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {portfolio.buildings.map((b) => (
                          <tr key={b.buildingId} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-4 font-medium text-slate-900">{b.buildingName}</td>
                            <td className="py-2.5 px-3 text-center"><HealthDot health={b.health} /></td>
                            <td className="py-2.5 px-3 text-right font-mono text-emerald-700">{formatChfCents(b.earnedIncomeCents)}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-red-700">{formatChfCents(b.expensesTotalCents)}</td>
                            <td className={`py-2.5 px-3 text-right font-mono font-semibold ${b.netIncomeCents >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                              {formatChfCents(b.netIncomeCents)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-700 hidden sm:table-cell">{b.activeUnitsCount}</td>
                            <td className="py-2.5 px-3 text-right">
                              <Link
                                href={`/admin-inventory/buildings/${b.buildingId}`}
                                className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                              >
                                Details
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {portfolio.buildings.length === 0 && (
                  <p className="text-sm text-slate-500">No buildings with financial data found.</p>
                )}
              </>
            )}
          </CollapsibleSection>

        </PageContent>
      </PageShell>
    </AppShell>
  );
}
