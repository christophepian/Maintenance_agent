/**
 * RenovationTaxPlanning — Renovation & Tax Planning tab
 *
 * Contains:
 *   - CapExSummaryBridge: compact portfolio CapEx snapshot + link to
 *     Planning tab where full cashflow plans live.
 *   - Swiss renovation classification catalog (51 jobs) with filters.
 *
 * The former "CapEx Forecast" and "Timing Advisor" sub-tabs have been
 * removed. Full CapEx detail and actionable timing recommendations now
 * live inside cashflow plan detail pages (/manager/cashflow/[id]).
 */
import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "next-i18next";
import Link from "next/link";
import Panel from "./layout/Panel";
import Section from "./layout/Section";
import { authHeaders } from "../lib/api";
import Badge from "./ui/Badge";
import { taxVariant } from "../lib/statusVariants";
import { cn } from "../lib/utils";
import KpiInlineGrid from "./ui/KpiInlineGrid";

// ─── Constants ───────────────────────────────────────────────────────────────

const TAX_CATEGORY_STYLES = {
  WERTERHALTEND:      {},
  WERTVERMEHREND:     {},
  MIXED:              {},
  ENERGY_ENVIRONMENT: {},
};

const BUILDING_SYSTEM_KEYS = [
  "FACADE","WINDOWS","ROOF","INTERIOR","COMMON_AREAS",
  "BATHROOM","KITCHEN","APPLIANCES","MEP","EXTERIOR","LAUNDRY",
];

