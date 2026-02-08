import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "../../../components/AppShell";

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
    backLink: { color: "#0066cc", textDecoration: "none", fontWeight: 500, marginBottom: "20px", display: "inline-block" },
  };

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || "http://127.0.0.1:3001";

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
  const [createApplianceName, setCreateApplianceName] = useState("");
  const [createApplianceCategory, setCreateApplianceCategory] = useState("");
  const [createApplianceSerial, setCreateApplianceSerial] = useState("");
  const [createApplianceModel, setCreateApplianceModel] = useState("");

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

  async function loadUnit() {
    if (!id) return;
    try {
      const data = await fetchJSON(`/buildings/dummy/units`);
      const u = Array.isArray(data) ? data.find((x) => x.id === id) : data?.data?.find((x) => x.id === id);
      if (!u) {
        // Fallback: try to load from appliances endpoint which may return unit info
        setErr("Unit not found");
        return;
      }
      setUnit(u);
      setEditNumber(u.unitNumber || u.name || "");
    } catch (e) {
      // Ignore load errors; we'll still try to load appliances
    }
    await loadAppliances();
    await loadTenants();
    await loadAllTenants();
    await loadAssetModels();
    setLoading(false);
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
      setOk("Appliance created.");
    } catch (e) {
      setErr(`Create appliance failed: ${e.message}`);
    } finally {
      setLoading(false);
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
      setOk("Tenant created and assigned.");
    } catch (e) {
      setErr(`Create tenant failed: ${e.message}`);
    } finally {
      setCreatingTenant(false);
    }
  }

  const assignedTenantIds = new Set(tenants.map((t) => t.id));
  const availableTenants = allTenants.filter((t) => !assignedTenantIds.has(t.id));

  if (loading) {
    return <div style={ui.page}>Loading...</div>;
  }

  return (
    <AppShell role="MANAGER">
      <div style={ui.page}>
      <Link href="/admin-inventory" style={ui.backLink}>
        ← Back to Inventory
      </Link>

      <div style={ui.headerRow}>
        <div>
          <h1 style={ui.h1}>Unit {unit?.unitNumber || "Detail"}</h1>
          <div style={ui.subtle}><code style={ui.code}>{id}</code></div>
        </div>
      </div>

      {notice && (
        <div style={{ ...ui.notice, ...(notice.type === "ok" ? ui.noticeOk : ui.noticeErr) }}>
          {notice.message}
        </div>
      )}

      {/* Unit details */}
      <div style={ui.card}>
        <h2 style={ui.h2}>Unit Details</h2>
        <div style={{ marginBottom: "16px" }}>
          <div style={ui.help}><strong>Unit number:</strong> {unit?.unitNumber || unit?.name || "—"}</div>
          {unit?.type && <div style={ui.help}><strong>Type:</strong> {unit.type}</div>}
        </div>
        <button type="button" style={ui.dangerBtn} onClick={onDeactivateUnit} disabled={loading}>
          Deactivate unit
        </button>
      </div>

      {/* Appliances section */}
      <div style={ui.card}>
        <h2 style={ui.h2}>Appliances</h2>

        <form onSubmit={onCreateAppliance} style={{ marginBottom: "20px" }}>
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
              <input
                style={ui.input}
                value={createApplianceCategory}
                onChange={(e) => setCreateApplianceCategory(e.target.value)}
                placeholder="e.g. sink"
              />
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
      </div>

      {/* Tenants section */}
      <div style={ui.card}>
        <h2 style={ui.h2}>Tenants</h2>

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
              {availableTenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name || "Tenant"} • {t.phone}
                </option>
              ))}
            </select>
            {availableTenants.length === 0 && (
              <div style={ui.help}>No unassigned tenants available.</div>
            )}
          </div>
          <button type="submit" style={ui.primaryBtn} disabled={assigningTenant || !selectedTenantId}>
            Assign tenant
          </button>
        </form>

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
      </div>
      </div>
    </AppShell>
  );
}
