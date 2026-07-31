/**
 * YieldGoalSeekPanel — the Planning what-if, as a target × lever matrix.
 *
 * Collapsed by default (a one-line strip) so the page opens calm. Expand it and
 * you get a matrix: reachable target yields across the top (ending in a "max
 * reachable" ceiling column — no perpetually-unreachable column), the realistic
 * levers down the side, each capped at what's actually possible and filled
 * least-disruptive-first. Rows are compact (progressive disclosure): click one to
 * see HOW it gets there. The management fee is a variable (defaulted to the fee
 * detected on the statements). Hovering "operating costs" pulls the reporting
 * expense breakdown; the renovation lever hands its accretive works to the SAME
 * onSimulate the accordion uses. It also emits accretive/dilutive annotations so
 * the single opportunity list below badges each row.
 *
 * The heavy figures (value, NOI, per-lever ceilings, fee, opex drivers) are
 * fetched once; all allocation/column maths run client-side so it stays instant.
 */
import { useState, useEffect, useMemo, useCallback, Fragment } from "react";
import { useTranslation } from "next-i18next";
import { cn } from "../lib/utils";
import { formatChf as fchf } from "../lib/format";
import { authHeaders } from "../lib/api";

const pct = (x, d = 1) => (x == null ? "—" : `${(x * 100).toFixed(d)}%`);
// CHF amounts are always whole francs (no cents) in this panel.
const chf = (v) => (v == null || !Number.isFinite(v) ? "—" : fchf(Math.round(v)));
// Compact francs for tight matrix cells (drop the "CHF " prefix).
const num = (v) => (v == null || !Number.isFinite(v) ? "—" : fchf(Math.round(v)).replace(/^CHF\s*/, ""));
const round2 = (n) => Math.round(n * 100) / 100;

