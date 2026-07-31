/**
 * YieldGoalSeekPanel — the prospective half of the building's performance story,
 * embedded under Reporting → Profitability.
 *
 * Retrospective figures live above it; this is the "so what": a calm CTA strip
 * ("See how it can perform better over the coming periods — ranked for the
 * owner's mandate") that expands in place to a target × lever matrix. Reachable
 * target yields across the top ending in a "max reachable" ceiling; the levers
 * down the side, each capped, filled least-disruptive-first — but ON-STRATEGY
 * levers fill FIRST, off-strategy ones sink below an "against the mandate"
 * divider, so a target reachable within the mandate never lights an off-strategy
 * row. Rows expand (progressive disclosure) for the "how". The management fee is
 * a variable defaulted to the fee detected on the statements; hovering operating
 * costs pulls the reporting expense breakdown. "Plan improvements →" (and the
 * renovation lever's "Simulate") hand off to the Planning workspace via
 * onPlanImprovements — the panel itself is navigation-agnostic.
 *
 * The heavy figures are fetched once; all allocation/column maths run client-side.
 */
import { useState, useEffect, useMemo, useCallback, Fragment } from "react";
import { useTranslation } from "next-i18next";
import { cn } from "../lib/utils";
import { formatChf as fchf } from "../lib/format";
import { authHeaders } from "../lib/api";

const pct = (x, d = 1) => (x == null ? "—" : `${(x * 100).toFixed(d)}%`);
const chf = (v) => (v == null || !Number.isFinite(v) ? "—" : fchf(Math.round(v)));
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

