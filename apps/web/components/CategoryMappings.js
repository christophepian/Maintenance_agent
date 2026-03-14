import { useEffect, useState, useCallback } from "react";
import Panel from "./layout/Panel";
import Link from "next/link";
import { authHeaders } from "../lib/api";

// ── Plain-language labels ─────────────────────────────────────

const CATEGORY_META = {
  stove:       { icon: "\u{1F525}", label: "Stove & Cooktop" },
  oven:        { icon: "\u{1F373}", label: "Oven" },
  dishwasher:  { icon: "\u{1FAE7}", label: "Dishwasher" },
  bathroom:    { icon: "\u{1F6BF}", label: "Bathroom" },
  lighting:    { icon: "\u{1F4A1}", label: "Lighting" },
  plumbing:    { icon: "\u{1F527}", label: "Plumbing" },
  other:       { icon: "\u{1F4CB}", label: "Other / General" },
};

function meta(cat) {
  return CATEGORY_META[cat] || { icon: "\u{1F4CB}", label: cat };
}

const TOPIC_FRIENDLY = {
  STOVE_COOKTOP: "Stove & Cooktop",
  OVEN_APPLIANCE: "Oven Appliance",
  DISHWASHER: "Dishwasher",
  BATHROOM_PLUMBING: "Bathroom & Plumbing",
  LIGHTING_ELECTRICAL: "Lighting & Electrical",
  PLUMBING_WATER: "Plumbing & Water Systems",
  GENERAL_MAINTENANCE: "General Maintenance",
};

function friendlyTopic(topic) {
  return TOPIC_FRIENDLY[topic] || topic?.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) || "\u2014";
}

const CURATED_TOPICS = [
  { value: "STOVE_COOKTOP", label: "Stove & Cooktop" },
  { value: "OVEN_APPLIANCE", label: "Oven Appliance" },
  { value: "DISHWASHER", label: "Dishwasher" },
  { value: "BATHROOM_PLUMBING", label: "Bathroom & Plumbing" },
  { value: "LIGHTING_ELECTRICAL", label: "Lighting & Electrical" },
  { value: "PLUMBING_WATER", label: "Plumbing & Water Systems" },
  { value: "GENERAL_MAINTENANCE", label: "General Maintenance" },
];

// ── Main Component ────────────────────────────────────────────

export default function CategoryMappings() {
  const [coverage, setCoverage] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editTopic, setEditTopic] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/legal/category-mappings/coverage", { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to load");
      setCoverage(data?.data || []);
      setSummary(data?.summary || null);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function toggleActive(mappingId, currentlyActive) {
    try {
      const res = await fetch(`/api/legal/category-mappings/${mappingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ isActive: !currentlyActive }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d?.error?.message || "Failed"); }
      await loadData();
    } catch (e) { setError(String(e?.message || e)); }
  }

  async function saveTopicOverride(mappingId) {
    if (!editTopic) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/legal/category-mappings/${mappingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ legalTopic: editTopic }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d?.error?.message || "Failed"); }
      setEditingId(null);
      await loadData();
    } catch (e) { setError(String(e?.message || e)); }
    finally { setSaving(false); }
  }

  async function resetToDefault(mappingId, category) {
    if (!confirm(`Reset "${meta(category).label}" to the system default? Your custom override will be removed.`)) return;
    try {
      const res = await fetch(`/api/legal/category-mappings/${mappingId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d?.error?.message || "Failed"); }
      await loadData();
    } catch (e) { setError(String(e?.message || e)); }
  }

  async function createMapping(requestCategory, legalTopic) {
    try {
      const res = await fetch("/api/legal/category-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ requestCategory, legalTopic }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d?.error?.message || "Failed to create"); }
      setShowAddForm(false);
      await loadData();
    } catch (e) { setError(String(e?.message || e)); }
  }

  const mappedCount = summary?.mappedCategories || 0;
  const totalCount = summary?.totalCategories || 0;
  const allMapped = mappedCount === totalCount && totalCount > 0;
  const unmappedCategories = coverage.filter(c => !c.mapped);

  return (
    <>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button className="ml-2 underline" onClick={() => setError("")}>dismiss</button>
        </div>
      )}

      {summary && !loading && (
        <StatusBanner allMapped={allMapped} mappedCount={mappedCount} totalCount={totalCount} />
      )}

      <HowItWorks />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <span className="ml-3 text-sm text-slate-500">Loading categories&hellip;</span>
        </div>
      ) : coverage.length === 0 ? (
        <Panel>
          <div className="empty-state">
            <p className="empty-state-text">
              No categories found yet. Once tenants start submitting maintenance requests, their categories will appear here.
            </p>
          </div>
        </Panel>
      ) : (
        <div className="space-y-4">
          {coverage.map((c) => (
            <CategoryCard
              key={c.category}
              data={c}
              isEditing={editingId === c.mappingId}
              editTopic={editTopic}
              saving={saving}
              onStartEdit={() => { setEditingId(c.mappingId); setEditTopic(c.legalTopic); }}
              onCancelEdit={() => setEditingId(null)}
              onChangeTopic={setEditTopic}
              onSaveEdit={() => saveTopicOverride(c.mappingId)}
              onToggle={() => toggleActive(c.mappingId, c.isActive)}
              onReset={() => resetToDefault(c.mappingId, c.category)}
            />
          ))}
        </div>
      )}

      {unmappedCategories.length > 0 && (
        <AddCategorySection
          unmapped={unmappedCategories}
          showForm={showAddForm}
          onToggleForm={() => setShowAddForm(!showAddForm)}
          onCreate={createMapping}
          onError={setError}
        />
      )}
    </>
  );
}

