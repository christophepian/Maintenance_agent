import { useEffect, useState, useCallback, useMemo } from "react";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import { authHeaders } from "../../../lib/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the ASLOCA category from notes like "Chaudière (Chauffage) — ASLOCA/FRI 2007" */
function extractCategory(notes) {
  if (!notes) return null;
  const m = notes.match(/\(([^)]+)\)\s*[—–-]\s*ASLOCA/);
  return m ? m[1] : null;
}

/** Extract the French item name from notes */
function extractItemName(notes) {
  if (!notes) return null;
  const m = notes.match(/^(.+?)\s*\(/);
  return m ? m[1].trim() : notes.split("—")[0]?.trim() || null;
}

/** Human-friendly labels for AssetType enum */
const ASSET_TYPE_LABELS = {
  APPLIANCE: "Appliance",
  FIXTURE: "Fixture",
  FINISH: "Finish / Surface",
  STRUCTURAL: "Structural",
  SYSTEM: "System / Installation",
  OTHER: "Other",
};

/** Colours for asset type pills */
const ASSET_TYPE_COLORS = {
  APPLIANCE: "bg-violet-100 text-violet-700",
  FIXTURE: "bg-blue-100 text-blue-700",
  FINISH: "bg-amber-100 text-amber-700",
  STRUCTURAL: "bg-emerald-100 text-emerald-700",
  SYSTEM: "bg-rose-100 text-rose-700",
  OTHER: "bg-slate-100 text-slate-600",
};

/** Category display order (mirrors ASLOCA PDF sections 1–14) */
const CATEGORY_ORDER = [
  "Chauffage", "Eau chaude", "Cheminée", "Enveloppe", "Intérieurs",
  "Sols", "Cuisine", "Salle de bains", "Conduites", "Électricité",
  "Extérieurs", "Cave/grenier", "Ascenseur", "Commun",
];

/** Section numbers for display */
const CATEGORY_NUMBERS = {
  "Chauffage": "1", "Eau chaude": "2", "Cheminée": "3", "Enveloppe": "4",
  "Intérieurs": "5", "Sols": "6", "Cuisine": "7", "Salle de bains": "8",
  "Conduites": "9a", "Électricité": "9b", "Extérieurs": "10",
  "Cave/grenier": "11", "Ascenseur": "12", "Commun": "13",
};

/** French category → English subtitle */
const CATEGORY_SUBTITLES = {
  "Chauffage": "Heating / Ventilation / Air Conditioning",
  "Eau chaude": "Hot Water",
  "Cheminée": "Fireplaces",
  "Enveloppe": "Building Envelope (insulation, windows, roof)",
  "Intérieurs": "Ceilings / Walls / Doors / Woodwork",
  "Sols": "Floor Coverings",
  "Cuisine": "Kitchen",
  "Salle de bains": "Bathroom / Shower / WC",
  "Conduites": "Pipes & Plumbing",
  "Électricité": "TV / Radio / Electrical Installations",
  "Extérieurs": "Balconies / Awnings / Conservatories",
  "Cave/grenier": "Cellar & Attic",
  "Ascenseur": "Elevator",
  "Commun": "Common Installations",
};

const MAX_LIFE_YEARS = 50;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AssetTypePill({ type }) {
  const colors = ASSET_TYPE_COLORS[type] || ASSET_TYPE_COLORS.OTHER;
  const label = ASSET_TYPE_LABELS[type] || type;
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${colors}`}>
      {label}
    </span>
  );
}

function LifespanBar({ months }) {
  const years = months / 12;
  const pct = Math.min((years / MAX_LIFE_YEARS) * 100, 100);
  const color =
    years <= 10 ? "bg-red-400"
      : years <= 20 ? "bg-amber-400"
        : years <= 30 ? "bg-blue-400"
          : "bg-emerald-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded-full bg-slate-100 sm:w-32">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="whitespace-nowrap text-xs font-semibold text-slate-700">
        {Number.isInteger(years) ? years : years.toFixed(1)} yr
      </span>
    </div>
  );
}

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
  const num = CATEGORY_NUMBERS[category] || "–";
  const subtitle = CATEGORY_SUBTITLES[category] || "";
  return (
    <div className="rounded-lg border border-slate-100 bg-white shadow-sm">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">
            {num}
          </span>
          <div>
            <span className="text-sm font-semibold text-slate-800">{category}</span>
            {subtitle && <span className="ml-2 text-xs text-slate-400">{subtitle}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
            {items.length} items
          </span>
          <svg
            className={`h-4 w-4 text-slate-400 transition-transform ${collapsed ? "" : "rotate-180"}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {!collapsed && (
        <div className="border-t border-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-50 text-left text-[11px] font-medium uppercase tracking-wider text-slate-400">
                <th className="py-2 pl-4 pr-2">Item</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Useful Life</th>
                <th className="hidden px-2 py-2 lg:table-cell">Topic Key</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => {
                const itemName = extractItemName(s.notes) || s.topic;
                return (
                  <tr key={s.id} className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50">
                    <td className="py-2 pl-4 pr-2">
                      <span className="text-sm text-slate-700">{itemName}</span>
                    </td>
                    <td className="px-2 py-2"><AssetTypePill type={s.assetType} /></td>
                    <td className="px-2 py-2"><LifespanBar months={s.usefulLifeMonths} /></td>
                    <td className="hidden px-2 py-2 font-mono text-xs text-slate-400 lg:table-cell">{s.topic}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function DepreciationStandardsPage() {
  const [standards, setStandards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [collapsedCats, setCollapsedCats] = useState({});
  const [showCreate, setShowCreate] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/legal/depreciation-standards", { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to load standards");
      setStandards(data?.data || []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Enrich each standard with parsed category / item name
  const enriched = useMemo(() =>
    standards.map((s) => ({
      ...s,
      _category: extractCategory(s.notes) || "Other",
      _itemName: extractItemName(s.notes) || s.topic,
    })),
    [standards]
  );

  // Apply search + type filter
  const filtered = useMemo(() => {
    let result = enriched;
    if (typeFilter !== "ALL") result = result.filter((s) => s.assetType === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s._itemName.toLowerCase().includes(q) ||
          s.topic.toLowerCase().includes(q) ||
          s._category.toLowerCase().includes(q) ||
          (s.notes || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [enriched, typeFilter, search]);

  // Group by ASLOCA category, preserving PDF section order
  const grouped = useMemo(() => {
    const map = {};
    for (const s of filtered) {
      const cat = s._category;
      if (!map[cat]) map[cat] = [];
      map[cat].push(s);
    }
    const ordered = CATEGORY_ORDER.filter((c) => map[c]);
    const extras = Object.keys(map).filter((c) => !CATEGORY_ORDER.includes(c)).sort();
    return [...ordered, ...extras].map((cat) => ({
      category: cat,
      items: map[cat].sort((a, b) => a._itemName.localeCompare(b._itemName)),
    }));
  }, [filtered]);

  // Stats
  const aslocaCount = enriched.filter((s) => s.sourceId === "asloca-depreciation").length;
  const avgLifeYears = enriched.length
    ? (enriched.reduce((sum, s) => sum + s.usefulLifeMonths, 0) / enriched.length / 12).toFixed(1)
    : "–";
  const categoryCount = new Set(enriched.map((s) => s._category)).size;
  const assetTypes = useMemo(
    () => [...new Set(enriched.map((s) => s.assetType))].sort(),
    [enriched]
  );

  function toggleCat(cat) {
    setCollapsedCats((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }
  function expandAll() { setCollapsedCats({}); }
  function collapseAll() {
    const all = {};
    grouped.forEach((g) => { all[g.category] = true; });
    setCollapsedCats(all);
  }

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader
          title="Depreciation Standards"
          subtitle="Swiss industry-standard useful-life schedules — ASLOCA/FRI joint table (2007)"
          actions={
            <button
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              onClick={() => setShowCreate(!showCreate)}
            >
              {showCreate ? "Cancel" : "+ Add Standard"}
            </button>
          }
        />
        <PageContent>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {/* ── Stats cards ── */}
          {!loading && standards.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Total Items" value={enriched.length} sublabel={`${aslocaCount} from ASLOCA/FRI`} />
              <StatCard label="Categories" value={categoryCount} sublabel="Sections from official table" />
              <StatCard label="Avg. Lifespan" value={`${avgLifeYears} yr`} sublabel="Across all items" />
              <StatCard label="Source" value="ASLOCA/FRI" sublabel="Tableau paritaire 2007" />
            </div>
          )}

          {showCreate && (
            <CreateStandardForm onCreated={() => { setShowCreate(false); loadData(); }} onError={setError} />
          )}

          {/* ── Search & filters ── */}
          {!loading && standards.length > 0 && (
            <Panel>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[200px] flex-1">
                  <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search items… (e.g. cuisinière, parquet, radiateur)"
                    className="w-full rounded-lg border border-slate-200 py-2 pl-10 pr-3 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="ALL">All Types</option>
                  {assetTypes.map((t) => (
                    <option key={t} value={t}>{ASSET_TYPE_LABELS[t] || t}</option>
                  ))}
                </select>
                <div className="flex gap-1">
                  <button onClick={expandAll} className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50">Expand All</button>
                  <button onClick={collapseAll} className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50">Collapse All</button>
                </div>
                {(search || typeFilter !== "ALL") && (
                  <span className="text-xs text-slate-400">Showing {filtered.length} of {enriched.length}</span>
                )}
              </div>
            </Panel>
          )}

          {/* ── Main content ── */}
          {loading ? (
            <Panel><p className="text-sm text-slate-500">Loading depreciation standards…</p></Panel>
          ) : standards.length === 0 ? (
            <Panel>
              <p className="text-sm text-slate-500">
                No depreciation standards yet. Click <strong>"Sync Sources"</strong> on the{" "}
                <a href="/manager/legal" className="text-blue-600 underline">Legal Engine hub</a> to import the ASLOCA/FRI table.
              </p>
            </Panel>
          ) : filtered.length === 0 ? (
            <Panel><p className="text-sm text-slate-500">No items match your search. Try adjusting filters.</p></Panel>
          ) : (
            <div className="flex flex-col gap-2">
              {grouped.map(({ category, items }) => (
                <CategorySection
                  key={category}
                  category={category}
                  items={items}
                  collapsed={!!collapsedCats[category]}
                  onToggle={() => toggleCat(category)}
                />
              ))}
            </div>
          )}

          {/* ── Legend ── */}
          {!loading && standards.length > 0 && (
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="mb-2 text-xs font-semibold text-slate-500">Lifespan Legend</p>
              <div className="flex flex-wrap gap-4 text-[11px] text-slate-500">
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded-full bg-red-400" /> ≤ 10 years</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded-full bg-amber-400" /> 11–20 years</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded-full bg-blue-400" /> 21–30 years</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded-full bg-emerald-400" /> &gt; 30 years</span>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                Source: <em>Tableau paritaire des amortissements</em> — ASLOCA Fédération romande &amp; FRI, effective 1 March 2007.
                Section 14 commercial reductions: Offices −20%, Retail (low) −25%, Retail (high) −50%.
                {" "}
                <a href="https://www.asloca.ch/fiches-information" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
                  View original PDF ↗
                </a>
              </p>
            </div>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Create Form
// ---------------------------------------------------------------------------

function CreateStandardForm({ onCreated, onError }) {
  const [form, setForm] = useState({
    assetType: "APPLIANCE",
    topic: "",
    usefulLifeMonths: 120,
    authority: "INDUSTRY_STANDARD",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    onError("");
    try {
      const body = { ...form, usefulLifeMonths: parseInt(form.usefulLifeMonths) };
      const res = await fetch("/api/legal/depreciation-standards", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message || "Failed to create standard");
      }
      onCreated();
    } catch (e) {
      onError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="New Depreciation Standard">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Asset Type</span>
          <select className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm" value={form.assetType} onChange={(e) => setForm({ ...form, assetType: e.target.value })}>
            <option value="APPLIANCE">Appliance</option>
            <option value="FIXTURE">Fixture</option>
            <option value="FINISH">Finish / Surface</option>
            <option value="SYSTEM">System / Installation</option>
            <option value="STRUCTURAL">Structural</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Topic Key</span>
          <input className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="e.g. DISHWASHER, PARQUET_MOSAIC" required />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Useful Life (months)</span>
          <input type="number" className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm" value={form.usefulLifeMonths} onChange={(e) => setForm({ ...form, usefulLifeMonths: e.target.value })} min={1} required />
        </label>
        <div className="flex items-end">
          <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Creating…" : "Create Standard"}
          </button>
        </div>
      </form>
    </Panel>
  );
}
