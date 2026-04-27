import { useEffect, useState, useMemo, useCallback } from "react";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import { authHeaders } from "../../../lib/api";

function formatCurrency(chf) {
  if (typeof chf !== "number") return "—";
  const str = chf.toFixed(0);
  const formatted = str.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `CHF ${formatted}`;
}

const VIEW_TABS = [
  { key: "SUMMARY", label: "Summary" },
  { key: "ITEMIZED", label: "Itemized" },
];

export default function ManagerChargesPage() {
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

  // Flatten chargesItems across all leases for itemized view
  const itemizedRows = useMemo(() => {
    const rows = [];
    leasesWithCharges.forEach((l) => {
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
  }, [leasesWithCharges]);

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
        <PageHeader title="Charges" />
        <PageContent>
          {error && (
            <Panel className="bg-red-50 border-red-200">
              <strong className="text-red-700">Error:</strong> {error}
              <button onClick={() => setError("")} className="action-btn-dismiss">Dismiss</button>
            </Panel>
          )}

          {/* Filters — COA expense type (feature-flagged) */}
          {expenseTypes.length > 0 && (
            <Panel>
              <div className="filter-row">
                <div>
                  <label className="filter-label">Expense Type</label>
                  <select
                    value={expenseTypeId}
                    onChange={(e) => setExpenseTypeId(e.target.value)}
                    className="filter-select"
                  >
                    <option value="">All expense types</option>
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

          {/* Edit Modal (inline panel) */}
          {editingLeaseId && (
            <Panel className="edit-panel">
              <h3 className="mb-3 text-base font-semibold m-0">Edit Charges</h3>

              <div className="mb-3">
                <label className="filter-label">Charge Items</label>
                {editForm.chargesItems.map((item, idx) => (
                  <div key={idx} className="edit-row">
                    <input
                      type="text"
                      placeholder="Item name"
                      value={item.label}
                      onChange={(e) => updateChargeItem(idx, "label", e.target.value)}
                      className="edit-input flex-1"
                    />
                    <select
                      value={item.mode}
                      onChange={(e) => updateChargeItem(idx, "mode", e.target.value)}
                      className="edit-input"
                    >
                      <option value="ACOMPTE">Acompte</option>
                      <option value="FORFAIT">Forfait</option>
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
                  <label className="filter-label">Settlement date</label>
                  <input
                    type="text"
                    placeholder="e.g., 30.06.2027"
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
            <Panel><p className="m-0">Loading charges...</p></Panel>
          ) : leasesWithCharges.length === 0 ? (
            <Panel>
              <p className="m-0">No active leases with charge data found.</p>
            </Panel>
          ) : activeTab === "SUMMARY" ? (
            /* Summary view */
            <Panel bodyClassName="p-0">
              <>
                {/* Mobile card list — sm:hidden */}
                <div className="sm:hidden overflow-hidden divide-y divide-table-divider">
                  {leasesWithCharges.map((l) => (
                    <div key={l.id} className="table-card">
                      <p className="table-card-head">{l.tenantName}</p>
                      <p className="table-card-sub">{l.unit?.building?.name || l.unit?.building?.address || "—"}{l.unit?.unitNumber ? ` / ${l.unit.unitNumber}` : ""}</p>
                      <div className="table-card-footer">
                        <span className="font-medium">{formatCurrency(l.chargesTotalChf)}/mo</span>
                        {l.chargesSettlementDate && <span>Settlement {l.chargesSettlementDate}</span>}
                        <button onClick={() => startEdit(l)} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">Edit charges</button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Wide table — hidden sm:block */}
                <div className="hidden sm:block">
                  <table className="inline-table">
                    <thead>
                      <tr>
                        <th>Tenant</th>
                        <th>Unit</th>
                        <th>Building</th>
                        <th>Monthly charges (CHF)</th>
                        <th>Settlement date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leasesWithCharges.map((l) => (
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
            </Panel>
          ) : (
            /* Itemized view */
            itemizedRows.length === 0 ? (
              <Panel>
                <p className="m-0">No itemized charge data found.</p>
              </Panel>
            ) : (
              <Panel bodyClassName="p-0">
                <>
                  {/* Mobile card list — sm:hidden */}
                  <div className="sm:hidden overflow-hidden divide-y divide-table-divider">
                    {itemizedRows.map((row, idx) => (
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
                          >Edit</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Wide table — hidden sm:block */}
                  <div className="hidden sm:block">
                    <table className="inline-table">
                      <thead>
                        <tr>
                          <th>Tenant</th>
                          <th>Unit</th>
                          <th>Item name</th>
                          <th>Mode</th>
                          <th>Amount (CHF)</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemizedRows.map((row, idx) => (
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
              </Panel>
            )
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
