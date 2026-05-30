import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "next-i18next";
import Panel from "./layout/Panel";
import ErrorBanner from "./ui/ErrorBanner";
import Link from "next/link";
import { authHeaders } from "../lib/api";

import { cn } from "../lib/utils";
// ── Metadata (icons only — labels via i18n) ──────────────────

const CATEGORY_ICONS = {
  stove:       "🔥",
  oven:        "🍳",
  dishwasher:  "🫧",
  bathroom:    "🚿",
  lighting:    "💡",
  plumbing:    "🔧",
  other:       "📋",
};

const TOPIC_KEYS = [
  "STOVE_COOKTOP",
  "OVEN_APPLIANCE",
  "DISHWASHER",
  "BATHROOM_PLUMBING",
  "LIGHTING_ELECTRICAL",
  "PLUMBING_WATER",
  "GENERAL_MAINTENANCE",
];

// ── Main Component ────────────────────────────────────────────

export default function CategoryMappings() {
  const { t } = useTranslation("manager");
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
    if (!confirm(`Reset "${t(`common:categoryMapping.${category}`, { defaultValue: category })}" to the system default? Your custom override will be removed.`)) return;
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
      <ErrorBanner error={error} onDismiss={() => setError("")} className="text-sm" />

      {summary && !loading && (
        <StatusBanner allMapped={allMapped} mappedCount={mappedCount} totalCount={totalCount} />
      )}

      <HowItWorks />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <span className="ml-3 text-sm text-muted">{t("categoryMappings.loading")}</span>
        </div>
      ) : coverage.length === 0 ? (
        <Panel>
          <div className="empty-state">
            <p className="empty-state-text">
              {t("categoryMappings.empty")}
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
  const { t } = useTranslation("manager");
  if (allMapped) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
        <span className="mt-0.5 text-xl">&#x2705;</span>
        <div>
          <p className="text-sm font-semibold text-green-700">{t("categoryMappings.statusBanner.allMapped", { count: totalCount })}</p>
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
        <p className="text-sm font-semibold text-amber-700">
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
  const { t } = useTranslation("manager");
  return (
    <div className="rounded-xl border border-surface-border bg-gradient-to-br from-slate-50 to-white p-5">
      <h3 className="mb-3 text-sm font-semibold text-muted-dark">{t("categoryMappings.howItWorks.title")}</h3>
      <p className="mb-4 text-xs leading-relaxed text-muted-text">
        {t("categoryMappings.howItWorks.description")}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex gap-3 rounded-lg border border-surface-divider bg-surface p-3">
          <span className="text-lg">&#x1F4CA;</span>
          <div>
            <p className="text-xs font-semibold text-muted-dark">{t("categoryMappings.howItWorks.deprecTitle")}</p>
            <p className="text-xs leading-relaxed text-muted">
              {t("categoryMappings.howItWorks.deprecDesc")}
            </p>
          </div>
        </div>
        <div className="flex gap-3 rounded-lg border border-surface-divider bg-surface p-3">
          <span className="text-lg">&#x2696;&#xFE0F;</span>
          <div>
            <p className="text-xs font-semibold text-muted-dark">{t("categoryMappings.howItWorks.rentTitle")}</p>
            <p className="text-xs leading-relaxed text-muted">
              {t("categoryMappings.howItWorks.rentDesc")}
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
  const { t } = useTranslation("manager");
  const icon = CATEGORY_ICONS[c.category] || "📋";
  const label = t(`common:categoryMapping.${c.category}`, { defaultValue: c.category });
  const [expanded, setExpanded] = useState(false);
  const isOrgOverride = c.scope === "org";
  const friendlyTopic = (topic) => t(`categoryMappings.topic.${topic}`, { defaultValue: topic?.replace(/_/g, " ") || "—" });

  if (!c.mapped) {
    return (
      <div className="rounded-xl border-2 border-dashed border-surface-border bg-surface-subtle/50 p-5">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <p className="text-sm font-semibold text-muted-dark">{label}</p>
            <p className="text-xs text-muted">
              {t("categoryMappings.card.notConnected")}
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
    <div className={cn("rounded-xl border bg-surface shadow-sm transition-all hover:shadow-md", isDisabled ? "border-surface-border opacity-60" : "border-surface-border")}>
      <div className="flex items-start justify-between p-5 pb-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">{label}</h3>
              {isOrgOverride && (
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-600">
                  {t("categoryMappings.card.customOverride")}
                </span>
              )}
              {isDisabled && (
                <span className="rounded-full bg-surface-border px-2 py-0.5 text-xs font-semibold text-muted">
                  {t("categoryMappings.card.disabled")}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {t("categoryMappings.card.connectedTo")} <span className="font-medium text-muted-dark">{friendlyTopic(c.legalTopic)}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {isOrgOverride && (
            <button onClick={onReset} className="rounded-lg px-2 py-1 text-xs font-medium text-foreground-dim hover:bg-surface-subtle hover:text-muted-text" title={t("categoryMappings.card.resetTitle")}>{t("categoryMappings.card.reset")}</button>
          )}
          <button onClick={onStartEdit} className="rounded-lg p-1.5 text-foreground-dim hover:bg-surface-hover hover:text-muted-text" title={t("categoryMappings.card.editTitle")}><PencilIcon /></button>
          <button
            onClick={onToggle}
            className={cn("rounded-lg p-1.5 transition-colors", c.isActive ? "text-green-500 hover:bg-green-50 hover:text-green-700" : "text-foreground-dim hover:bg-surface-hover hover:text-muted")}
            title={c.isActive ? t("categoryMappings.card.activeTitle") : t("categoryMappings.card.inactiveTitle")}
          >
            <ToggleIcon active={c.isActive} />
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="mx-5 mt-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
          <p className="mb-2 text-xs font-medium text-blue-700">
            {t("categoryMappings.card.changeHint", { label: label.toLowerCase() })}
          </p>
          <div className="flex gap-2">
            <select className="filter-select flex-1 py-1.5" value={editTopic} onChange={(e) => onChangeTopic(e.target.value)}>
              {TOPIC_KEYS.map(key => (<option key={key} value={key}>{t(`categoryMappings.topic.${key}`)}</option>))}
            </select>
            <button onClick={onSaveEdit} disabled={saving} className="button-primary text-xs px-3 py-1.5 disabled:opacity-50">{saving ? t("categoryMappings.card.saving") : t("categoryMappings.card.save")}</button>
            <button onClick={onCancelEdit} className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface-subtle">{t("categoryMappings.card.cancel")}</button>
          </div>
        </div>
      )}

      <div className="p-5 pt-3">
        <p className="mb-3 text-xs leading-relaxed text-muted">
          {t("categoryMappings.card.checkHint", { label: label.toLowerCase() })}
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <DepreciationBox c={c} hasDepreciation={hasDepreciation} />
          <RentReductionBox c={c} hasRules={hasRules} />
        </div>

        {(c.depreciationSamples?.length > 0 || c.ruleSamples?.length > 0) && (
          <button onClick={() => setExpanded(!expanded)} className="mt-3 text-xs font-medium text-foreground-dim hover:text-muted-text">
            {expanded ? "\u25BE Hide technical details" : "\u25B8 Show technical details"}
          </button>
        )}
        {expanded && <TechnicalDetails c={c} />}
      </div>
    </div>
  );
}

function DepreciationBox({ c, hasDepreciation }) {
  const { t } = useTranslation("manager");
  return (
    <div className={cn("rounded-lg border p-3", hasDepreciation ? "border-green-100 bg-green-50/50" : "border-surface-divider bg-surface-subtle/50")}>
      <div className="flex items-center gap-2">
        <span className="text-sm">&#x1F4CA;</span>
        <span className={cn("text-xs font-semibold", hasDepreciation ? "text-green-700" : "text-muted")}>{t("categoryMappings.deprecBox.title")}</span>
        <span className={cn("ml-auto rounded-full px-2 py-0.5 text-xs font-bold", hasDepreciation ? "bg-green-100 text-green-700" : "bg-surface-hover text-foreground-dim")}>
          {t("categoryMappings.deprecBox.item", { count: c.depreciationCount })}
        </span>
      </div>
      {hasDepreciation ? (
        <div className="mt-2">
          <p className="text-xs leading-relaxed text-green-700">
            {t("categoryMappings.deprecBox.coversItems", { assets: c.readableAssets?.slice(0, 3).join(", ") })}
            {c.readableAssets?.length > 3 && <span> {t("categoryMappings.deprecBox.andMore", { count: c.readableAssets.length - 3 })}</span>}.
            {c.lifespanRange && (<> {t("categoryMappings.deprecBox.lifespans", { range: c.lifespanRange })}</>)}
          </p>
          <p className="mt-1 text-xs text-green-600">{t("categoryMappings.deprecBox.whoPaysSub")}</p>
        </div>
      ) : (
        <p className="mt-2 text-xs text-foreground-dim">{t("categoryMappings.deprecBox.noData")}</p>
      )}
    </div>
  );
}

function RentReductionBox({ c, hasRules }) {
  const { t } = useTranslation("manager");
  return (
    <div className={cn("rounded-lg border p-3", hasRules ? "border-blue-100 bg-blue-50/50" : "border-surface-divider bg-surface-subtle/50")}>
      <div className="flex items-center gap-2">
        <span className="text-sm">&#x2696;&#xFE0F;</span>
        <span className={cn("text-xs font-semibold", hasRules ? "text-blue-700" : "text-muted")}>{t("categoryMappings.rentBox.title")}</span>
        <span className={cn("ml-auto rounded-full px-2 py-0.5 text-xs font-bold", hasRules ? "bg-blue-100 text-blue-700" : "bg-surface-hover text-foreground-dim")}>
          {t("categoryMappings.rentBox.rule", { count: c.ruleCount })}
        </span>
      </div>
      {hasRules ? (
        <div className="mt-2">
          <p className="text-xs leading-relaxed text-blue-700">
            {t("categoryMappings.rentBox.rulesFor", { rules: c.readableRules?.slice(0, 3).join(", ") })}
            {c.readableRules?.length > 3 && <span> {t("categoryMappings.rentBox.andMore", { count: c.readableRules.length - 3 })}</span>}.
          </p>
          <p className="mt-1 text-xs text-blue-600">{t("categoryMappings.rentBox.claimSub")}</p>
        </div>
      ) : (
        <p className="mt-2 text-xs text-foreground-dim">{t("categoryMappings.rentBox.noRules")}</p>
      )}
    </div>
  );
}

function TechnicalDetails({ c }) {
  const { t } = useTranslation("manager");
  return (
    <div className="mt-2 rounded-lg border border-surface-divider bg-surface-subtle p-3">
      <div className="grid gap-4 sm:grid-cols-2">
        {c.depreciationSamples?.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-foreground-dim">
              {t("categoryMappings.technical.deprecStandards", { count: c.depreciationCount })}
            </p>
            {c.depreciationSamples.map((d, i) => (
              <div key={i} className="flex items-center justify-between py-0.5 text-xs text-muted-text">
                <span>{d.topic.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, ch => ch.toUpperCase())}</span>
                <span className="text-foreground-dim">{Math.round(d.usefulLifeMonths / 12)} yr</span>
              </div>
            ))}
            {c.depreciationCount > c.depreciationSamples.length && (
              <p className="mt-1 text-xs text-foreground-dim">{t("categoryMappings.technical.moreItems", { count: c.depreciationCount - c.depreciationSamples.length })}</p>
            )}
          </div>
        )}
        {c.ruleSamples?.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-foreground-dim">
              {t("categoryMappings.technical.rentRules", { count: c.ruleCount })}
            </p>
            {c.ruleSamples.map((key, i) => (
              <div key={i} className="py-0.5 text-xs text-muted-text">
                {key.replace(/^CH_RENT_RED_/, "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, ch => ch.toUpperCase())}
              </div>
            ))}
            {c.ruleCount > c.ruleSamples.length && (
              <p className="mt-1 text-xs text-foreground-dim">{t("categoryMappings.technical.moreItems", { count: c.ruleCount - c.ruleSamples.length })}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Add Category Section ──────────────────────────────────────

function AddCategorySection({ unmapped, showForm, onToggleForm, onCreate, onError }) {
  const { t } = useTranslation("manager");
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
            <p className="text-sm font-semibold text-amber-700">
              {t("categoryMappings.addSection.needsMapping", { count: unmapped.length })}
            </p>
            <p className="text-xs text-amber-700">
              {unmapped.map(u => t(`common:categoryMapping.${u.category}`, { defaultValue: u.category })).join(", ")}
            </p>
          </div>
        </div>
        <button onClick={onToggleForm} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700">
          {showForm ? t("categoryMappings.addSection.cancel") : t("categoryMappings.addSection.setUp")}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="text-xs font-medium text-muted-text">{t("categoryMappings.addSection.categoryLabel")}</span>
            <select className="filter-select mt-1 block" value={selectedCat} onChange={e => setSelectedCat(e.target.value)} required>
              <option value="">{t("categoryMappings.addSection.select")}</option>
              {unmapped.map(u => (
                <option key={u.category} value={u.category}>
                  {CATEGORY_ICONS[u.category] || "📋"} {t(`common:categoryMapping.${u.category}`, { defaultValue: u.category })}
                </option>
              ))}
            </select>
          </label>
          <label className="flex-1">
            <span className="text-xs font-medium text-muted-text">{t("categoryMappings.addSection.connectTo")}</span>
            <select className="filter-select mt-1 block" value={selectedTopic} onChange={e => setSelectedTopic(e.target.value)} required>
              <option value="">{t("categoryMappings.addSection.select")}</option>
              {TOPIC_KEYS.map(key => (<option key={key} value={key}>{t(`categoryMappings.topic.${key}`)}</option>))}
            </select>
          </label>
          <button type="submit" disabled={saving || !selectedCat || !selectedTopic} className="button-primary text-sm disabled:opacity-50">
            {saving ? t("categoryMappings.addSection.creating") : t("categoryMappings.addSection.create")}
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
