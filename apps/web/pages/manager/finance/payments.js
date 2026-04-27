import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import { FilterToggle, FilterPanelBody, FilterSection, FilterSectionClear, SelectField, DateField } from "../../../components/ui/FilterPanel";
import { authHeaders } from "../../../lib/api";
import { formatDate, formatChf } from "../../../lib/format";
import ConfigurableTable from "../../../components/ConfigurableTable";
import { useTableSort, clientSort } from "../../../lib/tableUtils";

const PAYMENT_SORT_FIELDS = ["invoiceNumber", "amount", "paidAt"];

function paymentFieldExtractor(p, field) {
  switch (field) {
    case "invoiceNumber": return p.invoiceNumber || "";
    case "amount": return p.totalAmount ?? 0;
    case "paidAt": return p.paidAt || "";
    default: return "";
  }
}

const PAYMENT_COLUMNS = [
  {
    id: "invoiceNumber",
    label: "Invoice #",
    sortable: true,
    alwaysVisible: true,
    render: (p) => p.invoiceNumber || p.id.slice(0, 8),
  },
  {
    id: "description",
    label: "Description",
    defaultVisible: true,
    render: (p) => p.description || "\u2014",
  },
  {
    id: "amount",
    label: "Amount (CHF)",
    sortable: true,
    defaultVisible: true,
    className: "text-right",
    render: (p) => <span className="tabular-nums cell-bold">{formatChf(p.totalAmount)}</span>,
  },
  {
    id: "paidAt",
    label: "Paid on",
    sortable: true,
    defaultVisible: true,
    render: (p) => formatDate(p.paidAt),
  },
  {
    id: "reference",
    label: "Payment reference",
    defaultVisible: true,
    render: (p) => p.paymentReference || "\u2014",
  },
  {
    id: "actions",
    label: "Actions",
    alwaysVisible: true,
    render: () => (
      <a href="/manager/finance/invoices" className="action-btn-brand no-underline inline-block">View Invoice</a>
    ),
  },
];

export default function ManagerPaymentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payments, setPayments] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const { sortField, sortDir, handleSort } = useTableSort(router, PAYMENT_SORT_FIELDS, { defaultField: "paidAt", defaultDir: "desc" });
  const sortedPayments = useMemo(() => clientSort(payments, sortField, sortDir, paymentFieldExtractor), [payments, sortField, sortDir]);

  // Filters
  const [buildingId, setBuildingId] = useState("");
  const [paidAfter, setPaidAfter] = useState("");
  const [paidBefore, setPaidBefore] = useState("");

  // Load buildings for dropdown
  useEffect(() => {
    fetch("/api/buildings", { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setBuildings(data?.data || []))
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ status: "PAID", view: "summary" });
      if (buildingId) params.set("buildingId", buildingId);
      if (paidAfter) params.set("paidAfter", paidAfter);
      if (paidBefore) params.set("paidBefore", paidBefore);

      const res = await fetch(`/api/invoices?${params.toString()}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to load payments");
      setPayments(data?.data || []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [buildingId, paidAfter, paidBefore]);

  useEffect(() => { loadData(); }, [loadData]);

  function clearFilters() {
    setBuildingId("");
    setPaidAfter("");
    setPaidBefore("");
  }

  const hasFilters = buildingId || paidAfter || paidBefore;
  const activeCount = [buildingId, paidAfter, paidBefore].filter(Boolean).length;
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader title="Payments" />
        <PageContent>
          {error && (
            <Panel className="bg-red-50 border-red-200">
              <strong className="text-red-700">Error:</strong> {error}
              <button onClick={() => setError("")} className="action-btn-dismiss">Dismiss</button>
            </Panel>
          )}

          <FilterToggle open={filterOpen} onToggle={() => setFilterOpen((v) => !v)} activeCount={activeCount} />
          {filterOpen && (
            <FilterPanelBody>
              <FilterSection title="Scope" first>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <SelectField label="Building" value={buildingId} onChange={(e) => setBuildingId(e.target.value)}>
                    <option value="">All buildings</option>
                    {buildings.map((b) => <option key={b.id} value={b.id}>{b.name || b.address}</option>)}
                  </SelectField>
                </div>
              </FilterSection>
              <FilterSection title="Date range">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <DateField label="Paid after" value={paidAfter} onChange={(e) => setPaidAfter(e.target.value)} />
                  <DateField label="Paid before" value={paidBefore} onChange={(e) => setPaidBefore(e.target.value)} />
                </div>
              </FilterSection>
              <FilterSectionClear hasFilter={hasFilters} onClear={clearFilters} />
            </FilterPanelBody>
          )}

          {loading ? (
            <Panel><p className="m-0">Loading payments...</p></Panel>
          ) : (
            <ConfigurableTable
                tableId="manager-payments"
                columns={PAYMENT_COLUMNS}
                data={sortedPayments}
                rowKey={(p) => p.id}
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
                emptyState={
                  <p className="px-4 py-8 text-center text-sm text-slate-400">No payments found for the selected filters.</p>
                }
                mobileCard={(p) => (
                  <div className="table-card">
                    <span className="font-mono text-xs text-slate-500">{p.invoiceNumber || p.id?.slice(0, 8)}</span>
                    <p className="table-card-head mt-1">{p.description || "—"}</p>
                    <div className="table-card-footer">
                      <span className="font-medium">{formatChf(p.totalAmount)}</span>
                      <span>{formatDate(p.paidAt)}</span>
                    </div>
                  </div>
                )}
              />
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
