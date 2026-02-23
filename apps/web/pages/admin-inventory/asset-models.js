import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import { ALLOWED_CATEGORIES } from "../../lib/categories";

export default function AssetModelsAdmin() {
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
    badge: { display: "inline-block", background: "#f0f0f0", padding: "4px 8px", borderRadius: "4px", fontSize: "0.8rem", color: "#666", marginLeft: "8px" },
    backLink: { color: "#0066cc", textDecoration: "none", fontWeight: 500, marginBottom: "20px", display: "inline-block" },
  };

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || "http://127.0.0.1:3001";

  const [globalModels, setGlobalModels] = useState([]);
  const [orgModels, setOrgModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [createName, setCreateName] = useState("");
  const [createCategory, setCreateCategory] = useState(ALLOWED_CATEGORIES[0] || "");
  const [createManufacturer, setCreateManufacturer] = useState("");
  const [createModel, setCreateModel] = useState("");

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

  async function loadAssetModels() {
    try {
      setLoading(true);
      const data = await fetchJSON(`/asset-models`);
      const models = Array.isArray(data) ? data : data?.data || [];
      setGlobalModels(models.filter((m) => !m.orgId));
      setOrgModels(models.filter((m) => m.orgId));
    } catch (e) {
      setErr(`Failed to load asset models: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAssetModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreate(e) {
    e.preventDefault();
    if (!createName.trim()) return setErr("Name is required.");
    if (!createCategory) return setErr("Category is required.");

    try {
      setLoading(true);
      await fetchJSON(`/asset-models`, {
        method: "POST",
        body: JSON.stringify({
          name: createName,
          category: createCategory,
          manufacturer: createManufacturer || undefined,
          model: createModel || undefined,
        }),
      });
      setCreateName("");
      setCreateCategory(ALLOWED_CATEGORIES[0] || "");
      setCreateManufacturer("");
      setCreateModel("");
      await loadAssetModels();
      setOk("Asset model created.");
    } catch (e) {
      setErr(`Create failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function onDeactivate(modelId) {
    if (!confirm("Deactivate this asset model?")) return;
    try {
      await fetchJSON(`/asset-models/${modelId}`, { method: "DELETE" });
      await loadAssetModels();
      setOk("Asset model deactivated.");
    } catch (e) {
      setErr(`Deactivate failed: ${e.message}`);
    }
  }

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
          <h1 style={ui.h1}>Asset Models Library</h1>
        </div>

      {notice && (
        <div style={{ ...ui.notice, ...(notice.type === "ok" ? ui.noticeOk : ui.noticeErr) }}>
          {notice.message}
        </div>
      )}

      {/* Create org-private model */}
      <div style={ui.card}>
        <h2 style={ui.h2}>Create New Model (Org-Private)</h2>

        <form onSubmit={onCreate}>
          <div style={ui.grid2}>
            <div>
              <label style={ui.label}>Name</label>
              <input
                style={ui.input}
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. Bosch Serie 6"
              />
            </div>
            <div>
              <label style={ui.label}>Category</label>
              <select
                style={ui.input}
                value={createCategory}
                onChange={(e) => setCreateCategory(e.target.value)}
              >
                {ALLOWED_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={ui.label}>Manufacturer (optional)</label>
              <input
                style={ui.input}
                value={createManufacturer}
                onChange={(e) => setCreateManufacturer(e.target.value)}
                placeholder="e.g. Bosch"
              />
            </div>
            <div>
              <label style={ui.label}>Model (optional)</label>
              <input
                style={ui.input}
                value={createModel}
                onChange={(e) => setCreateModel(e.target.value)}
                placeholder="e.g. SME88TD00Z"
              />
            </div>
          </div>
          <button type="submit" style={ui.primaryBtn} disabled={loading}>
            Create model
          </button>
        </form>
      </div>

      {/* Global models (read-only) */}
      {globalModels.length > 0 && (
        <div style={ui.card}>
          <h2 style={ui.h2}>
            Global Models <span style={ui.badge}>Read-only</span>
          </h2>
          <div style={ui.list}>
            {globalModels.map((m) => (
              <div key={m.id} style={ui.listRow}>
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
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Org-private models (editable) */}
      {orgModels.length > 0 && (
        <div style={ui.card}>
          <h2 style={ui.h2}>Your Organization Models</h2>
          <div style={ui.list}>
            {orgModels.map((m) => (
              <div key={m.id} style={ui.listRow}>
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
                  style={ui.dangerBtn}
                  onClick={() => onDeactivate(m.id)}
                  disabled={loading}
                >
                  Deactivate
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {globalModels.length === 0 && orgModels.length === 0 && (
        <div style={ui.card}>
          <div style={ui.empty}>No asset models yet.</div>
        </div>
      )}
      </div>
    </AppShell>
  );
}
