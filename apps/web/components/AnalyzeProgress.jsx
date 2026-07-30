/**
 * AnalyzeProgress
 *
 * Reassuring feedback while a régie package is analyzed. The analyze endpoint is a
 * single blocking call whose cost is dominated by one opaque ~40s vision extraction,
 * so there's no real per-stage telemetry to stream — this is an honest *staged
 * simulation*: an eased progress bar (never claims a precise %, asymptotes to 92%
 * until the response lands), a stage checklist that advances on elapsed time, a
 * countdown, and rotating reassurance copy. When `active` flips false it snaps to
 * 100% + "Analyzed ✓" for a beat, then calls onComplete so the parent reveals results.
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";

const STAGES = [
  "Uploading the files",
  "Reading the document",
  "Detecting the statements",
  "Cross-checking the figures",
];

const REASSURANCE = [
  "Régie PDFs take a moment — we read every line so the totals tie out.",
  "Pulling the balance sheet, income statement and rent roll apart…",
  "Still working — a scanned year-end package is a lot of numbers.",
  "Almost there — checking that Actif = Passif and the results agree.",
];

const EXPECT_SECONDS = 45; // typical régie-PDF analyze time
const MAX_PCT = 92; // the eased bar caps here until the real response arrives
const TAU = 20; // ease-out time constant (seconds) — fast at first, slows near the cap

export default function AnalyzeProgress({ active, fileCount = 0, onComplete }) {
  const [pct, setPct] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const wasActive = useRef(false);

  // Eased progress while the request is in flight.
  useEffect(() => {
    if (!active) return undefined;
    const t0 = Date.now();
    const id = setInterval(() => {
      const e = (Date.now() - t0) / 1000;
      setElapsed(e);
      setPct(MAX_PCT * (1 - Math.exp(-e / TAU)));
    }, 200);
    return () => clearInterval(id);
  }, [active]);

  // On active → false (response landed): snap to 100%, hold, then hand back.
  useEffect(() => {
    let id;
    if (wasActive.current && !active) {
      setPct(100);
      setDone(true);
      id = setTimeout(() => onComplete?.(), 650);
    }
    wasActive.current = active;
    return () => { if (id) clearTimeout(id); };
  }, [active, onComplete]);

  const remaining = Math.max(0, Math.ceil(EXPECT_SECONDS - elapsed));
  const reassure = REASSURANCE[Math.min(REASSURANCE.length - 1, Math.floor(elapsed / 8))];
  const frac = elapsed / EXPECT_SECONDS;
  // Stage advances on elapsed time (the vision call is one opaque block, so this is a
  // deliberate, honest simulation of the pipeline moving forward).
  const activeStage = done ? STAGES.length : elapsed < 2 ? 0 : frac < 0.7 ? 1 : frac < 0.9 ? 2 : 3;

  return (
    <div className="rounded-lg border border-surface-border bg-surface-subtle p-4 space-y-3" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{done ? "Analyzed ✓" : "Analyzing your package…"}</p>
        {!done && (
          <span className="text-xs tabular-nums text-muted">{remaining > 0 ? `~${remaining}s left` : "almost there…"}</span>
        )}
      </div>

      <div
        className="h-2 w-full overflow-hidden rounded-full bg-surface-divider"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-300 ease-out", done ? "bg-success" : "bg-brand")}
          style={{ width: `${pct}%` /* no-token: progress width is inherently dynamic */ }}
        />
      </div>

      <ul className="space-y-1.5">
        {STAGES.map((label, i) => {
          const state = i < activeStage ? "done" : i === activeStage ? "active" : "pending";
          return (
            <li key={label} className="flex items-center gap-2 text-sm">
              {state === "done" ? (
                <span className="text-success" aria-hidden>✓</span>
              ) : state === "active" ? (
                <span className="inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-brand border-t-transparent" aria-hidden />
              ) : (
                <span className="text-muted" aria-hidden>•</span>
              )}
              <span className={cn(state === "pending" ? "text-muted" : "text-foreground", state === "active" && "font-medium")}>
                {label}
                {i === 1 && state === "active" && fileCount > 0 ? ` (${fileCount} file${fileCount === 1 ? "" : "s"})` : ""}
              </span>
            </li>
          );
        })}
      </ul>

      {!done && <p className="text-xs italic text-muted">{reassure}</p>}
    </div>
  );
}
