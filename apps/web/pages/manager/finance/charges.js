import { useEffect, useState, useMemo, useCallback } from "react";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import { authHeaders } from "../../../lib/api";
import { useLocalSort, clientSort } from "../../../lib/tableUtils";
import { cn } from "../../../lib/utils";
import SortableHeader from "../../../components/SortableHeader";
import { withTranslations } from "../../../lib/i18n";
import { useTranslation } from "next-i18next";

function formatCurrency(chf) {
  if (typeof chf !== "number") return "—";
  const str = chf.toFixed(0);
  const formatted = str.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `CHF ${formatted}`;
}

const VIEW_TABS = [
  { key: "SUMMARY" },
  { key: "ITEMIZED" },
];

export default function ManagerChargesPage() {
  const { t } = useTranslation("manager");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [leases, setLeases] = useState([]);
  const [activeTab, setActiveTab] = useState("SUMMARY");
  const [editingLeaseId, setEditingLeaseId] = useState(null);
  const [editForm, setEditForm] = useState({ chargesItems: [], chargesTotalChf: "", chargesSettlementDate: "" });
  const [saving, setSaving] = useState(false);

  // COA filter (feature-flagged: only renders when expense types exist)
  const [expenseTypeId, setExpenseTypeId] = useState("");
  const [expenseTypes, setExpenseTypes] = useState([]);
  const [chargeSearch, setChargeSearch] = useState("");
  const { sortField: cSortField, sortDir: cSortDir, handleSort: handleChargeSort } = useLocalSort("tenant", "asc");
  const { sortField: iSortField, sortDir: iSortDir, handleSort: handleISort } = useLocalSort("tenantName", "asc");

  useEffect(() => {
    fetch("/api/coa/expense-types", { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setExpenseTypes(data?.data || []))
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ status: "ACTIVE", limit: "200" });
      if (expenseTypeId) params.set("expenseTypeId", expenseTypeId);
      const res = await fetch(`/api/leases?${params.toString()}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to load leases");
      setLeases(data?.data || []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [expenseTypeId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Only leases with charge data (or all active for editing purposes)
  const leasesWithCharges = useMemo(() => {
    return leases.filter((l) => l.chargesTotalChf || (l.chargesItems && l.chargesItems.length > 0));
  }, [leases]);

  function chargeFieldExtractor(l, field) {
    switch (field) {
      case "tenant": return (l.tenantName || "").toLowerCase();
      case "building": return (l.unit?.building?.name || "").toLowerCase();
      case "chargesTotalChf": return l.chargesTotalChf ?? 0;
      case "unit": return (l.unit?.unitNumber || "").toLowerCase();
      case "settlementDate": return l.chargesSettlementDate || "";
      default: return "";
    }
  }

  const filteredCharges = useMemo(() => {
    if (!chargeSearch.trim()) return leasesWithCharges;
    const q = chargeSearch.toLowerCase();
    return leasesWithCharges.filter((l) =>
      (l.tenantName || "").toLowerCase().includes(q) ||
      (l.unit?.building?.name || "").toLowerCase().includes(q) ||
      (l.unit?.unitNumber || "").toLowerCase().includes(q)
    );
  }, [leasesWithCharges, chargeSearch]);

  const sortedCharges = useMemo(() => clientSort(filteredCharges, cSortField, cSortDir, chargeFieldExtractor), [filteredCharges, cSortField, cSortDir]);

  // Flatten chargesItems across all leases for itemized view
  const itemizedRows = useMemo(() => {
    const rows = [];
    sortedCharges.forEach((l) => {
      const items = l.chargesItems || [];
      items.forEach((item) => {
        rows.push({
          leaseId: l.id,
          tenantName: l.tenantName,
          unitNumber: l.unit?.unitNumber || "—",
          buildingName: l.unit?.building?.name || l.unit?.building?.address || "—",
          label: item.label,
          mode: item.mode,
          amountChf: item.amountChf,
        });
      });
    });
    return rows;
  }, [sortedCharges]);

  const sortedItemizedRows = useMemo(() => clientSort(itemizedRows, iSortField, iSortDir, (row, f) => {
    if (f === "tenantName") return (row.tenantName || "").toLowerCase();
    if (f === "unitNumber") return (row.unitNumber || "").toLowerCase();
    if (f === "label") return (row.label || "").toLowerCase();
    if (f === "mode") return (row.mode || "").toLowerCase();
    if (f === "amountChf") return row.amountChf ?? 0;
    return "";
  }), [itemizedRows, iSortField, iSortDir]);

  function startEdit(lease) {
    setEditingLeaseId(lease.id);
    setEditForm({
      chargesItems: (lease.chargesItems || []).map((item) => ({ ...item })),
      chargesTotalChf: lease.chargesTotalChf != null ? String(lease.chargesTotalChf) : "",
      chargesSettlementDate: lease.chargesSettlementDate || "",
    });
  }

  function cancelEdit() {
    setEditingLeaseId(null);
  }

  function updateChargeItem(idx, field, value) {
    setEditForm((prev) => {
      const items = [...prev.chargesItems];
      items[idx] = { ...items[idx], [field]: field === "amountChf" ? Number(value) || 0 : value };
      return { ...prev, chargesItems: items };
    });
  }

  function addChargeItem() {
    setEditForm((prev) => ({
      ...prev,
      chargesItems: [...prev.chargesItems, { label: "", mode: "ACOMPTE", amountChf: 0 }],
    }));
  }

  function removeChargeItem(idx) {
    setEditForm((prev) => ({
      ...prev,
      chargesItems: prev.chargesItems.filter((_, i) => i !== idx),
    }));
  }

  async function saveCharges() {
    setSaving(true);
    setError("");
    try {
      const body = {
        chargesItems: editForm.chargesItems.filter((item) => item.label),
        chargesTotalChf: editForm.chargesTotalChf ? Number(editForm.chargesTotalChf) : null,
        chargesSettlementDate: editForm.chargesSettlementDate || null,
      };

      const res = await fetch(`/api/leases/${editingLeaseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message || "Failed to update charges");
      }
      setEditingLeaseId(null);
      await loadData();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader title={t("manager:financeCharges.title.charges")} />
        <PageContent>
          {error && (
            <Panel className="bg-red-50 border-red-200">
              <strong className="text-red-700">{t("manager:financeCharges.text.error")}</strong> {error}
              <button onClick={() => setError("")} className="action-btn-dismiss">{t("manager:financeCharges.text.dismiss")}</button>
            </Panel>
          )}

          {/* Filters — COA expense type (feature-flagged) */}
          {expenseTypes.length > 0 && (
            <Panel>
              <div className="filter-row">
                <div>
                  <label className="filter-label">{t("manager:financeCharges.text.expenseType")}</label>
                  <select
                    value={expenseTypeId}
                    onChange={(e) => setExpenseTypeId(e.target.value)}
                    className="filter-select"
                  >
                    <option value="">{t("manager:financeCharges.text.allExpenseTypes")}</option>
                    {expenseTypes.map((et) => (
                      <option key={et.id} value={et.id}>{et.code} — {et.name}</option>
                    ))}
                  </select>
                </div>
                {expenseTypeId && (
                  <button
                    onClick={() => setExpenseTypeId("")}
                    className="action-btn"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            </Panel>
          )}

          {/* View Tabs */}
          <div className="pill-tab-row">
            {VIEW_TABS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={active ? "pill-tab pill-tab-active" : "pill-tab"}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2">
            <input
              type="search"
              placeholder={t("manager:financeCharges.placeholder.searchByTenantBuildingOrUnit")}
              value={chargeSearch}
              onChange={(e) => setChargeSearch(e.target.value)}
              className="filter-input flex-1 min-w-0 mb-0"
            />
            <button
              type="button"
              aria-label={t("manager:financeCharges.ariaLabel.sortCharges")}
              onClick={() => {
                const cycle = ["tenant", "building", "chargesTotalChf"];
                const next = cycle[(cycle.indexOf(cSortField) + 1) % cycle.length];
                handleChargeSort(next);
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm font-medium text-muted-text hover:bg-surface-subtle transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true"><path fillRule="evenodd" d="M2 3.75A.75.75 0 0 1 2.75 3h11.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 3.75ZM2 7.5a.75.75 0 0 1 .75-.75h7.508a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 7.5ZM14 7a.75.75 0 0 1 .75.75v6.59l1.95-2.1a.75.75 0 1 1 1.1 1.02l-3.25 3.5a.75.75 0 0 1-1.1 0l-3.25-3.5a.75.75 0 0 1 1.1-1.02l1.95 2.1V7.75A.75.75 0 0 1 14 7ZM2 11.25a.75.75 0 0 1 .75-.75h4.562a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" /></svg>
              <span className="hidden sm:inline capitalize">{cSortField === "building" ? "Building" : cSortField === "chargesTotalChf" ? "Amount" : "Tenant"}</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className={cn("w-3 h-3 transition-transform", cSortDir === "desc" && "rotate-180")} aria-hidden="true"><path fillRule="evenodd" d="M8 2a.75.75 0 0 1 .75.75v8.69l1.22-1.22a.75.75 0 1 1 1.06 1.06l-2.5 2.5a.75.75 0 0 1-1.06 0l-2.5-2.5a.75.75 0 0 1 1.06-1.06l1.22 1.22V2.75A.75.75 0 0 1 8 2Z" clipRule="evenodd" /></svg>
            </button>
          </div>

          {/* Edit Modal (inline panel) */}
          {editingLeaseId && (
            <Panel className="edit-panel">
              <h3 className="mb-3 text-base font-semibold m-0">{t("manager:financeCharges.heading.editCharges")}</h3>

              <div className="mb-3">
                <label className="filter-label">{t("manager:financeCharges.text.chargeItems")}</label>
                {editForm.chargesItems.map((item, idx) => (
                  <div key={idx} className="edit-row">
                    <input
                      type="text"
                      placeholder={t("manager:financeCharges.placeholder.itemName")}
                      value={item.label}
                      onChange={(e) => updateChargeItem(idx, "label", e.target.value)}
                      className="edit-input flex-1"
                    />
                    <select
                      value={item.mode}
                      onChange={(e) => updateChargeItem(idx, "mode", e.target.value)}
                      className="edit-input"
                    >
                      <option value="ACOMPTE">{t("manager:financeCharges.text.acompte")}</option>
                      <option value="FORFAIT">{t("manager:financeCharges.text.forfait")}</option>
                    </select>
                    <input
                      type="number"
                      placeholder="CHF"
                      value={item.amountChf}
                      onChange={(e) => updateChargeItem(idx, "amountChf", e.target.value)}
                      className="edit-input w-20"
                    />
                    <button
                      onClick={() => removeChargeItem(idx)}
                      className="action-btn"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={addChargeItem}
                  className="action-btn-brand"
                >
                  + Add item
                </button>
              </div>

              <div className="flex gap-3 mb-3">
                <div>
                  <label className="filter-label">Total charges (CHF)</label>
                  <input
                    type="number"
                    value={editForm.chargesTotalChf}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, chargesTotalChf: e.target.value }))}
                    className="edit-input w-[100px]"
                  />
                </div>
                <div>
                  <label className="filter-label">{t("manager:financeCharges.text.settlementDate")}</label>
                  <input
                    type="text"
                    placeholder={t("manager:financeCharges.placeholder.eG30062027")}
                    value={editForm.chargesSettlementDate}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, chargesSettlementDate: e.target.value }))}
                    className="edit-input w-[150px]"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={saveCharges}
                  disabled={saving}
                  className="action-btn-success"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={cancelEdit}
                  className="action-btn"
                >
                  Cancel
                </button>
              </div>
            </Panel>
          )}

          {loading ? (
            <Panel><p className="m-0">{t("manager:financeCharges.text.loadingCharges")}</p></Panel>
          ) : sortedCharges.length === 0 ? (
            <Panel>
              <p className="m-0">{chargeSearch ? "No charges match your search." : "No active leases with charge data found."}</p>
            </Panel>
          ) : activeTab === "SUMMARY" ? (
            /* Summary view */
            <>
                {/* Mobile card list — sm:hidden */}
                <div className="sm:hidden overflow-hidden divide-y divide-surface-divider">
                  {sortedCharges.map((l) => (
                    <div key={l.id} className="table-card">
                      <p className="table-card-head">{l.tenantName}</p>
                      <p className="table-card-sub">{l.unit?.building?.name || l.unit?.building?.address || "—"}{l.unit?.unitNumber ? ` / ${l.unit.unitNumber}` : ""}</p>
                      <div className="table-card-footer">
                        <span className="font-medium">{formatCurrency(l.chargesTotalChf)}/mo</span>
                        {l.chargesSettlementDate && <span>Settlement {l.chargesSettlementDate}</span>}
                        <button onClick={() => startEdit(l)} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">{t("manager:financeCharges.text.editCharges")}</button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Wide table — hidden sm:block */}
                <div className="hidden sm:block overflow-x-auto rounded-lg border border-surface-border">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <SortableHeader label={t("manager:financeCharges.prop.tenant")} field="tenant" sortField={cSortField} sortDir={cSortDir} onSort={handleChargeSort} />
                        <SortableHeader label={t("manager:financeCharges.prop.unit")} field="unit" sortField={cSortField} sortDir={cSortDir} onSort={handleChargeSort} />
                        <SortableHeader label={t("manager:financeCharges.prop.building")} field="building" sortField={cSortField} sortDir={cSortDir} onSort={handleChargeSort} />
                        <SortableHeader label="Monthly charges (CHF)" field="chargesTotalChf" sortField={cSortField} sortDir={cSortDir} onSort={handleChargeSort} />
                        <SortableHeader label={t("manager:financeCharges.prop.settlementDate")} field="settlementDate" sortField={cSortField} sortDir={cSortDir} onSort={handleChargeSort} />
                        <th>{t("manager:financeCharges.col.actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCharges.map((l) => (
                        <tr key={l.id}>
                          <td className="cell-bold">{l.tenantName}</td>
                          <td>{l.unit?.unitNumber || "—"}</td>
                          <td>{l.unit?.building?.name || l.unit?.building?.address || "—"}</td>
                          <td className="cell-bold">{formatCurrency(l.chargesTotalChf)}</td>
                          <td>{l.chargesSettlementDate || "—"}</td>
                          <td>
                            <button onClick={() => startEdit(l)} className="action-btn-brand">
                              Edit charges
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
          ) : (
            /* Itemized view */
            itemizedRows.length === 0 ? (
              <Panel>
                <p className="m-0">{t("manager:financeCharges.text.noItemizedChargeDataFound")}</p>
              </Panel>
            ) : (
              <>
                  {/* Mobile card list — sm:hidden */}
                  <div className="sm:hidden overflow-hidden divide-y divide-surface-divider">
                    {sortedItemizedRows.map((row, idx) => (
                      <div key={`${row.leaseId}-${idx}`} className="table-card">
                        <p className="table-card-head">{row.tenantName}</p>
                        <p className="table-card-sub">{row.unitNumber} · {row.label}</p>
                        <div className="table-card-footer">
                          <span className={row.mode === "FORFAIT"
                            ? "px-2 py-0.5 rounded-xl text-xs font-semibold bg-amber-50 text-orange-700 border border-amber-300"
                            : "px-2 py-0.5 rounded-xl text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-300"
                          }>{row.mode}</span>
                          <span className="font-medium">{formatCurrency(row.amountChf)}</span>
                          <button
                            onClick={() => { const lease = leases.find((l) => l.id === row.leaseId); if (lease) startEdit(lease); }}
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                          >{t("manager:financeCharges.text.edit")}</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Wide table — hidden sm:block */}
                  <div className="hidden sm:block overflow-x-auto rounded-lg border border-surface-border">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <SortableHeader label={t("manager:financeCharges.prop.tenant")} field="tenantName" sortField={iSortField} sortDir={iSortDir} onSort={handleISort} />
                          <SortableHeader label={t("manager:financeCharges.prop.unit")} field="unitNumber" sortField={iSortField} sortDir={iSortDir} onSort={handleISort} />
                          <SortableHeader label={t("manager:financeCharges.placeholder.itemName")} field="label" sortField={iSortField} sortDir={iSortDir} onSort={handleISort} />
                          <SortableHeader label={t("manager:financeCharges.prop.mode")} field="mode" sortField={iSortField} sortDir={iSortDir} onSort={handleISort} />
                          <SortableHeader label="Amount (CHF)" field="amountChf" sortField={iSortField} sortDir={iSortDir} onSort={handleISort} />
                          <th>{t("manager:financeCharges.col.actions")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedItemizedRows.map((row, idx) => (
                          <tr key={`${row.leaseId}-${idx}`}>
                            <td className="cell-bold">{row.tenantName}</td>
                            <td>{row.unitNumber}</td>
                            <td>{row.label}</td>
                            <td>
                              <span className={row.mode === "FORFAIT"
                                ? "inline-block px-2 py-0.5 rounded-xl text-xs font-semibold bg-amber-50 text-orange-700 border border-amber-300"
                                : "inline-block px-2 py-0.5 rounded-xl text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-300"
                              }>
                                {row.mode}
                              </span>
                            </td>
                            <td className="cell-bold">{formatCurrency(row.amountChf)}</td>
                            <td>
                              <button
                                onClick={() => {
                                  const lease = leases.find((l) => l.id === row.leaseId);
                                  if (lease) startEdit(lease);
                                }}
                                className="action-btn action-btn-brand text-xs"
                              >
                                Edit charges
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
            )
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}

export const getStaticProps = withTranslations(["common","manager"]);
