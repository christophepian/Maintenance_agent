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
import { withTranslations } from "../../../lib/i18n";
import { useTranslation } from "next-i18next";

const PAYMENT_SORT_FIELDS = ["invoiceNumber", "amount", "paidAt"];

function paymentFieldExtractor(p, field) {
  switch (field) {
    case "invoiceNumber": return p.invoiceNumber || "";
    case "amount": return p.totalAmount ?? 0;
    case "paidAt": return p.paidAt || "";
    default: return "";
  }
}

function buildPaymentColumns(t) {
  return [
  {
    id: "invoiceNumber",
    label: t("manager:financePayments.col.invoice"),
    sortable: true,
    alwaysVisible: true,
    render: (p) => p.invoiceNumber || p.id.slice(0, 8),
  },
  {
    id: "description",
    label: t("manager:financePayments.col.description"),
    defaultVisible: true,
    render: (p) => p.description || "\u2014",
  },
  {
    id: "amount",
    label: t("manager:financePayments.col.amountChf"),
    sortable: true,
    defaultVisible: true,
    className: "text-right",
    render: (p) => <span className="tabular-nums cell-bold">{formatChf(p.totalAmount)}</span>,
  },
  {
    id: "paidAt",
    label: t("manager:financePayments.col.paidOn"),
    sortable: true,
    defaultVisible: true,
    render: (p) => formatDate(p.paidAt),
  },
  {
    id: "reference",
    label: t("manager:financePayments.col.paymentReference"),
    defaultVisible: true,
    render: (p) => p.paymentReference || "\u2014",
  },
  {
    id: "actions",
    label: t("manager:financePayments.col.actions"),
    alwaysVisible: true,
    render: () => (
      <a href="/manager/finance/invoices" className="action-btn-brand no-underline inline-block">{t("manager:financePayments.text.viewInvoice")}</a>
    ),
  },
];
}

export default function ManagerPaymentsPage() {
  const { t } = useTranslation("manager");
  const paymentColumns = useMemo(() => buildPaymentColumns(t), [t]);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payments, setPayments] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const { sortField, sortDir, handleSort } = useTableSort(router, PAYMENT_SORT_FIELDS, { defaultField: "paidAt", defaultDir: "desc" });

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

  const [paySearch, setPaySearch] = useState("");
  const filteredPayments = useMemo(() => {
    const q = paySearch.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter((p) =>
      (p.invoiceNumber || "").toLowerCase().includes(q) ||
      (p.description || "").toLowerCase().includes(q)
    );
  }, [payments, paySearch]);
  const sortedPayments = useMemo(
    () => clientSort(filteredPayments, sortField, sortDir, paymentFieldExtractor),
    [filteredPayments, sortField, sortDir]
  );

  const hasFilters = buildingId || paidAfter || paidBefore;
  const activeCount = [buildingId, paidAfter, paidBefore].filter(Boolean).length;
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader title={t("manager:financePayments.title.payments")} />
        <PageContent>
          {error && (
            <Panel className="bg-red-50 border-red-200">
              <strong className="text-red-700">{t("manager:financePayments.text.error")}</strong> {error}
              <button onClick={() => setError("")} className="action-btn-dismiss">{t("manager:financePayments.text.dismiss")}</button>
            </Panel>
          )}

          <div className="flex items-center gap-2 mb-3">
            <input
              type="search"
              placeholder={t("manager:financePayments.placeholder.searchPayments")}
              value={paySearch}
              onChange={(e) => setPaySearch(e.target.value)}
              className="filter-input flex-1 min-w-0 mb-0"
            />
            <FilterToggle open={filterOpen} onToggle={() => setFilterOpen((v) => !v)} activeCount={activeCount} />
          </div>
          {filterOpen && (
            <FilterPanelBody>
              <FilterSection title={t("manager:financePayments.title.scope")} first>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <SelectField label={t("manager:financePayments.prop.building")} value={buildingId} onChange={(e) => setBuildingId(e.target.value)}>
                    <option value="">{t("manager:financePayments.text.allBuildings")}</option>
                    {buildings.map((b) => <option key={b.id} value={b.id}>{b.name || b.address}</option>)}
                  </SelectField>
                </div>
              </FilterSection>
              <FilterSection title={t("manager:financePayments.title.dateRange")}>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <DateField label={t("manager:financePayments.prop.paidAfter")} value={paidAfter} onChange={(e) => setPaidAfter(e.target.value)} />
                  <DateField label={t("manager:financePayments.prop.paidBefore")} value={paidBefore} onChange={(e) => setPaidBefore(e.target.value)} />
                </div>
              </FilterSection>
              <FilterSectionClear hasFilter={hasFilters} onClear={clearFilters} />
            </FilterPanelBody>
          )}

          {loading ? (
            <Panel><p className="m-0">{t("manager:financePayments.text.loadingPayments")}</p></Panel>
          ) : (
            <ConfigurableTable
                tableId="manager-payments"
                columns={paymentColumns}
                data={sortedPayments}
                rowKey={(p) => p.id}
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
                emptyState={
                  <p className="px-4 py-8 text-center text-sm text-slate-400">{t("manager:financePayments.text.noPaymentsFoundForTheSelectedFilters")}</p>
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

export const getStaticProps = withTranslations(["common","manager"]);