export default function YieldGoalSeekPanel({ building, onPlanImprovements }) {
  const { t } = useTranslation("manager");
  const buildingId = building?.id ?? null;

  const [expanded, setExpanded] = useState(false);
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const [enabled, setEnabled]   = useState({ opex: true, occ: true, rent: true, reno: true });
  const [openRows, setOpenRows] = useState(() => new Set());
  const [feeTodayPct, setFeeTodayPct] = useState(null);
  const [feeToPct, setFeeToPct]       = useState(1);

  useEffect(() => {
    setExpanded(false);
    setEnabled({ opex: true, occ: true, rent: true, reno: true });
    setOpenRows(new Set());
    setFeeTodayPct(null);
    setFeeToPct(1);
  }, [buildingId]);

  // One fetch per building (target-independent figures + per-lever ceilings + fee).
  useEffect(() => {
    if (!buildingId) { setData(null); return; }
    const { from, to } = trailingYearIso();
    let cancelled = false;
    setLoading(true); setError("");
    fetch(`/api/buildings/${buildingId}/yield-goalseek?from=${from}&to=${to}&target=3&mgmtFeePct=5`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((gs) => {
        if (cancelled) return;
        if (!gs?.data) { setError(t("planning.goalSeek.error", { defaultValue: "Couldn't compute the yield model for this building." })); setData(null); return; }
        setData(gs.data);
        setFeeTodayPct(gs.data.currentFeePct ?? 5);
      })
      .catch(() => { if (!cancelled) setError(t("planning.goalSeek.error", { defaultValue: "Couldn't compute the yield model for this building." })); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [buildingId, t]);

  const feeMaxChf = useMemo(() => {
    if (!data || feeTodayPct == null) return 0;
    return Math.max(0, ((feeTodayPct - feeToPct) / 100) * data.rentRollChf);
  }, [data, feeTodayPct, feeToPct]);

  // Levers in base disruption order, each tagged on/off the owner's mandate.
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
      { key: "opex", kind: "toggle", sign: "−", off: false,
        name: t("planning.goalSeek.lever.opex", { defaultValue: "Cut operating costs" }),
        max: opexMax, opexCost, leanestChf: opexMax != null && opexCost != null ? opexCost - opexMax : null },
      { key: "occ", kind: "toggle", sign: "+", off: false,
        name: t("planning.goalSeek.lever.occupancy", { defaultValue: "Lift occupancy" }),
        // Each vacant unit at its OWN asking rent (garages as garages), from the API.
        max: data.occupancyGainAnnualChf != null ? data.occupancyGainAnnualChf : Math.max(0, 1 - occ) * potentialRent,
        vacantUnits: data.vacantUnits ?? [] },
      { key: "rent", kind: "toggle", sign: "+", off: !!flags.rentAggressive,
        name: t("planning.goalSeek.lever.rent", { defaultValue: "Raise rent to market" }),
        max: lv.rent?.marketGapAnnualChf ?? null, months: lv.rent?.avgLeaseRemainingMonths ?? null,
        detailRows: data.rentMarketDetail ?? [], basis: data.rentMarketBasis ?? null,
        offReason: t("planning.goalSeek.offReasonRent", { defaultValue: "you prefer stable tenancies to pushing rents" }) },
      { key: "reno", kind: "toggle", sign: "+", off: !!flags.renovation,
        name: t("planning.goalSeek.lever.renovation", { defaultValue: "Renovate" }),
        max: rn.annualUpliftChf ?? 0, accretiveCount: rn.accretiveCount ?? 0, capexChf: rn.capexChf ?? 0, simulate: (rn.accretiveCount ?? 0) > 0,
        offReason: t("planning.goalSeek.offReasonReno", { defaultValue: "you'd rather avoid costly renovations" }) },
      { key: "fee", kind: "fee", sign: "+", off: feeToPct < 1 && !!flags.selfManage,
        name: t("planning.goalSeek.lever.fee", { defaultValue: "Management fee" }),
        offReason: t("planning.goalSeek.offReasonFee", { defaultValue: "you want a hands-off holding, not to self-manage" }) },
    ];
  }, [data, feeToPct, t]);

  const levMax    = useCallback((L) => (L.kind === "fee" ? feeMaxChf : L.max), [feeMaxChf]);
  const levActive = useCallback((L) => (L.kind === "fee" ? feeMaxChf > 0 : !!enabled[L.key] && L.max != null && L.max > 0), [enabled, feeMaxChf]);

  const hasMandate = !!data && !!data.strategySource && data.strategySource !== "none";
  const ownerLabel = useMemo(() => {
    if (!hasMandate) return null;
    if (data.strategyOwnerName) return t("planning.goalSeek.ownerMandate", { defaultValue: "{{name}}'s mandate", name: data.strategyOwnerName });
    if (data.strategySource === "building") return t("planning.goalSeek.buildingMandate", { defaultValue: "your building's strategy" });
    return t("planning.goalSeek.genericMandate", { defaultValue: "the owner's mandate" });
  }, [hasMandate, data, t]);

  // Fill order: on-strategy levers first (base order preserved), then off-strategy.
  const ordered = useMemo(() => {
    const on = levers.filter((L) => !L.off), off = levers.filter((L) => L.off);
    return { list: [...on, ...off], firstOffKey: off[0]?.key ?? null };
  }, [levers]);

  const matrix = useMemo(() => {
    if (!data) return null;
    const V = data.valueChf, NOI = data.currentNoiChf, curY = data.currentYieldPct;
    const order = ordered.list;
    const onMax  = order.filter((L) => !L.off && levActive(L)).reduce((s, L) => s + levMax(L), 0);
    const allMax = order.filter((L) => levActive(L)).reduce((s, L) => s + levMax(L), 0);
    const withinCeil = V > 0 ? (NOI + onMax) / V * 100 : curY;
    const maxCeil    = V > 0 ? (NOI + allMax) / V * 100 : curY;
    const hasOff = order.some((L) => L.off && levActive(L));

    const targets = [];
    for (let tp = Math.ceil((curY + 0.01) * 2) / 2; tp < maxCeil - 0.05 && targets.length < 5; tp += 0.5) {
      targets.push({ pct: round2(tp), isMax: false });
    }
    targets.push({ pct: round2(maxCeil), isMax: true });
    const cols = targets.map((tg) => {
      const beyond = hasMandate && hasOff && tg.pct > withinCeil + 0.001;
      let rem = (tg.pct / 100) * V - NOI;
      const gap = rem, use = {};
      for (const L of order) {
        if (!levActive(L)) { use[L.key] = 0; continue; }
        const c = Math.max(0, Math.min(rem, levMax(L)));
        use[L.key] = c; rem -= c;
      }
      return { ...tg, gap, use, beyond };
    });
    return { cols, withinCeil, maxCeil, hasOff, hasLevers: allMax > 0 };
  }, [data, ordered, levActive, levMax, hasMandate]);

  const toggleRow = useCallback((k) => setOpenRows((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; }), []);
  const plan = useCallback((opts) => { onPlanImprovements?.(opts ?? {}); }, [onPlanImprovements]);

  if (!buildingId) return null;
  if (loading && !data) return <div className="h-16 animate-pulse rounded-xl bg-surface-hover" />;
  if (error || !data || data.valueChf <= 0) return null; // reporting stands on its own; fail quiet

  const cur = data.currentYieldPct;

  // ── Collapsed CTA strip ──
  if (!expanded) {
    return (
      <button onClick={() => setExpanded(true)} aria-expanded="false"
        className="flex w-full items-center gap-3.5 rounded-xl border border-brand/25 bg-brand-light px-4 py-3.5 text-left transition-colors hover:brightness-[0.98]">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-brand text-[17px] font-bold text-white">↗</span>
        <span className="flex-1">
          <span className="block text-sm font-semibold text-foreground">{t("planning.goalSeek.ctaTitle", { defaultValue: "See how it can perform better over the coming periods" })}</span>
          <span className="block text-[12.5px] text-muted">
            {hasMandate
              ? t("planning.goalSeek.ctaMandate", { defaultValue: "Ranked for {{who}}{{label}}.", who: ownerLabel, label: data.strategyLabel ? ` — ${data.strategyLabel.toLowerCase()}` : "" })
              : t("planning.goalSeek.ctaNoMandate", { defaultValue: "The levers you'd pull, capped at what's realistic." })}
          </span>
        </span>
        <span className="shrink-0 whitespace-nowrap text-xs font-bold text-brand-dark">{t("planning.goalSeek.ctaExplore", { defaultValue: "Explore" })} ▸</span>
      </button>
    );
  }

  // ── Expanded matrix ──
  const cols = matrix?.cols ?? [];
  const ncol = cols.length + 1;
  return (
    <div className="rounded-xl border border-brand-ring bg-surface p-4">
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <span className="text-[12px] font-bold uppercase tracking-wide text-foreground-dim">
          {t("planning.goalSeek.title", { defaultValue: "Reach a target yield" })}
          {data.periodTo && <span className="ml-2 text-[10px] font-medium normal-case tracking-normal text-foreground-dim">{t("planning.goalSeek.basedOn", { defaultValue: "based on {{y}}", y: data.periodTo.slice(0, 4) })}</span>}
        </span>
        <button onClick={() => setExpanded(false)} className="shrink-0 text-xs font-medium text-muted hover:text-foreground">{t("planning.goalSeek.collapse", { defaultValue: "Collapse" })} ▴</button>
      </div>

      {!matrix?.hasLevers ? (
        <p className="rounded-lg border border-surface-border bg-surface-subtle px-3 py-2.5 text-[13px] text-muted">
          {t("planning.goalSeek.noLevers", { defaultValue: "No levers can be assessed for this building yet — add a rent benchmark (market price / m²) and a period with operating costs on file." })}
        </p>
      ) : (
        <>
          {/* Verdict — lead with the within-mandate ceiling */}
          <div className="mb-1.5 rounded-lg border border-success-ring bg-success-light px-3.5 py-2.5 text-[13px] leading-relaxed text-foreground">
            {hasMandate && matrix.hasOff
              ? t("planning.goalSeek.verdictWithin", { defaultValue: "Within {{who}} you can reach ~{{within}} without the levers it sets aside. Reaching higher — up to {{max}} — means taking those on.", who: ownerLabel, within: pct(matrix.withinCeil / 100, 2), max: pct(matrix.maxCeil / 100, 2) })
              : hasMandate
                ? t("planning.goalSeek.verdictWithinFull", { defaultValue: "Within {{who}} you can reach ~{{max}} — every lever here fits it.", who: ownerLabel, max: pct(matrix.maxCeil / 100, 2) })
                : t("planning.goalSeek.verdictNoMandate", { defaultValue: "Combining these levers you can reach up to ~{{max}} (from {{cur}} today).", max: pct(matrix.maxCeil / 100, 2), cur: pct(cur / 100, 2) })}
          </div>
          {/* First-owner caveat */}
          {data.strategyOwnerName && (
            <p className="mb-2.5 flex items-start gap-1.5 text-[11.5px] text-muted">
              <span aria-hidden="true" className="text-foreground-dim">ⓘ</span>
              {t("planning.goalSeek.caveatFirstOwner", { defaultValue: "Ranked for {{name}}, the primary owner on file. Co-owners may weigh these differently — we use the primary mandate until every owner's is reconciled.", name: data.strategyOwnerName })}
            </p>
          )}

          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[520px] border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className="w-[40%] min-w-[210px] border-b-2 border-surface-border px-2 py-1.5 text-left" />
                  {cols.map((c, i) => (
                    <th key={i} className={cn("border-b-2 px-2 py-1.5 text-right align-bottom", c.isMax ? "border-brand bg-brand-light" : "border-surface-border")}>
                      <div className={cn("text-[15px] font-extrabold tabular-nums", c.isMax ? "text-brand" : "text-foreground")}>{c.pct.toFixed(c.isMax ? 2 : 1)}%</div>
                      <div className={cn("text-[9px] font-bold uppercase tracking-wide", c.beyond ? "text-warning-text" : "text-foreground-dim")}>
                        {c.isMax ? t("planning.goalSeek.maxReachable", { defaultValue: "max reachable" })
                          : c.beyond ? t("planning.goalSeek.colBeyond", { defaultValue: "beyond mandate" })
                            : hasMandate ? t("planning.goalSeek.colWithin", { defaultValue: "within mandate" })
                              : t("planning.goalSeek.target", { defaultValue: "target" })}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="bg-surface-subtle">
                  <td className="px-2 py-1.5 text-left text-[12px] font-semibold text-muted">{t("planning.goalSeek.gapRow", { defaultValue: "Extra NOI needed / yr" })}</td>
                  {cols.map((c, i) => (
                    <td key={i} className={cn("px-2 py-1.5 text-right font-semibold tabular-nums text-muted", c.isMax && "bg-brand-light")}>+{chf(c.gap)}</td>
                  ))}
                </tr>

                {ordered.list.map((L) => {
                  const active = levActive(L), mx = levMax(L), open = openRows.has(L.key);
                  const unavailable = L.kind !== "fee" && L.max == null;
                  return (
                    <Fragment key={L.key}>
                      {ordered.firstOffKey === L.key && (() => {
                        const offList = ordered.list.filter((x) => x.off);
                        const why = offList.length === 1 && offList[0].offReason ? ` — ${offList[0].offReason}` : "";
                        return (
                          <tr>
                            <td colSpan={ncol} className="border-y border-warning-ring bg-warning-light px-2 py-1.5 text-left text-[11px] font-semibold normal-case tracking-normal text-warning-text">
                              {t("planning.goalSeek.dividerAgainst", { defaultValue: "Outside the mandate — {{name}} would rather not use the lever{{plural}} below{{why}}", name: data.strategyOwnerName || t("planning.goalSeek.theOwner", { defaultValue: "the owner" }), plural: offList.length > 1 ? "s" : "", why })}
                            </td>
                          </tr>
                        );
                      })()}
                      <tr className={cn("border-b border-surface-divider", !active && "opacity-55")}>
                        <td className="px-2 py-1.5 text-left align-top">
                          <div className="flex w-full items-center gap-2">
                            {L.kind === "toggle" && (
                              <input type="checkbox" checked={!!enabled[L.key]} disabled={unavailable}
                                onChange={(e) => setEnabled((s) => ({ ...s, [L.key]: e.target.checked }))}
                                className="h-3.5 w-3.5 shrink-0 accent-brand disabled:opacity-40" aria-label={L.name} />
                            )}
                            <button type="button" onClick={() => toggleRow(L.key)} className="flex items-center gap-2 text-left">
                              <span className="font-semibold text-foreground">{L.name}</span>
                              {L.off && <span title={t("planning.goalSeek.offStrategyTip", { defaultValue: "Against the mandate" })} className="h-[7px] w-[7px] shrink-0 rounded-full bg-warning-ring" />}
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
                              onSimulate={() => plan({ simulate: true })} t={t} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] text-muted">
            <span className="inline-flex items-center gap-1.5"><span className="font-bold text-success-text">CHF</span> {t("planning.goalSeek.legendMaxed", { defaultValue: "lever maxed out" })}</span>
            {matrix.hasOff && <span className="inline-flex items-center gap-1.5"><span className="h-[7px] w-[7px] rounded-full bg-warning-ring" /> {t("planning.goalSeek.legendOffStrategy", { defaultValue: "against the mandate — used only past your ceiling" })}</span>}
            <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-3.5 rounded-sm border border-brand-ring bg-brand-light" /> {t("planning.goalSeek.legendCeiling", { defaultValue: "your ceiling" })}</span>
          </div>

          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 border-t border-surface-divider pt-3.5">
            <p className="min-w-[200px] flex-1 text-[12px] text-muted">{t("planning.goalSeek.footNote", { defaultValue: "Take these into the Planning workspace to simulate the works, schedule them and open an RFP." })}</p>
            <button onClick={() => plan({})} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-[13.5px] font-bold text-white transition-colors hover:bg-brand-dark">
              {t("planning.goalSeek.planCta", { defaultValue: "Plan improvements" })} →
            </button>
          </div>
        </>
      )}
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
    const vacant = L.vacantUnits ?? [];
    const priced = vacant.filter((v) => v.hasAskingRent);
    const noRent = vacant.filter((v) => !v.hasAskingRent);
    body = vacant.length === 0
      ? t("planning.goalSeek.occFull", { defaultValue: "Every unit is let — there's no occupancy gain to capture." })
      : (
        <>
          <div>{t("planning.goalSeek.occHow2", { defaultValue: "{{n}} unit(s) sit empty. Each is valued at its own asking rent — a garage as a garage, not extrapolated from the flats — {{max}}/yr in all.", n: vacant.length, max: chf(L.max) })}</div>
          {priced.length > 0 && (
            <div className="mt-1.5 flex flex-col gap-0.5">
              {priced.map((v, i) => (
                <div key={i} className="flex justify-between gap-3">
                  <span>{v.label}{v.kind === "parking" ? ` · ${t("planning.goalSeek.kindParking", { defaultValue: "parking" })}` : ""}</span>
                  <span className="font-semibold tabular-nums text-foreground">+{chf(v.expectedAnnualChf)}/yr</span>
                </div>
              ))}
            </div>
          )}
          {noRent.length > 0 && (
            <div className="mt-1.5 text-warning-text">{t("planning.goalSeek.occNoRent", { defaultValue: "{{n}} vacant unit(s) have no asking rent on file, so they're not counted.", n: noRent.length })}</div>
          )}
        </>
      );
  } else if (L.key === "rent") {
    const detailRows = L.detailRows ?? [];
    const b = L.basis;
    body = L.max == null
      ? t("planning.goalSeek.rentHowNoData", { defaultValue: "No market benchmark (price / m²) is on file for this building, so this lever can't be sized." })
      : (
        <>
          <div>
            {b
              ? t("planning.goalSeek.rentHow2", { defaultValue: "Market rent = living area × {{src}} price/m² × {{gy}} canton gross yield, discounted for vétusté; the gap vs current rent is realized on turnover{{turn}}.", gy: `${b.grossYieldPct}%`, src: b.pricePerSqmSource === "zip" ? t("planning.goalSeek.srcZip", { defaultValue: "the area's" }) : t("planning.goalSeek.srcIntrinsic", { defaultValue: "the unit's" }), turn: L.months != null ? t("planning.goalSeek.turnMonths", { defaultValue: " (~{{m}} mo remaining on average)", m: Math.round(L.months) }) : "" })
              : t("planning.goalSeek.rentHow", { defaultValue: "Rents sit below the area benchmark. Re-let at market as leases turn over — up to {{max}}/yr.", max: chf(L.max) })}
          </div>
          {detailRows.length > 0 && (
            <div className="mt-1.5 flex flex-col gap-0.5">
              {detailRows.slice(0, 4).map((r, i) => (
                <div key={i} className="flex justify-between gap-3">
                  <span>{r.label}{r.livingAreaSqm != null ? ` · ${r.livingAreaSqm} m²` : ""}</span>
                  <span className="tabular-nums">{chf(r.currentAnnualChf)} → {chf(r.marketAnnualChf)} <span className="font-semibold text-foreground">= +{chf(r.gapChf)}</span></span>
                </div>
              ))}
              {detailRows.length > 4 && <div className="text-foreground-dim">{t("planning.goalSeek.andMore", { defaultValue: "…and {{n}} more", n: detailRows.length - 4 })}</div>}
            </div>
          )}
        </>
      );
  } else if (L.key === "reno") {
    body = L.accretiveCount > 0
      ? t("planning.goalSeek.renoHow", { defaultValue: "OBLF Art. 14 adds part of a value-adding renovation's cost to the rent over its life. Only the {{n}} yield-positive (accretive) works count — {{capex}} of works → +{{max}}/yr.", n: L.accretiveCount, capex: chf(L.capexChf), max: chf(L.max) })
      : t("planning.goalSeek.renoHowNone", { defaultValue: "No accretive works are on the opportunity list — renovation wouldn't lift the yield here." });
  }
  return (
    <div className="max-w-[62ch] text-[12.5px] text-muted">
      {L.off && L.offReason && (
        <div className="mb-1 font-medium text-warning-text">{t("planning.goalSeek.offReasonPrefix", { defaultValue: "Outside the mandate: {{why}}.", why: L.offReason })}</div>
      )}
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
