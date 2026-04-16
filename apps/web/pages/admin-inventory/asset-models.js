import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import { ALLOWED_CATEGORIES } from "../../lib/categories";

import { cn } from "../../lib/utils";
export default function AssetModelsAdmin() {
    const ui = {
    page: "max-w-[1100px] mx-auto p-6 font-sans",
    headerRow: "flex items-center justify-between mb-6",
    h1: "text-4xl font-bold",
    h2: "text-2xl font-semibold mb-4",
    subtle: "text-slate-400 text-[0.95rem]",
    code: "bg-slate-100 px-1.5 py-0.5 rounded text-[0.95em] font-mono",
    codeSmall: "bg-slate-100 px-1 py-0.5 rounded text-sm font-mono",
    card: "bg-white border border-slate-200 rounded-lg p-5 mb-5",
    label: "block font-semibold mb-1.5 text-[0.95rem]",
    input: "px-3 py-2.5 rounded-lg border border-slate-300 w-full text-[0.95rem] box-border",
    primaryBtn: "px-5 py-2.5 rounded-lg border-none bg-blue-600 text-white cursor-pointer font-semibold text-[0.95rem] hover:bg-blue-700",
    secondaryBtn: "px-5 py-2.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 cursor-pointer font-medium text-[0.95rem]",
    dangerBtn: "px-5 py-2.5 rounded-lg border-none bg-red-600 text-white cursor-pointer font-semibold text-[0.95rem]",
    formRow: "flex gap-4 items-end mb-5",
    grid2: "grid grid-cols-2 gap-5 mb-5",
    list: "flex flex-col gap-3",
    listRow: "flex justify-between items-center p-3.5 border border-slate-200 rounded-lg bg-slate-50",
    rowTitle: "font-semibold text-base mb-1",
    help: "text-sm text-slate-500 mt-1",
    empty: "p-5 text-center text-slate-400 italic",
    notice: "px-4 py-3 rounded-lg mb-4 text-[0.95rem]",
    noticeOk: "bg-green-50 border border-green-400 text-green-700",
    noticeErr: "bg-red-50 border border-red-500 text-red-800",
    pill: "inline-block bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full text-xs ml-1.5",
    backLink: "text-blue-600 no-underline font-medium mb-5 inline-block",
    badge: "inline-block bg-slate-100 px-2 py-1 rounded text-xs text-slate-500 ml-2",
  };

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

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
    return <div className={ui.page}>Loading...</div>;
  }

  return (
    <AppShell role="MANAGER">
      <div className={ui.page}>
        <Link href="/admin-inventory" className={ui.backLink}>
          ← Back to Inventory
        </Link>

        <div className={ui.headerRow}>
          <h1 className={ui.h1}>Asset Models Library</h1>
        </div>

      {notice && (
        <div className={cn(ui.notice, notice.type === "ok" ? ui.noticeOk : ui.noticeErr)}>
          {notice.message}
        </div>
      )}

      {/* Create org-private model */}
      <div className={ui.card}>
        <h2 className={ui.h2}>Create New Model (Org-Private)</h2>

        <form onSubmit={onCreate}>
          <div className={ui.grid2}>
            <div>
              <label className={ui.label}>Name</label>
              <input
                className={ui.input}
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. Bosch Serie 6"
              />
            </div>
            <div>
              <label className={ui.label}>Category</label>
              <select
                className={ui.input}
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
              <label className={ui.label}>Manufacturer (optional)</label>
              <input
                className={ui.input}
                value={createManufacturer}
                onChange={(e) => setCreateManufacturer(e.target.value)}
                placeholder="e.g. Bosch"
              />
            </div>
            <div>
              <label className={ui.label}>Model (optional)</label>
              <input
                className={ui.input}
                value={createModel}
                onChange={(e) => setCreateModel(e.target.value)}
                placeholder="e.g. SME88TD00Z"
              />
            </div>
          </div>
          <button type="submit" className={ui.primaryBtn} disabled={loading}>
            Create model
          </button>
        </form>
      </div>

      {/* Global models (read-only) */}
      {globalModels.length > 0 && (
        <div className={ui.card}>
          <h2 className={ui.h2}>
            Global Models <span className={ui.badge}>Read-only</span>
          </h2>
          <div className={ui.list}>
            {globalModels.map((m) => (
              <div key={m.id} className={ui.listRow}>
                <div>
                  <div className={ui.rowTitle}>
                    {m.name} {m.category && <span className={ui.pill}>{m.category}</span>}
                  </div>
                  <div className={ui.help}>
                    {m.manufacturer && <>Mfg: {m.manufacturer} • </>}
                    {m.model && <>Model: {m.model} • </>}
                    <code className={ui.codeSmall}>{m.id}</code>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Org-private models (editable) */}
      {orgModels.length > 0 && (
        <div className={ui.card}>
          <h2 className={ui.h2}>Your Organization Models</h2>
          <div className={ui.list}>
            {orgModels.map((m) => (
              <div key={m.id} className={ui.listRow}>
                <div>
                  <div className={ui.rowTitle}>
                    {m.name} {m.category && <span className={ui.pill}>{m.category}</span>}
                  </div>
                  <div className={ui.help}>
                    {m.manufacturer && <>Mfg: {m.manufacturer} • </>}
                    {m.model && <>Model: {m.model} • </>}
                    <code className={ui.codeSmall}>{m.id}</code>
                  </div>
                </div>
                <button
                  type="button"
                  className={ui.dangerBtn}
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
        <div className={ui.card}>
          <div className={ui.empty}>No asset models yet.</div>
        </div>
      )}
      </div>
    </AppShell>
  );
}
