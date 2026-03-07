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
import { useState } from "react";
import { authHeaders } from "../lib/api";

const ASSET_TYPES = ["APPLIANCE", "FIXTURE", "FINISH", "STRUCTURAL", "SYSTEM", "OTHER"];
const INTERVENTION_TYPES = ["REPAIR", "REPLACEMENT"];

const TYPE_COLORS = {
  APPLIANCE: "bg-blue-100 text-blue-700",
  FIXTURE: "bg-purple-100 text-purple-700",
  FINISH: "bg-amber-100 text-amber-700",
  STRUCTURAL: "bg-red-100 text-red-700",
  SYSTEM: "bg-teal-100 text-teal-700",
  OTHER: "bg-gray-100 text-gray-600",
};

function DepreciationBar({ depreciation }) {
  if (!depreciation) {
    return <span className="text-xs text-gray-400 italic">No date / standard</span>;
  }
  const { residualPct, ageMonths, usefulLifeMonths } = depreciation;
  const color =
    residualPct > 60 ? "bg-emerald-500" :
    residualPct > 30 ? "bg-amber-500" :
    "bg-red-500";
  const years = Math.floor(ageMonths / 12);
  const months = ageMonths % 12;
  const lifeYears = Math.floor(usefulLifeMonths / 12);

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden" title={`${residualPct}% residual value`}>
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${residualPct}%` }} />
      </div>
      <span className="text-xs text-gray-600 whitespace-nowrap font-medium">
        {residualPct}%
      </span>
      <span className="text-xs text-gray-400 whitespace-nowrap">
        ({years}y{months > 0 ? `${months}m` : ""} / {lifeYears}y)
      </span>
    </div>
  );
}

function InterventionList({ interventions }) {
  if (!interventions || interventions.length === 0) {
    return <p className="text-xs text-gray-400 italic">No interventions recorded</p>;
  }
  return (
    <div className="space-y-1.5">
      {interventions.map((iv) => (
        <div key={iv.id} className="flex items-center gap-2 text-xs">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
            iv.type === "REPLACEMENT" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
          }`}>
            {iv.type}
          </span>
          <span className="text-gray-600">{formatDate(iv.interventionDate)}</span>
          {iv.costChf != null && (
            <span className="text-gray-500">CHF {iv.costChf.toLocaleString("de-CH")}</span>
          )}
          {iv.notes && <span className="text-gray-400 truncate max-w-[200px]">{iv.notes}</span>}
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
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
      <h4 className="text-sm font-semibold text-gray-700">Add Asset</h4>
      {error && <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</p>}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Type *</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
          >
            {ASSET_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Topic *</label>
          <input
            value={form.topic}
            onChange={(e) => setForm({ ...form, topic: e.target.value })}
            placeholder="e.g. kitchen, bathroom"
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Dishwasher"
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
            required
          />
        </div>

        {scope === "building" && units && units.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Unit *</label>
            <select
              value={form.unitId}
              onChange={(e) => setForm({ ...form, unitId: e.target.value })}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
              required
            >
              <option value="">Select unit…</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.unitNumber}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Brand</label>
          <input
            value={form.brand}
            onChange={(e) => setForm({ ...form, brand: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Model #</label>
          <input
            value={form.modelNumber}
            onChange={(e) => setForm({ ...form, modelNumber: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Serial #</label>
          <input
            value={form.serialNumber}
            onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Installed</label>
          <input
            type="date"
            value={form.installedAt}
            onChange={(e) => setForm({ ...form, installedAt: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
          <input
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting || !form.topic || !form.name}
        className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50"
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
    <form onSubmit={handleSubmit} className="flex items-end gap-2 mt-2 bg-white p-2 rounded border border-gray-100">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <select
        value={form.type}
        onChange={(e) => setForm({ ...form, type: e.target.value })}
        className="px-2 py-1 text-xs border border-gray-300 rounded"
      >
        {INTERVENTION_TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <input
        type="date"
        value={form.interventionDate}
        onChange={(e) => setForm({ ...form, interventionDate: e.target.value })}
        className="px-2 py-1 text-xs border border-gray-300 rounded"
        required
      />
      <input
        type="number"
        placeholder="Cost CHF"
        value={form.costChf}
        onChange={(e) => setForm({ ...form, costChf: e.target.value })}
        className="w-24 px-2 py-1 text-xs border border-gray-300 rounded"
        min="0"
        step="0.01"
      />
      <input
        placeholder="Notes"
        value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.target.value })}
        className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
      />
      <button
        type="submit"
        disabled={submitting || !form.interventionDate}
        className="px-3 py-1 bg-gray-800 text-white text-xs font-medium rounded hover:bg-gray-700 disabled:opacity-50"
      >
        {submitting ? "…" : "+ Log"}
      </button>
    </form>
  );
}

export default function AssetInventoryPanel({ assets, onRefresh, scope, parentId, unitId, units }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedAsset, setExpandedAsset] = useState(null);
  const [showInterventionFor, setShowInterventionFor] = useState(null);
  const [filterType, setFilterType] = useState("");

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
        <span className="font-semibold text-gray-700">{totalAssets} assets</span>
        {totalAssets > 0 && (
          <>
            <span className="text-gray-500">Avg residual: <strong>{Math.round(avgResidual)}%</strong></span>
            {fullyDepreciated > 0 && (
              <span className="text-red-600 font-medium">{fullyDepreciated} fully depreciated</span>
            )}
          </>
        )}

        {/* Type filter */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="ml-auto px-2 py-1 text-xs border border-gray-300 rounded-md"
        >
          <option value="">All types</option>
          {ASSET_TYPES.map((t) => (
            <option key={t} value={t}>{t} ({assets.filter((a) => a.type === t).length})</option>
          ))}
        </select>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-md hover:bg-gray-800"
        >
          {showAddForm ? "Cancel" : "+ Add Asset"}
        </button>
      </div>

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
        <p className="text-sm text-gray-400 italic text-center py-8">No assets registered yet. Click "+ Add Asset" to begin.</p>
      )}

      {Object.entries(grouped).map(([type, items]) => (
        <div key={type} className="space-y-1">
          <h4 className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider pt-2">
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${TYPE_COLORS[type] || TYPE_COLORS.OTHER}`}>{type}</span>
            <span>({items.length})</span>
          </h4>

          <div className="space-y-1.5">
            {items.map((asset) => {
              const isExpanded = expandedAsset === asset.id;
              return (
                <div key={asset.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Row header */}
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedAsset(isExpanded ? null : asset.id)}
                  >
                    <span className="text-sm font-medium text-gray-800 min-w-[120px]">{asset.name}</span>
                    <span className="text-xs text-gray-500">{asset.topic}</span>
                    {scope === "building" && asset.unit && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{asset.unit.unitNumber}</span>
                    )}
                    {asset.brand && <span className="text-xs text-gray-400">{asset.brand}</span>}
                    <div className="flex-1" />
                    <DepreciationBar depreciation={asset.depreciation} />
                    {!asset.isPresent && (
                      <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold">ABSENT</span>
                    )}
                    <span className="text-gray-400 text-xs">{isExpanded ? "▲" : "▼"}</span>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 py-3 bg-white border-t border-gray-100 space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        {asset.installedAt && (
                          <div><span className="text-gray-500">Installed:</span> <span className="font-medium">{formatDate(asset.installedAt)}</span></div>
                        )}
                        {asset.replacedAt && (
                          <div><span className="text-gray-500">Replaced:</span> <span className="font-medium">{formatDate(asset.replacedAt)}</span></div>
                        )}
                        {asset.lastRenovatedAt && (
                          <div><span className="text-gray-500">Renovated:</span> <span className="font-medium">{formatDate(asset.lastRenovatedAt)}</span></div>
                        )}
                        {asset.modelNumber && (
                          <div><span className="text-gray-500">Model:</span> <span className="font-mono font-medium">{asset.modelNumber}</span></div>
                        )}
                        {asset.serialNumber && (
                          <div><span className="text-gray-500">Serial:</span> <span className="font-mono font-medium">{asset.serialNumber}</span></div>
                        )}
                        {asset.notes && (
                          <div className="col-span-2"><span className="text-gray-500">Notes:</span> <span>{asset.notes}</span></div>
                        )}
                      </div>

                      {/* Intervention history */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <h5 className="text-xs font-semibold text-gray-600">Interventions</h5>
                          <button
                            type="button"
                            onClick={() => setShowInterventionFor(showInterventionFor === asset.id ? null : asset.id)}
                            className="text-[10px] text-blue-600 hover:underline font-medium"
                          >
                            {showInterventionFor === asset.id ? "Cancel" : "+ Log intervention"}
                          </button>
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
      ))}
    </div>
  );
}
