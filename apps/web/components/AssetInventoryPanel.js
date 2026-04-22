/**
 * AssetInventoryPanel — Shared component for displaying asset inventory
 * with depreciation bars, intervention history, and add forms.
 *
 * Used on both building/[id] and unit/[id] detail pages.
 *
 * Props:
 *   - assets: AssetInventoryItem[] (from API)
 *   - onRefresh: () => void — callback to reload data after mutations
 *   - scope: "unit" | "building" — controls whether unit column is shown
 *   - parentId: string — unitId or buildingId for POST target
 *   - unitId?: string — required when scope="unit" (for POST /units/:id/assets)
 *   - units?: { id, unitNumber }[] — required when scope="building" (for unit picker)
 */
import { useState, useEffect, useRef, useMemo } from "react";
import { authHeaders } from "../lib/api";

import { cn } from "../lib/utils";
import { topicLabel } from "../lib/topicLabels";
const ASSET_TYPES = ["APPLIANCE", "FIXTURE", "FINISH", "STRUCTURAL", "SYSTEM", "OTHER"];

const TYPE_LABELS = {
  APPLIANCE: "Appliance",
  FIXTURE: "Fixture",
  FINISH: "Finish / Surface",
  STRUCTURAL: "Structural",
  SYSTEM: "System / Installation",
  OTHER: "Other",
};
const INTERVENTION_TYPES = ["REPAIR", "REPLACEMENT"];

/**
 * assetCategory = business grouping (EQUIPMENT vs COMPONENT)
 * assetType     = operational classification (UI, filters, legacy logic)
 * topic         = depreciation key
 */
const ASSET_TYPE_TO_CATEGORY = {
  APPLIANCE: "EQUIPMENT",
  FIXTURE: "EQUIPMENT",
  FINISH: "COMPONENT",
  STRUCTURAL: "COMPONENT",
  SYSTEM: "COMPONENT",
  OTHER: "EQUIPMENT",
};

