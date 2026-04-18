import { useState, useMemo } from "react";
import Panel from "./layout/Panel";
import Badge from "./ui/Badge";
import ErrorBanner from "./ui/ErrorBanner";
import { cn } from "../lib/utils";
import { ALLOWED_CATEGORIES } from "../lib/categories";
import { authHeaders } from "../lib/api";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({ label, value, sublabel }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white px-4 py-3 shadow-sm">
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      {sublabel && <p className="mt-0.5 text-[11px] text-slate-400">{sublabel}</p>}
    </div>
  );
}

function CategorySection({ category, items, collapsed, onToggle }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
      >
        <span className="text-sm font-semibold text-slate-800 capitalize">{category || "Uncategorised"}</span>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
            {items.length} {items.length === 1 ? "model" : "models"}
          </span>
          <svg
            className={cn("h-4 w-4 text-slate-400 transition-transform", collapsed ? "" : "rotate-180")}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {!collapsed && (
        <div className="border-t border-slate-100">
          <table className="inline-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Manufacturer</th>
                <th>Model ref.</th>
                <th>Scope</th>
                <th>Useful Life</th>
                <th>Replace Cost</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id}>
                  <td className="cell-bold">{m.name}</td>
                  <td>{m.manufacturer || "—"}</td>
                  <td className="font-mono text-xs">{m.model || "—"}</td>
                  <td>
                    <Badge variant={m.orgId ? "brand" : "muted"} size="sm">
                      {m.orgId ? "Org" : "Global"}
                    </Badge>
                  </td>
                  <td>{m.usefulLifeMonths ? `${Math.round(m.usefulLifeMonths / 12)} yr` : "—"}</td>
                  <td>{typeof m.replacementCostChf === "number" ? `CHF ${m.replacementCostChf.toLocaleString()}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function AssetCatalogue({ models = [], loading = false, onRefresh }) {
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("ALL");
  const [collapsedCats, setCollapsedCats] = useState({});

  // Create form state
  const [formVisible, setFormVisible] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createCategory, setCreateCategory] = useState(ALLOWED_CATEGORIES[0] || "");
  const [createManufacturer, setCreateManufacturer] = useState("");
  const [createModel, setCreateModel] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  async function onCreateModel(e) {
    e.preventDefault();
    if (!createName.trim()) return setCreateError("Name is required.");
    if (!createCategory) return setCreateError("Category is required.");
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/asset-models", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          name: createName.trim(),
          category: createCategory,
          ...(createManufacturer.trim() ? { manufacturer: createManufacturer.trim() } : {}),
          ...(createModel.trim() ? { model: createModel.trim() } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to create model");
      setCreateName("");
      setCreateCategory(ALLOWED_CATEGORIES[0] || "");
      setCreateManufacturer("");
      setCreateModel("");
      setFormVisible(false);
      onRefresh?.();
    } catch (e) {
      setCreateError(String(e?.message || e));
    } finally {
      setCreating(false);
    }
  }

  // Apply search + scope filter
  const filtered = useMemo(() => {
    let result = models;
    if (scopeFilter === "ORG") result = result.filter((m) => m.orgId);
    if (scopeFilter === "GLOBAL") result = result.filter((m) => !m.orgId);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          (m.name || "").toLowerCase().includes(q) ||
          (m.category || "").toLowerCase().includes(q) ||
          (m.manufacturer || "").toLowerCase().includes(q) ||
          (m.model || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [models, scopeFilter, search]);

  // Group by category, alphabetical within each group
  const grouped = useMemo(() => {
    const map = {};
    for (const m of filtered) {
      const cat = m.category || "uncategorised";
      if (!map[cat]) map[cat] = [];
      map[cat].push(m);
    }
    return Object.keys(map)
      .sort()
      .map((cat) => ({
        category: cat,
        items: map[cat].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
      }));
  }, [filtered]);

  const allCats = useMemo(() => grouped.map((g) => g.category), [grouped]);

  function toggleCat(cat) { setCollapsedCats((prev) => ({ ...prev, [cat]: !prev[cat] })); }
  function expandAll() { setCollapsedCats(Object.fromEntries(allCats.map((c) => [c, false]))); }
  function collapseAll() { setCollapsedCats(Object.fromEntries(allCats.map((c) => [c, true]))); }
  function isCollapsed(cat) { return collapsedCats[cat] !== false; }

  // Stats
  const orgCount = models.filter((m) => m.orgId).length;
  const globalCount = models.filter((m) => !m.orgId).length;
  const categoryCount = new Set(models.map((m) => m.category || "uncategorised")).size;

  if (loading) {
    return <Panel><p className="loading-text">Loading asset models…</p></Panel>;
  }

  return (
    <div className="space-y-4">
      {/* ── Stats ── */}
      {models.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Total Models" value={models.length} sublabel={`${categoryCount} categories`} />
          <StatCard label="Org-Private" value={orgCount} sublabel="Editable by your org" />
          <StatCard label="Global Library" value={globalCount} sublabel="Shared read-only models" />
        </div>
      )}

      {/* ── Search, filters & Add button ── */}
      <Panel>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search models… (e.g. Bosch, dishwasher)"
              className="w-full rounded-lg border border-slate-200 py-2 pl-10 pr-3 text-sm focus:border-brand-ring focus:outline-none focus:ring-1 focus:ring-brand-ring"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
          >
            <option value="ALL">All scopes</option>
            <option value="ORG">Org-private</option>
            <option value="GLOBAL">Global library</option>
          </select>
          <div className="flex gap-1">
            <button type="button" onClick={expandAll} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50">Expand All</button>
            <button type="button" onClick={collapseAll} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50">Collapse All</button>
          </div>
          {(search || scopeFilter !== "ALL") && (
            <span className="text-xs text-slate-400">Showing {filtered.length} of {models.length}</span>
          )}
          <button
            type="button"
            className="button-primary ml-auto shrink-0"
            onClick={() => { setFormVisible((v) => !v); setCreateError(""); }}
          >
            {formVisible ? "Cancel" : "Add"}
          </button>
        </div>

        {/* ── Inline creation form ── */}
        {formVisible && (
          <form onSubmit={onCreateModel} className="mt-4 rounded-xl border border-brand bg-brand-light/30 p-4">
            <ErrorBanner error={createError} className="mb-3 text-sm" />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="filter-label">Name</label>
                <input
                  className="filter-input w-full"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Bosch Serie 6"
                  required
                />
              </div>
              <div>
                <label className="filter-label">Category</label>
                <select
                  className="filter-input w-full"
                  value={createCategory}
                  onChange={(e) => setCreateCategory(e.target.value)}
                >
                  {ALLOWED_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="filter-label">Manufacturer <span className="font-normal text-slate-400">(optional)</span></label>
                <input
                  className="filter-input w-full"
                  value={createManufacturer}
                  onChange={(e) => setCreateManufacturer(e.target.value)}
                  placeholder="e.g. Bosch"
                />
              </div>
              <div>
                <label className="filter-label">Model ref. <span className="font-normal text-slate-400">(optional)</span></label>
                <input
                  className="filter-input w-full"
                  value={createModel}
                  onChange={(e) => setCreateModel(e.target.value)}
                  placeholder="e.g. SME88TD00Z"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button type="button" className="button-secondary" onClick={() => setFormVisible(false)}>Cancel</button>
              <button type="submit" className="button-primary" disabled={creating}>
                {creating ? "Saving…" : "Save model"}
              </button>
            </div>
          </form>
        )}
      </Panel>

      {/* ── Grouped sections ── */}
      {models.length === 0 ? (
        <Panel>
          <div className="empty-state">
            <p className="empty-state-text">No asset models yet. Use the Add button above to create your first model.</p>
          </div>
        </Panel>
      ) : grouped.length === 0 ? (
        <Panel><p className="empty-state-text">No models match your search. Try adjusting filters.</p></Panel>
      ) : (
        <div className="flex flex-col gap-2">
          {grouped.map(({ category, items }) => (
            <CategorySection
              key={category}
              category={category}
              items={items}
              collapsed={isCollapsed(category)}
              onToggle={() => toggleCat(category)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
