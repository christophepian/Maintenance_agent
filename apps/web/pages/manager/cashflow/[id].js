import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import Section from "../../../components/layout/Section";
import { authHeaders } from "../../../lib/api";
import { formatChfCents, formatDate, formatChf } from "../../../lib/format";

// ─── Constants ───────────────────────────────────────────────────────────────

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const STATUS_BADGE = {
  DRAFT: "bg-gray-100 text-gray-600",
  SUBMITTED: "bg-blue-100 text-blue-700",
  APPROVED: "bg-green-100 text-green-700",
};

const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMonth(year, month) {
  return `${MONTHS[month - 1]} ${year}`;
}

function statCards(buckets, hasOpeningBalance) {
  if (!buckets || buckets.length === 0) return {};
  const projected = buckets.filter((b) => !b.isActual);
  const next12 = projected.slice(0, 12);
  const totalIncome = next12.reduce((s, b) => s + b.projectedIncomeCents, 0);
  const totalCapex = projected.reduce((s, b) => s + b.scheduledCapexCents, 0);
  let peakCapex = { v: 0, b: null };
  let lowestBal = { v: Infinity, b: null };
  for (const b of projected) {
    if (b.scheduledCapexCents > peakCapex.v) peakCapex = { v: b.scheduledCapexCents, b };
  }
  if (hasOpeningBalance) {
    for (const b of buckets) {
      if (b.cumulativeBalanceCents < lowestBal.v) lowestBal = { v: b.cumulativeBalanceCents, b };
    }
  }
  return { totalIncome, totalCapex, peakCapex, lowestBal };
}

// ─── SVG Cashflow Chart ───────────────────────────────────────────────────────

