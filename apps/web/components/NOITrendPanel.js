/**
 * NOITrendPanel — Historical NOI (Net Operating Income) trendline.
 *
 * Fetches BuildingFinancialSnapshot rows for a selected building and
 * renders a horizontal bar chart of annual NOI, plus a Refresh button
 * that triggers server-side recomputation from ledger data.
 *
 * Used in /manager/finance?tab=planning and future owner planning surface.
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "next-i18next";
import { authHeaders } from "../lib/api";
import { formatChfCents } from "../lib/format";
import { cn } from "../lib/utils";
import Panel from "./layout/Panel";

// ─── Bar chart ───────────────────────────────────────────────────────────────

function BarChart({ snapshots }) {
  const maxNoi = Math.max(...snapshots.map((s) => Math.abs(s.netOperatingIncomeCents)), 1);

  return (
    <div className="space-y-2" role="list" aria-label="NOI trendline">
      {snapshots.map((s) => {
        const year = s.periodStart.slice(0, 4);
        const noi = s.netOperatingIncomeCents;
        const pct = Math.round((Math.abs(noi) / maxNoi) * 100);
        const positive = noi >= 0;
        return (
          <div key={s.periodStart} role="listitem" className="flex items-center gap-3 text-sm">
            <span className="w-10 shrink-0 text-right font-mono text-muted">{year}</span>
            <div className="flex-1 min-w-0">
              <div
                className={cn(
                  "h-5 rounded",
                  positive ? "bg-emerald-500" : "bg-red-400",
                )}
                style={{ width: `${pct}%` }}
                aria-label={`${year}: ${formatChfCents(noi)}`}
              />
            </div>
            <span
              className={cn(
                "w-28 shrink-0 text-right font-mono text-xs font-semibold",
                positive ? "text-emerald-700" : "text-red-600",
              )}
            >
              {formatChfCents(noi)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Building selector ────────────────────────────────────────────────────────

function BuildingSelect({ buildings, value, onChange }) {
  const { t } = useTranslation("manager");
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="noi-building-select" className="text-sm text-muted-text shrink-0">
        {t("manager:noiTrend.label.building")}
      </label>
      <select
        id="noi-building-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="form-select text-sm"
      >
        <option value="">{t("manager:noiTrend.label.selectBuilding")}</option>
        {buildings.map((b) => (
          <option key={b.buildingId} value={b.buildingId}>
            {b.buildingName}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NOITrendPanel({ onBuildingChange } = {}) {
  const { t } = useTranslation("manager");

  // Fetch buildings independently — DO NOT derive from portfolio prop.
  // The portfolio-summary endpoint filters by ownerId when the JWT has it set,
  // which would hide buildings the manager manages but doesn't own.
  const [buildings, setBuildings] = useState([]);
  const [buildingsLoading, setBuildingsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/buildings", { headers: authHeaders() });
        const json = await res.json();
        if (!cancelled && res.ok) {
          const list = (json.data ?? []).map((b) => ({
            buildingId: b.id,
            buildingName: b.name,
          }));
          setBuildings(list);
        }
      } finally {
        if (!cancelled) setBuildingsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const [selectedId, setSelectedId] = useState("");
  const [snapshots, setSnapshots] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");

  // Auto-select first building once the list loads
  useEffect(() => {
    if (buildings.length > 0 && !selectedId) {
      const first = buildings[0].buildingId;
      setSelectedId(first);
      onBuildingChange?.(first);
    }
  }, [buildings, selectedId, onBuildingChange]);

  const fetchSnapshots = useCallback(async (buildingId) => {
    if (!buildingId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/buildings/${buildingId}/financial-snapshots`, {
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to load snapshots");
      setSnapshots(json.data ?? []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) fetchSnapshots(selectedId);
  }, [selectedId, fetchSnapshots]);

  const handleRefresh = useCallback(async () => {
    if (!selectedId) return;
    setRefreshing(true);
    setRefreshError("");
    try {
      const res = await fetch(`/api/buildings/${selectedId}/financial-snapshots/refresh`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ years: 5 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to refresh");
      setSnapshots(json.data ?? []);
    } catch (e) {
      setRefreshError(String(e?.message || e));
    } finally {
      setRefreshing(false);
    }
  }, [selectedId]);

  const handleBuildingChange = (id) => {
    setSelectedId(id);
    setSnapshots(null);
    setError("");
    setRefreshError("");
    onBuildingChange?.(id);
  };

  // Filter to only annual snapshots (periodStart = Jan 1, periodEnd = Dec 31 same year)
  const annualSnapshots = (snapshots ?? []).filter((s) => {
    return s.periodStart.endsWith("-01-01") && s.periodEnd.endsWith("-12-31");
  });

  return (
    <Panel title={t("manager:noiTrend.title.historicalNoi")}>
      <div className="space-y-4">
        {/* Controls row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {buildingsLoading ? (
            <p className="text-sm text-foreground-dim">{t("manager:noiTrend.text.loading")}</p>
          ) : buildings.length > 0 ? (
            <BuildingSelect
              buildings={buildings}
              value={selectedId}
              onChange={handleBuildingChange}
            />
          ) : (
            <p className="text-sm text-muted">{t("manager:noiTrend.text.noBuildings")}</p>
          )}
          {selectedId && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="button-secondary text-sm"
              aria-label={t("manager:noiTrend.ariaLabel.refresh")}
            >
              {refreshing
                ? t("manager:noiTrend.text.refreshing")
                : t("manager:noiTrend.text.refreshData")}
            </button>
          )}
        </div>

        {/* Errors */}
        {error && <div className="notice notice-err">{error}</div>}
        {refreshError && <div className="notice notice-err">{refreshError}</div>}

        {/* Chart */}
        {loading && (
          <p className="loading-text">{t("manager:noiTrend.text.loading")}</p>
        )}

        {!loading && snapshots !== null && annualSnapshots.length === 0 && (
          <div className="empty-state">
            <p className="empty-state-text">{t("manager:noiTrend.text.noSnapshots")}</p>
            <p className="text-xs text-foreground-dim mt-1">
              {t("manager:noiTrend.text.noSnapshotsHint")}
            </p>
          </div>
        )}

        {!loading && annualSnapshots.length > 0 && (
          <>
            <BarChart snapshots={annualSnapshots} />
            <p className="text-xs text-foreground-dim">
              {t("manager:noiTrend.text.chartNote")}
            </p>
          </>
        )}
      </div>
    </Panel>
  );
}
