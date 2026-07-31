/**
 * YieldGoalSeekPanel — the Planning what-if, as a collapsible tool.
 *
 * Collapsed by default (a one-line strip) so the page opens calm on the opportunity
 * list. Expand it, pick a target net yield, and see the NOI gap translated into each
 * lever (rent · opex · occupancy · management fee). It does NOT list renovation
 * assets — instead it emits an `onAnnotationsChange` map so the single opportunity
 * accordion badges each row accretive / dilutive, and "Simulate the accretive works"
 * hands those assets to the SAME onSimulate the accordion uses (pre-loaded, no
 * re-entry). The heavy target-independent parts are fetched once; the trivial
 * target/fee scalars recompute client-side so the slider is instant.
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "next-i18next";
import { cn } from "../lib/utils";
import { formatChf } from "../lib/format";
import { authHeaders } from "../lib/api";

const PRESETS = [3.0, 3.5, 4.0];
const pct = (x, d = 1) => (x == null ? "—" : `${(x * 100).toFixed(d)}%`);

function trailingYearIso() {
  const to = new Date();
  const from = new Date(to);
  from.setFullYear(from.getFullYear() - 1);
  from.setDate(from.getDate() + 1);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

function Chip({ tone, children }) {
  const cls = tone === "ok" ? "border-success-ring bg-success-light text-success-text"
    : tone === "warn" ? "border-warning-ring bg-warning-light text-warning-text"
      : "border-destructive-ring bg-destructive-light text-destructive-text";
  return <span className={cn("shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", cls)}>{children}</span>;
}

// Compact inline lever cell with three signals: the number, feasibility (grey =
// can't), and strategy fit (amber = can, but against the owner's wishes).
function Lever({ name, value, note, tone, feasible = true, offStrategy = false, reason }) {
  const toneCls = tone === "ok" ? "text-success-text" : tone === "warn" ? "text-warning-text" : tone === "bad" ? "text-destructive-text" : "text-foreground";
  const box = !feasible ? "border-surface-border bg-surface-subtle opacity-60"
    : offStrategy ? "border-warning-ring bg-warning-light"
      : "border-surface-border";
  return (
    <div className={cn("min-w-[128px] flex-1 rounded-lg border p-2.5", box)}>
      <div className="text-[10px] font-bold uppercase tracking-wide text-foreground-dim">{name}</div>
      <div className={cn("mt-0.5 text-sm font-bold tabular-nums", feasible ? toneCls : "text-foreground-dim")}>{value}</div>
      {note && <div className="text-[10.5px] text-muted">{note}</div>}
      {!feasible && reason && <div className="mt-1 flex gap-1 text-[10.5px] font-medium text-muted"><span aria-hidden="true">⊘</span>{reason}</div>}
      {feasible && offStrategy && reason && <div className="mt-1 flex gap-1 text-[10.5px] font-medium text-warning-text"><span aria-hidden="true">⚠</span>{reason}</div>}
    </div>
  );
}

export default function YieldGoalSeekPanel({ building, onSimulate, onAnnotationsChange }) {
  const { t } = useTranslation("manager");
  const buildingId = building?.id ?? null;

  const [target, setTarget]     = useState(null);  // null = not targeting (calm default)
  const [fee, setFee]           = useState(5);
  const [expanded, setExpanded] = useState(false);
  const [data, setData]         = useState(null);
  const [opps, setOpps]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  // Reset the tool when the building changes.
  useEffect(() => { setTarget(null); setExpanded(false); }, [buildingId]);

  // One fetch per building. target=3 is arbitrary — the base figures and the
  // renovation lines' accretive flags are target-independent (accretive compares to
  // the current yield, not the target).
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
        setOpps(Array.isArray(op?.data) ? op.data : []);
      })
      .catch(() => { if (!cancelled) setError(t("planning.goalSeek.error", { defaultValue: "Couldn't compute the yield model for this building." })); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [buildingId, t]);

  // Emit accretive/dilutive annotations for the accordion — only while targeting.
  useEffect(() => {
    if (!onAnnotationsChange) return;
    const lines = data?.levers?.renovation?.lines ?? [];
    if (target == null || !lines.length) { onAnnotationsChange(null); return; }
    const map = {};
    for (const l of lines) {
      const label = l.accretive
        ? t("planning.goalSeek.accretive", { defaultValue: "Accretive" })
        : t("planning.goalSeek.dilutive", { defaultValue: "NPV+ / dilutive" });
      map[l.assetId] = { accretive: l.accretive, label: `${label} · ${l.marginalYieldPct.toFixed(1)}%` };
    }
    onAnnotationsChange(map);
  }, [target, data, onAnnotationsChange, t]);

  // Clear annotations on unmount (e.g. deselecting the building).
  useEffect(() => () => { onAnnotationsChange?.(null); }, [onAnnotationsChange]);

  // Target/fee-dependent scalars — recomputed live (the opinionated model, incl. the
  // realism band values + strategy flags + synthesis tiers, stays in `data`). Feasibility
  // is re-derived here against the live gap so the slider stays instant.
  const m = useMemo(() => {
    if (!data || target == null) return null;
    const V = data.valueChf, NOI = data.currentNoiChf, rentRoll = data.rentRollChf, occ = data.occupancyRate;
    const gap = (target / 100) * V - NOI;
    const potentialRent = occ > 0 ? rentRoll / occ : rentRoll;
    const newOcc = occ + (potentialRent > 0 ? gap / potentialRent : 0);
    const feeChf = (fee / 100) * rentRoll;
    const lv = data.levers ?? {};
    const reno = lv.renovation ?? { ceilingYieldPct: data.currentYieldPct, accretiveCount: 0, capexChf: 0, annualUpliftChf: 0, offStrategy: false };
    const rentMarketGap = lv.rent?.marketGapAnnualChf ?? null;   // null until market rent is wired
    const opexHeadroom = lv.opex?.headroomChf ?? null;           // null until 3-yr opex is wired
    const selfManage = fee < 1;
    const flags = data.strategyFlags ?? {};                      // recompute off-strategy live (target/fee-dependent)
    const rentPct = rentRoll > 0 ? gap / rentRoll : 0;
    return {
      gap, met: gap <= 0, requiredNOI: (target / 100) * V,
      rentMo: gap / 12, rentPct,
      rentMarketGap, rentFeasible: rentMarketGap == null ? true : gap <= rentMarketGap + 1e-6, rentOff: !!flags.rentAggressive && rentPct > 0.04,
      opexHeadroom, opexFeasible: opexHeadroom == null ? true : gap <= opexHeadroom + 1e-6,
      newOcc, occFeasible: newOcc <= 1,
      feeChf, feeCover: gap > 0 ? Math.min(feeChf, gap) / gap : 0, selfManage, feeOff: selfManage && !!flags.selfManage,
      reno, renoReach: reno.ceilingYieldPct / 100 >= target / 100 - 1e-9, renoOff: !!flags.renovation,
      synth: data.synthesis ?? null,
      avgLeaseMonths: lv.rent?.avgLeaseRemainingMonths ?? null,
    };
  }, [data, target, fee]);

  const openTool = useCallback(() => {
    setExpanded(true);
    if (target == null && data) setTarget(Math.round((data.currentYieldPct + 0.3) * 10) / 10);
  }, [target, data]);

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

  // ── Collapsed strip ──
  if (!expanded) {
    return (
      <button onClick={openTool} aria-expanded="false"
        className={cn("flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
          target != null ? "border-brand bg-brand-light" : "border-surface-border bg-surface hover:border-brand-ring")}>
        <span className="shrink-0">
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-foreground-dim">{t("planning.goalSeek.currentYield", { defaultValue: "Net yield" })}</span>
          <span className="text-[15px] font-extrabold tabular-nums text-foreground">{pct(data.currentYieldPct / 100)}</span>
        </span>
        <span className="flex-1 text-[13px] text-muted">
          {target != null && m
            ? <>{t("planning.goalSeek.targetingMsg", { defaultValue: "Targeting {{tgt}} · gap +{{gap}}/yr", tgt: pct(target / 100, 1), gap: formatChf(m.gap) })}</>
            : t("planning.goalSeek.teaser", { defaultValue: "See what it would take to reach a higher yield" })}
        </span>
        <span className="shrink-0 text-xs text-foreground-dim">▾</span>
      </button>
    );
  }

  // ── Expanded panel (lighter; no asset list — the accordion carries it) ──
  return (
    <div className="rounded-xl border border-brand-ring bg-surface p-4">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-[12px] font-bold uppercase tracking-wide text-foreground-dim">
          {t("planning.goalSeek.title", { defaultValue: "Reach a target yield" })}
          {data.strategyLabel && <span className="ml-2 rounded-full border border-surface-border bg-surface-subtle px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-muted">{data.strategyLabel}</span>}
        </span>
        <button onClick={() => setExpanded(false)} className="shrink-0 text-xs font-medium text-muted hover:text-foreground">{t("planning.goalSeek.collapse", { defaultValue: "Collapse" })} ▴</button>
      </div>

      {/* Target */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground-dim">{t("planning.goalSeek.targetYield", { defaultValue: "Target" })}</span>
        <span className="text-2xl font-extrabold tabular-nums text-brand">{target != null ? pct(target / 100, 2) : "—"}</span>
        <div className="ml-1 flex gap-1.5">
          {PRESETS.map((p) => (
            <button key={p} onClick={() => setTarget(p)} aria-pressed={target === p}
              className={cn("rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors", target === p ? "border-brand bg-brand text-white" : "border-surface-border bg-surface text-muted hover:border-brand hover:text-brand")}>{pct(p / 100, 1)}</button>
          ))}
          {target != null && <button onClick={() => setTarget(null)} className="rounded-lg border border-surface-border px-2 py-1 text-xs text-muted transition-colors hover:border-destructive-ring hover:text-destructive-text">✕</button>}
        </div>
      </div>
      <input type="range" min="2" max="6" step="0.05" value={target ?? data.currentYieldPct} onChange={(e) => setTarget(parseFloat(e.target.value))}
        className="mt-2 w-full accent-brand" aria-label={t("planning.goalSeek.targetYield", { defaultValue: "Target" })} />
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground-dim">{t("planning.goalSeek.mgmtFee", { defaultValue: "Management fee" })}</span>
        <input type="range" min="0" max="8" step="0.5" value={fee} onChange={(e) => setFee(parseFloat(e.target.value))} className="max-w-[200px] flex-1 accent-brand" aria-label={t("planning.goalSeek.mgmtFee", { defaultValue: "Management fee" })} />
        <span className="text-xs font-semibold tabular-nums text-foreground">{fee.toFixed(1)}%</span>
      </div>

      {!m ? (
        <p className="mt-3 text-sm text-muted">{t("planning.goalSeek.pickPrompt", { defaultValue: "Pick a target to see how to close the gap." })}</p>
      ) : m.met ? (
        <p className="mt-3 rounded-lg border border-success-ring bg-success-light px-3 py-2 text-sm font-semibold text-success-text">{t("planning.goalSeek.alreadyMet", { defaultValue: "Already at or above {{tgt}} — current yield is {{cur}}.", tgt: pct(target / 100, 2), cur: pct(data.currentYieldPct / 100) })}</p>
      ) : (
        <>
          <p className="mb-2 mt-3 text-sm">{t("planning.goalSeek.gapLine", { defaultValue: "To reach {{tgt}} you need +{{gap}}/yr of NOI ({{noi}} → {{req}}).", tgt: pct(target / 100, 2), gap: formatChf(m.gap), noi: formatChf(data.currentNoiChf), req: formatChf(m.requiredNOI) })}</p>
          <div className="flex flex-wrap gap-2">
            <Lever
              name={t("planning.goalSeek.lever.rent", { defaultValue: "Rent" })}
              value={`+${formatChf(m.rentMo)}/mo`}
              note={m.avgLeaseMonths != null ? t("planning.goalSeek.rentTurnover", { defaultValue: "{{p}} of roll · on turnover (~{{mo}} mo)", p: pct(m.rentPct), mo: Math.round(m.avgLeaseMonths) }) : t("planning.goalSeek.rentNote", { defaultValue: "{{p}} of roll", p: pct(m.rentPct) })}
              tone={m.rentPct <= 0.05 ? "ok" : m.rentPct <= 0.10 ? "warn" : "bad"}
              feasible={m.rentFeasible} offStrategy={m.rentOff}
              reason={!m.rentFeasible ? t("planning.goalSeek.rentBeyondMarket", { defaultValue: "beyond market (~{{g}}/yr)", g: formatChf(m.rentMarketGap ?? 0) }) : t("planning.goalSeek.rentChurn", { defaultValue: "aggressive — tenant-churn risk" })}
            />
            <Lever
              name={t("planning.goalSeek.lever.opex", { defaultValue: "Opex" })}
              value={m.opexFeasible ? `−${formatChf(m.gap)}/yr` : `−${formatChf(m.opexHeadroom ?? 0)}/yr max`}
              note={t("planning.goalSeek.opexNoteShort", { defaultValue: "straight to NOI" })}
              tone="ok" feasible={m.opexFeasible}
              reason={t("planning.goalSeek.opexBeyondBest", { defaultValue: "beyond your best cost year" })}
            />
            <Lever
              name={t("planning.goalSeek.lever.occupancy", { defaultValue: "Occupancy" })}
              value={m.occFeasible ? `${pct(data.occupancyRate, 0)}→${pct(m.newOcc, 1)}` : `${pct(data.occupancyRate, 0)}→${pct(m.newOcc, 0)}`}
              note={m.occFeasible ? t("planning.goalSeek.occNoteShort", { defaultValue: "recover vacancy" }) : ""}
              tone={m.occFeasible ? "ok" : "bad"} feasible={m.occFeasible}
              reason={t("planning.goalSeek.occOver100", { defaultValue: "can't exceed 100% occupancy" })}
            />
            <Lever
              name={m.selfManage ? t("planning.goalSeek.lever.selfManage", { defaultValue: "Self-manage" }) : t("planning.goalSeek.lever.fee", { defaultValue: "Mgmt fee" })}
              value={m.selfManage ? `${formatChf(m.feeChf)}/yr → 0` : `${formatChf(m.feeChf)}/yr`}
              note={m.selfManage ? t("planning.goalSeek.selfManageNote", { defaultValue: "owner absorbs the work + liability" }) : t("planning.goalSeek.feeNoteShort", { defaultValue: "{{cov}} of the gap", cov: pct(m.feeCover, 0) })}
              tone={m.selfManage ? "warn" : m.feeChf >= m.gap ? "ok" : "warn"}
              offStrategy={m.feeOff}
              reason={t("planning.goalSeek.feeHandsOff", { defaultValue: "you want a hands-off holding" })}
            />
          </div>

          {/* Renovation summary — the list lives in the accordion below, badged. */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-surface-divider pt-3">
            <Chip tone={m.renoReach ? "ok" : "bad"}>{m.renoReach ? t("planning.goalSeek.reachesTarget", { defaultValue: "works reach it" }) : t("planning.goalSeek.maxesAt", { defaultValue: "works max at {{y}}", y: pct(m.reno.ceilingYieldPct / 100, 2) })}</Chip>
            {m.renoOff && <Chip tone="warn">{t("planning.goalSeek.renoOffStrategy", { defaultValue: "against your strategy" })}</Chip>}
            <span className="flex-1 text-[13px] text-muted">
              {t("planning.goalSeek.renoSummary", { defaultValue: "The {{n}} accretive works ({{capex}} → +{{uplift}}/yr) lift yield to {{ceil}} — badged in the list below.", n: m.reno.accretiveCount, capex: formatChf(m.reno.capexChf), uplift: formatChf(m.reno.annualUpliftChf), ceil: pct(m.reno.ceilingYieldPct / 100, 2) })}
            </span>
            {m.reno.accretiveCount > 0 && (
              <button onClick={simulateAccretive} className="rounded-lg bg-brand px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark">
                {t("planning.goalSeek.simulateCta", { defaultValue: "Simulate the {{n}} accretive works", n: m.reno.accretiveCount })} →
              </button>
            )}
          </div>

          {/* Tiered "realistically reachable" synthesis — reads realism + strategy. */}
          {m.synth && (() => {
            const tgt = target / 100, within = m.synth.withinStrategyYieldPct / 100, reno = m.synth.withRenovationYieldPct / 100, self = m.synth.withSelfManageYieldPct / 100;
            const scope = data.strategySource !== "none" ? t("planning.goalSeek.withinStrategy", { defaultValue: "within your strategy" }) : t("planning.goalSeek.withinOps", { defaultValue: "within normal operations" });
            const renoPhrase = m.renoOff ? t("planning.goalSeek.renoAvoid", { defaultValue: "the renovations you'd rather avoid" }) : t("planning.goalSeek.renoAccretive", { defaultValue: "the accretive renovations" });
            let body;
            if (tgt <= within + 1e-9) body = t("planning.goalSeek.synthWithin", { defaultValue: "You can reach {{tgt}} {{scope}}.", tgt: pct(tgt, 2), scope });
            else if (tgt <= reno + 1e-9) body = t("planning.goalSeek.synthReno", { defaultValue: "{{scope}} you can reach ~{{within}}. Reaching {{tgt}} also needs {{reno}}.", scope: scope.charAt(0).toUpperCase() + scope.slice(1), within: pct(within, 2), tgt: pct(tgt, 2), reno: renoPhrase });
            else if (tgt <= self + 1e-9) body = t("planning.goalSeek.synthSelf", { defaultValue: "{{scope}} you can reach ~{{within}}. Reaching {{tgt}} needs {{reno}} and self-managing.", scope: scope.charAt(0).toUpperCase() + scope.slice(1), within: pct(within, 2), tgt: pct(tgt, 2), reno: renoPhrase });
            else body = t("planning.goalSeek.synthBeyond", { defaultValue: "{{tgt}} is beyond what any realistic combination reaches — even with {{reno}} and self-managing (ceiling ~{{self}}).", tgt: pct(tgt, 2), reno: renoPhrase, self: pct(self, 2) });
            return (
              <div className="mt-3 rounded-lg border border-info-ring bg-info-light px-3.5 py-2.5 text-[13px] leading-relaxed text-foreground">
                <span className="mr-1.5 text-[10px] font-bold uppercase tracking-wide text-info-text">{t("planning.goalSeek.reachable", { defaultValue: "Realistically reachable" })}</span>
                {body}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
