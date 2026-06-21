/**
 * FinancingPanel — building market value + mortgage data entry.
 *
 * Feeds the levered (FCFE) NPV layer: setting a market value and mortgage(s)
 * unlocks LTV, DSCR, WACC and the equity IRR shown in the NPV panel.
 *
 * Props:
 *   buildingId — the building to manage financing for
 *   onChanged  — called after any save/delete so the NPV panel can recompute
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "next-i18next";
import { authHeaders } from "../lib/api";
import { formatChf } from "../lib/format";
import Panel from "./layout/Panel";

const AMORT_TYPES = ["ANNUITY", "LINEAR", "INTEREST_ONLY"];

const INPUT_SM = "border border-surface-border rounded px-2 py-1 text-xs bg-surface text-foreground focus:outline-none focus:border-blue-400";

const EMPTY_FORM = {
  lenderName: "",
  originalPrincipalChf: "",
  currentBalanceChf: "",
  interestRatePct: "",
  amortizationType: "ANNUITY",
  annualAmortizationChf: "",
  maturityDate: "",
};

export default function FinancingPanel({ buildingId, onChanged }) {
  const { t } = useTranslation("manager");

  const [marketValueChf, setMarketValueChf] = useState(null);
  const [mortgages, setMortgages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Market value edit state
  const [editingValue, setEditingValue] = useState(false);
  const [valueInput, setValueInput] = useState("");
  const [savingValue, setSavingValue] = useState(false);

  // Add-mortgage form state
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [savingForm, setSavingForm] = useState(false);

  const load = useCallback(async () => {
    if (!buildingId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/buildings/${buildingId}/mortgages`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to load financing");
      setMarketValueChf(json.data.marketValueChf ?? null);
      setMortgages(json.data.mortgages ?? []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [buildingId]);

  useEffect(() => { load(); }, [load]);

  const totalDebt = mortgages.reduce((s, m) => s + (m.currentBalanceChf ?? 0), 0);
  const ltvPct = marketValueChf > 0 ? Math.round((totalDebt / marketValueChf) * 1000) / 10 : null;

  async function saveValue() {
    setSavingValue(true);
    setError("");
    try {
      const parsed = valueInput === "" ? null : Number(valueInput);
      const res = await fetch(`/api/buildings/${buildingId}/valuation`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ marketValueChf: parsed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Save failed");
      setEditingValue(false);
      await load();
      onChanged?.();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSavingValue(false);
    }
  }

  async function addMortgage() {
    setSavingForm(true);
    setError("");
    try {
      const body = {
        lenderName: form.lenderName || null,
        originalPrincipalChf: Number(form.originalPrincipalChf),
        currentBalanceChf: Number(form.currentBalanceChf),
        interestRatePct: Number(form.interestRatePct),
        amortizationType: form.amortizationType,
        annualAmortizationChf:
          form.amortizationType === "LINEAR" && form.annualAmortizationChf !== ""
            ? Number(form.annualAmortizationChf) : null,
        maturityDate: form.maturityDate || null,
      };
      const res = await fetch(`/api/buildings/${buildingId}/mortgages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Save failed");
      setForm(EMPTY_FORM);
      setAdding(false);
      await load();
      onChanged?.();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSavingForm(false);
    }
  }

  async function removeMortgage(id) {
    if (!window.confirm(t("manager:financing.confirmDelete"))) return;
    setError("");
    try {
      const res = await fetch(`/api/mortgages/${id}`, { method: "DELETE", headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Delete failed");
      await load();
      onChanged?.();
    } catch (e) {
      setError(String(e?.message || e));
    }
  }

  function setField(k, v) { setForm((prev) => ({ ...prev, [k]: v })); }

  return (
    <Panel title={t("manager:financing.title")}>
      <p className="text-xs text-foreground-dim mb-4">{t("manager:financing.subtitle")}</p>

      {error && <div className="notice notice-err mb-3 text-sm">{error}</div>}
      {loading && <p className="loading-text">…</p>}

      {!loading && (
        <div className="space-y-5">
          {/* ── Market value ── */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-medium text-foreground-dim uppercase tracking-wide block">
                {t("manager:financing.marketValue")}
              </span>
              {!editingValue ? (
                <span className="text-base font-semibold tabular-nums text-foreground">
                  {marketValueChf != null ? formatChf(marketValueChf) : <span className="text-foreground-dim font-normal">{t("manager:financing.noValue")}</span>}
                </span>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-foreground-dim">CHF</span>
                  <input
                    type="number" min={0} step={10000} autoFocus
                    value={valueInput}
                    onChange={(e) => setValueInput(e.target.value)}
                    className="w-36 border border-surface-border rounded px-2 py-1 text-sm tabular-nums"
                  />
                  <button onClick={saveValue} disabled={savingValue} className="bg-slate-800 text-white text-xs font-medium px-3 py-1 rounded hover:bg-slate-700 disabled:opacity-50">
                    {savingValue ? t("manager:financing.saving") : t("manager:financing.save")}
                  </button>
                  <button onClick={() => setEditingValue(false)} className="text-xs text-foreground-dim hover:text-foreground">
                    {t("manager:financing.cancel")}
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {ltvPct != null && (
                <span className="text-xs text-foreground-dim">
                  {t("manager:financing.ltv")} <strong className="text-foreground tabular-nums">{ltvPct}%</strong>
                </span>
              )}
              {!editingValue && (
                <button
                  onClick={() => { setValueInput(marketValueChf != null ? String(marketValueChf) : ""); setEditingValue(true); }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {t("manager:financing.edit")}
                </button>
              )}
            </div>
          </div>

          {/* ── Mortgages ── */}
          <div className="border-t border-surface-divider pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-foreground-dim uppercase tracking-wide">
                {t("manager:financing.mortgages")}
              </span>
              {!adding && (
                <button onClick={() => setAdding(true)} className="text-xs text-blue-600 hover:underline">
                  + {t("manager:financing.addMortgage")}
                </button>
              )}
            </div>

            {mortgages.length === 0 && !adding && (
              <p className="text-xs text-foreground-dim">{t("manager:financing.noMortgages")}</p>
            )}

            {mortgages.length > 0 && (
              <div className="divide-y divide-surface-divider rounded-lg border border-surface-border">
                {mortgages.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-foreground">
                        {m.lenderName || t("manager:financing.mortgages")}
                      </span>
                      <div className="text-xs text-foreground-dim">
                        {formatChf(m.currentBalanceChf)} · {m.interestRatePct}% · {t(`manager:financing.amortizationType.${m.amortizationType}`)}
                        {m.maturityDate && <span> · {t("manager:financing.maturity")} {new Date(m.maturityDate).getFullYear()}</span>}
                      </div>
                    </div>
                    <button onClick={() => removeMortgage(m.id)} className="text-xs text-foreground-dim hover:text-red-600 shrink-0">
                      {t("manager:financing.delete")}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add form */}
            {adding && (
              <div className="mt-3 rounded-lg border border-surface-border bg-surface-subtle p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t("manager:financing.lender")}>
                    <input value={form.lenderName} onChange={(e) => setField("lenderName", e.target.value)}
                      placeholder={t("manager:financing.lenderPlaceholder")} className={INPUT_SM} />
                  </Field>
                  <Field label={t("manager:financing.rate")}>
                    <input type="number" min={0} step={0.1} value={form.interestRatePct}
                      onChange={(e) => setField("interestRatePct", e.target.value)} className={INPUT_SM} />
                  </Field>
                  <Field label={t("manager:financing.originalPrincipal")}>
                    <input type="number" min={0} step={10000} value={form.originalPrincipalChf}
                      onChange={(e) => setField("originalPrincipalChf", e.target.value)} className={INPUT_SM} />
                  </Field>
                  <Field label={t("manager:financing.balance")}>
                    <input type="number" min={0} step={10000} value={form.currentBalanceChf}
                      onChange={(e) => setField("currentBalanceChf", e.target.value)} className={INPUT_SM} />
                  </Field>
                  <Field label={t("manager:financing.amortization")}>
                    <select value={form.amortizationType} onChange={(e) => setField("amortizationType", e.target.value)} className={INPUT_SM}>
                      {AMORT_TYPES.map((a) => (
                        <option key={a} value={a}>{t(`manager:financing.amortizationType.${a}`)}</option>
                      ))}
                    </select>
                  </Field>
                  {form.amortizationType === "LINEAR" && (
                    <Field label={t("manager:financing.annualAmortization")}>
                      <input type="number" min={0} step={1000} value={form.annualAmortizationChf}
                        onChange={(e) => setField("annualAmortizationChf", e.target.value)} className={INPUT_SM} />
                    </Field>
                  )}
                  <Field label={t("manager:financing.maturity")}>
                    <input type="date" value={form.maturityDate}
                      onChange={(e) => setField("maturityDate", e.target.value)} className={INPUT_SM} />
                  </Field>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <button onClick={addMortgage} disabled={savingForm}
                    className="bg-slate-800 text-white text-xs font-medium px-3 py-1.5 rounded hover:bg-slate-700 disabled:opacity-50">
                    {savingForm ? t("manager:financing.saving") : t("manager:financing.save")}
                  </button>
                  <button onClick={() => { setAdding(false); setForm(EMPTY_FORM); }} className="text-xs text-foreground-dim hover:text-foreground">
                    {t("manager:financing.cancel")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-foreground-dim">{label}</span>
      {children}
    </label>
  );
}
