import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "../../../components/AppShell";

export default function BuildingDetail() {
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

  const [building, setBuilding] = useState(null);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [createUnitName, setCreateUnitName] = useState("");
  const [createUnitType, setCreateUnitType] = useState("RESIDENTIAL");

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
    } catch (e) {
      setErr(`Failed to load building: ${e.message}`);
    } finally {
      setLoading(false);
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

  if (loading && !building) {
    return <div style={ui.page}>Loading...</div>;
  }

  if (!building) {
    return <div style={ui.page}>Building not found.</div>;
  }

  const residentialUnits = units.filter((u) => u.type === "RESIDENTIAL" || !u.type);
  const commonUnits = units.filter((u) => u.type === "COMMON_AREA");

  return (
    <AppShell role="MANAGER">
      <div style={ui.page}>
      <Link href="/admin-inventory" style={ui.backLink}>
        ← Back to Inventory
      </Link>

      <div style={ui.headerRow}>
        <div>
          <h1 style={ui.h1}>{building.name}</h1>
          {building.address && <div style={ui.subtle}>{building.address}</div>}
        </div>
      </div>

      {notice && (
        <div style={{ ...ui.notice, ...(notice.type === "ok" ? ui.noticeOk : ui.noticeErr) }}>
          {notice.message}
        </div>
      )}

      {/* Building details card */}
      <div style={ui.card}>
        <h2 style={ui.h2}>Building Details</h2>
        {editMode ? (
          <form onSubmit={onUpdateBuilding}>
            <div style={ui.grid2}>
              <div>
                <label style={ui.label}>Name</label>
                <input
                  style={ui.input}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Building name"
                />
              </div>
              <div>
                <label style={ui.label}>Address (optional)</label>
                <input
                  style={ui.input}
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="Address"
                />
              </div>
            </div>
            <div style={ui.formRow}>
              <button type="submit" style={ui.primaryBtn} disabled={loading}>
                Save changes
              </button>
              <button type="button" style={ui.secondaryBtn} onClick={() => setEditMode(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <div style={{ marginBottom: "16px" }}>
              <div style={ui.help}><strong>Name:</strong> {building.name}</div>
              {building.address && <div style={ui.help}><strong>Address:</strong> {building.address}</div>}
            </div>
            <div style={ui.formRow}>
              <button type="button" style={ui.secondaryBtn} onClick={() => setEditMode(true)}>
                Edit
              </button>
              <button type="button" style={ui.dangerBtn} onClick={onDeactivateBuilding} disabled={loading}>
                Deactivate
              </button>
            </div>
          </>
        )}
      </div>

      {/* Units section */}
      <div style={ui.card}>
        <h2 style={ui.h2}>Units</h2>
        <form onSubmit={onCreateUnit} style={ui.formRow}>
          <div style={{ flex: 1 }}>
            <label style={ui.label}>New unit number/label</label>
            <input
              style={ui.input}
              value={createUnitName}
              onChange={(e) => setCreateUnitName(e.target.value)}
              placeholder="e.g. 101, 3B, Common Area 1"
            />
          </div>
          <div>
            <label style={ui.label}>Type</label>
            <select
              style={ui.input}
              value={createUnitType}
              onChange={(e) => setCreateUnitType(e.target.value)}
            >
              <option value="RESIDENTIAL">Residential</option>
              <option value="COMMON_AREA">Common Area</option>
            </select>
          </div>
          <button type="submit" style={ui.primaryBtn} disabled={loading}>
            Create unit
          </button>
        </form>

        {residentialUnits.length > 0 && (
          <>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginTop: "20px", marginBottom: "12px" }}>
              Residential Units
            </h3>
            <div style={ui.list}>
              {residentialUnits.map((u) => (
                <Link key={u.id} href={`/admin-inventory/units/${u.id}`} style={{ textDecoration: "none", display: "block" }}>
                    <div style={ui.listRow}>
                      <div>
                        <div style={ui.rowTitle}>{u.unitNumber || u.name || "Unit"}</div>
                        <div style={ui.help}><code style={ui.codeSmall}>{u.id}</code></div>
                      </div>
                      <span style={{ color: "#0066cc" }}>→</span>
                    </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {commonUnits.length > 0 && (
          <>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginTop: "20px", marginBottom: "12px" }}>
              Common Areas
            </h3>
            <div style={ui.list}>
              {commonUnits.map((u) => (
                <Link key={u.id} href={`/admin-inventory/units/${u.id}`} style={{ textDecoration: "none", display: "block" }}>
                  <div style={ui.listRow}>
                    <div>
                      <div style={ui.rowTitle}>{u.unitNumber || u.name || "Common Area"}</div>
                      <div style={ui.help}><code style={ui.codeSmall}>{u.id}</code></div>
                    </div>
                    <span style={{ color: "#0066cc" }}>→</span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {units.length === 0 && <div style={ui.empty}>No units yet.</div>}
      </div>
      </div>
    </AppShell>
  );
}
