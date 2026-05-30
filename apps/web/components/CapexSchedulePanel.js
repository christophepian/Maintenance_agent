/**
 * CapexSchedulePanel — Forward capex schedule derived from asset depreciation.
 *
 * Receives a buildingId (from the shared selector in NOITrendPanel) and fetches
 * GET /buildings/:id/capex-schedule which returns yearly capex buckets for the
 * projection horizon (default 5 years).
 *
 * Bar chart: total capex per year, with deductible portion shaded darker.
 * Below the chart: assets nearing EOL that fall beyond the projection horizon.
 * Used in /manager/finance?tab=planning below NOITrendPanel.
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "next-i18next";
import { authHeaders } from "../lib/api";
import { formatChf } from "../lib/format";
import { cn } from "../lib/utils";
import Panel from "./layout/Panel";

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

  const maxChf = schedule ? Math.max(...schedule.map((s) => s.totalChf), 1) : 1;

  const hasData = schedule !== null && schedule.some((s) => s.totalChf > 0 || s.assetCount > 0);

  const totalDeductibleChf = schedule ? schedule.reduce((s, b) => s + b.deductibleChf, 0) : 0;
  const subtitle = meta
    ? `${meta.fromYear}–${meta.toYear} · ${t("manager:capexSchedule.text.totalLabel")} ${formatChf(meta.totalProjectedChf)}`
    : undefined;
  const subtitleDetail = schedule && totalDeductibleChf > 0
    ? `${formatChf(totalDeductibleChf)} ${t("manager:capexSchedule.legend.deductible").toLowerCase()} · ${formatChf(meta.totalProjectedChf - totalDeductibleChf)} ${t("manager:capexSchedule.legend.capitalized").toLowerCase()}`
    : undefined;

  const missingDateCount = excludedAssets.filter((a) => a.reason === "MISSING_INSTALLATION_DATE").length;

  return (
    <Panel title={t("manager:capexSchedule.title.forwardCapex")}>
      <div className="space-y-4">

        {/* Subtitle */}
        {subtitle && (
          <div>
            <p className="text-xs font-medium text-muted-text">{subtitle}</p>
            {subtitleDetail && <p className="text-xs text-foreground-dim">{subtitleDetail}</p>}
          </div>
        )}

        {/* Error */}
        {error && <div className="notice notice-err">{error}</div>}

        {/* Loading */}
        {loading && <p className="loading-text">{t("manager:capexSchedule.text.loading")}</p>}

        {/* Empty — no building selected */}
        {!buildingId && !loading && (
          <p className="text-sm text-foreground-dim">{t("manager:capexSchedule.text.selectBuilding")}</p>
        )}

        {/* Empty — building has assets but none with replacement timelines */}
        {!loading && buildingId && schedule !== null && !hasData && (
          <div className="empty-state">
            <p className="empty-state-text">{t("manager:capexSchedule.text.noAssets")}</p>
            <p className="text-xs text-foreground-dim mt-1">{t("manager:capexSchedule.text.noAssetsHint")}</p>
          </div>
        )}

        {/* Excluded assets — missing installation date */}
        {!loading && missingDateCount > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 space-y-1">
            <p className="text-xs font-medium text-amber-800">
              {t("manager:capexSchedule.text.excludedWarning", { count: missingDateCount })}
            </p>
            <ul className="space-y-0.5">
              {excludedAssets
                .filter((a) => a.reason === "MISSING_INSTALLATION_DATE")
                .map((a) => (
                  <li key={a.assetId} className="text-xs text-amber-700 flex gap-1.5">
                    <span className="shrink-0 mt-px">·</span>
                    <span>
                      <span className="font-medium">{a.assetName}</span>
                      {" — "}
                      <span className="text-amber-600">{t("manager:capexSchedule.text.missingDateHint")}</span>
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {/* ── Bar chart ── */}
        {!loading && hasData && (
          <div className="space-y-5">
            <div className="space-y-4" role="list" aria-label="Capex schedule">
              {schedule.map((bucket) => {
                const barWidthPct = Math.round((bucket.totalChf / maxChf) * 100);
                const deductibleBarPct = maxChf > 0
                  ? Math.round((bucket.deductibleChf / maxChf) * 100)
                  : 0;
                return (
                  <div key={bucket.year} role="listitem" className="space-y-1.5">

                    {/* Year · bar · total */}
                    <div className="flex items-center gap-3">
                      <span className="w-10 shrink-0 text-right font-mono text-xs text-muted">
                        {bucket.year}
                      </span>
                      <div className="flex-1 min-w-0 relative h-4 bg-surface-hover rounded overflow-hidden">
                        {bucket.totalChf > 0 && (
                          <>
                            <div
                              className="absolute inset-y-0 left-0 bg-amber-200 rounded"
                              style={{ width: `${barWidthPct}%` }}
                            />
                            {deductibleBarPct > 0 && (
                              <div
                                className="absolute inset-y-0 left-0 bg-amber-500 rounded"
                                style={{ width: `${deductibleBarPct}%` }}
                              />
                            )}
                          </>
                        )}
                      </div>
                      <span
                        className={cn(
                          "w-24 shrink-0 text-right font-mono text-xs font-semibold",
                          bucket.totalChf > 0 ? "text-amber-800" : "text-foreground-dim",
                        )}
                      >
                        {bucket.totalChf > 0 ? formatChf(bucket.totalChf) : "—"}
                      </span>
                    </div>

                    {/* Asset list for this year */}
                    {bucket.items && bucket.items.length > 0 && (
                      <div className="pl-14 space-y-0.5">
                        {bucket.items.map((item) => (
                          <div
                            key={item.assetId}
                            className="flex items-baseline justify-between gap-3 text-xs"
                          >
                            <span className="flex items-center gap-1.5 min-w-0">
                              <span
                                className={cn(
                                  "inline-block w-1.5 h-1.5 rounded-full shrink-0",
                                  item.deductiblePct > 0 ? "bg-amber-500" : "bg-amber-200",
                                )}
                              />
                              <span className="text-muted-text truncate">{item.assetName}</span>
                            </span>
                            {item.estimatedCostChf > 0 && (
                              <span className="shrink-0 font-mono text-foreground-dim">
                                {formatChf(item.estimatedCostChf)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend + note */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded bg-amber-500 shrink-0" />
                {t("manager:capexSchedule.legend.deductible")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded bg-amber-200 shrink-0" />
                {t("manager:capexSchedule.legend.capitalized")}
              </span>
              <span className="text-foreground-dim italic ml-auto">
                {t("manager:capexSchedule.text.chartNote")}
              </span>
            </div>
          </div>
        )}

        {/* ── Nearing EOL beyond horizon ── */}
        {!loading && nearingEolAssets.length > 0 && (
          <div className="rounded-md border border-surface-border bg-surface-subtle divide-y divide-slate-200">

            {/* Section header */}
            <div className="px-3 py-2">
              <p className="text-xs font-medium text-muted-dark">
                {t("manager:capexSchedule.text.nearingEolTitle", { toYear: meta?.toYear })}
              </p>
              <p className="text-xs text-foreground-dim mt-0.5">
                {t("manager:capexSchedule.text.nearingEolHint")}
              </p>
            </div>

            {/* Asset rows */}
            <div className="divide-y divide-slate-100">
              {nearingEolAssets.map((a) => (
                <div key={a.assetId} className="flex items-center gap-3 px-3 py-2 text-xs">
                  {/* Depreciation badge */}
                  <span className="shrink-0 w-10 text-right font-mono text-foreground-dim">
                    {Math.round(a.depreciationPct)}%
                  </span>
                  {/* Asset name */}
                  <span className="flex-1 min-w-0 font-medium text-muted-dark truncate">
                    {a.assetName}
                  </span>
                  {/* Due year */}
                  <span className="shrink-0 text-muted">
                    {t("manager:capexSchedule.text.nearingEolYear", { year: a.estimatedReplacementYear })}
                  </span>
                  {/* Cost */}
                  {a.estimatedCostChf > 0 && (
                    <span className="shrink-0 w-24 text-right font-mono text-foreground-dim">
                      {formatChf(a.estimatedCostChf)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </Panel>
  );
}
