/**
 * RfpCandidatesPanel — RFP generation from an APPROVED plan's scheduled capex,
 * grouped into trade candidates. Shared by the plan detail page and the planning
 * workspace's Decision panel.
 */
import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslation } from "next-i18next";
import { authHeaders } from "../../lib/api";

function RfpCandidateCard({ planId, candidate }) {
  const { t } = useTranslation("manager");
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
          <span className="font-semibold text-foreground text-sm">{candidate.tradeGroup}</span>
          <span className="text-xs text-foreground-dim ml-2">{candidate.scheduledYear}</span>
        </div>
        <span className="text-sm font-semibold text-warning-text tabular-nums shrink-0">
          CHF {totalChf.toLocaleString("de-CH")}
        </span>
      </div>

      <ul className="text-xs text-muted space-y-0.5">
        {candidate.assets.map((a) => (
          <li key={a.assetId} className="flex items-center justify-between gap-2">
            <span>{a.assetName}{a.isOverridden && <em className="ml-1 text-violet-500">(shifted)</em>}</span>
            <span className="tabular-nums">CHF {(a.estimatedCostCents / 100).toLocaleString("de-CH")}</span>
          </li>
        ))}
      </ul>

      {sendDate && (
        <div className="text-xs text-foreground-dim">
          Send by <strong>{sendDate}</strong>
        </div>
      )}

      {errorMsg && <div className="notice notice-err text-xs">{errorMsg}</div>}

      {status === "done" || rfpId ? (
        <div className="flex items-center gap-2">
          <span className="status-pill bg-success-light text-success-text">{t("manager:cashflowId.text.rFPCreated")}</span>
          <Link href={`/manager/rfps/${rfpId}`} className="text-xs text-brand-dark hover:underline">
            View RFP →
          </Link>
        </div>
      ) : (
        <button
          onClick={handleCreate}
          disabled={status === "creating"}
          className="bg-brand text-white text-xs font-medium px-3 py-1.5 rounded hover:opacity-90 disabled:opacity-50 self-start"
        >
          {status === "creating" ? "Creating…" : "Create RFP"}
        </button>
      )}
    </div>
  );
}

export default function RfpCandidatesPanel({ planId }) {
  const { t } = useTranslation("manager");
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

  if (loading) return <p className="loading-text">{t("manager:cashflowId.text.loadingRfpCandidates")}</p>;
  if (error) return <div className="notice notice-err text-sm">{error}</div>;
  if (candidates.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state-text">{t("manager:cashflowId.text.noCapexItemsScheduledWithinThePlanHorizon")}</p>
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
