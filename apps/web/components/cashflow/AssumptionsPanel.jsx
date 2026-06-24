/**
 * AssumptionsPanel — NPV assumptions (discount/cap/defer/property value) for a
 * cashflow plan. Editable when the plan is DRAFT. Shared by the plan detail page
 * and the planning workspace's Decision panel.
 */
import { useState, useEffect } from "react";
import Panel from "../layout/Panel";
import { authHeaders } from "../../lib/api";

export default function AssumptionsPanel({ plan, isDraft, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [vals,    setVals]    = useState({
    discountRatePct:  plan.discountRatePct  ?? 4,
    capRatePct:       plan.capRatePct       ?? 5,
    deferYears:       plan.deferYears       ?? 3,
    propertyValueChf: plan.propertyValueChf ?? "",
  });

  // Sync when plan reloads
  useEffect(() => {
    if (!editing) {
      setVals({
        discountRatePct:  plan.discountRatePct  ?? 4,
        capRatePct:       plan.capRatePct       ?? 5,
        deferYears:       plan.deferYears       ?? 3,
        propertyValueChf: plan.propertyValueChf ?? "",
      });
    }
  }, [plan, editing]);

  function set(field, v) { setVals((prev) => ({ ...prev, [field]: v })); }

  async function save() {
    setSaving(true); setError("");
    try {
      const body = {
        discountRatePct:  parseFloat(vals.discountRatePct),
        capRatePct:       parseFloat(vals.capRatePct),
        deferYears:       parseInt(vals.deferYears, 10),
        propertyValueChf: vals.propertyValueChf !== "" ? parseFloat(vals.propertyValueChf) : null,
      };
      if ([body.discountRatePct, body.capRatePct, body.deferYears].some(isNaN)) {
        setError("All rate fields must be valid numbers."); setSaving(false); return;
      }
      const res  = await fetch(`/api/cashflow-plans/${plan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Save failed");
      setEditing(false);
      onUpdated();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  const Field = ({ label, field, suffix, step = "0.1", min = "0" }) => (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-foreground-dim uppercase tracking-wide">{label}</span>
      {editing ? (
        <input
          type="number" step={step} min={min}
          value={vals[field]}
          onChange={(e) => set(field, e.target.value)}
          className="border border-surface-border rounded px-2 py-1 text-sm w-28 tabular-nums"
        />
      ) : (
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {vals[field] !== "" && vals[field] != null ? `${vals[field]}${suffix}` : "—"}
        </span>
      )}
    </div>
  );

  return (
    <Panel
      title="NPV Assumptions"
      actions={isDraft && !editing && (
        <button onClick={() => setEditing(true)} className="text-xs text-brand-dark hover:underline">
          Edit
        </button>
      )}
    >
      <div className="flex flex-wrap gap-6">
        <Field label="Discount rate"    field="discountRatePct"  suffix="%" />
        <Field label="Cap rate"         field="capRatePct"       suffix="%" />
        <Field label="Defer window"     field="deferYears"       suffix=" yr" step="1" min="1" />
        <Field label="Property value"   field="propertyValueChf" suffix=" CHF" step="10000" />
      </div>
      {editing && (
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-surface-divider">
          <button
            onClick={save} disabled={saving}
            className="bg-brand text-white text-sm font-medium px-4 py-1.5 rounded hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save assumptions"}
          </button>
          <button
            onClick={() => { setEditing(false); setError(""); }}
            className="text-sm text-foreground-dim hover:text-foreground"
          >
            Cancel
          </button>
          {error && <span className="text-xs text-destructive-text">{error}</span>}
        </div>
      )}
      <p className="text-xs text-foreground-dim mt-3">
        Used to compute the Invest / Defer / Neglect NPV verdict below.
        {!isDraft && " Edit the plan to change these assumptions."}
      </p>
    </Panel>
  );
}