const CATEGORY_COLORS = {
  EQUIPMENT: "bg-indigo-50 text-indigo-700 border-indigo-200",
  COMPONENT: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const TYPE_COLORS = {
  APPLIANCE: "bg-blue-100 text-blue-700",
  FIXTURE: "bg-purple-100 text-purple-700",
  FINISH: "bg-amber-100 text-amber-700",
  STRUCTURAL: "bg-red-100 text-red-700",
  SYSTEM: "bg-teal-100 text-teal-700",
  OTHER: "bg-slate-100 text-slate-600",
};

/**
 * Whether an asset type supports model-related fields (Brand, Model #, Serial #).
 * Only EQUIPMENT-category types are model-identifiable.
 * Generic components like walls, floors, ceilings are not model-driven by default.
 */
function isModelEligible(type) {
  return ASSET_TYPE_TO_CATEGORY[type] === "EQUIPMENT";
}

function DepreciationBar({ depreciation, installedAt }) {
  if (!depreciation && !installedAt) {
    return <span className="text-xs text-slate-400 italic">Install date unknown</span>;
  }
  if (!depreciation) {
    return <span className="text-xs text-slate-400 italic">No depreciation standard</span>;
  }
  const { residualPct, ageMonths, usefulLifeMonths, depreciationPct } = depreciation;
  const isFullyDepreciated = depreciationPct >= 100;
  const color =
    isFullyDepreciated ? "bg-red-500" :
    residualPct > 60 ? "bg-green-500" :
    residualPct > 30 ? "bg-amber-500" :
    "bg-red-500";
  const ageYears = (ageMonths / 12).toFixed(1);
  const lifeYears = (usefulLifeMonths / 12).toFixed(1);
  const remainingMonths = Math.max(0, usefulLifeMonths - ageMonths);
  const remainingYears = (remainingMonths / 12).toFixed(1);

  return (
    <div className="flex items-center gap-2 min-w-[220px]">
      {isFullyDepreciated && (
        <span className="text-[10px] font-semibold uppercase tracking-wide bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
          Fully depreciated
        </span>
      )}
      <div className="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden" title={`${ageYears} / ${lifeYears} years used — ${residualPct}% residual value`}>
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(depreciationPct, 100)}%` }} />
      </div>
      <span className="text-xs text-slate-600 whitespace-nowrap font-medium">
        {ageYears} / {lifeYears}y
      </span>
      {!isFullyDepreciated && (
        <span className="text-xs text-slate-400 whitespace-nowrap">
          ({remainingYears}y left)
        </span>
      )}
    </div>
  );
}

function DepreciationDetail({ depreciation, installedAt }) {
  if (!depreciation && !installedAt) {
    return (
      <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
        <p className="text-xs text-slate-400 italic">Install date unknown — depreciation cannot be computed.</p>
      </div>
    );
  }
  if (!depreciation) {
    return (
      <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Installed:</span>
          <span className="text-xs font-medium">{formatDate(installedAt)}</span>
        </div>
        <p className="mt-1 text-xs text-slate-400 italic">No depreciation standard found. Standards are matched by topic first, then asset type.</p>
      </div>
    );
  }

  const { usefulLifeMonths, ageMonths, depreciationPct, residualPct } = depreciation;
  const ageYears = (ageMonths / 12).toFixed(1);
  const lifeYears = (usefulLifeMonths / 12).toFixed(1);
  const remainingMonths = Math.max(0, usefulLifeMonths - ageMonths);
  const remainingYears = (remainingMonths / 12).toFixed(1);
  const isFullyDepreciated = depreciationPct >= 100;

  const barColor =
    depreciationPct < 40 ? "bg-green-500" :
    depreciationPct < 70 ? "bg-amber-500" :
    "bg-red-500";

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <h5 className="text-xs font-semibold text-slate-600">Useful Life / Depreciation</h5>
        {isFullyDepreciated && (
          <span className="text-[10px] font-semibold uppercase tracking-wide bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
            Fully depreciated
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden" title={`${depreciationPct}% depreciated`}>
          <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${Math.min(depreciationPct, 100)}%` }} />
        </div>
        <span className="text-xs font-semibold text-slate-700 whitespace-nowrap w-10 text-right">
          {depreciationPct}%
        </span>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div>
          <span className="text-slate-500">Time in service</span>
          <div className="font-semibold text-slate-800">{ageYears} / {lifeYears} years</div>
        </div>
        <div>
          <span className="text-slate-500">Remaining life</span>
          <div className={cn("font-semibold", isFullyDepreciated ? "text-red-600" : "text-slate-800")}>
            {isFullyDepreciated ? "0 years" : `${remainingYears} years`}
          </div>
        </div>
        <div>
          <span className="text-slate-500">Residual value</span>
          <div className="font-semibold text-slate-800">{residualPct}%</div>
        </div>
      </div>
    </div>
  );
}

function InterventionList({ interventions }) {
  if (!interventions || interventions.length === 0) {
    return <p className="text-xs text-slate-400 italic">No interventions recorded</p>;
  }
  return (
    <div className="space-y-1.5">
      {interventions.map((iv) => (
        <div key={iv.id} className="flex items-center gap-2 text-xs">
          <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase", iv.type === "REPLACEMENT" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700")}>
            {iv.type}
          </span>
          <span className="text-slate-600">{formatDate(iv.interventionDate)}</span>
          {iv.costChf != null && (
            <span className="text-slate-500">CHF {iv.costChf.toLocaleString("de-CH")}</span>
          )}
          {iv.notes && <span className="text-slate-400 truncate max-w-[200px]">{iv.notes}</span>}
        </div>
      ))}
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

// topicLabel(key) → English display name, imported from ../lib/topicLabels

