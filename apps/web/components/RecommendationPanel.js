/**
 * RecommendationPanel — displays scored decision options for a request.
 *
 * Shows ranked options with scores, strengths/weaknesses, and lets
 * the owner accept/reject/defer the recommendation.
 */

import { useState, useEffect, useCallback } from "react";
import Panel from "./layout/Panel";
import Badge from "./ui/Badge";
import { cn } from "../lib/utils";
import { ownerAuthHeaders } from "../lib/api";

const DECISION_LABELS = {
  accepted: { label: "Accepted", variant: "success" },
  rejected: { label: "Rejected", variant: "destructive" },
  deferred: { label: "Deferred", variant: "warning" },
  pending: { label: "Pending", variant: "secondary" },
};

const OPTION_TYPE_LABELS = {
  replace_full: "Full Replacement",
  replace_component: "Component Replacement",
  repair: "Repair",
  defer: "Defer",
  upgrade: "Upgrade",
};

export default function RecommendationPanel({ requestId }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deciding, setDeciding] = useState(false);
  const [feedback, setFeedback] = useState("");

  const fetchRecommendations = useCallback(async () => {
    if (!requestId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/recommendations/${requestId}`, {
        headers: ownerAuthHeaders(),
      });
      if (!res.ok) {
        if (res.status === 404) {
          setRecommendations([]);
          return;
        }
        throw new Error(`Failed: ${res.status}`);
      }
      const data = await res.json();
      setRecommendations(data.recommendations || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  const handleDecision = async (recId, decision) => {
    setDeciding(true);
    try {
      const res = await fetch(`/api/recommendations/${recId}/decision`, {
        method: "PATCH",
        headers: { ...ownerAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          userDecision: decision,
          userFeedback: feedback || undefined,
        }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      await fetchRecommendations();
      setFeedback("");
    } catch (err) {
      setError(err.message);
    } finally {
      setDeciding(false);
    }
  };

  if (loading) {
    return (
      <Panel title="Strategy Recommendation">
        <p className="text-sm text-slate-400 m-0 animate-pulse">Loading recommendations…</p>
      </Panel>
    );
  }

  if (error) {
    return (
      <Panel title="Strategy Recommendation">
        <p className="text-sm text-red-500 m-0">Error: {error}</p>
      </Panel>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Panel title="Strategy Recommendation">
        <p className="text-sm text-slate-400 m-0">No recommendation yet.</p>
      </Panel>
    );
  }

  const rec = recommendations[0]; // latest
  let ranked = [];
  let explanation = null;
  try {
    ranked = JSON.parse(rec.rankedOptionsJson || "[]");
    explanation = JSON.parse(rec.explanationJson || "null");
  } catch {
    /* ignore parse errors */
  }

  const decisionInfo = DECISION_LABELS[rec.userDecision] || DECISION_LABELS.pending;

  return (
    <Panel title="Strategy Recommendation">
      <div className="space-y-4">
        {/* Summary */}
        {explanation?.summary && (
          <p className="text-sm text-slate-600 m-0">{explanation.summary}</p>
        )}

        {/* Decision status */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Decision:</span>
          <Badge variant={decisionInfo.variant}>{decisionInfo.label}</Badge>
        </div>

        {/* Ranked options */}
        <div className="space-y-3">
          {ranked.map((opt, i) => {
            const optExpl = explanation?.options?.find((o) => o.optionId === opt.optionId);
            return (
              <div
                key={opt.optionId}
                className={cn(
                  "rounded-lg border p-3",
                  i === 0 ? "border-indigo-200 bg-indigo-50/50" : "border-slate-200",
                  !opt.eligible && "opacity-50",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {i === 0 && (
                      <span className="text-xs font-semibold text-indigo-600 uppercase">
                        Recommended
                      </span>
                    )}
                    <span className="text-sm font-medium">
                      {OPTION_TYPE_LABELS[opt.optionType] || opt.optionType}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "text-sm font-bold tabular-nums",
                      opt.finalScore >= 60
                        ? "text-green-600"
                        : opt.finalScore >= 40
                          ? "text-amber-600"
                          : "text-red-600",
                    )}
                  >
                    {opt.finalScore}/100
                  </span>
                </div>

                {!opt.eligible && (
                  <p className="text-xs text-red-500 mt-1 m-0">
                    Ineligible: {opt.penalties?.map((p) => p.reason).join("; ")}
                  </p>
                )}

                {optExpl && (
                  <div className="mt-2 space-y-1 text-xs text-slate-500">
                    <p className="m-0">
                      <span className="font-medium">Short-term:</span> {optExpl.shortTermImpact}
                    </p>
                    <p className="m-0">
                      <span className="font-medium">Long-term:</span> {optExpl.longTermImpact}
                    </p>
                    {optExpl.topStrengths?.length > 0 && (
                      <p className="m-0 text-green-600">
                        ✓ {optExpl.topStrengths.join(" · ")}
                      </p>
                    )}
                    {optExpl.topWeaknesses?.length > 0 && (
                      <p className="m-0 text-red-500">
                        ✗ {optExpl.topWeaknesses.join(" · ")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Decision actions (only if pending) */}
        {rec.userDecision === "pending" && (
          <div className="space-y-3 border-t border-slate-200 pt-3">
            <label htmlFor="rec-feedback" className="text-xs font-medium text-slate-500">
              Feedback (optional)
            </label>
            <textarea
              id="rec-feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={2}
              placeholder="Any comments on this recommendation…"
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleDecision(rec.id, "accepted")}
                disabled={deciding}
                className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 focus-visible:ring-2 focus-visible:ring-green-500 disabled:opacity-50"
                aria-label="Accept recommendation"
              >
                Accept
              </button>
              <button
                onClick={() => handleDecision(rec.id, "deferred")}
                disabled={deciding}
                className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-50"
                aria-label="Defer recommendation"
              >
                Defer
              </button>
              <button
                onClick={() => handleDecision(rec.id, "rejected")}
                disabled={deciding}
                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50"
                aria-label="Reject recommendation"
              >
                Reject
              </button>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
