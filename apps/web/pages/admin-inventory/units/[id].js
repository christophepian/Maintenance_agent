import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "../../../components/AppShell";
import { ALLOWED_CATEGORIES } from "../../../lib/categories";

export default function UnitDetail() {
  const router = useRouter();
  const { id } = router.query;

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
    tag: { display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.02em", marginLeft: "10px" },
    tagBusy: { background: "#e3f2fd", color: "#1565c0", border: "1px solid #90caf9" },
    tagEmpty: { background: "#f3f4f6", color: "#4b5563", border: "1px solid #d1d5db" },
    tabRow: { display: "flex", gap: "8px", marginBottom: "12px" },
    tabBtn: { padding: "8px 14px", borderRadius: "999px", border: "1px solid #e5e5e5", background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", color: "#444" },
    tabActive: { background: "#111", color: "#fff", border: "1px solid #111" },
    actionPanel: { background: "#fafafa", border: "1px solid #e5e5e5", borderRadius: "6px", padding: "14px", display: "flex", flexDirection: "column", gap: "16px" },
    actionHeader: { display: "flex", alignItems: "center", justifyContent: "space-between" },
    actionOptions: { display: "grid", gap: "10px" },
    actionOptionBtn: { padding: "10px 14px", borderRadius: "6px", border: "1px solid #ddd", background: "#fafafa", textAlign: "left", cursor: "pointer", fontWeight: 600 },
    actionHint: { color: "#666", fontSize: "0.85rem", marginTop: "4px" },
    backLink: { color: "#0066cc", textDecoration: "none", fontWeight: 500, marginBottom: "20px", display: "inline-block" },
  };

  const [unit, setUnit] = useState(null);
  const [appliances, setAppliances] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [allTenants, setAllTenants] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [assigningTenant, setAssigningTenant] = useState(false);
  const [unassigningTenantId, setUnassigningTenantId] = useState(null);
  const [createTenantName, setCreateTenantName] = useState("");
  const [createTenantPhone, setCreateTenantPhone] = useState("");
  const [createTenantEmail, setCreateTenantEmail] = useState("");
  const [creatingTenant, setCreatingTenant] = useState(false);
  const [assetModels, setAssetModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editNumber, setEditNumber] = useState("");
  const [editFloor, setEditFloor] = useState("");
  const [editType, setEditType] = useState("");
  const [createApplianceName, setCreateApplianceName] = useState("");
  const [createApplianceCategory, setCreateApplianceCategory] = useState("");
  const [createApplianceSerial, setCreateApplianceSerial] = useState("");
  const [createApplianceModel, setCreateApplianceModel] = useState("");
  const [creatingApplianceModelId, setCreatingApplianceModelId] = useState(null);
  const [activeTab, setActiveTab] = useState("Tenants");
  const [tenantAction, setTenantAction] = useState(null);
  const [applianceAction, setApplianceAction] = useState(null);

  function setOk(message) {
    setNotice({ type: "ok", message });
    setTimeout(() => setNotice(null), 4000);
  }
  function setErr(message) {
    setNotice({ type: "err", message });
  }

  async function fetchJSON(path, options = {}) {
    const apiPath = path.startsWith("/api/") ? path : `/api${path}`;
    const res = await fetch(apiPath, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {}
    if (!res.ok) {
      const msg =
        data?.error?.message ||
        data?.error?.code ||
        data?.error ||
        data?.message ||
        `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return data;
  }

  async function loadUnit() {
    if (!id) return;
    try {
      setLoading(true);
      const data = await fetchJSON(`/units/${id}`);
      const u = data?.data || data;
      if (!u) {
        setErr("Unit not found");
        return;
      }
      setUnit(u);
      setEditNumber(u.unitNumber || u.name || "");
      setEditFloor(u.floor || "");
      setEditType(u.type || "");
      await loadAppliances();
      await loadTenants();
      await loadAllTenants();
      await loadAssetModels();
    } catch (e) {
      setErr(`Failed to load unit: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadAppliances() {
    if (!id) return;
    try {
      const data = await fetchJSON(`/units/${id}/appliances`);
      setAppliances(Array.isArray(data) ? data : data?.data || []);
    } catch (e) {
      setErr(`Failed to load appliances: ${e.message}`);
    }
  }

  async function loadTenants() {
    if (!id) return;
    try {
      const data = await fetchJSON(`/units/${id}/tenants`);
      setTenants(Array.isArray(data) ? data : data?.data || []);
    } catch (e) {
      // Silently fail; tenants may not be set up yet
    }
  }

  async function loadAllTenants() {
    try {
      const data = await fetchJSON(`/tenants`);
      setAllTenants(Array.isArray(data) ? data : data?.data || []);
    } catch (e) {
      // Silently fail
    }
  }

  async function loadAssetModels() {
    try {
      const data = await fetchJSON(`/asset-models`);
      setAssetModels(Array.isArray(data) ? data : data?.data || []);
    } catch (e) {
      // Silently fail
    }
  }

  useEffect(() => {
    if (id) loadUnit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onCreateAppliance(e) {
    e.preventDefault();
    if (!createApplianceName.trim()) return setErr("Appliance name is required.");

    try {
      setLoading(true);
      await fetchJSON(`/units/${id}/appliances`, {
        method: "POST",
        body: JSON.stringify({
          name: createApplianceName,
          ...(createApplianceCategory.trim() ? { category: createApplianceCategory } : {}),
          serial: createApplianceSerial || undefined,
          assetModelId: createApplianceModel || undefined,
        }),
      });
      await loadAppliances();
      setCreateApplianceName("");
      setCreateApplianceCategory("");
      setCreateApplianceSerial("");
      setCreateApplianceModel("");
      setApplianceAction(null);
      setOk("Appliance created.");
    } catch (e) {
      setErr(`Create appliance failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function onCreateApplianceFromModel(model) {
    try {
      setCreatingApplianceModelId(model.id);
      await fetchJSON(`/units/${id}/appliances`, {
        method: "POST",
        body: JSON.stringify({
          name: model.name,
          ...(model.category ? { category: model.category } : {}),
          assetModelId: model.id,
        }),
      });
      await loadAppliances();
      setOk("Appliance created.");
    } catch (e) {
      setErr(`Create appliance failed: ${e.message}`);
    } finally {
      setCreatingApplianceModelId(null);
    }
  }

  async function onDeactivateUnit() {
    if (!confirm("Deactivate this unit? This cannot be undone.")) return;
    try {
      setLoading(true);
      await fetchJSON(`/units/${id}`, { method: "DELETE" });
      setOk("Unit deactivated. Redirecting...");
      setTimeout(() => router.back(), 1500);
    } catch (e) {
      setErr(`Deactivate failed: ${e.message}`);
      setLoading(false);
    }
  }

  async function onSaveUnit() {
    try {
      setLoading(true);
      const payload = {
        unitNumber: editNumber.trim() || undefined,
        floor: editFloor.trim() || undefined,
        type: editType || undefined,
      };
      const data = await fetchJSON(`/units/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      const updated = data?.data || data;
      setUnit(updated);
      setEditMode(false);
      setOk("Unit updated.");
    } catch (e) {
      setErr(`Update failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function onDeactivateAppliance(applianceId) {
    if (!confirm("Deactivate this appliance?")) return;
    try {
      await fetchJSON(`/appliances/${applianceId}`, { method: "DELETE" });
      await loadAppliances();
      setOk("Appliance deactivated.");
    } catch (e) {
      setErr(`Deactivate failed: ${e.message}`);
    }
  }


  async function onAssignTenant(e) {
    e.preventDefault();
    if (!selectedTenantId) return setErr("Select a tenant to assign.");
    try {
      setAssigningTenant(true);
      await fetchJSON(`/units/${id}/tenants`, {
        method: "POST",
        body: JSON.stringify({ tenantId: selectedTenantId }),
      });
      setSelectedTenantId("");
      await loadTenants();
      await loadAllTenants();
      setTenantAction(null);
      setOk("Tenant assigned.");
    } catch (e) {
      setErr(`Assign failed: ${e.message}`);
    } finally {
      setAssigningTenant(false);
    }
  }

  async function onUnassignTenant(tenantId) {
    if (!confirm("Remove this tenant from the unit?")) return;
    try {
      setUnassigningTenantId(tenantId);
      await fetchJSON(`/units/${id}/tenants/${tenantId}`, { method: "DELETE" });
      await loadTenants();
      await loadAllTenants();
      setOk("Tenant unassigned.");
    } catch (e) {
      setErr(`Unassign failed: ${e.message}`);
    } finally {
      setUnassigningTenantId(null);
    }
  }

  async function onCreateTenant(e) {
    e.preventDefault();
    if (!createTenantPhone.trim()) return setErr("Phone is required.");
    try {
      setCreatingTenant(true);
      const payload = {
        phone: createTenantPhone.trim(),
        ...(createTenantName.trim() ? { name: createTenantName.trim() } : {}),
        ...(createTenantEmail.trim() ? { email: createTenantEmail.trim() } : {}),
      };
      const created = await fetchJSON(`/tenants`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const createdTenantId = created?.data?.id || created?.id;
      if (createdTenantId) {
        await fetchJSON(`/units/${id}/tenants`, {
          method: "POST",
          body: JSON.stringify({ tenantId: createdTenantId }),
        });
      }
      setCreateTenantName("");
      setCreateTenantPhone("");
      setCreateTenantEmail("");
      await loadTenants();
      await loadAllTenants();
      setTenantAction(null);
      setOk("Tenant created and assigned.");
    } catch (e) {
      setErr(`Create tenant failed: ${e.message}`);
    } finally {
      setCreatingTenant(false);
    }
  }

  const assignedTenantIds = new Set(tenants.map((t) => t.id));
  const isBusy = tenants.length > 0;
  const occupancyLabel = isBusy ? "Busy" : "Empty";
  const orgModels = assetModels.filter((m) => m.orgId);

  if (loading) {
    return <div style={ui.page}>Loading...</div>;
  }

  return (
    <AppShell role="MANAGER">
      <div style={ui.page}>
      <Link href={unit?.building?.id ? `/admin-inventory/buildings/${unit.building.id}` : "/admin-inventory"} style={ui.backLink}>
        ← Back
      </Link>

      <div style={ui.headerRow}>
        <div>
          <h1 style={ui.h1}>Unit {unit?.unitNumber || "Detail"}</h1>
          <div style={ui.subtle}><code style={ui.code}>{id}</code></div>
          {unit?.building?.name && (
            <div style={ui.subtle}>Building: {unit.building.name}</div>
          )}
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          {editMode ? (
            <>
              <button type="button" style={ui.secondaryBtn} onClick={() => {
                setEditMode(false);
                setEditNumber(unit?.unitNumber || "");
                setEditFloor(unit?.floor || "");
                setEditType(unit?.type || "");
              }}>
                Cancel
              </button>
              <button type="button" style={ui.primaryBtn} onClick={onSaveUnit} disabled={loading}>
                Save
              </button>
            </>
          ) : (
            <button type="button" style={ui.secondaryBtn} onClick={() => setEditMode(true)}>
              Edit
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div style={{ ...ui.notice, ...(notice.type === "ok" ? ui.noticeOk : ui.noticeErr) }}>
          {notice.message}
        </div>
      )}

      {/* Unit details */}
      <div style={ui.card}>
        <h2 style={ui.h2}>
          Unit Details
          <span style={{ ...ui.tag, ...(isBusy ? ui.tagBusy : ui.tagEmpty) }}>{occupancyLabel}</span>
        </h2>
        {editMode ? (
          <div style={{ marginBottom: "16px", display: "grid", gap: "12px", maxWidth: 420 }}>
            <div>
              <label style={ui.label}>Unit number</label>
              <input
                style={ui.input}
                value={editNumber}
                onChange={(e) => setEditNumber(e.target.value)}
                placeholder="e.g. Apt 3B"
              />
            </div>
            <div>
              <label style={ui.label}>Floor</label>
              <input
                style={ui.input}
                value={editFloor}
                onChange={(e) => setEditFloor(e.target.value)}
                placeholder="e.g. 3"
              />
            </div>
            <div>
              <label style={ui.label}>Type</label>
              <select
                style={ui.input}
                value={editType}
                onChange={(e) => setEditType(e.target.value)}
              >
                <option value="">— Select type —</option>
                <option value="RESIDENTIAL">Residential</option>
                <option value="COMMON_AREA">Common area</option>
              </select>
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: "16px" }}>
            <div style={ui.help}><strong>Unit number:</strong> {unit?.unitNumber || unit?.name || "—"}</div>
            {unit?.floor && <div style={ui.help}><strong>Floor:</strong> {unit.floor}</div>}
            {unit?.type && <div style={ui.help}><strong>Type:</strong> {unit.type}</div>}
          </div>
        )}
        <button type="button" style={ui.dangerBtn} onClick={onDeactivateUnit} disabled={loading}>
          Deactivate unit
        </button>
      </div>

      <div style={ui.tabRow}>
        {["Tenants", "Appliances", "Invoices", "Contracts"].map((tab) => (
          <button
            key={tab}
            type="button"
            style={{ ...ui.tabBtn, ...(activeTab === tab ? ui.tabActive : {}) }}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Appliances" && (
        <div style={ui.card}>
          <h2 style={ui.h2}>Appliances</h2>
          <div style={ui.list}>
            {appliances.length === 0 ? (
              <div style={ui.empty}>No appliances yet.</div>
            ) : (
              appliances.map((a) => (
                <div key={a.id} style={ui.listRow}>
                  <div>
                    <div style={ui.rowTitle}>
                      {a.name}
                      {a.category && <span style={ui.pill}>{a.category}</span>}
                    </div>
                    <div style={ui.help}>
                      {a.serial && <>SN: <code style={ui.codeSmall}>{a.serial}</code> • </>}
                      <code style={ui.codeSmall}>{a.id}</code>
                    </div>
                    {a.assetModel && (
                      <div style={ui.help}>
                        Model: <strong>{a.assetModel.name}</strong> {a.assetModel.category && `(${a.assetModel.category})`}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    style={ui.dangerBtn}
                    onClick={() => onDeactivateAppliance(a.id)}
                    disabled={loading}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>

          <div style={ui.actionPanel}>
            <div style={ui.actionHeader}>
              <div>
                <div style={ui.rowTitle}>Add appliance</div>
                <div style={ui.actionHint}>Create an appliance or manage models.</div>
              </div>
              {applianceAction ? (
                <button type="button" style={ui.secondaryBtn} onClick={() => setApplianceAction(null)}>
                  Close
                </button>
              ) : (
                <button type="button" style={ui.primaryBtn} onClick={() => setApplianceAction("menu")}>
                  Add
                </button>
              )}
            </div>

            {applianceAction === "menu" && (
              <div style={ui.actionOptions}>
                <button type="button" style={ui.actionOptionBtn} onClick={() => setApplianceAction("create")}> 
                  Create appliance
                  <div style={ui.actionHint}>Add a unit appliance with optional model.</div>
                </button>
                <button type="button" style={ui.actionOptionBtn} onClick={() => setApplianceAction("orgModels")}>
                  Your organization models
                  <div style={ui.actionHint}>Browse existing models.</div>
                </button>
              </div>
            )}

            {applianceAction === "create" && (
              <>
                <button type="button" style={ui.secondaryBtn} onClick={() => setApplianceAction("menu")}>
                  Back to options
                </button>
                <form onSubmit={onCreateAppliance} style={{ marginBottom: "8px" }}>
                  <div style={ui.grid2}>
                    <div>
                      <label style={ui.label}>Name</label>
                      <input
                        style={ui.input}
                        value={createApplianceName}
                        onChange={(e) => setCreateApplianceName(e.target.value)}
                        placeholder="e.g. Kitchen Sink"
                      />
                    </div>
                    <div>
                      <label style={ui.label}>Category</label>
                      <select
                        style={ui.input}
                        value={createApplianceCategory}
                        onChange={(e) => setCreateApplianceCategory(e.target.value)}
                      >
                        <option value="">— None —</option>
                        {ALLOWED_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={ui.label}>Serial (optional)</label>
                      <input
                        style={ui.input}
                        value={createApplianceSerial}
                        onChange={(e) => setCreateApplianceSerial(e.target.value)}
                        placeholder="Serial number"
                      />
                    </div>
                    <div>
                      <label style={ui.label}>Asset Model (optional)</label>
                      <select
                        style={ui.input}
                        value={createApplianceModel}
                        onChange={(e) => setCreateApplianceModel(e.target.value)}
                      >
                        <option value="">— None —</option>
                        {assetModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} {m.category ? `(${m.category})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button type="submit" style={ui.primaryBtn} disabled={loading}>
                    Create appliance
                  </button>
                </form>
              </>
            )}

            {applianceAction === "orgModels" && (
              <>
                <button type="button" style={ui.secondaryBtn} onClick={() => setApplianceAction("menu")}>
                  Back to options
                </button>
                <div style={ui.list}>
                  {orgModels.length === 0 ? (
                    <div style={ui.empty}>No organization models yet.</div>
                  ) : (
                    orgModels.map((m) => (
                      <div
                        key={m.id}
                        style={{ ...ui.listRow, cursor: "pointer" }}
                      >
                        <div>
                          <div style={ui.rowTitle}>
                            {m.name} {m.category && <span style={ui.pill}>{m.category}</span>}
                          </div>
                          <div style={ui.help}>
                            {m.manufacturer && <>Mfg: {m.manufacturer} • </>}
                            {m.model && <>Model: {m.model} • </>}
                            <code style={ui.codeSmall}>{m.id}</code>
                          </div>
                        </div>
                        <button
                          type="button"
                          style={ui.primaryBtn}
                          onClick={() => onCreateApplianceFromModel(m)}
                          disabled={creatingApplianceModelId === m.id}
                        >
                          {creatingApplianceModelId === m.id ? "Adding..." : "Add"}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === "Tenants" && (
        <div style={ui.card}>
          <h2 style={ui.h2}>Tenants</h2>
          <div style={ui.list}>
            {tenants.length === 0 ? (
              <div style={ui.empty}>No tenants assigned to this unit.</div>
            ) : (
              tenants.map((t) => (
                <div key={t.id} style={ui.listRow}>
                  <div>
                    <div style={ui.rowTitle}>{t.name || "Tenant"}</div>
                    <div style={ui.help}>Phone: {t.phone || "—"}</div>
                  </div>
                  <button
                    type="button"
                    style={ui.secondaryBtn}
                    onClick={() => onUnassignTenant(t.id)}
                    disabled={unassigningTenantId === t.id}
                  >
                    {unassigningTenantId === t.id ? "Removing..." : "Remove"}
                  </button>
                </div>
              ))
            )}
          </div>

          <div style={ui.actionPanel}>
            <div style={ui.actionHeader}>
              <div>
                <div style={ui.rowTitle}>Add tenant</div>
                <div style={ui.actionHint}>Assign an existing tenant or create a new one.</div>
              </div>
              {tenantAction ? (
                <button type="button" style={ui.secondaryBtn} onClick={() => setTenantAction(null)}>
                  Close
                </button>
              ) : (
                <button type="button" style={ui.primaryBtn} onClick={() => setTenantAction("menu")}>
                  Add
                </button>
              )}
            </div>

            {tenantAction === "menu" && (
              <div style={ui.actionOptions}>
                <button type="button" style={ui.actionOptionBtn} onClick={() => setTenantAction("assign")}>
                  Assign tenant
                  <div style={ui.actionHint}>Pick from existing tenants.</div>
                </button>
                <button type="button" style={ui.actionOptionBtn} onClick={() => setTenantAction("create")}>
                  Create new tenant + assign
                  <div style={ui.actionHint}>Enter name, phone, and email.</div>
                </button>
              </div>
            )}

            {tenantAction === "assign" && (
              <>
                <button type="button" style={ui.secondaryBtn} onClick={() => setTenantAction("menu")}>
                  Back to options
                </button>
                <form onSubmit={onAssignTenant} style={ui.formRow}>
                  <div style={{ minWidth: 280 }}>
                    <label style={ui.label}>Assign tenant</label>
                    <select
                      style={ui.input}
                      value={selectedTenantId}
                      onChange={(e) => setSelectedTenantId(e.target.value)}
                      disabled={assigningTenant}
                    >
                      <option value="">— Select tenant —</option>
                      {allTenants.map((t) => (
                        <option key={t.id} value={t.id} disabled={assignedTenantIds.has(t.id)}>
                          {t.name || "Tenant"} • {t.phone || "no phone"}
                          {assignedTenantIds.has(t.id) ? " (assigned)" : ""}
                        </option>
                      ))}
                    </select>
                    {allTenants.length === 0 && (
                      <div style={ui.help}>No tenants found in the system.</div>
                    )}
                  </div>
                  <button type="submit" style={ui.primaryBtn} disabled={assigningTenant || !selectedTenantId}>
                    Assign tenant
                  </button>
                </form>
              </>
            )}

            {tenantAction === "create" && (
              <>
                <button type="button" style={ui.secondaryBtn} onClick={() => setTenantAction("menu")}>
                  Back to options
                </button>
                <form onSubmit={onCreateTenant} style={ui.formRow}>
                  <div style={{ minWidth: 240 }}>
                    <label style={ui.label}>Name (optional)</label>
                    <input
                      style={ui.input}
                      value={createTenantName}
                      onChange={(e) => setCreateTenantName(e.target.value)}
                      placeholder="e.g. Jane Doe"
                    />
                  </div>
                  <div style={{ minWidth: 240 }}>
                    <label style={ui.label}>Phone</label>
                    <input
                      style={ui.input}
                      value={createTenantPhone}
                      onChange={(e) => setCreateTenantPhone(e.target.value)}
                      placeholder="+41 79 123 45 67"
                    />
                  </div>
                  <div style={{ minWidth: 240 }}>
                    <label style={ui.label}>Email (optional)</label>
                    <input
                      style={ui.input}
                      value={createTenantEmail}
                      onChange={(e) => setCreateTenantEmail(e.target.value)}
                      placeholder="tenant@example.com"
                    />
                  </div>
                  <button type="submit" style={ui.primaryBtn} disabled={creatingTenant}>
                    {creatingTenant ? "Creating..." : "Create + assign"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === "Invoices" && (
        <div style={ui.card}>
          <h2 style={ui.h2}>Invoices</h2>
          <div style={{ ...ui.empty, padding: "32px" }}>Empty for now.</div>
        </div>
      )}

      {activeTab === "Contracts" && (
        <div style={ui.card}>
          <h2 style={ui.h2}>Contracts</h2>
          <div style={{ ...ui.empty, padding: "32px" }}>Empty for now.</div>
        </div>
      )}
      </div>
    </AppShell>
  );
}
