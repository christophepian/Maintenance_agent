/**
 * CapexSchedulePanel — Forward capex schedule derived from asset depreciation.
 *
 * Receives a buildingId (from the shared selector in NOITrendPanel) and fetches
 * GET /buildings/:id/capex-schedule which returns yearly capex buckets for the
 * projection horizon (default 5 years).
 *
 * Bar chart: total capex per year, with deductible portion shaded darker.
 * Used in /manager/finance?tab=planning below NOITrendPanel.
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "next-i18next";
import { authHeaders } from "../lib/api";
import { formatChf } from "../lib/format";
import { cn } from "../lib/utils";
import Panel from "./layout/Panel";

// ─── Bar chart ───────────────────────────────────────────────────────────────

function CapexBar({ bucket }) {
  const { totalChf, deductibleChf, year } = bucket;
  const deductiblePct = totalChf > 0 ? Math.round((deductibleChf / totalChf) * 100) : 0;

  return (
    <div className="flex items-center gap-3 text-sm" role="listitem">
      <span className="w-10 shrink-0 text-right font-mono text-slate-500">{year}</span>
      <div className="flex-1 min-w-0 relative h-5">
        {/* Full bar (total) */}
        <div className="absolute inset-0 rounded bg-amber-200" />
        {/* Deductible portion — darker amber */}
        {deductiblePct > 0 && (
          <div
            className="absolute inset-y-0 left-0 rounded bg-amber-500"
            style={{ width: `${deductiblePct}%` }}
          />
        )}
      </div>
      <div className="w-28 shrink-0 text-right">
        <span className="font-mono text-xs font-semibold text-amber-800">
          {totalChf > 0 ? `CHF ${formatChf(totalChf)}` : "—"}
        </span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CapexSchedulePanel({ buildingId }) {
  const { t } = useTranslation("manager");

  const [schedule, setSchedule] = useState(null);
  const [meta, setMeta] = useState(null);
  const [excludedAssets, setExcludedAssets] = useState([]);
  const [nearingEolAssets, setNearingEolAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchSchedule = useCallback(async (id) => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/buildings/${id}/capex-schedule`, {
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to load capex schedule");
      setSchedule(json.data?.schedule ?? []);
      setExcludedAssets(json.data?.excludedAssets ?? []);
      setNearingEolAssets(json.data?.nearingEolAssets ?? []);
      setMeta({
        buildingName: json.data?.buildingName,
        totalProjectedChf: json.data?.totalProjectedChf,
        fromYear: json.data?.fromYear,
        toYear: json.data?.toYear,
      });
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (buildingId) {
      setSchedule(null);
      setExcludedAssets([]);
      setNearingEolAssets([]);
      fetchSchedule(buildingId);
    }
  }, [buildingId, fetchSchedule]);

  // Max for proportional bar widths
  const maxChf = schedule ? Math.max(...schedule.map((s) => s.totalChf), 1) : 1;

  // Scale each bar relative to the max year
  const scaledSchedule = (schedule ?? []).map((s) => ({
    ...s,
    // reuse totalChf for width scaling — CapexBar handles it via parent width
    barWidthPct: Math.round((s.totalChf / maxChf) * 100),
  }));

  const hasData = schedule !== null && schedule.some((s) => s.totalChf > 0 || s.assetCount > 0);

  const subtitle = meta
    ? `${meta.fromYear}–${meta.toYear} · ${t("manager:capexSchedule.text.totalLabel")} CHF ${formatChf(meta.totalProjectedChf)}`
    : undefined;

  return (
    <Panel title={t("manager:capexSchedule.title.forwardCapex")}>
      <div className="space-y-4">
        {/* Subtitle */}
        {subtitle && (
          <p className="text-xs text-slate-500">{subtitle}</p>
        )}

        {/* Errors */}
        {error && <div className="notice notice-err">{error}</div>}

        {/* Loading */}
        {loading && (
          <p className="loading-text">{t("manager:capexSchedule.text.loading")}</p>
        )}

        {/* Empty — no building selected yet */}
        {!buildingId && !loading && (
          <p className="text-sm text-slate-400">
            {t("manager:capexSchedule.text.selectBuilding")}
          </p>
        )}

        {/* Empty — building has no assets with replacement timelines */}
        {!loading && buildingId && schedule !== null && !hasData && (
          <div className="empty-state">
            <p className="empty-state-text">{t("manager:capexSchedule.text.noAssets")}</p>
            <p className="text-xs text-slate-400 mt-1">
              {t("manager:capexSchedule.text.noAssetsHint")}
            </p>
          </div>
        )}

        {/* Excluded assets warning — assets missing installation date */}
        {!loading && excludedAssets.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-1.5">
            <p className="text-xs font-medium text-amber-800">
              {t("manager:capexSchedule.text.excludedWarning", {
                count: excludedAssets.filter((a) => a.reason === "MISSING_INSTALLATION_DATE").length,
              })}
            </p>
            <ul className="space-y-0.5">
              {excludedAssets
                .filter((a) => a.reason === "MISSING_INSTALLATION_DATE")
                .map((a) => (
                  <li key={a.assetId} className="text-xs text-amber-700 flex items-center gap-1">
                    <span className="shrink-0">·</span>
                    <span className="font-medium">{a.assetName}</span>
                    <span className="text-amber-600">
                      — {t("manager:capexSchedule.text.missingDateHint")}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {/* Chart */}
        {!loading && hasData && (
          <>
            <div className="space-y-3" role="list" aria-label="Capex schedule">
              {scaledSchedule.map((bucket) => (
                <div key={bucket.year} role="listitem" className="space-y-1">
                  {/* Bar row */}
                  <div className="flex items-center gap-3 text-sm">
                    <span className="w-10 shrink-0 text-right font-mono text-slate-500">
                      {bucket.year}
                    </span>
                    <div className="flex-1 min-w-0 relative h-5 bg-slate-100 rounded overflow-hidden">
                      {bucket.totalChf > 0 && (
                        <>
                          {/* Total bar */}
                          <div
                            className="absolute inset-y-0 left-0 bg-amber-200 rounded"
                            style={{ width: `${bucket.barWidthPct}%` }}
                          />
                          {/* Deductible portion */}
                          {bucket.deductibleChf > 0 && (
                            <div
                              className="absolute inset-y-0 left-0 bg-amber-500 rounded"
                              style={{
                                width: `${Math.round((bucket.deductibleChf / maxChf) * 100)}%`,
                              }}
                            />
                          )}
                        </>
                      )}
                    </div>
                    <span
                      className={cn(
                        "w-28 shrink-0 text-right font-mono text-xs font-semibold",
                        bucket.totalChf > 0 ? "text-amber-800" : "text-slate-400",
                      )}
                    >
                      {bucket.totalChf > 0 ? `CHF ${formatChf(bucket.totalChf)}` : "—"}
                    </span>
                  </div>

                  {/* Asset labels for this year */}
                  {bucket.items && bucket.items.length > 0 && (
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5" style={{ paddingLeft: "3.25rem" }}>
                      {bucket.items.map((item) => (
                        <span key={item.assetId} className="text-xs text-slate-500 flex items-center gap-1">
                          <span className={cn(
                            "inline-block w-1.5 h-1.5 rounded-full shrink-0",
                            item.deductiblePct > 0 ? "bg-amber-500" : "bg-amber-200",
                          )} />
                          {item.assetName}
                          {item.estimatedCostChf > 0 && (
                            <span className="text-slate-400">· CHF {formatChf(item.estimatedCostChf)}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded bg-amber-500" />
                {t("manager:capexSchedule.legend.deductible")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded bg-amber-200" />
                {t("manager:capexSchedule.legend.capitalized")}
              </span>
            </div>

            <p className="text-xs text-slate-400">
              {t("manager:capexSchedule.text.chartNote")}
            </p>
          </>
        )}

        {/* Nearing EOL beyond horizon */}
        {!loading && nearingEolAssets.length > 0 && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
            <div>
              <p className="text-xs font-medium text-slate-700">
                {t("manager:capexSchedule.text.nearingEolTitle", { toYear: meta?.toYear })}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {t("manager:capexSchedule.text.nearingEolHint")}
              </p>
            </div>
            <ul className="space-y-1">
              {nearingEolAssets.map((a) => (
                <li key={a.assetId} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="shrink-0 inline-block w-1.5 h-1.5 rounded-full bg-slate-400" />
                    <span className="font-medium text-slate-700 truncate">{a.assetName}</span>
                    <span className="text-slate-400 shrink-0">
                      · {t("manager:capexSchedule.text.nearingEolDepreciation", { pct: Math.round(a.depreciationPct) })}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-slate-500 font-mono">
                    {t("manager:capexSchedule.text.nearingEolYear", { year: a.estimatedReplacementYear })}
                    {a.estimatedCostChf > 0 && (
                      <span className="text-slate-400"> · CHF {formatChf(a.estimatedCostChf)}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}