const TIMING_VARIANT = {
  HIGH: "warning",
  MODERATE: "default",
  LOW: "muted",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtChf(v) {
  if (typeof v !== "number") return "—";
  return `CHF ${v.toLocaleString("de-CH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

function TaxBadge({ category }) {
  const { t } = useTranslation("owner");
  return (
    <Badge variant={taxVariant(category)} size="sm">
      {t(`renovation.taxCategory.${category}`, { defaultValue: category })}
    </Badge>
  );
}

function TimingBadge({ sensitivity }) {
  const { t } = useTranslation("owner");
  return (
    <Badge variant={TIMING_VARIANT[sensitivity] || "muted"} size="sm">
      {t(`renovation.timingSensitivity.${sensitivity}`, { defaultValue: sensitivity })}
    </Badge>
  );
}

// ─── CapEx Summary Bridge ─────────────────────────────────────────────────────

export function CapExSummaryBridge() {
  const { t } = useTranslation("owner");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bundlingExpanded, setBundlingExpanded] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/api/forecasting/capex-projection", { headers: authHeaders() })
      .then((r) => r.json())
      .then((json) => {
        if (json?.data) setData(json.data);
        else setError(t("renovation.capex.loading"));
      })
      .catch(() => setError(t("renovation.capex.loading")))
      .finally(() => setLoading(false));
  }, []);

  const nearestYear = data?.yearlyTotals?.find((y) => y.totalChf > 0)?.year ?? null;
  const timingCount = data?.timingRecommendations?.length ?? 0;

  // Flatten bundling advice across all buildings
  const bundlingAdvice = useMemo(() => {
    if (!data?.buildings) return [];
    return data.buildings
      .filter((b) => b.bundlingAdvice?.length > 0)
      .flatMap((b) => b.bundlingAdvice.map((adv) => ({ ...adv, buildingName: b.buildingName })));
  }, [data]);

  return (
    <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{t("renovation.capex.title")}</h3>
            <p className="text-xs text-muted mt-0.5">
              {t("renovation.capex.subtitle")}
            </p>
          </div>
          <Link
            href="/manager/finance?tab=planning"
            className="shrink-0 button-secondary text-xs"
          >
            {t("renovation.capex.viewPlans")}
          </Link>
        </div>

        {loading && (
          <p className="loading-text text-xs">{t("renovation.capex.loading")}</p>
        )}

        {!loading && error && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-foreground-dim">{error}</p>
            <Link href="/manager/finance?tab=planning" className="text-xs text-brand hover:underline">
              {t("renovation.capex.openPlanning")}
            </Link>
          </div>
        )}

        {!loading && data && (
          <>
            {/* Mobile: compact inline grid */}
            <div className="sm:hidden mb-3">
              <KpiInlineGrid
                items={[
                  { label: t("renovation.capex.totalCapex"),    value: fmtChf(data.totalProjectedChf), tone: "warn" },
                  { label: t("renovation.capex.bundlingOpps"),  value: String(bundlingAdvice.length), tone: bundlingAdvice.length > 0 ? "good" : undefined },
                  { label: t("renovation.capex.timingOpps"),    value: String(timingCount), tone: timingCount > 0 ? "good" : undefined },
                ]}
              />
            </div>
            {/* Desktop: card grid */}
            <div className="hidden sm:grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="card mb-0 flex flex-col gap-1">
                <span className="text-xs font-medium text-muted uppercase tracking-wide">{t("renovation.capex.totalCapex")}</span>
                <span className="text-lg font-bold text-amber-700">{fmtChf(data.totalProjectedChf)}</span>
                <span className="text-xs text-foreground-dim">{t("renovation.capex.acrossBuildings")}</span>
              </div>
              <div className="card mb-0 flex flex-col gap-1">
                <span className="text-xs font-medium text-muted uppercase tracking-wide">{t("renovation.capex.bundlingOpps")}</span>
                <span className={cn("text-lg font-bold", bundlingAdvice.length > 0 ? "text-green-700" : "text-foreground-dim")}>
                  {bundlingAdvice.length}
                </span>
                <span className="text-xs text-foreground-dim">
                  {bundlingAdvice.length > 0 ? t("renovation.capex.bundlingGroups") : t("renovation.capex.bundlingNone")}
                </span>
              </div>
              <div className="card mb-0 flex flex-col gap-1">
                <span className="text-xs font-medium text-muted uppercase tracking-wide">{t("renovation.capex.timingOpps")}</span>
                <span className={cn("text-lg font-bold", timingCount > 0 ? "text-brand" : "text-foreground-dim")}>
                  {timingCount}
                </span>
                <span className="text-xs text-foreground-dim">
                  {timingCount > 0 ? t("renovation.capex.timingShifts") : t("renovation.capex.timingNone")}
                </span>
              </div>
              <div className="card mb-0 flex flex-col gap-1">
                <span className="text-xs font-medium text-muted uppercase tracking-wide">{t("renovation.capex.nearestYear")}</span>
                <span className="text-lg font-bold text-foreground">{nearestYear ?? "—"}</span>
                <span className="text-xs text-foreground-dim">{t("renovation.capex.firstYear")}</span>
              </div>
            </div>

            {/* Bundling recommendations — collapsible */}
            {bundlingAdvice.length > 0 && (
              <div className="border border-surface-divider rounded-lg overflow-hidden">
                <button
                  onClick={() => setBundlingExpanded((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-muted-dark hover:bg-surface-subtle transition-colors"
                  aria-expanded={bundlingExpanded}
                >
                  <span>
                    {t("renovation.capex.bundlingRecs")}
                    <span className="ml-2 text-xs font-normal text-foreground-dim">
                      {t(bundlingAdvice.length === 1 ? "renovation.capex.suggestion_one" : "renovation.capex.suggestion_other", { count: bundlingAdvice.length })}
                    </span>
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                    className={cn("w-4 h-4 text-foreground-dim transition-transform duration-200", bundlingExpanded ? "rotate-180" : "")}>
                    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                  </svg>
                </button>

                {bundlingExpanded && (
                  <div className="border-t border-surface-divider divide-y divide-slate-100">
                    {bundlingAdvice.map((adv, i) => (
                      <div key={i} className="px-4 py-3 flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-foreground">{adv.yearRange}</span>
                            <span className="text-xs text-foreground-dim">{adv.buildingName}</span>
                            <span className="text-xs text-foreground-dim">· {adv.assetCount} asset{adv.assetCount !== 1 ? "s" : ""}</span>
                          </div>
                          <p className="text-xs text-muted-text mt-1">{adv.rationale}</p>
                          {adv.savingsBreakdown?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {adv.savingsBreakdown.map((s, j) => (
                                <Badge key={j} variant="success" size="sm">
                                  {s.category} ~{s.estimatedPct}%
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold text-green-700">~{fmtChf(adv.estimatedSavingsChf)}</div>
                          <div className="text-xs text-foreground-dim">~{adv.savingsEstimatePct}% savings</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * RenovationCatalog — the Swiss renovation job classification table only.
 * Used standalone in Settings → Standards tab.
 */
export function RenovationCatalog() {
  const { t } = useTranslation("owner");
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogFilter, setCatalogFilter] = useState({ system: "", taxCategory: "", search: "" });

  useEffect(() => {
    setCatalogLoading(true);
    fetch("/api/forecasting/renovation-catalog", { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setCatalog(d?.data || []))
      .catch(() => {})
      .finally(() => setCatalogLoading(false));
  }, []);

  const filteredCatalog = useMemo(() => {
    let items = catalog;
    if (catalogFilter.system) {
      items = items.filter((e) => e.buildingSystem === catalogFilter.system);
    }
    if (catalogFilter.taxCategory) {
      items = items.filter((e) => e.taxCategory === catalogFilter.taxCategory);
    }
    if (catalogFilter.search) {
      const q = catalogFilter.search.toLowerCase();
      items = items.filter((e) =>
        e.label.toLowerCase().includes(q) ||
        (e.aliases || []).some((a) => a.toLowerCase().includes(q)) ||
        e.code.toLowerCase().includes(q)
      );
    }
    return items;
  }, [catalog, catalogFilter]);

  const groupedCatalog = useMemo(() => {
    const groups = {};
    for (const entry of filteredCatalog) {
      const sys = entry.buildingSystem;
      if (!groups[sys]) groups[sys] = [];
      groups[sys].push(entry);
    }
    return groups;
  }, [filteredCatalog]);

  const categoryCounts = useMemo(() => {
    const counts = { WERTERHALTEND: 0, WERTVERMEHREND: 0, MIXED: 0, ENERGY_ENVIRONMENT: 0 };
    for (const e of catalog) counts[e.taxCategory] = (counts[e.taxCategory] || 0) + 1;
    return counts;
  }, [catalog]);

  return (
    <div className="space-y-4">
      {/* Disclaimer */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-xs text-amber-700">
          <strong>Decision-support guidance only</strong> — {t("renovation.catalog.disclaimer")}
        </p>
      </div>

      {/* Classification Guide — category summary cards */}
      {/* Mobile: compact inline grid */}
      <div className="sm:hidden mb-3">
        <KpiInlineGrid
          items={[
            { label: t("renovation.catalog.valuePreserving"), value: String(categoryCounts.WERTERHALTEND),    tone: "good" },
            { label: t("renovation.catalog.valueEnhancing"),  value: String(categoryCounts.WERTVERMEHREND),   tone: "warn" },
            { label: t("renovation.catalog.mixed"),            value: String(categoryCounts.MIXED),            tone: categoryCounts.MIXED > 0 ? "warn" : undefined },
            { label: t("renovation.catalog.energyEnv"),       value: String(categoryCounts.ENERGY_ENVIRONMENT) },
          ]}
        />
      </div>
      {/* Desktop: card grid */}
      <div className="hidden sm:grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card mb-0 flex flex-col gap-1">
          <span className="text-xs font-medium text-muted uppercase tracking-wide">{t("renovation.catalog.valuePreserving")}</span>
          <span className="text-xl font-bold text-green-700">{categoryCounts.WERTERHALTEND}</span>
          <span className="text-xs text-foreground-dim">{t("renovation.catalog.valuePreservingNote")}</span>
        </div>
        <div className="card mb-0 flex flex-col gap-1">
          <span className="text-xs font-medium text-muted uppercase tracking-wide">{t("renovation.catalog.valueEnhancing")}</span>
          <span className="text-xl font-bold text-red-600">{categoryCounts.WERTVERMEHREND}</span>
          <span className="text-xs text-foreground-dim">{t("renovation.catalog.valueEnhancingNote")}</span>
        </div>
        <div className="card mb-0 flex flex-col gap-1">
          <span className="text-xs font-medium text-muted uppercase tracking-wide">{t("renovation.catalog.mixed")}</span>
          <span className="text-xl font-bold text-amber-700">{categoryCounts.MIXED}</span>
          <span className="text-xs text-foreground-dim">{t("renovation.catalog.mixedNote")}</span>
        </div>
        <div className="card mb-0 flex flex-col gap-1">
          <span className="text-xs font-medium text-muted uppercase tracking-wide">{t("renovation.catalog.energyEnv")}</span>
          <span className="text-xl font-bold text-blue-700">{categoryCounts.ENERGY_ENVIRONMENT}</span>
          <span className="text-xs text-foreground-dim">{t("renovation.catalog.energyEnvNote")}</span>
        </div>
      </div>

      {/* Catalog filters */}
      <Panel>
        <div className="grid grid-cols-1 sm:flex sm:flex-wrap sm:items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-text">{t("renovation.catalog.buildingSystemLabel")}</label>
            <select
              value={catalogFilter.system}
              onChange={(e) => setCatalogFilter((f) => ({ ...f, system: e.target.value }))}
              className="rounded-lg border border-surface-border px-3 py-2 text-sm w-full sm:w-auto"
            >
              <option value="">{t("renovation.catalog.allSystems")}</option>
              {BUILDING_SYSTEM_KEYS.map((k) => (
                <option key={k} value={k}>{t(`renovation.buildingSystem.${k}`, { defaultValue: k })}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-text">{t("renovation.catalog.taxCategoryLabel")}</label>
            <select
              value={catalogFilter.taxCategory}
              onChange={(e) => setCatalogFilter((f) => ({ ...f, taxCategory: e.target.value }))}
              className="rounded-lg border border-surface-border px-3 py-2 text-sm w-full sm:w-auto"
            >
              <option value="">{t("renovation.catalog.allCategories")}</option>
              {Object.keys(TAX_CATEGORY_STYLES).map((k) => (
                <option key={k} value={k}>{t(`renovation.taxCategory.${k}`, { defaultValue: k })}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-text">{t("renovation.catalog.searchLabel")}</label>
            <input
              type="text"
              value={catalogFilter.search}
              onChange={(e) => setCatalogFilter((f) => ({ ...f, search: e.target.value }))}
              placeholder={t("renovation.catalog.searchPlaceholder")}
              className="rounded-lg border border-surface-border px-3 py-2 text-sm w-full sm:w-56"
            />
          </div>
          {(catalogFilter.system || catalogFilter.taxCategory || catalogFilter.search) && (
            <button
              onClick={() => setCatalogFilter({ system: "", taxCategory: "", search: "" })}
              className="text-xs text-brand hover:underline sm:pb-2"
            >
              {t("renovation.catalog.clearFilters")}
            </button>
          )}
        </div>
      </Panel>

      <span className="tab-panel-count">
        {t(filteredCatalog.length === 1 ? "renovation.catalog.count_one" : "renovation.catalog.count_other", { count: filteredCatalog.length })}
        {filteredCatalog.length !== catalog.length ? ` ${t("renovation.catalog.countOf", { total: catalog.length })}` : ""}
      </span>

      {/* Grouped catalog */}
      {catalogLoading ? (
        <p className="loading-text">{t("renovation.catalog.loading")}</p>
      ) : Object.keys(groupedCatalog).length === 0 ? (
        <Panel>
          <div className="empty-state">
            <p className="empty-state-text">{t("renovation.catalog.empty")}</p>
          </div>
        </Panel>
      ) : (
        Object.entries(groupedCatalog).map(([system, entries]) => (
          <CatalogSystemGroup key={system} system={system} entries={entries} />
        ))
      )}
    </div>
  );
}

/** @deprecated Use RenovationCatalog named export instead */
export default RenovationCatalog;

// ─── Catalog System Group ─────────────────────────────────────────────────────

function CatalogSystemGroup({ system, entries }) {
  const { t } = useTranslation("owner");
  const [expanded, setExpanded] = useState(false);
  const label = t(`renovation.buildingSystem.${system}`, { defaultValue: system });
  const preview = expanded ? entries : entries.slice(0, 3);
  const hasMore = entries.length > 3;

  return (
    <Section title={label}>
      <Panel bodyClassName="p-0">
        <div className="divide-y divide-slate-100">
          {preview.map((entry) => (
            <CatalogEntryRow key={entry.code} entry={entry} />
          ))}
        </div>
        {hasMore && (
          <div
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 border-t border-surface-divider cursor-pointer hover:bg-surface-subtle transition-colors text-sm text-muted select-none"
            onClick={() => setExpanded((e) => !e)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
              className={cn("w-4 h-4 transition-transform duration-200", expanded ? "rotate-180" : "")}>
              <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
            {expanded ? t("renovation.catalog.showLess") : t("renovation.catalog.showAll", { count: entries.length })}
          </div>
        )}
      </Panel>
    </Section>
  );
}

// ─── Catalog Entry Row ────────────────────────────────────────────────────────

function CatalogEntryRow({ entry }) {
  const { t } = useTranslation("owner");
  const [open, setOpen] = useState(false);
  const accounting = t(`renovation.deductibility.${entry.accountingTreatment}`, { defaultValue: entry.accountingTreatment });

  return (
    <div>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-subtle transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground">{entry.label}</span>
            <span className="text-xs text-foreground-dim font-mono">{entry.code}</span>
          </div>
          <div className="text-xs text-muted mt-0.5">{accounting}</div>
          <div className="flex items-center gap-2 flex-wrap mt-1.5">
            <TaxBadge category={entry.taxCategory} />
            <TimingBadge sensitivity={entry.timingSensitivity} />
          </div>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
          className={cn("w-4 h-4 text-foreground-dim shrink-0 transition-transform duration-200", open ? "rotate-180" : "")}>
          <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
        </svg>
      </div>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-50 bg-surface-subtle/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="font-medium text-muted-text">{t("renovation.catalog.deductibilityLabel")}</span>
              <p className="text-muted mt-0.5">{entry.typicalDeductibility}</p>
            </div>
            <div>
              <span className="font-medium text-muted-text">{t("renovation.catalog.deductiblePortion")}</span>
              <p className="text-muted mt-0.5">{entry.deductiblePct}%</p>
            </div>
            <div>
              <span className="font-medium text-muted-text">{t("renovation.catalog.timingGuidanceLabel")}</span>
              <p className="text-muted mt-0.5">
                {t(`renovation.buildingSystem.${entry.timingSensitivity}`, { defaultValue: "—" })}
              </p>
            </div>
            <div>
              <span className="font-medium text-muted-text">{t("renovation.catalog.notesLabel")}</span>
              <p className="text-muted mt-0.5">{entry.notes || "—"}</p>
            </div>
            {entry.assetLinkable && (
              <div className="col-span-full">
                <Badge variant="brand" size="sm">
                  {t("renovation.catalog.assetLinkable")}
                </Badge>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
