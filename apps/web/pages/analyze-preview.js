/**
 * UI-only preview of the régie-package analyze wait (AnalyzeProgress).
 * No file upload, no backend call, no API cost — purely to review the progress
 * bar, stage checklist, rotating trivia and the tic-tac-toe. Safe to leave in or
 * delete later. Reachable at /analyze-preview.
 */
import { useState } from "react";
import Head from "next/head";
import AnalyzeProgress from "../components/AnalyzeProgress";

export default function AnalyzePreview() {
  const [runId, setRunId] = useState(1);
  const [active, setActive] = useState(true);

  function restart() {
    setActive(true);
    setRunId((n) => n + 1); // remount → resets the eased bar, stages and timers
  }

  return (
    <>
      <Head><title>Analyze progress — preview</title></Head>
      <main className="mx-auto max-w-lg space-y-4 p-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Analyze progress — preview</h1>
          <p className="text-sm text-muted">
            UI-only demo of the analyze wait — no files, no extraction, no API cost. The bar eases toward ~92% and
            holds (it snaps to 100% when a real response lands); trivia rotates every ~8s; the tic-tac-toe is playable.
          </p>
        </div>

        <AnalyzeProgress key={runId} active={active} fileCount={3} onComplete={() => {}} />

        <div className="flex gap-3">
          <button type="button" onClick={() => setActive(false)} disabled={!active} className="button-secondary text-sm">
            Finish (show completion)
          </button>
          <button type="button" onClick={restart} className="button-primary text-sm">
            Restart
          </button>
        </div>
        <p className="text-xs text-muted">
          &ldquo;Finish&rdquo; simulates the response arriving (the 100% flourish); &ldquo;Restart&rdquo; replays from 0.
        </p>
      </main>
    </>
  );
}
