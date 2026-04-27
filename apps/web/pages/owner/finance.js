import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import ErrorBanner from "../../components/ui/ErrorBanner";
import ConfigurableTable from "../../components/ConfigurableTable";
import Badge from "../../components/ui/Badge";
import { invoiceVariant } from "../../lib/statusVariants";
import { formatChf, formatDate } from "../../lib/format";
import { FilterToggle, FilterPanelBody, FilterSection, FilterSectionClear, SelectField, DateField } from "../../components/ui/FilterPanel";
import { useTableSort, clientSort } from "../../lib/tableUtils";
import { ownerAuthHeaders } from "../../lib/api";

function getInvoiceTotal(invoice) {
  if (typeof invoice.totalAmount === "number") return invoice.totalAmount;
  if (typeof invoice.amount === "number") return invoice.amount;
  return 0;
}

const SORT_FIELDS = ["status", "invoiceNumber", "amount", "createdAt"];

function fieldExtractor(inv, field) {
  switch (field) {
    case "status": return inv.status ?? "";
    case "invoiceNumber": return inv.invoiceNumber ?? "";
    case "amount": return getInvoiceTotal(inv);
    case "createdAt": return inv.createdAt || "";
    default: return "";
  }
}

function ActionDropdown({ actions }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);
  if (!actions.length) return null;
  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
      >
        Actions ▾
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-48 origin-top-right rounded-lg border border-slate-200 bg-white shadow-lg ring-1 ring-black/5">
          <div className="py-1">
            {actions.map((a, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpen(false); a.onClick(); }}
                className={"w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition " + (a.className || "text-slate-700")}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function OwnerFinance() {
  const router = useRouter();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [includeQr, setIncludeQr] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  const activeCount = [filter !== "ALL" ? filter : "", dateFrom, dateTo].filter(Boolean).length;
  const { sortField, sortDir, handleSort } = useTableSort(router, SORT_FIELDS);

  useEffect(() => { fetchInvoices(); }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/owner/invoices", { headers: ownerAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load invoices");
      setInvoices(data.data || []);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const actionRequest = async (invoiceId, action) => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...ownerAuthHeaders() },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`Failed to ${action} invoice`);
      await fetchInvoices();
    } catch (err) {
      setError(err.message);
    }
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      if (filter !== "ALL" && invoice.status !== filter) return false;
      if (dateFrom && invoice.createdAt < dateFrom) return false;
      if (dateTo && invoice.createdAt > dateTo + "T23:59:59") return false;
      return true;
    });
  }, [filter, dateFrom, dateTo, invoices]);

  const sortedInvoices = useMemo(
    () => clientSort(filteredInvoices, sortField, sortDir, fieldExtractor),
    [filteredInvoices, sortField, sortDir],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const columns = useMemo(() => [
    {
      id: "status",
      label: "Status",
      sortable: true,
      defaultVisible: true,
      render: (inv) => <Badge variant={invoiceVariant(inv.status)} size="sm">{inv.status}</Badge>,
    },
    {
      id: "invoiceNumber",
      label: "Invoice #",
      sortable: true,
      defaultVisible: true,
      className: "cell-bold",
      render: (inv) => inv.invoiceNumber || inv.id?.slice(0, 8) || "Draft",
    },
    {
      id: "createdAt",
      label: "Date",
      sortable: true,
      defaultVisible: true,
      render: (inv) => formatDate(inv.createdAt),
    },
    {
      id: "amount",
      label: "Amount",
      sortable: true,
      defaultVisible: true,
      render: (inv) => formatChf(getInvoiceTotal(inv)),
    },
    {
      id: "actions",
      label: "Actions",
      sortable: false,
      alwaysVisible: true,
      className: "text-right",
      headerClassName: "text-right",
      render: (inv) => (
        <ActionDropdown actions={[
          { label: "📄 View PDF", onClick: () => window.open(`/api/invoices/${inv.id}/pdf?includeQRBill=${includeQr}`, "_blank") },
          { label: "🔷 View QR", onClick: () => window.open(`/api/invoices/${inv.id}/qr-code.png`, "_blank") },
          ...(inv.status === "DRAFT" ? [{ label: "✓ Approve", className: "text-green-700 font-semibold", onClick: () => actionRequest(inv.id, "approve") }] : []),
          ...(inv.status === "APPROVED" ? [{ label: "💰 Mark Paid", className: "text-green-700 font-semibold", onClick: () => actionRequest(inv.id, "mark-paid") }] : []),
          ...((inv.status === "DRAFT" || inv.status === "APPROVED") ? [{ label: "⚠ Dispute", className: "text-rose-600", onClick: () => actionRequest(inv.id, "dispute") }] : []),
        ]} />
      ),
    },
  ], [includeQr]);

  return (
    <AppShell role="OWNER">
      <PageShell>
        <PageHeader
          title="Finance"
          subtitle="Review, approve, and manage invoice payments"
          actions={
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={includeQr} onChange={(e) => setIncludeQr(e.target.checked)} />
              Include QR in PDF
            </label>
          }
        />
        <PageContent>
          <ErrorBanner error={error} className="text-sm" />
          <FilterToggle open={filterOpen} onToggle={() => setFilterOpen((v) => !v)} activeCount={activeCount} />
          {filterOpen && (
            <FilterPanelBody>
              <FilterSection title="Status" first>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <SelectField label="Status" value={filter} onChange={(e) => setFilter(e.target.value)}>
                    <option value="ALL">All statuses</option>
                    <option value="DRAFT">Draft</option>
                    <option value="ISSUED">Issued</option>
                    <option value="APPROVED">Approved</option>
                    <option value="PAID">Paid</option>
                    <option value="DISPUTED">Disputed</option>
                  </SelectField>
                </div>
              </FilterSection>
              <FilterSection title="Date range">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <DateField label="From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                  <DateField label="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
              </FilterSection>
              <FilterSectionClear
                hasFilter={activeCount > 0}
                onClear={() => { setFilter("ALL"); setDateFrom(""); setDateTo(""); }}
              />
            </FilterPanelBody>
          )}
          {loading ? (
            <p className="loading-text">Loading invoices…</p>
          ) : (
            <ConfigurableTable
              tableId="owner-finance-invoices"
              columns={columns}
              data={sortedInvoices}
              rowKey="id"
              sortField={sortField}
              sortDir={sortDir}
              onSort={handleSort}
              emptyState={
                <p className="empty-state-text">
                  {invoices.length === 0 ? "No invoices yet." : "No results match the current filters."}
                </p>
              }
            />
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
