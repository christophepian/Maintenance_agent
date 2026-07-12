/**
 * Per-building accounting statements — the ledger balance sheet (financial
 * position), per-tenant opening receivables, and the analytical view (equity
 * bridge, KPIs, account movements). Extracted from the building reporting page
 * and hosted in Finance → accounting behind a building selector.
 */

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "next-i18next";
import Panel from "../layout/Panel";
import { authHeaders } from "../../lib/api";
import { fmtChf as rFmtChf } from "./ReportingShared";
import { cn } from "../../lib/utils";

function displayDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

// WS-B: read-only balance sheet (financial position) for one building, as-of a date.
export function BuildingBalanceSheet({ buildingId }) {
  const { t } = useTranslation("manager");
  const todayStr = new Date().toISOString().slice(0, 10);
  const [asOf, setAsOf] = useState(todayStr);
  const [data, setData] = useState(null);
  const [closes, setCloses] = useState([]);
  const [fixedAssets, setFixedAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  const load = useCallback(async () => {
    if (!buildingId) return;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ buildingId, asOf });
    try {
      const [bsRes, closesRes, assetsRes] = await Promise.all([
        fetch(`/api/ledger/balance-sheet?${params}`, { headers: authHeaders() }),
        fetch(`/api/ledger/closes?buildingId=${buildingId}`, { headers: authHeaders() }),
        fetch(`/api/fixed-assets?buildingId=${buildingId}`, { headers: authHeaders() }),
      ]);
      const bsJson = await bsRes.json();
      if (!bsRes.ok) throw new Error(bsJson?.error?.message || t("buildingsId.reporting.failedToLoad"));
      setData(bsJson.data ?? null);
      const closesJson = await closesRes.json().catch(() => ({}));
      setCloses(closesRes.ok ? (closesJson.data ?? []) : []);
      const assetsJson = await assetsRes.json().catch(() => ({}));
      setFixedAssets(assetsRes.ok ? (assetsJson.data ?? []) : []);
    } catch {
      setError(t("buildingsId.reporting.failedToLoad"));
    } finally {
      setLoading(false);
    }
  }, [buildingId, asOf, t]);

  useEffect(() => { load(); }, [load]);

  const viewYear = Number(asOf.slice(0, 4));
  const yearClose = closes.find((c) => c.fiscalYear === viewYear && c.status === "CLOSED");

  const runClose = useCallback(async (reopen) => {
    setActionBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/ledger/${reopen ? "reopen-year" : "close-year"}`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ buildingId, fiscalYear: viewYear }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || t("buildingsId.reporting.failedToLoad"));
      await load();
    } catch (e) {
      setError(e.message || t("buildingsId.reporting.failedToLoad"));
    } finally {
      setActionBusy(false);
    }
  }, [buildingId, viewYear, load, t]);

  const runDepreciation = useCallback(async () => {
    setActionBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/fixed-assets/run-depreciation`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ asOf }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || t("buildingsId.reporting.failedToLoad"));
      await load();
    } catch (e) {
      setError(e.message || t("buildingsId.reporting.failedToLoad"));
    } finally {
      setActionBusy(false);
    }
  }, [asOf, load, t]);

  const renderLine = (line) => {
    const isDeduction = line.displayCents < 0;
    return (
      <div key={line.accountId} className="flex justify-between gap-3 py-1.5 text-sm border-b border-surface-border/60 last:border-0">
        <span className="text-muted-dark">{line.accountCode ? `${line.accountCode} · ` : ""}{line.accountName}</span>
        <span className={cn("font-mono shrink-0", isDeduction ? "text-foreground-dim" : "text-foreground")}>
          {isDeduction ? `(${rFmtChf(Math.abs(line.displayCents))})` : rFmtChf(line.displayCents)}
        </span>
      </div>
    );
  };

  const assets = data?.assets ?? [];
  const liabilities = data?.liabilities ?? [];
  const differenceCents = data?.differenceCents ?? 0;
  const hasData = assets.length > 0 || liabilities.length > 0;
  const resultKey = differenceCents >= 0 ? "bsUnclosedSurplus" : "bsUnclosedDeficit";

  return (
    <div className="space-y-4">
      <label className="inline-block text-xs text-muted">
        {t("buildingsId.reporting.asOf")}
        <input
          type="date"
          value={asOf}
          max={todayStr}
          onChange={(e) => setAsOf(e.target.value)}
          className="block mt-1 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-sm text-foreground"
        />
      </label>

      {error && <p className="text-sm text-destructive-text">{error}</p>}
      {loading && <p className="text-sm text-muted">{t("buildingsId.reporting.loadingEllipsis")}</p>}
      {!loading && !error && data && !hasData && (
        <p className="text-sm text-muted">{t("buildingsId.reporting.bsEmpty")}</p>
      )}

      {!loading && !error && data && hasData && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Panel>
              <h3 className="text-sm font-semibold text-foreground mb-2">{t("buildingsId.reporting.bsAssets")}</h3>
              {assets.map(renderLine)}
              <div className="flex justify-between pt-2 mt-1 border-t border-surface-border text-sm font-semibold">
                <span>{t("buildingsId.reporting.bsTotalAssets")}</span>
                <span className="font-mono">{rFmtChf(data.totalAssetsCents ?? 0)}</span>
              </div>
            </Panel>
            <Panel>
              <h3 className="text-sm font-semibold text-foreground mb-2">{t("buildingsId.reporting.bsLiabilities")}</h3>
              {liabilities.map(renderLine)}
              <div className="flex justify-between pt-2 mt-1 border-t border-surface-border text-sm font-semibold">
                <span>{t("buildingsId.reporting.bsTotalLiabilities")}</span>
                <span className="font-mono">{rFmtChf(data.totalLiabilitiesCents ?? 0)}</span>
              </div>
            </Panel>
          </div>

          {/* D1(a): assets − liabilities residual = the period result not yet closed to equity */}
          {Math.abs(differenceCents) >= 2 && !yearClose && (
            <div className="flex items-start gap-3 rounded-2xl border border-info-ring bg-info-light px-5 py-4">
              <span className="mt-0.5 text-info-text text-lg shrink-0">≡</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-info-text mb-0.5">
                  {t(`buildingsId.reporting.${resultKey}`, { amount: rFmtChf(Math.abs(differenceCents)) })}
                </p>
                <p className="text-xs text-info-text/80">{t("buildingsId.reporting.bsUnclosedHint")}</p>
              </div>
            </div>
          )}

          {/* WS-E: year-end close control */}
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-surface-border bg-surface-hover px-5 py-3">
            <div className="text-sm">
              <span className="font-semibold text-foreground">{t("buildingsId.reporting.yearEndClose", { year: viewYear })}</span>
              <span className={cn("ml-2 rounded-full px-2 py-0.5 text-xs font-medium", yearClose ? "bg-success-light text-success-text" : "bg-warning-light text-warning-text")}>
                {yearClose ? t("buildingsId.reporting.closed") : t("buildingsId.reporting.open")}
              </span>
              {yearClose && (
                <span className="ml-2 text-xs text-foreground-dim">
                  {t("buildingsId.reporting.resultToEquity", { amount: rFmtChf(yearClose.retainedEarningsCents) })}
                </span>
              )}
            </div>
            <button
              onClick={() => runClose(!!yearClose)}
              disabled={actionBusy}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity no-underline disabled:opacity-50",
                yearClose ? "border border-surface-border text-muted-dark hover:opacity-80" : "bg-brand text-white hover:opacity-90",
              )}
            >
              {actionBusy ? t("buildingsId.reporting.loadingEllipsis") : yearClose ? t("buildingsId.reporting.reopenYear") : t("buildingsId.reporting.closeYear")}
            </button>
          </div>

          {/* WS-D: fixed-asset register */}
          {fixedAssets.length > 0 && (
            <Panel>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-foreground">{t("buildingsId.reporting.fixedAssets")}</h3>
                <button
                  onClick={runDepreciation}
                  disabled={actionBusy}
                  className="shrink-0 rounded-lg border border-surface-border px-3 py-1 text-xs font-semibold text-muted-dark hover:opacity-80 disabled:opacity-50"
                >
                  {t("buildingsId.reporting.runDepreciation")}
                </button>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between gap-3 text-xs text-foreground-dim font-medium border-b border-surface-border pb-1">
                  <span>{t("buildingsId.reporting.faName")}</span>
                  <span className="flex gap-4">
                    <span className="w-24 text-right">{t("buildingsId.reporting.faCost")}</span>
                    <span className="w-24 text-right">{t("buildingsId.reporting.faAccumDep")}</span>
                    <span className="w-24 text-right">{t("buildingsId.reporting.faBookValue")}</span>
                  </span>
                </div>
                {fixedAssets.map((a) => (
                  <div key={a.id} className="flex justify-between gap-3 py-1 text-sm">
                    <span className="text-muted-dark truncate">{a.name}</span>
                    <span className="flex gap-4 font-mono shrink-0">
                      <span className="w-24 text-right text-foreground">{rFmtChf(a.costCents)}</span>
                      <span className="w-24 text-right text-foreground-dim">({rFmtChf(a.accumulatedDepreciationCents)})</span>
                      <span className="w-24 text-right text-foreground">{rFmtChf(a.bookValueCents)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

// WS-F: per-tenant opening receivables — entry, control total, aging, settle.
export function OpeningReceivablesPanel({ buildingId }) {
  const { t } = useTranslation("manager");
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ tenantName: "", amountChf: "", dueDate: "" });

  const load = useCallback(async () => {
    if (!buildingId) return;
    try {
      const res = await fetch(`/api/opening-receivables?buildingId=${buildingId}`, { headers: authHeaders() });
      const json = await res.json();
      if (res.ok) setReport(json.data ?? null);
    } catch { /* leave prior */ }
  }, [buildingId]);

  useEffect(() => { load(); }, [load]);

  const add = useCallback(async () => {
    const amountCents = Math.round(parseFloat(form.amountChf) * 100);
    if (!form.tenantName.trim() || !amountCents || amountCents <= 0) return;
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/opening-receivables`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ buildingId, tenantName: form.tenantName.trim(), amountCents, dueDate: form.dueDate || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || t("buildingsId.reporting.failedToLoad"));
      setForm({ tenantName: "", amountChf: "", dueDate: "" });
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }, [buildingId, form, load, t]);

  const settle = useCallback(async (id) => {
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/opening-receivables/${id}/settle`, { method: "POST", headers: authHeaders() });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j?.error?.message || t("buildingsId.reporting.failedToLoad")); }
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }, [load, t]);

  if (!report || (report.items.length === 0 && report.control.importLumpCents === 0)) {
    // Nothing imported and nothing entered — hide the panel entirely.
    if (!report || report.control.importLumpCents === 0) return null;
  }

  const variance = report.control.varianceCents;
  return (
    <Panel>
      <h3 className="text-sm font-semibold text-foreground mb-2">{t("buildingsId.reporting.openingReceivables")}</h3>
      {error && <p className="text-sm text-destructive-text mb-2">{error}</p>}

      <div className="flex flex-wrap gap-4 text-sm mb-3">
        <span className="text-foreground-dim">{t("buildingsId.reporting.orImportLump")}: <span className="font-mono text-foreground">{rFmtChf(report.control.importLumpCents)}</span></span>
        <span className="text-foreground-dim">{t("buildingsId.reporting.orEntered")}: <span className="font-mono text-foreground">{rFmtChf(report.control.enteredCents)}</span></span>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", variance === 0 ? "bg-success-light text-success-text" : "bg-warning-light text-warning-text")}>
          {variance === 0 ? t("buildingsId.reporting.orMatched") : t("buildingsId.reporting.orVariance", { amount: rFmtChf(variance) })}
        </span>
      </div>

      {report.items.length > 0 && (
        <div className="space-y-1 mb-3">
          {report.items.map((it) => (
            <div key={it.id} className="flex items-center justify-between gap-3 py-1 text-sm border-b border-surface-border/60 last:border-0">
              <span className="text-muted-dark truncate">{it.tenantName}{it.dueDate ? ` · ${displayDate(it.dueDate)}` : ""}</span>
              <span className="flex items-center gap-3 shrink-0">
                <span className="font-mono text-foreground">{rFmtChf(it.amountCents)}</span>
                {it.status === "OPEN" ? (
                  <button onClick={() => settle(it.id)} disabled={busy} className="rounded-lg border border-surface-border px-2 py-0.5 text-xs font-semibold text-muted-dark hover:opacity-80 disabled:opacity-50">{t("buildingsId.reporting.orSettle")}</button>
                ) : (
                  <span className="rounded-full bg-success-light px-2 py-0.5 text-xs font-medium text-success-text">{t("buildingsId.reporting.orSettled")}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <input value={form.tenantName} onChange={(e) => setForm({ ...form, tenantName: e.target.value })} placeholder={t("buildingsId.reporting.orTenant")} className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-sm text-foreground" />
        <input value={form.amountChf} onChange={(e) => setForm({ ...form, amountChf: e.target.value })} type="number" placeholder={t("buildingsId.reporting.orAmount")} className="w-28 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-sm text-foreground" />
        <input value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} type="date" className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-sm text-foreground" />
        <button onClick={add} disabled={busy} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">{t("buildingsId.reporting.orAdd")}</button>
      </div>
    </Panel>
  );
}

// WS-C: analytical accounting view — equity bridge, KPIs, account movements.
export function BuildingAnalytical({ buildingId }) {
  const { t } = useTranslation("manager");
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!buildingId) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/ledger/analytical?buildingId=${buildingId}&fiscalYear=${year}`, { headers: authHeaders() })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error?.message || t("buildingsId.reporting.failedToLoad"));
        return j;
      })
      .then((j) => { if (!cancelled) setData(j.data ?? null); })
      .catch(() => { if (!cancelled) setError(t("buildingsId.reporting.failedToLoad")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [buildingId, year, t]);

  const navBtn = "rounded-lg border border-surface-border px-2 py-1 text-sm text-muted-dark hover:opacity-80";
  const kpi = (label, value) => (
    <Panel key={label}>
      <p className="text-xs text-foreground-dim mb-1">{label}</p>
      <p className="text-lg font-semibold text-foreground">{value}</p>
    </Panel>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => setYear((y) => y - 1)} className={navBtn}>‹</button>
        <span className="text-sm font-semibold text-foreground w-12 text-center">{year}</span>
        <button onClick={() => setYear((y) => y + 1)} className={navBtn}>›</button>
      </div>

      {error && <p className="text-sm text-destructive-text">{error}</p>}
      {loading && <p className="text-sm text-muted">{t("buildingsId.reporting.loadingEllipsis")}</p>}

      {!loading && !error && data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {kpi(t("buildingsId.reporting.nav"), rFmtChf(data.kpis.navCents))}
            {kpi(t("buildingsId.reporting.mortgage"), rFmtChf(data.kpis.mortgageCents))}
            {kpi(t("buildingsId.reporting.propertyValue"), data.kpis.propertyValueCents != null ? rFmtChf(data.kpis.propertyValueCents) : "—")}
            {kpi(t("buildingsId.reporting.ltv"), data.kpis.ltvPct != null ? `${data.kpis.ltvPct}%` : "—")}
          </div>

          <Panel>
            <h3 className="text-sm font-semibold text-foreground mb-2">{t("buildingsId.reporting.equityBridge")}</h3>
            <div className="space-y-1 text-sm">
              {[
                [t("buildingsId.reporting.ebOpening"), data.equityBridge.openingEquityCents],
                [t("buildingsId.reporting.ebResult"), data.equityBridge.periodResultCents],
                [t("buildingsId.reporting.ebDistributions"), -data.equityBridge.distributionsCents],
              ].map(([label, cents]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-muted-dark">{label}</span>
                  <span className="font-mono text-foreground">{rFmtChf(cents)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2 mt-1 border-t border-surface-border font-semibold">
                <span>{t("buildingsId.reporting.ebClosing")}</span>
                <span className="font-mono">{rFmtChf(data.equityBridge.closingEquityCents)}</span>
              </div>
            </div>
          </Panel>

          {data.accountMovements.length > 0 && (
            <Panel>
              <h3 className="text-sm font-semibold text-foreground mb-2">{t("buildingsId.reporting.movements")}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-foreground-dim border-b border-surface-border">
                      <th className="text-left font-medium py-1">{t("buildingsId.reporting.mAccount")}</th>
                      <th className="text-right font-medium py-1">{t("buildingsId.reporting.mOpening")}</th>
                      <th className="text-right font-medium py-1">{t("buildingsId.reporting.mDebit")}</th>
                      <th className="text-right font-medium py-1">{t("buildingsId.reporting.mCredit")}</th>
                      <th className="text-right font-medium py-1">{t("buildingsId.reporting.mClosing")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.accountMovements.map((m) => (
                      <tr key={m.code || m.name} className="border-b border-surface-border/60">
                        <td className="py-1 text-muted-dark">{m.code ? `${m.code} · ` : ""}{m.name}</td>
                        <td className="py-1 text-right font-mono text-foreground-dim">{rFmtChf(m.openingCents)}</td>
                        <td className="py-1 text-right font-mono text-foreground">{rFmtChf(m.debitCents)}</td>
                        <td className="py-1 text-right font-mono text-foreground">{rFmtChf(m.creditCents)}</td>
                        <td className="py-1 text-right font-mono text-foreground">{rFmtChf(m.closingCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
