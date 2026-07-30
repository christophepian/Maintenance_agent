/**
 * YieldGoalSeekPanel — the Planning what-if. Pick a target net yield; see the NOI
 * gap translated into each lever (rent · opex · occupancy · management fee) and a
 * renovation lever that models each work's value uplift (ΔV) so the "reachable via
 * works" verdict is honest.
 *
 * Fetches the heavy, target-independent parts once per building (value, NOI, rent
 * roll, occupancy, and the renovation lines with ΔV + accretive flags computed
 * server-side); the trivial target/fee-dependent scalars are recomputed client-side
 * so the slider is instant. The renovation lever hands the accretive assets to the
 * SAME `onSimulate` the accordion uses — pre-loaded, no re-entry, same numbers.
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
  return <span className={cn("shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide", cls)}>{children}</span>;
}

function Lever({ name, chip, value, note }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface p-4">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-foreground-dim">{name}</span>
        {chip}
      </div>
      <div className="text-xl font-bold tracking-tight tabular-nums text-foreground">{value}</div>
      {note && <div className="mt-0.5 text-xs text-muted">{note}</div>}
    </div>
  );
}

export default function YieldGoalSeekPanel({ building, onSimulate }) {
  const { t } = useTranslation("manager");
  const buildingId = building?.id ?? null;

  const [target, setTarget] = useState(3.0);
  const [fee, setFee]       = useState(5);
  const [data, setData]     = useState(null);   // yield-goalseek payload (target-independent parts)
  const [opps, setOpps]     = useState([]);     // raw renovation opportunity items (for the handoff)
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");

  // One fetch per building: the heavy, target-independent parts (+ raw opportunities).
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

  // Target/fee-dependent scalars — recomputed live (trivial; the opinionated model
  // stays server-side in `data`).
  const m = useMemo(() => {
    if (!data) return null;
    const V = data.valueChf, NOI = data.currentNoiChf, rentRoll = data.rentRollChf, occ = data.occupancyRate;
    const requiredNOI = (target / 100) * V;
    const gap = requiredNOI - NOI;
    const met = gap <= 0;
    const potentialRent = occ > 0 ? rentRoll / occ : rentRoll;
    const newOcc = occ + (potentialRent > 0 ? gap / potentialRent : 0);
    const feeChf = (fee / 100) * rentRoll;
    const reno = data.levers?.renovation ?? { lines: [], ceilingYieldPct: data.currentYieldPct, accretiveCount: 0, capexChf: 0, annualUpliftChf: 0 };
    return {
      requiredNOI, gap, met,
      rentMo: gap / 12,
      rentPct: rentRoll > 0 ? gap / rentRoll : 0,
      newOcc, occFeasible: newOcc <= 1,
      feeChf, feeCover: gap > 0 ? Math.min(feeChf, gap) / gap : 0,
      reno,
      renoReach: reno.ceilingYieldPct / 100 >= target / 100 - 1e-9,
    };
  }, [data, target, fee]);

  // Hand the accretive works to the simulator, pre-loaded (same items → same numbers).
  const simulateAccretive = useCallback(() => {
    if (!m || !buildingId) return;
    const ids = new Set(m.reno.lines.filter((l) => l.accretive).map((l) => l.assetId));
    const items = opps.filter((o) => ids.has(o.assetId));
    if (items.length > 0 && onSimulate) onSimulate(items, buildingId);
  }, [m, opps, buildingId, onSimulate]);

  if (!buildingId) return null;

  return (
    <div className="rounded-2xl border border-surface-border bg-surface-subtle p-4 sm:p-5">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">{t("planning.goalSeek.title", { defaultValue: "Reach a target yield" })}</h3>
        <p className="text-xs text-foreground-dim">{t("planning.goalSeek.subtitle", { defaultValue: "See what it takes to move this building's net yield — and whether renovation can get you there." })}</p>
      </div>

      {loading && !data && <div className="h-40 animate-pulse rounded-xl bg-surface-hover" />}
      {error && <p className="text-sm text-destructive-text">{error}</p>}

      {data && data.valueChf <= 0 && (
        <p className="text-sm text-muted">{t("planning.goalSeek.noValuation", { defaultValue: "Add a building or unit valuation to model yield targets." })}</p>
      )}

      {data && m && data.valueChf > 0 && (
        <>
          {/* Context */}
          <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-surface-border bg-surface-border sm:grid-cols-4">
            {[
              [t("planning.goalSeek.currentYield", { defaultValue: "Current yield" }), pct(data.currentYieldPct / 100)],
              [t("planning.goalSeek.buildingValue", { defaultValue: "Building value" }), formatChf(data.valueChf)],
              [t("planning.goalSeek.annualNoi", { defaultValue: "Annual NOI" }), formatChf(data.currentNoiChf)],
              [t("planning.goalSeek.rentRoll", { defaultValue: "Rent roll" }), formatChf(data.rentRollChf)],
            ].map(([k, v], i) => (
              <div key={i} className="bg-surface p-3">
                <div className="text-[10px] font-medium uppercase tracking-wide text-foreground-dim">{k}</div>
                <div className="mt-1 text-base font-bold tabular-nums text-foreground">{v}</div>
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="mb-4 rounded-xl border border-surface-border bg-surface p-4">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-foreground-dim">{t("planning.goalSeek.targetYield", { defaultValue: "Target net yield" })}</div>
            <div className="mb-2 flex items-baseline gap-3">
              <span className="text-3xl font-extrabold tracking-tight tabular-nums text-brand">{pct(target / 100, 2)}</span>
              <span className="text-xs text-muted">{t("planning.goalSeek.fromToday", { defaultValue: "from {{y}} today", y: pct(data.currentYieldPct / 100) })}</span>
            </div>
            <input type="range" min="2" max="6" step="0.05" value={target} onChange={(e) => setTarget(parseFloat(e.target.value))}
              className="w-full accent-brand" aria-label={t("planning.goalSeek.targetYield", { defaultValue: "Target net yield" })} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button key={p} onClick={() => setTarget(p)} aria-pressed={target === p}
                  className={cn("rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors", target === p ? "border-brand bg-brand text-white" : "border-surface-border bg-surface text-muted hover:border-brand hover:text-brand")}>{pct(p / 100, 1)}</button>
              ))}
            </div>
            <div className="mt-4 border-t border-surface-divider pt-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground-dim">{t("planning.goalSeek.mgmtFee", { defaultValue: "Management fee (% of rent)" })}</span>
                <span className="text-xs font-semibold tabular-nums text-foreground">{fee.toFixed(1)}%</span>
              </div>
              <input type="range" min="0" max="8" step="0.5" value={fee} onChange={(e) => setFee(parseFloat(e.target.value))}
                className="w-full max-w-[280px] accent-brand" aria-label={t("planning.goalSeek.mgmtFee", { defaultValue: "Management fee" })} />
            </div>
          </div>

          {/* Gap headline */}
          <div className={cn("mb-4 rounded-xl border px-4 py-3", m.met ? "border-success-ring bg-success-light" : "border-brand/40 bg-brand-light")}>
            {m.met
              ? <p className="text-sm font-semibold text-success-text">{t("planning.goalSeek.alreadyMet", { defaultValue: "Already at or above {{tgt}} — current yield is {{cur}}.", tgt: pct(target / 100, 2), cur: pct(data.currentYieldPct / 100) })}</p>
              : <p className="text-sm font-semibold text-foreground">{t("planning.goalSeek.gapLine", { defaultValue: "To reach {{tgt}} you need +{{gap}}/yr of NOI ({{noi}} → {{req}}).", tgt: pct(target / 100, 2), gap: formatChf(m.gap), noi: formatChf(data.currentNoiChf), req: formatChf(m.requiredNOI) })}</p>}
          </div>

          {!m.met && (
            <>
              {/* Levers */}
              <div className="mb-3 grid gap-3 sm:grid-cols-2">
                <Lever
                  name={t("planning.goalSeek.lever.rent", { defaultValue: "Raise rent" })}
                  chip={<Chip tone={m.rentPct <= 0.05 ? "ok" : m.rentPct <= 0.10 ? "warn" : "bad"}>{m.rentPct <= 0.05 ? t("planning.goalSeek.achievable", { defaultValue: "achievable" }) : m.rentPct <= 0.10 ? t("planning.goalSeek.sizeable", { defaultValue: "sizeable" }) : t("planning.goalSeek.beyondOblf", { defaultValue: "beyond OBLF" })}</Chip>}
                  value={`+${formatChf(m.rentMo)}/mo`}
                  note={t("planning.goalSeek.rentNote", { defaultValue: "building-wide, {{p}} of the rent roll", p: pct(m.rentPct) })}
                />
                <Lever
                  name={t("planning.goalSeek.lever.opex", { defaultValue: "Cut operating costs" })}
                  chip={<Chip tone="ok">{t("planning.goalSeek.ifAchievable", { defaultValue: "if achievable" })}</Chip>}
                  value={`−${formatChf(m.gap)}/yr`}
                  note={t("planning.goalSeek.opexNote", { defaultValue: "any recurring opex reduction flows straight to NOI" })}
                />
                <Lever
                  name={t("planning.goalSeek.lever.occupancy", { defaultValue: "Lift occupancy" })}
                  chip={<Chip tone={m.occFeasible ? "ok" : "bad"}>{m.occFeasible ? t("planning.goalSeek.feasible", { defaultValue: "feasible" }) : t("planning.goalSeek.over100", { defaultValue: "needs > 100%" })}</Chip>}
                  value={m.occFeasible ? `${pct(data.occupancyRate, 0)} → ${pct(m.newOcc, 1)}` : `${pct(data.occupancyRate, 0)} → ${pct(m.newOcc, 0)}`}
                  note={m.occFeasible ? t("planning.goalSeek.occNote", { defaultValue: "recover {{g}} of foregone rent", g: formatChf(m.gap) }) : t("planning.goalSeek.occHard", { defaultValue: "can't close the gap on occupancy alone" })}
                />
                <Lever
                  name={t("planning.goalSeek.lever.fee", { defaultValue: "Management fee" })}
                  chip={<Chip tone={m.feeChf >= m.gap ? "ok" : "warn"}>{m.feeChf >= m.gap ? t("planning.goalSeek.exceedsGap", { defaultValue: "exceeds the gap" }) : t("planning.goalSeek.worthPct", { defaultValue: "worth {{p}}", p: pct(m.feeCover, 0) })}</Chip>}
                  value={`${formatChf(m.feeChf)}/yr`}
                  note={t("planning.goalSeek.feeNote", { defaultValue: "{{f}}% of rent · {{cov}} of the gap", f: fee.toFixed(1), cov: pct(m.feeCover, 0) })}
                />
              </div>

              {/* Renovation */}
              <div className="rounded-xl border border-surface-border bg-surface p-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-foreground-dim">{t("planning.goalSeek.lever.renovation", { defaultValue: "Renovate (value uplift modelled)" })}</span>
                  <Chip tone={m.renoReach ? "ok" : "bad"}>{m.renoReach ? t("planning.goalSeek.reachesTarget", { defaultValue: "reaches target" }) : t("planning.goalSeek.maxesAt", { defaultValue: "maxes at {{y}}", y: pct(m.reno.ceilingYieldPct / 100, 2) })}</Chip>
                </div>
                <p className="mb-3 text-xs text-muted">
                  {t("planning.goalSeek.renoCeiling", { defaultValue: "Doing the {{n}} yield-accretive works ({{capex}} → +{{uplift}}/yr) lifts yield to {{ceil}}.", n: m.reno.accretiveCount, capex: formatChf(m.reno.capexChf), uplift: formatChf(m.reno.annualUpliftChf), ceil: pct(m.reno.ceilingYieldPct / 100, 2) })}
                </p>
                <div className="space-y-1">
                  {m.reno.lines.map((l) => (
                    <div key={l.assetId} className={cn("flex items-center justify-between gap-3 rounded-lg px-2 py-1.5", l.accretive ? "" : "opacity-70")}>
                      <div className="min-w-0">
                        <div className="truncate text-sm text-foreground">{l.label}</div>
                        <div className="text-[11px] tabular-nums text-foreground-dim">{formatChf(l.costChf)} · +{formatChf(l.annualUpliftChf)}/yr · ΔV {formatChf(l.deltaValueChf)}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-semibold tabular-nums text-foreground">{pct(l.marginalYieldPct / 100)}</span>
                        {l.accretive
                          ? <span className="rounded border border-success-ring bg-success-light px-1.5 py-0.5 text-[10px] font-bold uppercase text-success-text">{t("planning.goalSeek.accretive", { defaultValue: "Accretive" })}</span>
                          : <span className="rounded border border-warning-ring bg-warning-light px-1.5 py-0.5 text-[10px] font-bold uppercase text-warning-text">{t("planning.goalSeek.dilutive", { defaultValue: "NPV+ / dilutive" })}</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-foreground-dim">
                  {t("planning.goalSeek.accretiveExplain", { defaultValue: "A renovation is accretive only when its marginal yield (uplift ÷ ΔV) beats today's {{y}}. The dimmed ones add value (positive NPV) but dilute yield, so they're excluded from the ceiling.", y: pct(data.currentYieldPct / 100) })}
                </p>
                {m.reno.accretiveCount > 0 && (
                  <button onClick={simulateAccretive}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark">
                    {t("planning.goalSeek.simulateCta", { defaultValue: "Simulate the {{n}} accretive works", n: m.reno.accretiveCount })} →
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