// ── Status Banner ─────────────────────────────────────────────

function StatusBanner({ allMapped, mappedCount, totalCount }) {
  if (allMapped) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
        <span className="mt-0.5 text-xl">&#x2705;</span>
        <div>
          <p className="text-sm font-semibold text-green-800">All {totalCount} categories are connected to Swiss law</p>
          <p className="mt-0.5 text-xs text-green-700">
            When a tenant submits a maintenance request, the legal engine will automatically look up
            depreciation standards and rent reduction rules for every category.
          </p>
        </div>
      </div>
    );
  }
  const unmapped = totalCount - mappedCount;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <span className="mt-0.5 text-xl">&#x26A0;&#xFE0F;</span>
      <div>
        <p className="text-sm font-semibold text-amber-800">
          {unmapped} of {totalCount} {unmapped === 1 ? "category isn\u2019t" : "categories aren\u2019t"} connected to Swiss law yet
        </p>
        <p className="mt-0.5 text-xs text-amber-700">
          The legal engine can&apos;t find depreciation standards or rent reduction rules for unmapped categories.
          Scroll down to set them up.
        </p>
      </div>
    </div>
  );
}

// ── How It Works ──────────────────────────────────────────────

function HowItWorks() {
  return (
    <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">What does a mapping do?</h3>
      <p className="mb-4 text-xs leading-relaxed text-slate-600">
        Each mapping connects a <strong>maintenance category</strong> (what the tenant sees) to a <strong>legal topic</strong> (what the engine searches).
        When a tenant reports an issue &mdash; say, a broken dishwasher &mdash; the engine uses the mapping to find two things:
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex gap-3 rounded-lg border border-slate-100 bg-white p-3">
          <span className="text-lg">&#x1F4CA;</span>
          <div>
            <p className="text-xs font-semibold text-slate-700">Depreciation standards</p>
            <p className="text-[11px] leading-relaxed text-slate-500">
              How old is the item and what&apos;s its expected lifespan? This determines who pays for repairs &mdash; the tenant or the landlord.
            </p>
          </div>
        </div>
        <div className="flex gap-3 rounded-lg border border-slate-100 bg-white p-3">
          <span className="text-lg">&#x2696;&#xFE0F;</span>
          <div>
            <p className="text-xs font-semibold text-slate-700">Rent reduction rules</p>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Is the tenant entitled to a rent reduction while the issue isn&apos;t fixed? Swiss law defines specific percentages per defect type.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Category Card ─────────────────────────────────────────────

function CategoryCard({
  data: c,
  isEditing, editTopic, saving,
  onStartEdit, onCancelEdit, onChangeTopic, onSaveEdit,
  onToggle, onReset,
}) {
  const { icon, label } = meta(c.category);
  const [expanded, setExpanded] = useState(false);
  const isOrgOverride = c.scope === "org";

  if (!c.mapped) {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-5">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <p className="text-sm font-semibold text-slate-700">{label}</p>
            <p className="text-xs text-slate-500">
              Not connected &mdash; the engine can&apos;t look up legal references for this category yet.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const hasDepreciation = c.depreciationCount > 0;
  const hasRules = c.ruleCount > 0;
  const isDisabled = c.isActive === false;

  return (
    <div className={`rounded-xl border bg-white shadow-sm transition-all hover:shadow-md ${isDisabled ? "border-slate-200 opacity-60" : "border-slate-200"}`}>
      <div className="flex items-start justify-between p-5 pb-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800">{label}</h3>
              {isOrgOverride && (
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-600">
                  Custom override
                </span>
              )}
              {isDisabled && (
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                  Disabled
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Connected to <span className="font-medium text-slate-700">{friendlyTopic(c.legalTopic)}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {isOrgOverride && (
            <button onClick={onReset} className="rounded-lg px-2 py-1 text-[11px] font-medium text-slate-400 hover:bg-slate-50 hover:text-slate-600" title="Remove your override and use the system default">Reset</button>
          )}
          <button onClick={onStartEdit} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Change the legal topic for this category"><PencilIcon /></button>
          <button
            onClick={onToggle}
            className={`rounded-lg p-1.5 transition-colors ${c.isActive ? "text-green-500 hover:bg-green-50 hover:text-green-700" : "text-slate-300 hover:bg-slate-100 hover:text-slate-500"}`}
            title={c.isActive ? "Active \u2014 the engine uses this mapping. Click to disable." : "Disabled \u2014 the engine skips this mapping. Click to re-enable."}
          >
            <ToggleIcon active={c.isActive} />
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="mx-5 mt-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
          <p className="mb-2 text-xs font-medium text-blue-800">
            Change what the engine searches when a tenant reports a &ldquo;{label.toLowerCase()}&rdquo; issue:
          </p>
          <div className="flex gap-2">
            <select className="flex-1 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" value={editTopic} onChange={(e) => onChangeTopic(e.target.value)}>
              {CURATED_TOPICS.map(t => (<option key={t.value} value={t.value}>{t.label}</option>))}
            </select>
            <button onClick={onSaveEdit} disabled={saving} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">{saving ? "Saving\u2026" : "Save"}</button>
            <button onClick={onCancelEdit} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      )}

      <div className="p-5 pt-3">
        <p className="mb-3 text-xs leading-relaxed text-slate-500">
          When a tenant reports a <strong className="text-slate-700">{label.toLowerCase()}</strong> issue, the engine checks:
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <DepreciationBox c={c} hasDepreciation={hasDepreciation} />
          <RentReductionBox c={c} hasRules={hasRules} />
        </div>

        {(c.depreciationSamples?.length > 0 || c.ruleSamples?.length > 0) && (
          <button onClick={() => setExpanded(!expanded)} className="mt-3 text-[11px] font-medium text-slate-400 hover:text-slate-600">
            {expanded ? "\u25BE Hide technical details" : "\u25B8 Show technical details"}
          </button>
        )}
        {expanded && <TechnicalDetails c={c} />}
      </div>
    </div>
  );
}

function DepreciationBox({ c, hasDepreciation }) {
  return (
    <div className={`rounded-lg border p-3 ${hasDepreciation ? "border-emerald-100 bg-emerald-50/50" : "border-slate-100 bg-slate-50/50"}`}>
      <div className="flex items-center gap-2">
        <span className="text-sm">&#x1F4CA;</span>
        <span className={`text-xs font-semibold ${hasDepreciation ? "text-emerald-800" : "text-slate-500"}`}>Depreciation</span>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${hasDepreciation ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
          {c.depreciationCount} {c.depreciationCount === 1 ? "item" : "items"}
        </span>
      </div>
      {hasDepreciation ? (
        <div className="mt-2">
          <p className="text-[11px] leading-relaxed text-emerald-700">
            Covers items like <strong>{c.readableAssets?.slice(0, 3).join(", ")}</strong>
            {c.readableAssets?.length > 3 && <span> and {c.readableAssets.length - 3} more</span>}.
            {c.lifespanRange && (<> Expected lifespans: <strong>{c.lifespanRange}</strong>.</>)}
          </p>
          <p className="mt-1 text-[10px] text-emerald-600">&rarr; Determines who pays: landlord (if past lifespan) or shared cost</p>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-slate-400">No depreciation data for this topic. Cost-sharing can&apos;t be calculated automatically.</p>
      )}
    </div>
  );
}

function RentReductionBox({ c, hasRules }) {
  return (
    <div className={`rounded-lg border p-3 ${hasRules ? "border-blue-100 bg-blue-50/50" : "border-slate-100 bg-slate-50/50"}`}>
      <div className="flex items-center gap-2">
        <span className="text-sm">&#x2696;&#xFE0F;</span>
        <span className={`text-xs font-semibold ${hasRules ? "text-blue-800" : "text-slate-500"}`}>Rent Reduction</span>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${hasRules ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400"}`}>
          {c.ruleCount} {c.ruleCount === 1 ? "rule" : "rules"}
        </span>
      </div>
      {hasRules ? (
        <div className="mt-2">
          <p className="text-[11px] leading-relaxed text-blue-700">
            Rules for: <strong>{c.readableRules?.slice(0, 3).join(", ")}</strong>
            {c.readableRules?.length > 3 && <span> and {c.readableRules.length - 3} more</span>}.
          </p>
          <p className="mt-1 text-[10px] text-blue-600">&rarr; Tells you if the tenant can claim a rent reduction while unfixed</p>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-slate-400">No specific rent reduction rules. The tenant can&apos;t auto-claim a reduction for this type.</p>
      )}
    </div>
  );
}

function TechnicalDetails({ c }) {
  return (
    <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
      <div className="grid gap-4 sm:grid-cols-2">
        {c.depreciationSamples?.length > 0 && (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Depreciation Standards ({c.depreciationCount})
            </p>
            {c.depreciationSamples.map((d, i) => (
              <div key={i} className="flex items-center justify-between py-0.5 text-[11px] text-slate-600">
                <span>{d.topic.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, ch => ch.toUpperCase())}</span>
                <span className="text-slate-400">{Math.round(d.usefulLifeMonths / 12)} yr</span>
              </div>
            ))}
            {c.depreciationCount > c.depreciationSamples.length && (
              <p className="mt-1 text-[10px] text-slate-400">+ {c.depreciationCount - c.depreciationSamples.length} more</p>
            )}
          </div>
        )}
        {c.ruleSamples?.length > 0 && (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Rent Reduction Rules ({c.ruleCount})
            </p>
            {c.ruleSamples.map((key, i) => (
              <div key={i} className="py-0.5 text-[11px] text-slate-600">
                {key.replace(/^CH_RENT_RED_/, "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, ch => ch.toUpperCase())}
              </div>
            ))}
            {c.ruleCount > c.ruleSamples.length && (
              <p className="mt-1 text-[10px] text-slate-400">+ {c.ruleCount - c.ruleSamples.length} more</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Add Category Section ──────────────────────────────────────

function AddCategorySection({ unmapped, showForm, onToggleForm, onCreate, onError }) {
  const [selectedCat, setSelectedCat] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate(e) {
    e.preventDefault();
    if (!selectedCat || !selectedTopic) return;
    setSaving(true);
    onError("");
    try {
      await onCreate(selectedCat, selectedTopic);
      setSelectedCat("");
      setSelectedTopic("");
    } catch (err) {
      onError(String(err?.message || err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg">&#x1F517;</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {unmapped.length} {unmapped.length === 1 ? "category needs" : "categories need"} a mapping
            </p>
            <p className="text-xs text-amber-700">
              {unmapped.map(u => meta(u.category).label).join(", ")}
            </p>
          </div>
        </div>
        <button onClick={onToggleForm} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700">
          {showForm ? "Cancel" : "Set up mapping"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="text-xs font-medium text-slate-600">Category</span>
            <select className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-200" value={selectedCat} onChange={e => setSelectedCat(e.target.value)} required>
              <option value="">Select&hellip;</option>
              {unmapped.map(u => (<option key={u.category} value={u.category}>{meta(u.category).icon} {meta(u.category).label}</option>))}
            </select>
          </label>
          <label className="flex-1">
            <span className="text-xs font-medium text-slate-600">Connect to legal topic</span>
            <select className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-200" value={selectedTopic} onChange={e => setSelectedTopic(e.target.value)} required>
              <option value="">Select&hellip;</option>
              {CURATED_TOPICS.map(t => (<option key={t.value} value={t.value}>{t.label}</option>))}
            </select>
          </label>
          <button type="submit" disabled={saving || !selectedCat || !selectedTopic} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Creating\u2026" : "Create mapping"}
          </button>
        </form>
      )}
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────

function PencilIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
    </svg>
  );
}

function ToggleIcon({ active }) {
  return active ? (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17 7H7a5 5 0 000 10h10a5 5 0 000-10zm0 8a3 3 0 110-6 3 3 0 010 6z" />
    </svg>
  ) : (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 7h10a5 5 0 010 10H7A5 5 0 017 7zm0 8a3 3 0 100-6 3 3 0 000 6z" />
    </svg>
  );
}
