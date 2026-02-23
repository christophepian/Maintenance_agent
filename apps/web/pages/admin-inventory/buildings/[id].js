import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";

export default function BuildingDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [activeTab, setActiveTab] = useState("Building information");

  const ui = {
    page: { maxWidth: "1100px", margin: "40px auto", padding: "24px", fontFamily: "system-ui" },
    headerRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" },
    h1: { fontSize: "2.2rem", fontWeight: 700, margin: 0 },
    h2: { fontSize: "1.5rem", fontWeight: 600, margin: "0 0 16px 0" },
    subtle: { color: "#888", fontSize: "0.95rem" },
    code: { background: "#f5f5f5", padding: "2px 6px", borderRadius: "4px", fontSize: "0.95em", fontFamily: "monospace" },
    codeSmall: { background: "#f5f5f5", padding: "2px 4px", borderRadius: "3px", fontSize: "0.85em", fontFamily: "monospace" },
    card: { background: "#fff", border: "1px solid #e5e5e5", borderRadius: "8px", padding: "20px", marginBottom: "20px" },
    label: { display: "block", fontWeight: 600, marginBottom: "6px", fontSize: "0.95rem" },
    input: { padding: "10px 12px", borderRadius: "6px", border: "1px solid #ddd", width: "100%", maxWidth: "380px", fontSize: "0.95rem", boxSizing: "border-box" },
    primaryBtn: { padding: "10px 20px", borderRadius: "6px", border: "none", background: "#111", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "0.95rem" },
    secondaryBtn: { padding: "10px 20px", borderRadius: "6px", border: "1px solid #ddd", background: "#fafafa", color: "#111", cursor: "pointer", fontWeight: 500, fontSize: "0.95rem" },
    dangerBtn: { padding: "10px 20px", borderRadius: "6px", border: "none", background: "#dc3545", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "0.95rem" },
    formRow: { display: "flex", gap: "16px", alignItems: "flex-end", marginBottom: "20px" },
    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" },
    list: { display: "flex", flexDirection: "column", gap: "12px" },
    listRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px", border: "1px solid #e5e5e5", borderRadius: "6px", background: "#fafafa" },
    rowTitle: { fontWeight: 600, fontSize: "1rem", marginBottom: "4px" },
    help: { fontSize: "0.85rem", color: "#666", marginTop: "4px" },
    empty: { padding: "20px", textAlign: "center", color: "#888", fontStyle: "italic" },
    notice: { padding: "12px 16px", borderRadius: "6px", marginBottom: "16px", fontSize: "0.95rem" },
    noticeOk: { background: "#e8f5e9", border: "1px solid #81c784", color: "#2e7d32" },
    noticeErr: { background: "#ffebee", border: "1px solid #ef5350", color: "#c62828" },
    pill: { display: "inline-block", background: "#e0e0e0", color: "#333", padding: "2px 8px", borderRadius: "12px", fontSize: "0.8rem", marginLeft: "6px" },
    actionPanel: { background: "#fafafa", border: "1px solid #e5e5e5", borderRadius: "6px", padding: "14px", display: "flex", flexDirection: "column", gap: "16px" },
    actionHeader: { display: "flex", alignItems: "center", justifyContent: "space-between" },
    actionOptions: { display: "grid", gap: "10px" },
    actionOptionBtn: { padding: "10px 14px", borderRadius: "6px", border: "1px solid #ddd", background: "#fafafa", textAlign: "left", cursor: "pointer", fontWeight: 600 },
    actionHint: { color: "#666", fontSize: "0.85rem", marginTop: "4px" },
    backLink: { color: "#0066cc", textDecoration: "none", fontWeight: 500, marginBottom: "20px", display: "inline-block" },
  };

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || "http://127.0.0.1:3001";

  const [building, setBuilding] = useState(null);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [createUnitName, setCreateUnitName] = useState("");
  const [createUnitType, setCreateUnitType] = useState("RESIDENTIAL");
  const [unitAction, setUnitAction] = useState(null);
  const [configMode, setConfigMode] = useState(null);
  const [configAutoApprove, setConfigAutoApprove] = useState("");
  const [configEmergency, setConfigEmergency] = useState(false);
  const [configOwnerThreshold, setConfigOwnerThreshold] = useState("");
  const [buildingConfig, setBuildingConfig] = useState(null);
  const [rules, setRules] = useState([]);
  const [createRuleMode, setCreateRuleMode] = useState(false);
  const [newRuleName, setNewRuleName] = useState("");
  const [newRulePriority, setNewRulePriority] = useState("0");
  const [newRuleConditions, setNewRuleConditions] = useState([{ field: "CATEGORY", operator: "EQUALS", value: "" }]);
  const [newRuleAction, setNewRuleAction] = useState("AUTO_APPROVE");
  const [message, setMessage] = useState("");

  function setOk(message) {
    setNotice({ type: "ok", message });
    setTimeout(() => setNotice(null), 4000);
  }
  function setErr(message) {
    setNotice({ type: "err", message });
  }

  async function fetchJSON(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {}
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return data;
  }

  async function loadBuilding() {
    try {
      const data = await fetchJSON(`/buildings`);
      const b = Array.isArray(data) ? data.find((x) => x.id === id) : data?.data?.find((x) => x.id === id);
      if (!b) throw new Error("Building not found");
      setBuilding(b);
      setEditName(b.name);
      setEditAddress(b.address || "");
      await loadUnits();
      await loadBuildingConfig();
      await loadApprovalRules();
    } catch (e) {
      setErr(`Failed to load building: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadBuildingConfig() {
    if (!id) return;
    try {
      const data = await fetchJSON(`/buildings/${id}/config`);
      const cfg = data?.data || null;
      setBuildingConfig(cfg);
      if (cfg) {
        setConfigAutoApprove(cfg.autoApproveLimit != null ? String(cfg.autoApproveLimit) : "");
        setConfigEmergency(cfg.emergencyAutoDispatch || false);
        setConfigOwnerThreshold(cfg.requireOwnerApprovalAbove != null ? String(cfg.requireOwnerApprovalAbove) : "");
      }
    } catch (e) {
      setErr(`Failed to load building config: ${e.message}`);
    }
  }

  async function loadApprovalRules() {
    if (!id) return;
    try {
      const data = await fetchJSON(`/approval-rules?buildingId=${id}`);
      setRules(Array.isArray(data) ? data : data?.data || []);
    } catch (e) {
      console.error("Failed to load approval rules:", e);
      setRules([]);
    }
  }

  async function loadUnits() {
    if (!id) return;
    try {
      const data = await fetchJSON(`/buildings/${id}/units`);
      setUnits(Array.isArray(data) ? data : data?.data || []);
    } catch (e) {
      setErr(`Failed to load units: ${e.message}`);
    }
  }

  useEffect(() => {
    if (id) loadBuilding();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onUpdateBuilding(e) {
    e.preventDefault();
    if (!editName.trim()) return setErr("Building name is required.");
    try {
      setLoading(true);
      await fetchJSON(`/buildings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName, address: editAddress }),
      });
      await loadBuilding();
      setEditMode(false);
      setOk("Building updated.");
    } catch (e) {
      setErr(`Update failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function onCreateUnit(e) {
    e.preventDefault();
    if (!createUnitName.trim()) return setErr("Unit name is required.");
    try {
      setLoading(true);
      await fetchJSON(`/buildings/${id}/units`, {
        method: "POST",
        body: JSON.stringify({ unitNumber: createUnitName, type: createUnitType }),
      });
      await loadUnits();
      setCreateUnitName("");
      setUnitAction(null);
      setOk("Unit created.");
    } catch (e) {
      setErr(`Create unit failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function onDeactivateBuilding() {
    if (!confirm("Deactivate this building? This cannot be undone.")) return;
    try {
      setLoading(true);
      await fetchJSON(`/buildings/${id}`, { method: "DELETE" });
      setOk("Building deactivated. Redirecting...");
      setTimeout(() => router.push("/admin-inventory"), 1500);
    } catch (e) {
      setErr(`Deactivate failed: ${e.message}`);
      setLoading(false);
    }
  }

  async function onSaveBuildingConfig(e) {
    e.preventDefault();
    try {
      setLoading(true);
      const payload = {};
      if (configAutoApprove.trim()) {
        const n = Number(configAutoApprove);
        if (!Number.isInteger(n) || n < 0 || n > 100000) {
          return setErr("Auto-approve limit must be an integer 0–100000 or blank.");
        }
        payload.autoApproveLimit = n;
      } else {
        payload.autoApproveLimit = null;
      }
      payload.emergencyAutoDispatch = configEmergency;
      if (configOwnerThreshold.trim()) {
        const n = Number(configOwnerThreshold);
        if (!Number.isInteger(n) || n < 0 || n > 100000) {
          return setErr("Owner threshold must be an integer 0–100000 or blank.");
        }
        payload.requireOwnerApprovalAbove = n;
      } else {
        payload.requireOwnerApprovalAbove = null;
      }
      await fetchJSON(`/buildings/${id}/config`, { method: "PUT", body: JSON.stringify(payload) });
      await loadBuildingConfig();
      setConfigMode(null);
      setOk("Building config saved.");
    } catch (e) {
      setErr(`Config save failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function onCreateRule(e) {
    e.preventDefault();
    if (!newRuleName.trim()) return setErr("Rule name is required.");
    const validConditions = newRuleConditions.filter((c) => c.value);
    if (validConditions.length === 0) return setErr("At least one condition with a value is required.");
    try {
      setLoading(true);
      const payload = {
        buildingId: id,
        name: newRuleName,
        priority: parseInt(newRulePriority) || 0,
        conditions: validConditions,
        action: newRuleAction,
      };
      await fetchJSON(`/approval-rules`, { method: "POST", body: JSON.stringify(payload) });
      await loadApprovalRules();
      setNewRuleName("");
      setNewRulePriority("0");
      setNewRuleConditions([{ field: "CATEGORY", operator: "EQUALS", value: "" }]);
      setNewRuleAction("AUTO_APPROVE");
      setCreateRuleMode(false);
      setOk("Approval rule created.");
    } catch (e) {
      setErr(`Create rule failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function onDeleteRule(ruleId) {
    if (!confirm("Delete this approval rule?")) return;
    try {
      setLoading(true);
      await fetchJSON(`/approval-rules/${ruleId}`, { method: "DELETE" });
      await loadApprovalRules();
      setOk("Approval rule deleted.");
    } catch (e) {
      setErr(`Delete rule failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function onToggleRuleActive(ruleId, currentActive) {
    try {
      setLoading(true);
      await fetchJSON(`/approval-rules/${ruleId}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !currentActive }),
      });
      await loadApprovalRules();
      setOk("Rule status updated.");
    } catch (e) {
      setErr(`Toggle rule failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  function addCondition() {
    setNewRuleConditions([...newRuleConditions, { field: "CATEGORY", operator: "EQUALS", value: "" }]);
  }

  function removeCondition(index) {
    setNewRuleConditions(newRuleConditions.filter((_, i) => i !== index));
  }

  function updateCondition(index, key, value) {
    const updated = [...newRuleConditions];
    updated[index][key] = value;
    setNewRuleConditions(updated);
  }

  if (loading && !building) {
    return (
      <AppShell role="MANAGER">
        <PageShell variant="embedded">
          <PageContent>
            <Panel>
              <p className="text-sm text-slate-600">Loading building...</p>
            </Panel>
          </PageContent>
        </PageShell>
      </AppShell>
    );
  }

  if (!building) {
    return (
      <AppShell role="MANAGER">
        <PageShell variant="embedded">
          <PageContent>
            <Panel>
              <p className="text-sm text-slate-600">Building not found.</p>
            </Panel>
          </PageContent>
        </PageShell>
      </AppShell>
    );
  }

  const residentialUnits = units.filter((u) => u.type === "RESIDENTIAL" || !u.type);
  const commonUnits = units.filter((u) => u.type === "COMMON_AREA");

  return (
    <AppShell role="MANAGER">
      <PageShell variant="embedded">
        <div className="mb-3">
          <Link href="/admin-inventory" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            ← Back to Inventory
          </Link>
        </div>
        <PageHeader
          title={building?.name || "Building"}
          subtitle={building?.address || "Building details and configuration."}
          actions={(
            <div className="flex items-center gap-2">
              {activeTab === "Building information" && !editMode && (
                <button
                  type="button"
                  className="button-primary"
                  onClick={() => setEditMode(true)}
                  disabled={loading}
                >
                  Edit
                </button>
              )}
            </div>
          )}
        />
        <PageContent>
          {notice && (
            <Panel>
              <div className={`text-sm ${notice.type === "ok" ? "text-green-600" : "text-red-600"}`}>
                {notice.message}
              </div>
            </Panel>
          )}

          {/* Tabs Navigation */}
          <div className="flex flex-wrap gap-2 mb-4">
            {["Building information", "Units", "Policies"].map((tab) => (
              <button
                key={tab}
                type="button"
                className={
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition " +
                  (activeTab === tab
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900")
                }
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Building information tab */}
          {activeTab === "Building information" && (
            <Panel title="Building information">
              {editMode ? (
                <form onSubmit={onUpdateBuilding}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</span>
                      <input
                        className="input text-sm text-slate-700"
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Building name"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Address</span>
                      <input
                        className="input text-sm text-slate-700"
                        type="text"
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        placeholder="Address"
                      />
                    </label>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      type="submit"
                      className="button-primary"
                      disabled={loading}
                    >
                      {loading ? "Saving…" : "Save changes"}
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => {
                        setEditMode(false);
                        setEditName(building?.name || "");
                        setEditAddress(building?.address || "");
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="button-danger"
                      onClick={onDeactivateBuilding}
                      disabled={loading}
                    >
                      Deactivate
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</div>
                      <div className="text-sm text-slate-700 mt-1">{building?.name}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Address</div>
                      <div className="text-sm text-slate-700 mt-1">{building?.address || "—"}</div>
                    </div>
                  </div>
                </>
              )}
            </Panel>
          )}

          {/* Units tab */}
          {activeTab === "Units" && (
            <Panel title="Units">
              <div className="mb-4">
                {!unitAction ? (
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() => setUnitAction("create")}
                  >
                    Add unit
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => setUnitAction(null)}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>

              {unitAction === "create" && (
                <form onSubmit={onCreateUnit} className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                  <div className="grid gap-4 sm:grid-cols-2 mb-4">
                    <label className="grid gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unit number/label</span>
                      <input
                        className="input text-sm text-slate-700"
                        value={createUnitName}
                        onChange={(e) => setCreateUnitName(e.target.value)}
                        placeholder="e.g. 101, 3B, Common Area 1"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Type</span>
                      <select
                        className="input text-sm text-slate-700"
                        value={createUnitType}
                        onChange={(e) => setCreateUnitType(e.target.value)}
                      >
                        <option value="RESIDENTIAL">Residential</option>
                        <option value="COMMON_AREA">Common Area</option>
                      </select>
                    </label>
                  </div>
                  <button type="submit" className="button-primary" disabled={loading}>
                    {loading ? "Creating…" : "Create unit"}
                  </button>
                </form>
              )}

              {residentialUnits.length > 0 && (
                <>
                  <h3 className="font-semibold text-slate-900 mt-4 mb-3">Residential Units</h3>
                  <div className="space-y-2 mb-4">
                    {residentialUnits.map((u) => (
                      <Link key={u.id} href={`/admin-inventory/units/${u.id}`} className="block border border-slate-200 rounded-lg p-3 hover:bg-slate-50 transition">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-semibold text-slate-900">{u.unitNumber || u.name || "Unit"}</div>
                            <div className="text-xs text-slate-500 mt-1"><code>{u.id}</code></div>
                          </div>
                          <span className="text-blue-600">→</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              )}

              {commonUnits.length > 0 && (
                <>
                  <h3 className="font-semibold text-slate-900 mt-4 mb-3">Common Areas</h3>
                  <div className="space-y-2 mb-4">
                    {commonUnits.map((u) => (
                      <Link key={u.id} href={`/admin-inventory/units/${u.id}`} className="block border border-slate-200 rounded-lg p-3 hover:bg-slate-50 transition">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-semibold text-slate-900">{u.unitNumber || u.name || "Common Area"}</div>
                            <div className="text-xs text-slate-500 mt-1"><code>{u.id}</code></div>
                          </div>
                          <span className="text-blue-600">→</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              )}

              {units.length === 0 && <div className="text-center text-slate-500 italic text-sm py-6">No units yet.</div>}
            </Panel>
          )}

          {/* Policies tab */}
          {activeTab === "Policies" && (
            <>
              <Panel title="Policies">
                <div className="text-sm text-slate-600 mb-4">Building-level thresholds for auto-approval and emergency dispatch. Leave blank to use org defaults.</div>
                {configMode === "edit" ? (
                  <form onSubmit={onSaveBuildingConfig} className="mt-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Auto-approve limit (CHF)</span>
                        <input
                          type="number"
                          className="input text-sm text-slate-700"
                          value={configAutoApprove}
                          onChange={(e) => setConfigAutoApprove(e.target.value)}
                          placeholder="Leave blank for org default"
                        />
                        <span className="text-xs text-slate-500">(blank = use org default)</span>
                      </label>
                      <label className="grid gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Owner threshold (CHF)</span>
                        <input
                          type="number"
                          className="input text-sm text-slate-700"
                          value={configOwnerThreshold}
                          onChange={(e) => setConfigOwnerThreshold(e.target.value)}
                          placeholder="Leave blank for org default"
                        />
                        <span className="text-xs text-slate-500">(blank = use org default)</span>
                      </label>
                    </div>
                    <label className="flex items-center gap-2 my-4 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={configEmergency}
                        onChange={(e) => setConfigEmergency(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm font-semibold text-slate-700">Emergency auto-dispatch</span>
                    </label>
                    <div className="flex gap-2">
                      <button type="submit" className="button-primary" disabled={loading}>
                        {loading ? "Saving…" : "Save policies"}
                      </button>
                      <button type="button" className="button-secondary" onClick={() => setConfigMode(null)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2 mt-4">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Auto-approve limit</div>
                        <div className="text-sm text-slate-700 mt-1">
                          {buildingConfig?.autoApproveLimit != null ? `${buildingConfig.autoApproveLimit} CHF` : "(using org default)"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Owner threshold</div>
                        <div className="text-sm text-slate-700 mt-1">
                          {buildingConfig?.requireOwnerApprovalAbove != null ? `${buildingConfig.requireOwnerApprovalAbove} CHF` : "(using org default)"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Emergency auto-dispatch</div>
                        <div className="text-sm text-slate-700 mt-1">
                          {buildingConfig?.emergencyAutoDispatch ? "Enabled" : "Disabled"}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="button-secondary mt-4"
                      onClick={() => setConfigMode("edit")}
                    >
                      Edit policies
                    </button>
                  </>
                )}
              </Panel>

              <Panel title="Overrides">
                <div className="text-sm text-slate-600 mb-4">Define context-specific approval overrides for this building (e.g., "auto-approve ovens &lt; CHF 500").</div>

              {createRuleMode ? (
                <form onSubmit={onCreateRule} className="mt-4">
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Rule name</label>
                    <input
                      className="input text-sm text-slate-700 w-full"
                      value={newRuleName}
                      onChange={(e) => setNewRuleName(e.target.value)}
                      placeholder="e.g., Auto-approve ovens < CHF 500"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Priority (higher = evaluated first)</label>
                    <input
                      type="number"
                      className="input text-sm text-slate-700"
                      value={newRulePriority}
                      onChange={(e) => setNewRulePriority(e.target.value)}
                      min="0"
                      max="100"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Conditions (all must match)</label>
                    <div className="space-y-2 mb-3">
                      {newRuleConditions.map((cond, idx) => (
                        <div key={idx} className="flex gap-2 items-end">
                          <select
                            className="input text-sm text-slate-700 flex-1"
                            value={cond.field}
                            onChange={(e) => updateCondition(idx, "field", e.target.value)}
                          >
                            <option value="CATEGORY">Category</option>
                            <option value="ESTIMATED_COST">Estimated Cost</option>
                            <option value="UNIT_TYPE">Unit Type</option>
                            <option value="UNIT_NUMBER">Unit Number</option>
                          </select>
                          <select
                            className="input text-sm text-slate-700 flex-1"
                            value={cond.operator}
                            onChange={(e) => updateCondition(idx, "operator", e.target.value)}
                          >
                            <option value="EQUALS">Equals</option>
                            <option value="NOT_EQUALS">Not Equals</option>
                            {cond.field === "ESTIMATED_COST" && (
                              <>
                                <option value="LESS_THAN">Less Than</option>
                                <option value="LESS_THAN_OR_EQUAL">Less Than or Equal</option>
                                <option value="GREATER_THAN">Greater Than</option>
                                <option value="GREATER_THAN_OR_EQUAL">Greater Than or Equal</option>
                              </>
                            )}
                            {(cond.field === "CATEGORY" || cond.field === "UNIT_TYPE" || cond.field === "UNIT_NUMBER") && (
                              <>
                                <option value="CONTAINS">Contains</option>
                                <option value="STARTS_WITH">Starts With</option>
                                <option value="ENDS_WITH">Ends With</option>
                              </>
                            )}
                          </select>
                          <input
                            className="input text-sm text-slate-700 flex-1"
                            type={cond.field === "ESTIMATED_COST" ? "number" : "text"}
                            value={cond.value}
                            onChange={(e) =>
                              updateCondition(idx, "value", cond.field === "ESTIMATED_COST" ? parseInt(e.target.value) || 0 : e.target.value)
                            }
                            placeholder={
                              cond.field === "CATEGORY"
                                ? "e.g., oven, stove"
                                : cond.field === "UNIT_TYPE"
                                ? "RESIDENTIAL or COMMON_AREA"
                                : cond.field === "UNIT_NUMBER"
                                ? "e.g., 101, 2xx, PH"
                                : "CHF amount"
                            }
                          />
                          {newRuleConditions.length > 1 && (
                            <button
                              type="button"
                              className="button-secondary px-2 py-1 text-xs"
                              onClick={() => removeCondition(idx)}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button type="button" className="button-secondary text-xs" onClick={addCondition}>
                      + Add condition
                    </button>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Action</label>
                    <select className="input text-sm text-slate-700 w-full" value={newRuleAction} onChange={(e) => setNewRuleAction(e.target.value)}>
                      <option value="AUTO_APPROVE">Auto-approve</option>
                      <option value="REQUIRE_MANAGER_REVIEW">Require manager review</option>
                      <option value="REQUIRE_OWNER_APPROVAL">Require owner approval</option>
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <button type="submit" className="button-primary" disabled={loading}>
                      {loading ? "Creating…" : "Create rule"}
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => {
                        setCreateRuleMode(false);
                        setNewRuleName("");
                        setNewRulePriority("0");
                        setNewRuleConditions([{ field: "CATEGORY", operator: "EQUALS", value: "" }]);
                        setNewRuleAction("AUTO_APPROVE");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {rules.length > 0 && (
                    <div className="space-y-3 mt-4 mb-4">
                      {rules.map((rule) => (
                        <div key={rule.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-semibold text-slate-900">
                                {rule.name}
                                {!rule.isActive && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full ml-2">Inactive</span>}
                                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full ml-2">Priority: {rule.priority}</span>
                              </div>
                              <div className="text-xs text-slate-600 mt-1">
                                {rule.conditions.map((c, i) => (
                                  <span key={i}>
                                    {i > 0 && " AND "}
                                    <strong>{c.field}</strong> {c.operator.toLowerCase().replace(/_/g, " ")} <code>{c.value}</code>
                                  </span>
                                ))}
                                {" → "}
                                <strong>{rule.action.toLowerCase().replace(/_/g, " ")}</strong>
                              </div>
                            </div>
                            <div className="flex gap-2 ml-4">
                              <button
                                type="button"
                                className="button-secondary text-xs px-2 py-1"
                                onClick={() => onToggleRuleActive(rule.id, rule.isActive)}
                                disabled={loading}
                              >
                                {rule.isActive ? "Deactivate" : "Activate"}
                              </button>
                              <button
                                type="button"
                                className="button-danger text-xs px-2 py-1"
                                onClick={() => onDeleteRule(rule.id)}
                                disabled={loading}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {rules.length === 0 && <div className="text-center text-slate-500 italic text-sm py-6">No approval rules yet.</div>}
                  <button type="button" className="button-primary" onClick={() => setCreateRuleMode(true)}>
                    Create rule
                  </button>
                </>
              )}
              </Panel>
            </>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
