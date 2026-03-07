import { useEffect, useState, useCallback } from "react";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import { authHeaders } from "../../../lib/api";

export default function LegalEvaluationsPage() {
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/legal/evaluations", { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to load evaluations");
      setEvaluations(data?.data || []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader
          title="Legal Evaluations"
          subtitle="Audit log of all legal decision evaluations"
        />
        <PageContent>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <Panel title={`Evaluations (${evaluations.length})`}>
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : evaluations.length === 0 ? (
              <p className="text-sm text-slate-500">No evaluations yet. Trigger a legal decision on a maintenance request to generate one.</p>
            ) : (
              <div className="space-y-3">
                {evaluations.map((ev) => (
                  <EvaluationCard key={ev.id} evaluation={ev} />
                ))}
              </div>
            )}
          </Panel>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}

function EvaluationCard({ evaluation }) {
  const [expanded, setExpanded] = useState(false);

  const obligationColors = {
    OBLIGATED: "bg-red-50 text-red-700 border-red-200",
    RECOMMENDED: "bg-yellow-50 text-yellow-700 border-yellow-200",
    DISCRETIONARY: "bg-blue-50 text-blue-700 border-blue-200",
    NOT_APPLICABLE: "bg-slate-50 text-slate-500 border-slate-200",
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">
              {evaluation.legalTopic || "Unknown Topic"}
            </span>
            <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${obligationColors[evaluation.obligation] || obligationColors.NOT_APPLICABLE}`}>
              {evaluation.obligation}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
            <span>Request: <strong className="font-mono">{evaluation.requestId?.slice(0, 8)}…</strong></span>
            <span>•</span>
            <span>Confidence: <strong>{(evaluation.confidence * 100).toFixed(0)}%</strong></span>
            <span>•</span>
            <span>{formatDate(evaluation.evaluatedAt || evaluation.createdAt)}</span>
          </div>
        </div>
        <button
          className="text-xs text-blue-600 hover:underline whitespace-nowrap"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Collapse" : "Details"}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2">
          {evaluation.reasons?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-600">Reasons:</p>
              <ul className="ml-4 list-disc text-xs text-slate-700">
                {evaluation.reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}
          {evaluation.citations?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-600">Citations:</p>
              <ul className="ml-4 list-disc text-xs text-slate-700">
                {evaluation.citations.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}
          {evaluation.recommendedActions?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-600">Recommended Actions:</p>
              <ul className="ml-4 list-disc text-xs text-slate-700">
                {evaluation.recommendedActions.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}
          {evaluation.snapshot && (
            <div>
              <p className="text-xs font-medium text-slate-600">Decision Snapshot:</p>
              <pre className="mt-1 overflow-x-auto rounded border border-slate-200 bg-white p-2 text-xs text-slate-700 whitespace-pre-wrap">
                {JSON.stringify(evaluation.snapshot, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("de-CH");
}
