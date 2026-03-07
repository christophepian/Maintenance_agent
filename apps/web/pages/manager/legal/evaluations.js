import { useEffect, useState, useCallback, useMemo } from "react";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import { authHeaders } from "../../../lib/api";

const OBLIGATION_CONFIG = {
  OBLIGATED: { label: "Obligated", bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-500" },
  RECOMMENDED: { label: "Recommended", bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200", dot: "bg-yellow-500" },
  DISCRETIONARY: { label: "Discretionary", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500" },
  TENANT_RESPONSIBLE: { label: "Tenant", bg: "bg-green-50", text: "text-green-700", border: "border-green-200", dot: "bg-green-500" },
  UNKNOWN: { label: "Unknown", bg: "bg-slate-50", text: "text-slate-500", border: "border-slate-200", dot: "bg-slate-400" },
  NOT_APPLICABLE: { label: "N/A", bg: "bg-slate-50", text: "text-slate-500", border: "border-slate-200", dot: "bg-slate-400" },
};

const ACTION_LABELS = {
  CREATE_RFP: "Create RFP",
  NOTIFY_MANAGER: "Notify manager",
  REVIEW_RECOMMENDED: "Review recommended",
  CONSIDER_REPLACEMENT: "Consider replacement",
  NOTIFY_TENANT: "Notify tenant",
  MANUAL_REVIEW: "Manual review required",
};

export default function LegalEvaluationsPage() {
  const [evaluations, setEvaluations] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [obligationFilter, setObligationFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(page * PAGE_SIZE));
      if (obligationFilter) params.set("obligation", obligationFilter);
      if (categoryFilter) params.set("category", categoryFilter);

      const res = await fetch(`/api/legal/evaluations?${params}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to load evaluations");
      setEvaluations(data?.data || []);
      setTotal(data?.total ?? 0);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [page, obligationFilter, categoryFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  // Summary stats from current page
  const stats = useMemo(() => {
    const byObligation = {};
    for (const ev of evaluations) {
      const key = ev.obligation || "UNKNOWN";
      byObligation[key] = (byObligation[key] || 0) + 1;
    }
    const avgConfidence = evaluations.length
      ? evaluations.reduce((sum, ev) => sum + (ev.confidence || 0), 0) / evaluations.length
      : 0;
    return { byObligation, avgConfidence, count: evaluations.length };
  }, [evaluations]);

  const categories = useMemo(() => {
    const set = new Set();
    for (const ev of evaluations) if (ev.category) set.add(ev.category);
    return [...set].sort();
  }, [evaluations]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader
          title="Legal Evaluations"
          subtitle={`Audit log of ${total} legal decision evaluation${total !== 1 ? "s" : ""}`}
        />
        <PageContent>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Summary Cards */}
          {!loading && evaluations.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {Object.entries(stats.byObligation).map(([key, count]) => {
                const cfg = OBLIGATION_CONFIG[key] || OBLIGATION_CONFIG.UNKNOWN;
                return (
                  <button
                    key={key}
                    onClick={() => setObligationFilter(obligationFilter === key ? "" : key)}
                    className={`rounded-lg border p-3 text-left transition-all ${cfg.border} ${cfg.bg} ${obligationFilter === key ? "ring-2 ring-blue-400" : "hover:shadow-sm"}`}
                  >
                    <div className={`text-lg font-bold ${cfg.text}`}>{count}</div>
                    <div className="text-xs text-slate-600">{cfg.label}</div>
                  </button>
                );
              })}
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-left">
                <div className="text-lg font-bold text-slate-900">
                  {(stats.avgConfidence * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-slate-500">Avg confidence</div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={obligationFilter}
              onChange={(e) => { setObligationFilter(e.target.value); setPage(0); }}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm"
            >
              <option value="">All obligations</option>
              {Object.entries(OBLIGATION_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm"
            >
              <option value="">All categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            {(obligationFilter || categoryFilter) && (
              <button
                onClick={() => { setObligationFilter(""); setCategoryFilter(""); setPage(0); }}
                className="text-xs text-blue-600 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Evaluation List */}
          <Panel title={`Evaluations (${evaluations.length}${evaluations.length < total ? ` of ${total}` : ""})`}>
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : evaluations.length === 0 ? (
              <p className="text-sm text-slate-500">
                {obligationFilter || categoryFilter
                  ? "No evaluations match the current filters."
                  : "No evaluations yet. Trigger a legal decision on a maintenance request to generate one."}
              </p>
            ) : (
              <div className="space-y-3">
                {evaluations.map((ev) => (
                  <EvaluationCard key={ev.id} evaluation={ev} />
                ))}
              </div>
            )}
          </Panel>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm disabled:opacity-40"
              >
                ← Previous
              </button>
              <span className="text-sm text-slate-500">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}

function EvaluationCard({ evaluation }) {
  const [expanded, setExpanded] = useState(false);
  const ev = evaluation;
  const cfg = OBLIGATION_CONFIG[ev.obligation] || OBLIGATION_CONFIG.UNKNOWN;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.text} ${cfg.border}`}>
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
            {ev.legalTopic && (
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                {formatTopic(ev.legalTopic)}
              </span>
            )}
            {ev.category && (
              <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
                {ev.category}
              </span>
            )}
            {ev.canton && (
              <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                {ev.canton}
              </span>
            )}
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            {ev.requestId && (
              <a
                href={`/manager/requests/${ev.requestId}`}
                className="font-mono text-blue-600 hover:underline"
                title="View request"
              >
                {ev.requestId.slice(0, 8)}…
              </a>
            )}
            <span>
              Confidence: <strong className="text-slate-700">{(ev.confidence * 100).toFixed(0)}%</strong>
            </span>
            <span>{ev.matchedRuleCount} rule{ev.matchedRuleCount !== 1 ? "s" : ""} matched</span>
            <span>{formatDate(ev.createdAt)}</span>
          </div>
        </div>

        <button
          className="shrink-0 rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition hover:bg-slate-50"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Collapse" : "Details"}
        </button>
      </div>

      {/* Reasons summary (always visible) */}
      {ev.reasons?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {ev.reasons.map((r, i) => (
            <span key={i} className="rounded bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
              {r}
            </span>
          ))}
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          {/* Depreciation Signal */}
          {ev.depreciationSignal && (
            <DetailSection title="Depreciation Signal">
              <DepreciationBar signal={ev.depreciationSignal} />
            </DetailSection>
          )}

          {/* Citations */}
          {ev.citations?.length > 0 && (
            <DetailSection title="Legal Citations">
              <ul className="ml-4 list-disc space-y-1 text-xs text-slate-700">
                {ev.citations.map((c, i) => (
                  <li key={i}>
                    <strong>{c.article}</strong>
                    {c.text && <> — {c.text}</>}
                    {c.authority && (
                      <span className="ml-1 text-slate-400">({c.authority})</span>
                    )}
                  </li>
                ))}
              </ul>
            </DetailSection>
          )}

          {/* Recommended Actions */}
          {ev.recommendedActions?.length > 0 && (
            <DetailSection title="Recommended Actions">
              <div className="flex flex-wrap gap-1.5">
                {ev.recommendedActions.map((a, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-medium text-amber-700"
                  >
                    {ACTION_LABELS[a] || a}
                  </span>
                ))}
              </div>
            </DetailSection>
          )}
        </div>
      )}
    </div>
  );
}

function DetailSection({ title, children }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
      {children}
    </div>
  );
}

function DepreciationBar({ signal }) {
  const pct = signal.remainingLifePct ?? 0;
  const barColor = pct > 50 ? "bg-green-500" : pct > 20 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-slate-600">
        <span>
          {signal.ageMonths} / {signal.usefulLifeMonths} months used
        </span>
        <span className="font-semibold">
          {pct}% remaining
          {signal.fullyDepreciated && (
            <span className="ml-1 text-red-600">(fully depreciated)</span>
          )}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.max(2, 100 - pct)}%` }}
        />
      </div>
    </div>
  );
}

function formatTopic(topic) {
  if (!topic) return "";
  return topic
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bCo\b/gi, "CO");
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