function CashflowChart({ buckets, hasOpeningBalance }) {
  const [hovered, setHovered] = useState(null);

  if (!buckets || buckets.length === 0) {
    return <p className="loading-text">No cashflow data.</p>;
  }

  const W = 900, H = 280;
  const ML = 64, MR = 16, MT = 20, MB = 44;
  const cw = W - ML - MR;
  const ch = H - MT - MB;
  const midY = MT + ch / 2;

  const maxVal = Math.max(
    1,
    ...buckets.map((b) =>
      Math.max(b.projectedIncomeCents, b.projectedOpexCents + b.scheduledCapexCents)
    )
  );

  const slotW = cw / buckets.length;
  const barW = Math.max(2, slotW * 0.72);
  const barOff = (slotW - barW) / 2;

  function xSlot(i) { return ML + i * slotW; }
  function toH(cents) { return (cents / maxVal) * (ch / 2 - 6); }

  let lastActualIdx = -1;
  for (let i = 0; i < buckets.length; i++) {
    if (buckets[i].isActual) lastActualIdx = i;
  }

  const balancePoints = hasOpeningBalance
    ? buckets.map((b, i) => {
        const x = xSlot(i) + slotW / 2;
        const h = (b.cumulativeBalanceCents / maxVal) * (ch / 2 - 6);
        return `${x},${Math.max(MT, Math.min(H - MB, midY - h))}`;
      }).join(" ")
    : null;

  const labelEvery = Math.ceil(buckets.length / 12);
  const hovB = hovered !== null ? buckets[hovered] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 260 }}>
        {/* Y-axis gridlines */}
        {[0.25, 0.5, 0.75, 1].map((frac) => (
          <g key={frac}>
            <line x1={ML} y1={midY - (ch / 2 - 6) * frac} x2={W - MR} y2={midY - (ch / 2 - 6) * frac} stroke="#f1f5f9" strokeWidth="1" />
            <line x1={ML} y1={midY + (ch / 2 - 6) * frac} x2={W - MR} y2={midY + (ch / 2 - 6) * frac} stroke="#f1f5f9" strokeWidth="1" />
          </g>
        ))}
        <text x={ML - 4} y={MT + 12} textAnchor="end" fontSize="9" fill="#94a3b8">{formatChfCents(maxVal)}</text>
        <text x={ML - 4} y={H - MB - 4} textAnchor="end" fontSize="9" fill="#94a3b8">{formatChfCents(-maxVal)}</text>

        {/* Zero line */}
        <line x1={ML} y1={midY} x2={W - MR} y2={midY} stroke="#e2e8f0" strokeWidth="1" />

        {/* Historical / projected divider */}
        {lastActualIdx >= 0 && lastActualIdx < buckets.length - 1 && (
          <line
            x1={xSlot(lastActualIdx + 1)} y1={MT}
            x2={xSlot(lastActualIdx + 1)} y2={H - MB}
            stroke="#94a3b8" strokeWidth="1" strokeDasharray="4,2"
          />
        )}

        {/* Bars */}
        {buckets.map((b, i) => {
          const x = xSlot(i) + barOff;
          const iH = Math.max(0, toH(b.projectedIncomeCents));
          const oH = Math.max(0, toH(b.projectedOpexCents));
          const cH = Math.max(0, toH(b.scheduledCapexCents));
          return (
            <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              {hovered === i && <rect x={xSlot(i)} y={MT} width={slotW} height={ch} fill="#f8fafc" />}
              {iH > 0 && <rect x={x} y={midY - iH} width={barW} height={iH} fill={b.isActual ? "#16a34a" : "#86efac"} />}
              {oH > 0 && <rect x={x} y={midY} width={barW} height={oH} fill={b.isActual ? "#dc2626" : "#fca5a5"} />}
              {cH > 0 && <rect x={x} y={midY + oH} width={barW} height={cH} fill="#f59e0b" />}
            </g>
          );
        })}

        {/* Balance line */}
        {balancePoints && (
          <polyline points={balancePoints} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinejoin="round" />
        )}

        {/* X-axis */}
        <line x1={ML} y1={H - MB} x2={W - MR} y2={H - MB} stroke="#e2e8f0" strokeWidth="1" />
        {buckets.map((b, i) => {
          if (i % labelEvery !== 0) return null;
          return (
            <text key={i} x={xSlot(i) + slotW / 2} y={H - MB + 14} textAnchor="middle" fontSize="9" fill="#94a3b8">
              {MONTHS[b.month - 1]} {b.year}
            </text>
          );
        })}
      </svg>

      {/* Hover tooltip */}
      {hovB && (
        <div className="absolute top-2 right-2 bg-white border border-slate-200 rounded-lg shadow-md p-3 text-xs min-w-48 pointer-events-none z-10">
          <div className="font-semibold text-slate-700 mb-1.5">
            {fmtMonth(hovB.year, hovB.month)}
            <span className="ml-2 font-normal text-slate-400">{hovB.isActual ? "Actual" : "Projected"}</span>
          </div>
          <div className="flex justify-between gap-4 text-emerald-700">
            <span>Income</span><span className="font-mono">{formatChfCents(hovB.projectedIncomeCents)}</span>
          </div>
          <div className="flex justify-between gap-4 text-red-600">
            <span>OpEx</span><span className="font-mono">{formatChfCents(hovB.projectedOpexCents)}</span>
          </div>
          {hovB.scheduledCapexCents > 0 && (
            <div className="flex justify-between gap-4 text-amber-600">
              <span>CapEx</span><span className="font-mono">{formatChfCents(hovB.scheduledCapexCents)}</span>
            </div>
          )}
          <div className="border-t border-slate-100 mt-1.5 pt-1.5 flex justify-between gap-4 font-semibold">
            <span className={hovB.netCents >= 0 ? "text-emerald-700" : "text-red-600"}>Net</span>
            <span className={`font-mono ${hovB.netCents >= 0 ? "text-emerald-700" : "text-red-600"}`}>
              {formatChfCents(hovB.netCents)}
            </span>
          </div>
          {hovB.capexItems?.length > 0 && (
            <div className="mt-1.5 pt-1.5 border-t border-slate-100 space-y-0.5">
              {hovB.capexItems.slice(0, 4).map((ci, j) => (
                <div key={j} className="flex justify-between gap-4 text-amber-700">
                  <span className="truncate" style={{ maxWidth: 96 }}>{ci.assetName}</span>
                  <span className="font-mono">{formatChfCents(ci.costCents)}</span>
                </div>
              ))}
              {hovB.capexItems.length > 4 && <div className="text-slate-400">+{hovB.capexItems.length - 4} more</div>}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-emerald-600" />Income (actual)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-emerald-300" />Income (projected)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-red-500" />OpEx (actual)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-red-300" />OpEx (projected)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-amber-400" />CapEx</span>
        {hasOpeningBalance && <span className="flex items-center gap-1.5"><span className="inline-block w-5 h-0.5 bg-blue-500" />Cumulative balance</span>}
        {lastActualIdx >= 0 && <span className="flex items-center gap-1.5"><span className="inline-block w-5 h-px border-t border-dashed border-slate-400" />Historical / projected</span>}
      </div>
    </div>
  );
}

// ─── CapEx Event Table (interactive for DRAFT) ────────────────────────────────

function CapexEventTable({ buckets, overrides, timingRecommendations, planId, isDraft, onRefresh }) {
  // Build override lookup: assetId → override record
  const overrideByAsset = {};
  for (const ov of (overrides || [])) {
    overrideByAsset[ov.assetId] = ov;
  }
  // Build recommendation lookup: assetId → recommendation
  const recByAsset = {};
  for (const r of (timingRecommendations || [])) {
    recByAsset[r.assetId] = r;
  }

  // Collect upcoming events from projected buckets
  const events = [];
  if (buckets) {
    for (const b of buckets) {
      if (!b.isActual && b.capexItems?.length > 0) {
        for (const ci of b.capexItems) {
          events.push({ ...ci, year: b.year, month: b.month });
        }
      }
    }
  }
  events.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);

  if (events.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state-text">No scheduled CapEx events in the projection horizon.</p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="inline-table">
        <thead>
          <tr>
            <th>Asset</th>
            <th>Scheduled</th>
            <th className="text-right">Estimated cost</th>
            <th>Trade group</th>
            <th>Bundle</th>
            {isDraft && <th>Override</th>}
          </tr>
        </thead>
        <tbody>
          {events.map((ev, i) => {
            const ov = overrideByAsset[ev.assetId];
            const rec = recByAsset[ev.assetId];
            return (
              <CapexEventRow
                key={i}
                ev={ev}
                ov={ov}
                rec={rec}
                planId={planId}
                isDraft={isDraft}
                onRefresh={onRefresh}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CapexEventRow({ ev, ov, rec, planId, isDraft, onRefresh }) {
  const currentYear = new Date().getFullYear();
  const [shifting, setShifting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");

  async function handleShiftYear(newYear) {
    setShifting(true);
    setError("");
    try {
      const res = await fetch(`/api/cashflow-plans/${planId}/overrides`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          assetId: ev.assetId,
          originalYear: ev.isOverridden && ov ? ov.originalYear : ev.year,
          overriddenYear: newYear,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to add override");
      onRefresh();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setShifting(false);
    }
  }

  async function handleRemoveOverride() {
    if (!ov) return;
    setRemoving(true);
    setError("");
    try {
      const res = await fetch(`/api/cashflow-plans/${planId}/overrides/${ov.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to remove override");
      onRefresh();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setRemoving(false);
    }
  }

  // Year options: scheduled year ± 3 years, clamped to current+1 min
  const baseYear = ov ? ov.originalYear : ev.year;
  const minYear = Math.max(currentYear + 1, baseYear - 3);
  const maxYear = baseYear + 3;
  const yearOptions = [];
  for (let y = minYear; y <= maxYear; y++) {
    if (!ov || y !== ov.overriddenYear) yearOptions.push(y);
  }

  const isOverridden = ev.isOverridden || !!ov;
  const rowClass = isOverridden ? "italic text-slate-500" : "";

  return (
    <tr className={rowClass}>
      <td className="cell-bold">
        {isOverridden && (
          <span className="mr-1 text-amber-500 text-xs" title="Year overridden">⟳</span>
        )}
        {ev.assetName}
      </td>
      <td>
        {fmtMonth(ev.year, ev.month)}
        {isOverridden && ov && (
          <span className="ml-1 text-xs text-slate-400">(was {ov.originalYear})</span>
        )}
      </td>
      <td className="text-right font-mono">{formatChfCents(ev.costCents)}</td>
      <td>{ev.tradeGroup || "—"}</td>
      <td>{ev.bundleId ? <span className="status-pill bg-blue-50 text-blue-700">Bundled</span> : <span className="text-slate-400 text-xs">—</span>}</td>
      {isDraft && (
        <td>
          <div className="flex flex-col gap-1 min-w-48">
            {/* Advisor recommendation chip */}
            {rec && rec.recommendedYear !== (ov?.overriddenYear ?? ev.year) && (
              <button
                onClick={() => handleShiftYear(rec.recommendedYear)}
                disabled={shifting}
                className="text-left text-xs bg-violet-50 text-violet-700 border border-violet-200 rounded px-2 py-0.5 hover:bg-violet-100 disabled:opacity-50 w-fit"
                title={rec.rationale}
              >
                Advisor: {rec.direction} to {rec.recommendedYear}
                {rec.estimatedTaxSavingChf > 0 && (
                  <span className="ml-1 text-violet-500">→ save {formatChf(rec.estimatedTaxSavingChf)} tax</span>
                )}
              </button>
            )}
            {/* Shift year control */}
            <div className="flex items-center gap-1">
              <select
                onChange={(e) => e.target.value && handleShiftYear(Number(e.target.value))}
                value=""
                disabled={shifting}
                className="border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-600 disabled:opacity-50"
              >
                <option value="">Shift year…</option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              {isOverridden && (
                <button
                  onClick={handleRemoveOverride}
                  disabled={removing}
                  className="text-xs text-slate-400 hover:text-red-500 disabled:opacity-50"
                  title="Reset to baseline year"
                >
                  {removing ? "…" : "Reset"}
                </button>
              )}
            </div>
            {error && <span className="text-xs text-red-600">{error}</span>}
          </div>
        </td>
      )}
    </tr>
  );
}

// ─── Income Growth Rate Inline Editor ─────────────────────────────────────────

function IncomeGrowthRateEditor({ planId, currentRate, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(currentRate ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  function startEdit() {
    setValue(String(currentRate ?? 0));
    setEditing(true);
    setError("");
    // Focus on next tick after render
    setTimeout(() => inputRef.current?.select(), 0);
  }

  async function save() {
    const rate = parseFloat(value);
    if (isNaN(rate) || rate < 0 || rate > 20) {
      setError("Enter a rate between 0 and 20.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/cashflow-plans/${planId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ incomeGrowthRatePct: rate }),
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

  function handleKeyDown(e) {
    if (e.key === "Enter") save();
    if (e.key === "Escape") { setEditing(false); setError(""); }
  }

  if (!editing) {
    return (
      <button
        onClick={startEdit}
        className="text-sm text-slate-600 hover:text-blue-600 underline underline-offset-2 tabular-nums"
        title="Click to edit income growth rate"
      >
        Income growth: <span className="font-semibold">{currentRate ?? 0}%</span> / year
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-600">Income growth:</span>
      <input
        ref={inputRef}
        type="number"
        step="0.1"
        min="0"
        max="20"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={save}
        className="border border-blue-300 rounded px-2 py-0.5 text-sm w-20 tabular-nums"
        autoFocus
      />
      <span className="text-sm text-slate-500">% / year</span>
      {saving && <span className="text-xs text-slate-400">Saving…</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

// ─── Opening Balance Banner ───────────────────────────────────────────────────

function OpeningBalanceBanner({ planId, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    const chf = parseFloat(value);
    if (isNaN(chf) || chf < 0) { setError("Enter a valid CHF amount."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/cashflow-plans/${planId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ openingBalanceCents: Math.round(chf * 100) }),
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

  return (
    <div className="notice notice-warn flex flex-wrap items-center gap-3">
      <span className="text-sm">
        Opening balance not set — showing net flows only. Add an opening balance to see full cashflow position.
      </span>
      {!editing ? (
        <button
          onClick={() => setEditing(true)}
          className="text-sm font-medium text-amber-800 underline underline-offset-2 whitespace-nowrap"
        >
          Add opening balance
        </button>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-amber-800">CHF</span>
          <input
            type="number" min="0" step="100" placeholder="e.g. 50000"
            value={value} onChange={(e) => setValue(e.target.value)}
            className="border border-amber-300 rounded px-2 py-1 text-sm w-32"
            autoFocus
          />
          <button
            onClick={handleSave} disabled={saving}
            className="text-sm font-medium bg-amber-600 text-white px-3 py-1 rounded hover:bg-amber-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={() => { setEditing(false); setError(""); }} className="text-sm text-amber-700 underline">
            Cancel
          </button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      )}
    </div>
  );
}

// ─── RFP Candidate Panel (APPROVED plans only) ────────────────────────────────

function RfpCandidateCard({ planId, candidate }) {
  const [status, setStatus] = useState("idle"); // idle | creating | done | error
  const [rfpId, setRfpId] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleCreate() {
    setStatus("creating");
    setErrorMsg("");
    try {
      const res = await fetch(
        `/api/cashflow-plans/${planId}/rfp-candidates/${encodeURIComponent(candidate.groupKey)}/create-rfp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({}),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to create RFP");
      setRfpId(json.data.rfpId);
      setStatus("done");
    } catch (e) {
      setErrorMsg(String(e?.message || e));
      setStatus("error");
    }
  }

  const totalChf = candidate.totalEstimatedCostCents / 100;
  const sendDate = candidate.suggestedRfpSendDate
    ? new Date(candidate.suggestedRfpSendDate).toLocaleDateString("de-CH", { month: "long", year: "numeric" })
    : null;

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="font-semibold text-slate-800 text-sm">{candidate.tradeGroup}</span>
          <span className="text-xs text-slate-400 ml-2">{candidate.scheduledYear}</span>
        </div>
        <span className="text-sm font-semibold text-amber-700 tabular-nums shrink-0">
          CHF {totalChf.toLocaleString("de-CH")}
        </span>
      </div>

      <ul className="text-xs text-slate-500 space-y-0.5">
        {candidate.assets.map((a) => (
          <li key={a.assetId} className="flex items-center justify-between gap-2">
            <span>{a.assetName}{a.isOverridden && <em className="ml-1 text-violet-500">(shifted)</em>}</span>
            <span className="tabular-nums">CHF {(a.estimatedCostCents / 100).toLocaleString("de-CH")}</span>
          </li>
        ))}
      </ul>

      {sendDate && (
        <div className="text-xs text-slate-400">
          Send by <strong>{sendDate}</strong>
        </div>
      )}

      {errorMsg && <div className="notice notice-err text-xs">{errorMsg}</div>}

      {status === "done" || rfpId ? (
        <div className="flex items-center gap-2">
          <span className="status-pill bg-green-100 text-green-700">RFP created</span>
          <Link href={`/manager/rfps/${rfpId}`} className="text-xs text-blue-600 hover:underline">
            View RFP →
          </Link>
        </div>
      ) : (
        <button
          onClick={handleCreate}
          disabled={status === "creating"}
          className="bg-blue-600 text-white text-xs font-medium px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50 self-start"
        >
          {status === "creating" ? "Creating…" : "Create RFP"}
        </button>
      )}
    </div>
  );
}

function RfpCandidatesPanel({ planId }) {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!planId) return;
    setLoading(true);
    fetch(`/api/cashflow-plans/${planId}/rfp-candidates`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((json) => {
        if (json?.data) setCandidates(json.data);
      })
      .catch((e) => setError(String(e?.message || e)))
      .finally(() => setLoading(false));
  }, [planId]);

  if (loading) return <p className="loading-text">Loading RFP candidates…</p>;
  if (error) return <div className="notice notice-err text-sm">{error}</div>;
  if (candidates.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state-text">No CapEx items scheduled within the plan horizon.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {candidates.map((c) => (
        <RfpCandidateCard key={c.groupKey} planId={planId} candidate={c} />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CashflowPlanDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const loadPlan = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/cashflow-plans/${id}`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to load plan");
      setPlan(json.data);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  async function handleAction(endpoint) {
    setActionLoading(true);
    setActionError("");
    try {
      const res = await fetch(`/api/cashflow-plans/${id}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Action failed");
      await loadPlan();
    } catch (e) {
      setActionError(String(e?.message || e));
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <AppShell role="MANAGER">
        <PageShell>
          <PageContent><p className="loading-text">Loading cashflow plan…</p></PageContent>
        </PageShell>
      </AppShell>
    );
  }

  if (error || !plan) {
    return (
      <AppShell role="MANAGER">
        <PageShell>
          <PageContent>
            <div className="notice notice-err">{error || "Plan not found."}</div>
            <Link href="/manager/cashflow" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
              ← Back to plans
            </Link>
          </PageContent>
        </PageShell>
      </AppShell>
    );
  }

  const { cashflow } = plan;
  const buckets = cashflow?.buckets || [];
  const hasOpeningBalance = cashflow?.hasOpeningBalance ?? false;
  const timingRecommendations = cashflow?.timingRecommendations || [];
  const isDraft = plan.status === "DRAFT";
  const isReadOnly = plan.status !== "DRAFT";

  const stats = statCards(buckets, hasOpeningBalance);
  const isStale = plan.lastComputedAt && (Date.now() - new Date(plan.lastComputedAt).getTime()) > STALE_THRESHOLD_MS;

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader
          title={plan.name}
          subtitle={
            <div className="flex flex-wrap items-center gap-3">
              <span className={`status-pill ${STATUS_BADGE[plan.status] || "bg-gray-100 text-gray-600"}`}>
                {plan.status}
              </span>
              <span className="text-slate-400 text-xs">
                {plan.buildingId ? "Building plan" : "Portfolio plan"}
                {" · "}{plan.horizonMonths}-month horizon
              </span>
              {/* Income growth rate — editable in DRAFT, read-only otherwise */}
              {isDraft ? (
                <IncomeGrowthRateEditor
                  planId={plan.id}
                  currentRate={plan.incomeGrowthRatePct}
                  onUpdated={loadPlan}
                />
              ) : (
                <span className="text-slate-500 text-sm tabular-nums">
                  Income growth: <span className="font-semibold">{plan.incomeGrowthRatePct ?? 0}%</span> / year
                </span>
              )}
            </div>
          }
          actions={
            <Link href="/manager/cashflow" className="button-secondary text-sm">
              ← Plans
            </Link>
          }
        />
        <PageContent>

          {/* Stale warning */}
          {isStale && (
            <div className="notice notice-warn flex items-center justify-between mb-4">
              <span className="text-sm">
                The underlying asset forecast may have changed since this plan was last computed. Reload to refresh.
              </span>
              <button
                onClick={loadPlan}
                disabled={loading}
                className="text-sm font-medium text-amber-800 underline underline-offset-2 whitespace-nowrap ml-4"
              >
                Reload
              </button>
            </div>
          )}

          {/* Opening balance banner — only in DRAFT */}
          {!hasOpeningBalance && isDraft && (
            <div className="mb-4">
              <OpeningBalanceBanner planId={plan.id} onUpdated={loadPlan} />
            </div>
          )}

          {/* Read-only notice for submitted/approved */}
          {isReadOnly && (
            <div className="notice notice-info mb-4 text-sm">
              This plan is <strong>{plan.status.toLowerCase()}</strong> — editing is disabled.
            </div>
          )}

          {/* Stat cards */}
          <Section title="Summary">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="card p-4 flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">12-mo projected income</span>
                <span className="text-xl font-bold text-emerald-700">{formatChfCents(stats.totalIncome)}</span>
                <span className="text-xs text-gray-400">Next 12 projected months</span>
              </div>
              <div className="card p-4 flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total projected CapEx</span>
                <span className="text-xl font-bold text-amber-700">{formatChfCents(stats.totalCapex)}</span>
                <span className="text-xs text-gray-400">Over {plan.horizonMonths}-month horizon</span>
              </div>
              <div className="card p-4 flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Peak monthly CapEx</span>
                <span className="text-xl font-bold text-amber-700">{formatChfCents(stats.peakCapex?.v)}</span>
                <span className="text-xs text-gray-400">
                  {stats.peakCapex?.b ? fmtMonth(stats.peakCapex.b.year, stats.peakCapex.b.month) : "—"}
                </span>
              </div>
              <div className="card p-4 flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Lowest cumulative balance</span>
                {hasOpeningBalance ? (
                  <>
                    <span className={`text-xl font-bold ${(stats.lowestBal?.v ?? 0) < 0 ? "text-red-600" : "text-slate-800"}`}>
                      {formatChfCents(stats.lowestBal?.v)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {stats.lowestBal?.b ? fmtMonth(stats.lowestBal.b.year, stats.lowestBal.b.month) : "—"}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-xl font-bold text-slate-300">—</span>
                    <span className="text-xs text-gray-400">Set opening balance to see</span>
                  </>
                )}
              </div>
            </div>
          </Section>

          {/* Cashflow chart */}
          <Panel title="Monthly cashflow">
            <CashflowChart buckets={buckets} hasOpeningBalance={hasOpeningBalance} />
          </Panel>

          {/* CapEx event list — interactive in DRAFT, read-only otherwise */}
          <Panel
            title="Scheduled CapEx events"
            bodyClassName="p-0"
            actions={
              isDraft && timingRecommendations.length > 0 && (
                <span className="text-xs text-violet-600">
                  {timingRecommendations.length} advisor suggestion{timingRecommendations.length !== 1 ? "s" : ""} available
                </span>
              )
            }
          >
            <CapexEventTable
              buckets={buckets}
              overrides={plan.overrides}
              timingRecommendations={timingRecommendations}
              planId={plan.id}
              isDraft={isDraft}
              onRefresh={loadPlan}
            />
          </Panel>

          {/* Actions */}
          {(plan.status === "DRAFT" || plan.status === "SUBMITTED") && (
            <Panel>
              {actionError && <div className="notice notice-err mb-3">{actionError}</div>}
              <div className="flex items-center gap-3">
                {plan.status === "DRAFT" && (
                  <button
                    onClick={() => handleAction("submit")}
                    disabled={actionLoading}
                    className="bg-blue-600 text-white text-sm font-medium px-5 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {actionLoading ? "Submitting…" : "Submit for approval"}
                  </button>
                )}
                {plan.status === "SUBMITTED" && (
                  <button
                    onClick={() => handleAction("approve")}
                    disabled={actionLoading}
                    className="bg-green-600 text-white text-sm font-medium px-5 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    {actionLoading ? "Approving…" : "Approve plan"}
                  </button>
                )}
                <span className="text-xs text-slate-400">
                  {plan.status === "DRAFT" && "Submit this plan for manager / owner approval."}
                  {plan.status === "SUBMITTED" && "Approve this plan to unlock RFP generation."}
                </span>
              </div>
            </Panel>
          )}

          {/* RFP candidates — APPROVED plans only */}
          {plan.status === "APPROVED" && (
            <Panel title="RFP Candidates">
              <RfpCandidatesPanel planId={plan.id} />
            </Panel>
          )}

        </PageContent>
      </PageShell>
    </AppShell>
  );
}