function trailingYearIso() {
  const to = new Date();
  const from = new Date(to);
  from.setFullYear(from.getFullYear() - 1);
  from.setDate(from.getDate() + 1);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

export default function YieldGoalSeekPanel({ building, onSimulate, onAnnotationsChange }) {
  const { t } = useTranslation("manager");
  const buildingId = building?.id ?? null;

  const [expanded, setExpanded] = useState(false);
  const [data, setData]         = useState(null);
  const [opps, setOpps]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  // Which levers are enabled (the user can untick one to test a constraint) and
  // which rows are expanded. Fee is driven by feeToPct (its "cut to" slider).
  const [enabled, setEnabled]   = useState({ opex: true, occ: true, rent: true, reno: true });
  const [openRows, setOpenRows] = useState(() => new Set());
  const [feeTodayPct, setFeeTodayPct] = useState(null);   // defaults to the detected fee
  const [feeToPct, setFeeToPct]       = useState(1);      // cut the fee down to this %

  // Reset the tool when the building changes.
  useEffect(() => {
    setExpanded(false);
    setEnabled({ opex: true, occ: true, rent: true, reno: true });
    setOpenRows(new Set());
    setFeeTodayPct(null);
    setFeeToPct(1);
  }, [buildingId]);

  // One fetch per building. target=3 is arbitrary — the base figures, per-lever
  // ceilings, the detected fee and the accretive flags are all target-independent.
  useEffect(() => {
    if (!buildingId) { setData(null); setOpps([]); return; }
    const { from, to } = trailingYearIso();
    let cancelled = false;
    setLoading(true); setError("");
    Promise.all([
      fetch(`/api/buildings/${buildingId}/yield-goalseek?from=${from}&to=${to}&target=3&mgmtFeePct=5`, { headers: authHeaders() }).then((r) => r.json()),
      fetch(`/api/buildings/${buildingId}/renovation-opportunities`, { headers: authHeaders() }).then((r) => r.json()).catch(() => null),
    ])
      .then(([gs, op]) => {
        if (cancelled) return;
        if (!gs?.data) { setError(t("planning.goalSeek.error", { defaultValue: "Couldn't compute the yield model for this building." })); setData(null); return; }
        setData(gs.data);
        setFeeTodayPct(gs.data.currentFeePct ?? 5);
        setOpps(Array.isArray(op?.data) ? op.data : []);
      })
      .catch(() => { if (!cancelled) setError(t("planning.goalSeek.error", { defaultValue: "Couldn't compute the yield model for this building." })); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [buildingId, t]);

  // Emit accretive/dilutive annotations for the accordion while the tool is open.
  useEffect(() => {
    if (!onAnnotationsChange) return;
    const lines = data?.levers?.renovation?.lines ?? [];
    if (!expanded || !lines.length) { onAnnotationsChange(null); return; }
    const map = {};
    for (const l of lines) {
      const label = l.accretive
        ? t("planning.goalSeek.accretive", { defaultValue: "Accretive" })
        : t("planning.goalSeek.dilutive", { defaultValue: "NPV+ / dilutive" });
      map[l.assetId] = { accretive: l.accretive, label: `${label} · ${l.marginalYieldPct.toFixed(1)}%` };
    }
    onAnnotationsChange(map);
  }, [expanded, data, onAnnotationsChange, t]);

  // Clear annotations on unmount (e.g. deselecting the building).
  useEffect(() => () => { onAnnotationsChange?.(null); }, [onAnnotationsChange]);

  const feeMaxChf = useMemo(() => {
    if (!data || feeTodayPct == null) return 0;
    return Math.max(0, ((feeTodayPct - feeToPct) / 100) * data.rentRollChf);
  }, [data, feeTodayPct, feeToPct]);

  // The levers, in fill order (least-disruptive first). max === null ⇒ the
  // underlying benchmark is missing ⇒ the lever can't be assessed (greyed).
  const levers = useMemo(() => {
    if (!data) return [];
    const occ = data.occupancyRate, rentRoll = data.rentRollChf;
    const potentialRent = occ > 0 ? rentRoll / occ : rentRoll;
    const flags = data.strategyFlags ?? {};
    const lv = data.levers ?? {};
    const rn = lv.renovation ?? {};
    const opexCost = lv.opex?.operatingCostChf ?? null;
    const opexMax = lv.opex?.headroomChf ?? null;
    return [
      { key: "opex", kind: "toggle", sign: "−",
        name: t("planning.goalSeek.lever.opex", { defaultValue: "Cut operating costs" }),
        max: opexMax, off: false,
        opexCost, leanestChf: opexMax != null && opexCost != null ? opexCost - opexMax : null },
      { key: "occ", kind: "toggle", sign: "+",
        name: t("planning.goalSeek.lever.occupancy", { defaultValue: "Lift occupancy" }),
        max: Math.max(0, 1 - occ) * potentialRent, off: false, occ },
      { key: "rent", kind: "toggle", sign: "+",
        name: t("planning.goalSeek.lever.rent", { defaultValue: "Raise rent to market" }),
        max: lv.rent?.marketGapAnnualChf ?? null, off: !!flags.rentAggressive,
        months: lv.rent?.avgLeaseRemainingMonths ?? null },
      { key: "reno", kind: "toggle", sign: "+",
        name: t("planning.goalSeek.lever.renovation", { defaultValue: "Renovate" }),
        max: rn.annualUpliftChf ?? 0, off: !!flags.renovation,
        accretiveCount: rn.accretiveCount ?? 0, capexChf: rn.capexChf ?? 0, simulate: (rn.accretiveCount ?? 0) > 0 },
      { key: "fee", kind: "fee", sign: "+",
        name: t("planning.goalSeek.lever.fee", { defaultValue: "Management fee" }),
        off: feeToPct < 1 && !!flags.selfManage },
    ];
  }, [data, feeToPct, t]);

  const levMax    = useCallback((L) => (L.kind === "fee" ? feeMaxChf : L.max), [feeMaxChf]);
  const levActive = useCallback((L) => (L.kind === "fee" ? feeMaxChf > 0 : !!enabled[L.key] && L.max != null && L.max > 0), [enabled, feeMaxChf]);

  // Columns: reachable target steps above today, ending in the actual ceiling.
  const matrix = useMemo(() => {
    if (!data) return null;
    const V = data.valueChf, NOI = data.currentNoiChf, cur = data.currentYieldPct;
    const enabledMax = levers.reduce((s, L) => s + (levActive(L) ? levMax(L) : 0), 0);
    const ceilingYield = V > 0 ? (NOI + enabledMax) / V * 100 : cur;
    const targets = [];
    for (let tp = Math.ceil((cur + 0.01) * 2) / 2; tp < ceilingYield - 0.05 && targets.length < 5; tp += 0.5) {
      targets.push({ pct: round2(tp), isMax: false });
    }
    targets.push({ pct: round2(ceilingYield), isMax: true });
    const cols = targets.map((tg) => {
      let rem = (tg.pct / 100) * V - NOI;
      const gap = rem, use = {};
      for (const L of levers) {
        if (!levActive(L)) { use[L.key] = 0; continue; }
        const c = Math.max(0, Math.min(rem, levMax(L)));
        use[L.key] = c; rem -= c;
      }
      return { ...tg, gap, use, reachable: rem <= 1 };
    });
    return { cols, ceilingYield, hasLevers: enabledMax > 0 };
  }, [data, levers, levActive, levMax]);

  const toggleRow = useCallback((k) => setOpenRows((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; }), []);
  const openTool  = useCallback(() => setExpanded(true), []);
  const simulateAccretive = useCallback(() => {
    if (!buildingId || !data) return;
    const ids = new Set((data.levers?.renovation?.lines ?? []).filter((l) => l.accretive).map((l) => l.assetId));
    const items = opps.filter((o) => ids.has(o.assetId));
    if (items.length > 0 && onSimulate) onSimulate(items, buildingId);
  }, [data, opps, buildingId, onSimulate]);

  if (!buildingId) return null;
  if (loading && !data) return <div className="h-14 animate-pulse rounded-xl bg-surface-hover" />;
  if (error) return <p className="text-sm text-destructive-text">{error}</p>;
  if (!data || data.valueChf <= 0) {
    return data ? <p className="rounded-xl border border-surface-border bg-surface px-4 py-3 text-xs text-muted">{t("planning.goalSeek.noValuation", { defaultValue: "Add a building or unit valuation to model yield targets." })}</p> : null;
  }

  const cur = data.currentYieldPct;

  // ── Collapsed strip ──
  if (!expanded) {
    return (
      <button onClick={openTool} aria-expanded="false"
        className="flex w-full items-center gap-3 rounded-xl border border-surface-border bg-surface px-4 py-3 text-left transition-colors hover:border-brand-ring">
        <span className="shrink-0">
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-foreground-dim">{t("planning.goalSeek.currentYield", { defaultValue: "Net yield" })}</span>
          <span className="text-[15px] font-extrabold tabular-nums text-foreground">{pct(cur / 100)}</span>
        </span>
        <span className="flex-1 text-[13px] text-muted">
          {t("planning.goalSeek.teaserMatrix", { defaultValue: "See which targets are reachable — and exactly what each lever must do", ceil: pct((matrix?.ceilingYield ?? cur) / 100) })}
        </span>
        <span className="shrink-0 text-xs text-foreground-dim">▾</span>
      </button>
    );
  }

  // ── Expanded matrix ──
  const cols = matrix?.cols ?? [];
  const ncol = cols.length + 1;
  return (
    <div className="rounded-xl border border-brand-ring bg-surface p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[12px] font-bold uppercase tracking-wide text-foreground-dim">
          {t("planning.goalSeek.title", { defaultValue: "Reach a target yield" })}
          {data.periodTo && <span className="ml-2 text-[10px] font-medium normal-case tracking-normal text-foreground-dim">{t("planning.goalSeek.basedOn", { defaultValue: "based on {{y}}", y: data.periodTo.slice(0, 4) })}</span>}
          {data.strategyLabel && <span className="ml-2 rounded-full border border-surface-border bg-surface-subtle px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-muted">{data.strategyLabel}</span>}
        </span>
        <button onClick={() => setExpanded(false)} className="shrink-0 text-xs font-medium text-muted hover:text-foreground">{t("planning.goalSeek.collapse", { defaultValue: "Collapse" })} ▴</button>
      </div>
      <p className="mb-3 text-[12.5px] leading-relaxed text-muted">
        {t("planning.goalSeek.matrixLede", { defaultValue: "Each lever is capped at what's realistic. Read down a column for the mix that reaches that target; the last column is as far as every lever combined can take you. Click a lever to see how, hover operating costs for the breakdown, and untick a lever or raise the fee floor to watch the ceiling move." })}
      </p>

      {!matrix?.hasLevers ? (
        <p className="rounded-lg border border-surface-border bg-surface-subtle px-3 py-2.5 text-[13px] text-muted">
          {t("planning.goalSeek.noLevers", { defaultValue: "No levers can be assessed for this building yet — add a rent benchmark (market price / m²) and a period with operating costs on file." })}
        </p>
      ) : (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[520px] border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="w-[38%] min-w-[210px] border-b-2 border-surface-border px-2 py-1.5 text-left" />
                {cols.map((c, i) => (
                  <th key={i} className={cn("border-b-2 px-2 py-1.5 text-right", c.isMax ? "border-brand bg-brand-light" : "border-surface-border")}>
                    <div className={cn("text-[15px] font-extrabold tabular-nums", c.isMax ? "text-brand" : "text-foreground")}>{c.pct.toFixed(c.isMax ? 2 : 1)}%</div>
                    <div className="text-[9.5px] font-semibold uppercase tracking-wide text-foreground-dim">{c.isMax ? t("planning.goalSeek.maxReachable", { defaultValue: "max reachable" }) : t("planning.goalSeek.target", { defaultValue: "target" })}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Gap row */}
              <tr className="bg-surface-subtle">
                <td className="px-2 py-1.5 text-left text-[12px] font-semibold text-muted">{t("planning.goalSeek.gapRow", { defaultValue: "Gap needed (NOI / yr)" })}</td>
                {cols.map((c, i) => (
                  <td key={i} className={cn("px-2 py-1.5 text-right font-semibold tabular-nums text-muted", c.isMax && "bg-brand-light")}>+{chf(c.gap)}</td>
                ))}
              </tr>

              {/* Lever rows (compact + progressive-disclosure detail) */}
              {levers.map((L) => {
                const active = levActive(L), mx = levMax(L), open = openRows.has(L.key);
                const unavailable = L.kind !== "fee" && L.max == null;
                return (
                  <Fragment key={L.key}>
                    <tr className={cn("border-b border-surface-divider", !active && "opacity-50")}>
                      <td className="px-2 py-1.5 text-left align-top">
                        {/* Keep the checkbox and the (link-bearing) overlay OUTSIDE the
                            expand buttons — no nested interactive elements. */}
                        <div className="flex w-full items-center gap-2">
                          {L.kind === "toggle" && (
                            <input type="checkbox" checked={!!enabled[L.key]} disabled={unavailable}
                              onChange={(e) => setEnabled((s) => ({ ...s, [L.key]: e.target.checked }))}
                              className="h-3.5 w-3.5 shrink-0 accent-brand disabled:opacity-40" aria-label={L.name} />
                          )}
                          <button type="button" onClick={() => toggleRow(L.key)} className="flex items-center gap-2 text-left">
                            <span className="font-semibold text-foreground">{L.name}</span>
                            {L.off && <span title={t("planning.goalSeek.offStrategyTip", { defaultValue: "Against your stated strategy" })} className="h-[7px] w-[7px] shrink-0 rounded-full bg-warning-ring" />}
                          </button>
                          {L.key === "opex" && <OpexOverlay data={data} buildingId={buildingId} t={t} />}
                          <button type="button" onClick={() => toggleRow(L.key)} className="ml-auto flex items-center gap-2">
                            <span className="whitespace-nowrap text-[11px] font-medium text-foreground-dim">
                              {L.kind === "fee" ? `→ ${feeToPct.toFixed(1)}%` : unavailable ? t("planning.goalSeek.noData", { defaultValue: "no data" }) : `max ${L.sign}${chf(mx)}`}
                            </span>
                            <span className={cn("shrink-0 text-[10px] text-foreground-dim transition-transform", open && "rotate-90")}>▶</span>
                          </button>
                        </div>
                      </td>
                      {cols.map((c, i) => {
                        const v = c.use[L.key] || 0;
                        const maxed = active && Math.abs(v - mx) < 1 && v > 0;
                        return (
                          <td key={i} className={cn("px-2 py-1.5 text-right tabular-nums", c.isMax && "bg-brand-light",
                            !active || v <= 0 ? "text-foreground-dim" : maxed ? "font-bold text-success-text" : "font-semibold text-foreground")}>
                            {!active ? "·" : v <= 0 ? "—" : `${L.sign}${num(v)}`}
                          </td>
                        );
                      })}
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={ncol} className="px-2 pb-3 pl-8 pt-0 text-left">
                          <LeverDetail L={L} data={data} feeTodayPct={feeTodayPct} setFeeTodayPct={setFeeTodayPct}
                            feeToPct={feeToPct} setFeeToPct={setFeeToPct} feeMaxChf={feeMaxChf}
                            onSimulate={simulateAccretive} t={t} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="font-bold text-success-text">CHF</span> {t("planning.goalSeek.legendMaxed", { defaultValue: "lever maxed out" })}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-[7px] w-[7px] rounded-full bg-warning-ring" /> {t("planning.goalSeek.legendOffStrategy", { defaultValue: "against your strategy" })}</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-3.5 rounded-sm border border-brand-ring bg-brand-light" /> {t("planning.goalSeek.legendCeiling", { defaultValue: "your ceiling — nothing beyond it is reachable" })}</span>
      </div>
    </div>
  );
}

// The progressive-disclosure body for a lever — the "how", plus lever-specific controls.
function LeverDetail({ L, data, feeTodayPct, setFeeTodayPct, feeToPct, setFeeToPct, feeMaxChf, onSimulate, t }) {
  if (L.kind === "fee") {
    return (
      <div className="max-w-[62ch] text-[12.5px] text-muted">
        {t("planning.goalSeek.feeHow", { defaultValue: "The management fee is a controllable cost — trimming it flows straight to NOI. Below 1% you're self-managing: you absorb the work and liability." })}
        <div className="mt-2 flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <span>{t("planning.goalSeek.feeToday", { defaultValue: "Fee today" })}</span>
            <input type="number" min="0" max="10" step="0.5" value={feeTodayPct ?? 0}
              onChange={(e) => { const v = Math.max(0, parseFloat(e.target.value) || 0); setFeeTodayPct(v); if (feeToPct > v) setFeeToPct(v); }}
              className="w-14 rounded-md border border-surface-border bg-surface px-1.5 py-0.5 text-[12px] text-foreground" />%
            <span className="text-[10px] italic text-foreground-dim">
              {data.feeSource === "statements" ? t("planning.goalSeek.feeFromStatements", { defaultValue: "from your statements" }) : t("planning.goalSeek.feeAssumed", { defaultValue: "assumed — no fee line found on the statements" })}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <span>{t("planning.goalSeek.feeCutTo", { defaultValue: "Cut to" })}</span>
            <input type="range" min="0" max={feeTodayPct ?? 0} step="0.5" value={feeToPct}
              onChange={(e) => setFeeToPct(parseFloat(e.target.value))} className="max-w-[160px] flex-1 accent-brand" aria-label={t("planning.goalSeek.feeCutTo", { defaultValue: "Cut to" })} />
            <span className="font-bold tabular-nums text-foreground">{feeToPct.toFixed(1)}%</span>
            <span>· {t("planning.goalSeek.feeAdds", { defaultValue: "adds" })} <span className="font-bold tabular-nums text-foreground">+{chf(feeMaxChf)}/yr</span></span>
            {L.off && <span className="text-[11px] text-warning-text">{t("planning.goalSeek.selfManageTag", { defaultValue: "self-manage" })}</span>}
          </div>
        </div>
      </div>
    );
  }
  let body = null;
  if (L.key === "opex") {
    body = L.leanestChf != null
      ? t("planning.goalSeek.opexHow", { defaultValue: "You ran this as lean as {{lean}}/yr before (now {{now}}) — re-tendering the biggest contracts recovers up to {{max}}/yr.", lean: chf(L.leanestChf), now: chf(L.opexCost), max: chf(L.max) })
      : t("planning.goalSeek.opexHowNoData", { defaultValue: "Operating cost isn't on file for this period, so this lever can't be sized." });
  } else if (L.key === "occ") {
    body = t("planning.goalSeek.occHow", { defaultValue: "Currently {{occ}} let. Filling to 100% at today's rents adds up to {{max}}/yr.", occ: pct(L.occ, 0), max: chf(L.max) });
  } else if (L.key === "rent") {
    body = L.max != null
      ? t("planning.goalSeek.rentHow", { defaultValue: "Rents sit below the area benchmark. Re-let at market as leases turn over{{turn}} — up to {{max}}/yr.", max: chf(L.max), turn: L.months != null ? ` (~${Math.round(L.months)} mo avg remaining)` : "" })
      : t("planning.goalSeek.rentHowNoData", { defaultValue: "No market benchmark (price / m²) is on file for this building, so this lever can't be sized." });
  } else if (L.key === "reno") {
    body = L.accretiveCount > 0
      ? t("planning.goalSeek.renoHow", { defaultValue: "OBLF Art. 14 adds part of a value-adding renovation's cost to the rent over its life. Only the {{n}} yield-positive (accretive) works count — {{capex}} of works → +{{max}}/yr.", n: L.accretiveCount, capex: chf(L.capexChf), max: chf(L.max) })
      : t("planning.goalSeek.renoHowNone", { defaultValue: "No accretive works are on the opportunity list — renovation wouldn't lift the yield here." });
  }
  return (
    <div className="max-w-[62ch] text-[12.5px] text-muted">
      {body}
      {L.simulate && (
        <div className="mt-2">
          <button onClick={onSimulate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-ring bg-brand-light px-3 py-1.5 text-[12.5px] font-semibold text-brand-dark transition-colors hover:bg-brand hover:text-white">
            {t("planning.goalSeek.simulateCta", { defaultValue: "Simulate the {{n}} accretive works", n: L.accretiveCount })} →
          </button>
        </div>
      )}
    </div>
  );
}

// Hover overlay pulling the reporting expense breakdown for the opex lever.
function OpexOverlay({ data, buildingId, t }) {
  const drivers = data.opexDrivers ?? [];
  const total = data.levers?.opex?.operatingCostChf ?? null;
  return (
    <span className="group relative inline-flex">
      <span className="cursor-help rounded-[5px] border border-dashed border-brand-ring px-1.5 text-[10px] font-bold uppercase tracking-wide text-brand-dark">
        {t("planning.goalSeek.expenses", { defaultValue: "expenses" })}
      </span>
      <span className="pointer-events-none absolute left-0 top-full z-40 mt-1.5 hidden w-72 rounded-xl border border-surface-border bg-surface p-3 text-left shadow-xl group-hover:block group-focus-within:block">
        <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-foreground-dim">{t("planning.goalSeek.opexOverlayTitle", { defaultValue: "Operating costs · {{y}}", y: data.periodTo ? data.periodTo.slice(0, 4) : "" })}</span>
        {drivers.length === 0 ? (
          <span className="block py-1 text-[12px] text-muted">{t("planning.goalSeek.opexOverlayEmpty", { defaultValue: "No account-level breakdown on file." })}</span>
        ) : (
          <>
            {drivers.map((d, i) => (
              <span key={i} className="flex justify-between gap-3 border-t border-surface-divider py-1 text-[12px] first:border-t-0">
                <span className="truncate text-muted">{d.label}</span>
                <span className="shrink-0 font-semibold tabular-nums text-foreground">{chf(d.annualChf)}</span>
              </span>
            ))}
            {total != null && (
              <span className="mt-0.5 flex justify-between gap-3 border-t-2 border-surface-border pt-1.5 text-[12px] font-bold">
                <span>{t("planning.goalSeek.opexOverlayTotal", { defaultValue: "Operating total" })}</span>
                <span className="tabular-nums">{chf(total)}</span>
              </span>
            )}
          </>
        )}
        <a href={`/manager/buildings/${buildingId}/financials`} className="pointer-events-auto mt-2 inline-block text-[11.5px] font-semibold text-brand hover:underline">
          {t("planning.goalSeek.openInReporting", { defaultValue: "Open in Reporting →" })}
        </a>
      </span>
    </span>
  );
}