function AddAssetForm({ scope, parentId, unitId, units, onDone }) {
  const [form, setForm] = useState({
    type: "APPLIANCE",
    topic: "",
    name: "",
    brand: "",
    modelNumber: "",
    serialNumber: "",
    installedAt: "",
    notes: "",
    unitId: unitId || "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  // Topic picker state
  const [topicSearch, setTopicSearch] = useState("");
  const [topicDropdownOpen, setTopicDropdownOpen] = useState(false);
  const [isCustomTopic, setIsCustomTopic] = useState(false);
  const topicRef = useRef(null);

  // Load ALL suggestions once — we filter client-side so we can auto-set type
  const [topicSuggestions, setTopicSuggestions] = useState([]);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/asset-topic-suggestions", { headers: authHeaders() });
        if (res.ok && !cancelled) {
          const json = await res.json();
          setTopicSuggestions(json.data || []);
        }
      } catch { /* non-fatal */ }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function onMouseDown(e) {
      if (topicRef.current && !topicRef.current.contains(e.target)) {
        setTopicDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // Only show standard-sourced suggestions; filter by English label or topic key
  const filteredSuggestions = useMemo(() => {
    const standards = topicSuggestions.filter((s) => s.source === "standard");
    if (!topicSearch.trim()) return standards;
    const q = topicSearch.toLowerCase();
    return standards.filter((s) => {
      const label = topicLabel(s.topicKey).toLowerCase();
      return label.includes(q) || s.topicKey.toLowerCase().includes(q);
    });
  }, [topicSuggestions, topicSearch]);

  function selectTopic(suggestion) {
    const newType = suggestion.assetType || form.type;
    const clearModelFields = !isModelEligible(newType);
    setForm((prev) => ({
      ...prev,
      topic: suggestion.topicKey,
      type: newType,
      ...(clearModelFields ? { brand: "", modelNumber: "", serialNumber: "" } : {}),
    }));
    setTopicSearch(topicLabel(suggestion.topicKey));
    setIsCustomTopic(false);
    setTopicDropdownOpen(false);
  }

  function activateCustomTopic() {
    setIsCustomTopic(true);
    setForm((prev) => ({ ...prev, topic: "" }));
    setTopicSearch("");
    setTopicDropdownOpen(false);
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const url = scope === "unit"
        ? `/api/units/${parentId}/assets`
        : `/api/buildings/${parentId}/assets`;
      const body = {
        type: form.type,
        topic: form.topic.trim(),
        name: form.name.trim(),
        ...(scope === "building" ? { unitId: form.unitId } : { unitId: parentId }),
        ...(form.brand ? { brand: form.brand.trim() } : {}),
        ...(form.modelNumber ? { modelNumber: form.modelNumber.trim() } : {}),
        ...(form.serialNumber ? { serialNumber: form.serialNumber.trim() } : {}),
        ...(form.installedAt ? { installedAt: new Date(form.installedAt).toISOString() } : {}),
        ...(form.notes ? { notes: form.notes.trim() } : {}),
      };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error?.message || `HTTP ${res.status}`);
      }
      setForm({ type: "APPLIANCE", topic: "", name: "", brand: "", modelNumber: "", serialNumber: "", installedAt: "", notes: "", unitId: unitId || "" });
      setTopicSearch("");
      setIsCustomTopic(false);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-3">
      <h4 className="text-sm font-semibold text-slate-700">Add Asset</h4>
      {error && <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</p>}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">

        {/* ── Topic picker ── */}
        <div className="col-span-2 md:col-span-1">
          <label className="block text-xs font-medium text-slate-600 mb-1">Item *</label>
          {isCustomTopic ? (
            <div className="space-y-1">
              <div className="flex gap-1">
                <input
                  value={form.topic}
                  onChange={(e) => setForm({ ...form, topic: e.target.value.toUpperCase().replace(/[\s-]+/g, "_") })}
                  placeholder="CUSTOM_TOPIC_KEY"
                  className="w-full px-2 py-1.5 text-sm border border-amber-300 rounded-lg font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => { setIsCustomTopic(false); setForm((p) => ({ ...p, topic: "" })); setTopicSearch(""); }}
                  className="px-2 py-1 text-xs text-slate-500 border border-slate-300 rounded-lg hover:bg-slate-100 whitespace-nowrap"
                >
                  ← Back
                </button>
              </div>
              <p className="text-[10px] text-amber-600">
                No depreciation standard will be matched — useful life won't be tracked unless you add a standard for this topic.
              </p>
            </div>
          ) : (
            <div className="relative" ref={topicRef}>
              <input
                type="text"
                value={topicSearch}
                onChange={(e) => { setTopicSearch(e.target.value); setTopicDropdownOpen(true); }}
                onFocus={() => setTopicDropdownOpen(true)}
                placeholder="Search items… (e.g. Dishwasher)"
                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg"
                autoComplete="off"
                required={!form.topic}
              />
              {/* Hidden input carries the actual topic key value for form validation */}
              <input type="hidden" value={form.topic} required />
              {topicDropdownOpen && (
                <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  {filteredSuggestions.length === 0 && (
                    <div className="px-3 py-2 text-xs text-slate-400 italic">No matches</div>
                  )}
                  {filteredSuggestions.map((s) => (
                    <button
                      key={s.topicKey}
                      type="button"
                      onMouseDown={() => selectTopic(s)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50"
                    >
                      <span className="text-sm text-slate-800">{topicLabel(s.topicKey)}</span>
                      {s.usefulLifeMonths != null && (
                        <span className="ml-2 shrink-0 text-[11px] font-medium text-slate-400">
                          {Math.round(s.usefulLifeMonths / 12)} yr
                        </span>
                      )}
                    </button>
                  ))}
                  <button
                    type="button"
                    onMouseDown={activateCustomTopic}
                    className="flex w-full items-center gap-1.5 border-t border-slate-100 px-3 py-2 text-left text-xs text-amber-600 hover:bg-amber-50"
                  >
                    + Enter custom topic key…
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Type (auto-set from topic, still editable) ── */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Type *
            {form.topic && !isCustomTopic && (
              <span className="ml-1 font-normal text-slate-400">(auto-set)</span>
            )}
          </label>
          <select
            value={form.type}
            onChange={(e) => {
              const newType = e.target.value;
              if (!isModelEligible(newType)) {
                setForm({ ...form, type: newType, brand: "", modelNumber: "", serialNumber: "" });
              } else {
                setForm({ ...form, type: newType });
              }
            }}
            className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg"
          >
            {ASSET_TYPES.map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>
            ))}
          </select>
        </div>

        {/* ── Name ── */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Kitchen dishwasher"
            className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg"
            required
          />
        </div>

        {/* ── Unit picker (building scope) ── */}
        {scope === "building" && units && units.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Unit *</label>
            <select
              value={form.unitId}
              onChange={(e) => setForm({ ...form, unitId: e.target.value })}
              className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg"
              required
            >
              <option value="">Select unit…</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.unitNumber}</option>
              ))}
            </select>
          </div>
        )}

        {/* ── Model fields (EQUIPMENT types only) ── */}
        {isModelEligible(form.type) ? (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Brand</label>
              <input
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Model #</label>
              <input
                value={form.modelNumber}
                onChange={(e) => setForm({ ...form, modelNumber: e.target.value })}
                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Serial #</label>
              <input
                value={form.serialNumber}
                onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </>
        ) : (
          <div className="col-span-2 md:col-span-3">
            <p className="text-xs text-slate-400 italic">Brand, model, and serial fields are not applicable for this asset type.</p>
          </div>
        )}

        {/* ── Install date ── */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Installed</label>
          <input
            type="date"
            value={form.installedAt}
            onChange={(e) => setForm({ ...form, installedAt: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg"
          />
          {!form.installedAt && (
            <p className="text-[10px] text-amber-600 mt-0.5">
              No install date — depreciation won't be tracked.
            </p>
          )}
        </div>

        {/* ── Notes ── */}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
          <input
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting || !form.topic || !form.name}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? "Adding…" : "Add Asset"}
      </button>
    </form>
  );
}

function AddInterventionForm({ assetId, onDone }) {
  const [form, setForm] = useState({
    type: "REPAIR",
    interventionDate: "",
    costChf: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        type: form.type,
        interventionDate: new Date(form.interventionDate).toISOString(),
        ...(form.costChf !== "" ? { costChf: parseFloat(form.costChf) } : {}),
        ...(form.notes ? { notes: form.notes.trim() } : {}),
      };
      const res = await fetch(`/api/assets/${assetId}/interventions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error?.message || `HTTP ${res.status}`);
      }
      setForm({ type: "REPAIR", interventionDate: "", costChf: "", notes: "" });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 mt-2 bg-white p-2 rounded border border-slate-100">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <select
        value={form.type}
        onChange={(e) => setForm({ ...form, type: e.target.value })}
        className="px-2 py-1 text-xs border border-slate-300 rounded-lg"
      >
        {INTERVENTION_TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <input
        type="date"
        value={form.interventionDate}
        onChange={(e) => setForm({ ...form, interventionDate: e.target.value })}
        className="px-2 py-1 text-xs border border-slate-300 rounded-lg"
        required
      />
      <input
        type="number"
        placeholder="Cost CHF"
        value={form.costChf}
        onChange={(e) => setForm({ ...form, costChf: e.target.value })}
        className="w-24 px-2 py-1 text-xs border border-slate-300 rounded-lg"
        min="0"
        step="0.01"
      />
      <input
        placeholder="Notes"
        value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.target.value })}
        className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded-lg"
      />
      <button
        type="submit"
        disabled={submitting || !form.interventionDate}
        className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? "…" : "+ Log"}
      </button>
    </form>
  );
}

function EditAssetForm({ asset, onDone, onRefresh }) {
  const [form, setForm] = useState({
    name: asset.name || "",
    installedAt: asset.installedAt ? asset.installedAt.slice(0, 10) : "",
    brand: asset.brand || "",
    modelNumber: asset.modelNumber || "",
    serialNumber: asset.serialNumber || "",
    notes: asset.notes || "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        name: form.name.trim(),
        installedAt: form.installedAt ? new Date(form.installedAt).toISOString() : null,
        brand: form.brand.trim() || null,
        modelNumber: form.modelNumber.trim() || null,
        serialNumber: form.serialNumber.trim() || null,
        notes: form.notes.trim() || null,
      };
      const res = await fetch(`/api/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error?.message || `HTTP ${res.status}`);
      }
      onRefresh();
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const showModelFields = isModelEligible(asset.type);

  return (
    <form onSubmit={handleSubmit} className="border border-brand rounded-xl p-3 bg-brand-light space-y-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-brand-dark">Edit asset</span>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{topicLabel(asset.topic)}</span>
          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-mono">{asset.type}</span>
          <span className="italic">(locked)</span>
        </div>
      </div>
      {error && <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</p>}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <div className="col-span-2 md:col-span-3">
          <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Installed</label>
          <input
            type="date"
            value={form.installedAt}
            onChange={(e) => setForm({ ...form, installedAt: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg"
          />
        </div>

        {showModelFields && (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Brand</label>
              <input
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Model #</label>
              <input
                value={form.modelNumber}
                onChange={(e) => setForm({ ...form, modelNumber: e.target.value })}
                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Serial #</label>
              <input
                value={form.serialNumber}
                onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </>
        )}

        <div className="col-span-2 md:col-span-3">
          <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
          <input
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={submitting || !form.name.trim()}
          className="button-primary text-sm disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save changes"}
        </button>
        <button type="button" onClick={onDone} className="button-cancel text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function AssetInventoryPanel({ assets, onRefresh, scope, parentId, unitId, units, showAddForm: controlledShowAdd, setShowAddForm: setControlledShowAdd }) {
  const [showAddFormInternal, setShowAddFormInternal] = useState(false);
  const isControlled = setControlledShowAdd !== undefined;
  const showAddForm = isControlled ? (controlledShowAdd ?? false) : showAddFormInternal;
  const setShowAddForm = isControlled ? setControlledShowAdd : setShowAddFormInternal;
  const [expandedAsset, setExpandedAsset] = useState(null);
  const [showInterventionFor, setShowInterventionFor] = useState(null);
  const [editingAsset, setEditingAsset] = useState(null);
  const [deletingAsset, setDeletingAsset] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [unlinkedJobs, setUnlinkedJobs] = useState([]);

  useEffect(() => {
    if (scope !== "unit" || !unitId) return;
    fetch(`/api/units/${unitId}/unlinked-jobs`, { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.data) setUnlinkedJobs(d.data); })
      .catch(() => {});
  }, [unitId, scope]);

  const filtered = filterType ? assets.filter((a) => a.type === filterType) : assets;

  // Group by type
  const grouped = {};
  for (const a of filtered) {
    if (!grouped[a.type]) grouped[a.type] = [];
    grouped[a.type].push(a);
  }

  // Summary stats
  const totalAssets = assets.length;
  const avgResidual = assets.reduce((sum, a) => sum + (a.depreciation?.residualPct ?? 0), 0) / (totalAssets || 1);
  const fullyDepreciated = assets.filter((a) => a.depreciation && a.depreciation.residualPct === 0).length;

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="font-semibold text-slate-700">{totalAssets} assets</span>
        {totalAssets > 0 && (
          <>
            <span className="text-slate-500">Avg residual: <strong>{Math.round(avgResidual)}%</strong></span>
            {fullyDepreciated > 0 && (
              <span className="text-red-600 font-medium">{fullyDepreciated} fully depreciated</span>
            )}
          </>
        )}

        {/* Type filter */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="ml-auto px-2 py-1 text-xs border border-slate-300 rounded-lg"
        >
          <option value="">All types</option>
          {ASSET_TYPES.map((t) => {
            const count = assets.filter((a) => a.type === t).length;
            if (count === 0) return null;
            const label = TYPE_LABELS[t] || t;
            return <option key={t} value={t}>{label} ({count})</option>;
          })}
        </select>

        {!isControlled && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
          >
            {showAddForm ? "Cancel" : "+ Add Asset"}
          </button>
        )}
      </div>

      {/* Unlinked jobs warning */}
      {unlinkedJobs.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
          <svg className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-700 m-0">
              {unlinkedJobs.length} completed job{unlinkedJobs.length !== 1 ? "s" : ""} with no asset linked
            </p>
            <p className="text-xs text-amber-600 mt-0.5 m-0">
              These interventions are not tracked against any asset. Open the request and use &ldquo;Link asset&rdquo; to associate them.
            </p>
            <ul className="mt-2 space-y-0.5">
              {unlinkedJobs.slice(0, 5).map((job) => (
                <li key={job.id} className="text-xs text-amber-700">
                  {job.request?.requestNumber ? `#${job.request.requestNumber}` : job.id.slice(0, 8)}
                  {job.request?.description ? ` — ${job.request.description.slice(0, 60)}` : ""}
                  {job.completedAt ? ` (${new Date(job.completedAt).toLocaleDateString()})` : ""}
                </li>
              ))}
              {unlinkedJobs.length > 5 && (
                <li className="text-xs text-amber-500">…and {unlinkedJobs.length - 5} more</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Add asset form */}
      {showAddForm && (
        <AddAssetForm
          scope={scope}
          parentId={parentId}
          unitId={unitId}
          units={units}
          onDone={() => { setShowAddForm(false); onRefresh(); }}
        />
      )}

      {/* Asset list by type group */}
      {totalAssets === 0 && !showAddForm && (
        <p className="text-sm text-slate-400 italic text-center py-8">No assets registered yet — equipment, fixtures, finishes, and structural components can all be tracked here. Click "+ Add Asset" to begin.</p>
      )}

      {Object.entries(grouped).map(([type, items]) => {
        const category = items[0]?.category || ASSET_TYPE_TO_CATEGORY[type] || "EQUIPMENT";
        return (
        <div key={type} className="space-y-1">
          <h4 className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider pt-2">
            <span className={cn("px-2 py-0.5 rounded-full text-[10px]", TYPE_COLORS[type] || TYPE_COLORS.OTHER)}>{TYPE_LABELS[type] || type}</span>
            <span className={cn("px-1.5 py-0.5 rounded border text-[9px] font-medium", CATEGORY_COLORS[category] || CATEGORY_COLORS.EQUIPMENT)}>{category}</span>
            <span>({items.length})</span>
          </h4>

          <div className="space-y-1.5">
            {items.map((asset) => {
              const isExpanded = expandedAsset === asset.id;
              return (
                <div key={asset.id} className="border border-slate-200 rounded-lg overflow-hidden">
                  {/* Row header */}
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
                    onClick={() => setExpandedAsset(isExpanded ? null : asset.id)}
                  >
                    <span className="text-sm font-medium text-slate-800 min-w-[120px]">{asset.name}</span>
                    <span className="text-xs text-slate-500">{topicLabel(asset.topic)}</span>
                    {scope === "building" && asset.unit && (
                      <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{asset.unit.unitNumber}</span>
                    )}
                    {asset.brand && <span className="text-xs text-slate-400">{asset.brand}</span>}
                    <div className="flex-1" />
                    <DepreciationBar depreciation={asset.depreciation} installedAt={asset.installedAt} />
                    {!asset.isPresent && (
                      <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold">ABSENT</span>
                    )}
                    <span className="text-slate-400 text-xs">{isExpanded ? "▲" : "▼"}</span>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 py-3 bg-white border-t border-slate-100 space-y-3">

                      {/* ── Edit form or metadata grid ── */}
                      {editingAsset === asset.id ? (
                        <EditAssetForm
                          asset={asset}
                          onRefresh={onRefresh}
                          onDone={() => setEditingAsset(null)}
                        />
                      ) : (
                        <>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            {asset.installedAt ? (
                              <div><span className="text-slate-500">Installed:</span> <span className="font-medium">{formatDate(asset.installedAt)}</span></div>
                            ) : (
                              <div><span className="text-slate-500 italic">Install date unknown</span></div>
                            )}
                            {asset.replacedAt && (
                              <div><span className="text-slate-500">Replaced:</span> <span className="font-medium">{formatDate(asset.replacedAt)}</span></div>
                            )}
                            {asset.lastRenovatedAt && (
                              <div><span className="text-slate-500">Renovated:</span> <span className="font-medium">{formatDate(asset.lastRenovatedAt)}</span></div>
                            )}
                            {asset.modelNumber && (
                              <div><span className="text-slate-500">Model:</span> <span className="font-mono font-medium">{asset.modelNumber}</span></div>
                            )}
                            {asset.serialNumber && (
                              <div><span className="text-slate-500">Serial:</span> <span className="font-mono font-medium">{asset.serialNumber}</span></div>
                            )}
                            {asset.notes && (
                              <div className="col-span-2"><span className="text-slate-500">Notes:</span> <span>{asset.notes}</span></div>
                            )}
                          </div>

                          {/* Action row */}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => { setEditingAsset(asset.id); setShowInterventionFor(null); setDeletingAsset(null); }}
                              className="action-btn"
                            >
                              Edit
                            </button>
                            {deletingAsset === asset.id ? (
                              <span className="flex items-center gap-2 text-xs">
                                <span className="text-slate-500">Remove this asset?</span>
                                <button
                                  type="button"
                                  disabled={deleteSubmitting}
                                  onClick={async () => {
                                    setDeleteSubmitting(true);
                                    try {
                                      const r = await fetch(`/api/assets/${asset.id}`, {
                                        method: "DELETE",
                                        headers: authHeaders(),
                                      });
                                      if (!r.ok) throw new Error(`HTTP ${r.status}`);
                                      setDeletingAsset(null);
                                      setExpandedAsset(null);
                                      onRefresh();
                                    } catch { /* ignore */ }
                                    finally { setDeleteSubmitting(false); }
                                  }}
                                  className="button-danger text-xs py-1 px-2"
                                >
                                  {deleteSubmitting ? "Removing…" : "Confirm remove"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingAsset(null)}
                                  className="button-cancel text-xs py-1 px-2"
                                >
                                  Cancel
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => { setDeletingAsset(asset.id); setEditingAsset(null); }}
                                className="action-btn text-red-600 border-red-200 hover:bg-red-50"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </>
                      )}

                      {/* Depreciation detail */}
                      <DepreciationDetail depreciation={asset.depreciation} installedAt={asset.installedAt} />

                      {/* Intervention history */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <h5 className="text-xs font-semibold text-slate-600">Interventions</h5>
                          {editingAsset !== asset.id && (
                            <button
                              type="button"
                              onClick={() => setShowInterventionFor(showInterventionFor === asset.id ? null : asset.id)}
                              className="text-[10px] text-blue-600 hover:underline font-medium"
                            >
                              {showInterventionFor === asset.id ? "Cancel" : "+ Log intervention"}
                            </button>
                          )}
                        </div>
                        <InterventionList interventions={asset.interventions} />
                        {showInterventionFor === asset.id && (
                          <AddInterventionForm
                            assetId={asset.id}
                            onDone={() => { setShowInterventionFor(null); onRefresh(); }}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )})}
    </div>
  );
}
