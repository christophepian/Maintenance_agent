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

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/leases?status=ACTIVE&limit=200", { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to load leases");
      setLeases(data?.data || []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

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
            <Panel style={{ backgroundColor: "#fff0f0", borderColor: "#ffb3b3" }}>
              <strong className="text-err-text">Error:</strong> {error}
              <button onClick={() => setError("")} style={{ marginLeft: 12, fontSize: "0.85em" }}>Dismiss</button>
            </Panel>
          )}

          {/* View Tabs */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 16 }}>
            {VIEW_TABS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    padding: "6px 14px", borderRadius: 6, fontSize: "0.85em", fontWeight: active ? 700 : 400,
                    border: active ? "2px solid #0b3a75" : "1px solid #ccc",
                    backgroundColor: active ? "#e3f2fd" : "#fff",
                    color: active ? "#0b3a75" : "#333", cursor: "pointer",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Edit Modal (inline panel) */}
          {editingLeaseId && (
            <Panel style={{ border: "2px solid #0b3a75", marginBottom: 16 }}>
              <h3 style={{ margin: "0 0 12px 0", fontSize: "1em" }}>Edit Charges</h3>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: "0.8em", fontWeight: 600, marginBottom: 4 }}>Charge Items</label>
                {editForm.chargesItems.map((item, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
                    <input
                      type="text"
                      placeholder="Item name"
                      value={item.label}
                      onChange={(e) => updateChargeItem(idx, "label", e.target.value)}
                      style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #ccc", fontSize: "0.85em", flex: 1 }}
                    />
                    <select
                      value={item.mode}
                      onChange={(e) => updateChargeItem(idx, "mode", e.target.value)}
                      style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #ccc", fontSize: "0.85em" }}
                    >
                      <option value="ACOMPTE">Acompte</option>
                      <option value="FORFAIT">Forfait</option>
                    </select>
                    <input
                      type="number"
                      placeholder="CHF"
                      value={item.amountChf}
                      onChange={(e) => updateChargeItem(idx, "amountChf", e.target.value)}
                      style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #ccc", fontSize: "0.85em", width: 80 }}
                    />
                    <button
                      onClick={() => removeChargeItem(idx)}
                      style={{ padding: "4px 8px", borderRadius: 4, fontSize: "0.8em", border: "1px solid #ccc", cursor: "pointer" }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={addChargeItem}
                  style={{
                    padding: "4px 12px", borderRadius: 4, fontSize: "0.8em",
                    border: "1px solid #90caf9", backgroundColor: "#e3f2fd", color: "#0b3a75", cursor: "pointer",
                  }}
                >
                  + Add item
                </button>
              </div>

              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8em", fontWeight: 600, marginBottom: 4 }}>Total charges (CHF)</label>
                  <input
                    type="number"
                    value={editForm.chargesTotalChf}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, chargesTotalChf: e.target.value }))}
                    style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #ccc", fontSize: "0.85em", width: 100 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8em", fontWeight: 600, marginBottom: 4 }}>Settlement date</label>
                  <input
                    type="text"
                    placeholder="e.g., 30.06.2027"
                    value={editForm.chargesSettlementDate}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, chargesSettlementDate: e.target.value }))}
                    style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #ccc", fontSize: "0.85em", width: 150 }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={saveCharges}
                  disabled={saving}
                  style={{
                    padding: "6px 16px", borderRadius: 4, fontSize: "0.85em",
                    backgroundColor: "#1b5e20", color: "#fff", border: "none", cursor: "pointer",
                  }}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={cancelEdit}
                  style={{
                    padding: "6px 16px", borderRadius: 4, fontSize: "0.85em",
                    border: "1px solid #ccc", backgroundColor: "#f5f5f5", cursor: "pointer",
                  }}
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
                        <button
                          onClick={() => startEdit(l)}
                          style={{
                            padding: "4px 10px", borderRadius: 4, fontSize: "0.8em",
                            backgroundColor: "#e3f2fd", color: "#0b3a75", border: "1px solid #90caf9",
                            cursor: "pointer",
                          }}
                        >
                          Edit charges
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          ) : (
            /* Itemized view */
            itemizedRows.length === 0 ? (
              <Panel>
                <p className="m-0">No itemized charge data found.</p>
              </Panel>
            ) : (
              <Panel bodyClassName="p-0">
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
                          <span style={{
                            display: "inline-block", padding: "2px 8px", borderRadius: 10,
                            fontSize: "0.8em", fontWeight: 600,
                            backgroundColor: row.mode === "FORFAIT" ? "#fff3e0" : "#e3f2fd",
                            color: row.mode === "FORFAIT" ? "#e65100" : "#0b3a75",
                            border: `1px solid ${row.mode === "FORFAIT" ? "#ffb74d" : "#90caf9"}`,
                          }}>
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
                            style={{
                              padding: "4px 10px", borderRadius: 4, fontSize: "0.8em",
                              backgroundColor: "#e3f2fd", color: "#0b3a75", border: "1px solid #90caf9",
                              cursor: "pointer",
                            }}
                          >
                            Edit charges
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            )
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
