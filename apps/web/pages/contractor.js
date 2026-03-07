import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import PageShell from "../components/layout/PageShell";
import PageHeader from "../components/layout/PageHeader";
import PageContent from "../components/layout/PageContent";
import { formatDateTime } from "../lib/format";
import { authHeaders } from "../lib/api";

// Add global.css classes for layout and styling
// Global CSS is imported in _app.js

function badgeForStatus(status) {
  if (status === "PENDING_REVIEW")
    return { label: "Pending Manager", bg: "#fff5e6", border: "#ffd08a", color: "#7a4a00" };
  if (status === "PENDING_OWNER_APPROVAL")
    return { label: "Pending Owner", bg: "#fff0f0", border: "#ffb3b3", color: "#7a1f1f" };
  if (status === "AUTO_APPROVED")
    return { label: "Ready to Start", bg: "#e9f8ee", border: "#7bd89a", color: "#116b2b" };
  if (status === "APPROVED")
    return { label: "Approved", bg: "#e8f2ff", border: "#90c2ff", color: "#0b3a75" };
  if (status === "IN_PROGRESS")
    return { label: "In Progress", bg: "#fff3e0", border: "#ffb74d", color: "#e65100" };
  if (status === "COMPLETED")
    return { label: "Completed", bg: "#e8f5e9", border: "#81c784", color: "#2e7d32" };
  return { label: String(status || "UNKNOWN"), bg: "#f1f1f1", border: "#ddd", color: "#333" };
}

function fmtDate(iso) {
  return formatDateTime(iso);
}

export default function ContractorPortal() {
    const router = useRouter();
    useEffect(() => {
      if (router.pathname === "/contractor") {
        router.replace("/contractor/jobs");
      }
    }, [router]);
    const [openTimeline, setOpenTimeline] = useState(null);
    const [eventLoading, setEventLoading] = useState(false);
    const [eventError, setEventError] = useState("");
    const [eventData, setEventData] = useState({}); // { [requestId]: [events] }

    async function loadTimeline(requestId) {
      setEventLoading(true);
      setEventError("");
      try {
        const r = await fetch(`/api/requests/${requestId}/events`, {
          headers: authHeaders(),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error?.message || j?.error || "Failed to load events");
        setEventData((prev) => ({ ...prev, [requestId]: j.data || [] }));
      } catch (e) {
        setEventError(String(e?.message || e));
      } finally {
        setEventLoading(false);
      }
    }
  const [contractorId, setContractorId] = useState(null);
  const [contractor, setContractor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [updating, setUpdating] = useState(null);
  // Fallback input state hooks (must be top-level)
  const [inputId, setInputId] = useState("");
  const [inputError, setInputError] = useState("");

  // Load contractor ID from localStorage or query param
  useEffect(() => {
    let id = new URLSearchParams(window.location.search).get("contractorId");
    if (!id) {
      id = localStorage.getItem("contractorId");
    }
    if (id) {
      setContractorId(id);
      localStorage.setItem("contractorId", id);
    } else {
      setError("");
      setLoading(false);
    }
  }, []);

  // Load assigned requests
  useEffect(() => {
    if (!contractorId) return;

    async function load() {
      setError("");
      setMessage("");
      setLoading(true);

      try {
        const r = await fetch(`/api/requests/contractor?contractorId=${contractorId}`, {
          headers: authHeaders(),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error?.message || j?.error || "Failed to load requests");
        setRequests(j?.data || []);
      } catch (e) {
        setError(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [contractorId]);

  async function updateStatus(requestId, newStatus) {
    setUpdating(requestId);
    try {
      const r = await fetch(`/api/requests/${requestId}/status?contractorId=${contractorId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message || j?.error || "Update failed");

      // Update local state
      setRequests((prev) =>
        prev.map((req) => (req.id === requestId ? j.data : req))
      );
      setMessage(j?.message || "Status updated");
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setUpdating(null);
    }
  }

  // Fetch contractor info
  useEffect(() => {
    fetch(`/api/contractors?id=${contractorId}`, { headers: authHeaders() })
      .then(res => res.json())
      .then(data => setContractor(data.data));
  }, []);

  // contractorId is already declared above or managed by state

  if (loading) {
    return (
      <PageShell>
        <div className="mx-auto w-full max-w-5xl">
          <PageHeader title="Contractor Portal" subtitle="Loading assigned requests." />
          <PageContent>
            <p className="text-sm text-slate-600">Loading...</p>
          </PageContent>
        </div>
      </PageShell>
    );
  }

  if (!contractorId) {
    function handleSubmit(e) {
      e.preventDefault();
      if (!inputId.trim()) {
        setInputError("Please enter a contractor ID.");
        return;
      }
      setContractorId(inputId.trim());
      localStorage.setItem("contractorId", inputId.trim());
      setInputError("");
    }
    return (
      <PageShell>
        <div className="mx-auto w-full max-w-5xl">
          <PageHeader
            title="Contractor Portal"
            subtitle="Enter your contractor ID to view assigned work."
          />
          <PageContent>
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              No contractor ID provided. Enter your contractor ID below or use ?contractorId=&lt;uuid&gt; in the URL.
            </div>
            <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-center">
              <input
                type="text"
                value={inputId}
                onChange={e => setInputId(e.target.value)}
                placeholder="Contractor ID (UUID)"
                className="input"
                style={{ width: 320, marginBottom: 0 }}
              />
              <button type="submit" className="button-primary">
                Enter
              </button>
            </form>
            {inputError && (
              <div className="text-sm text-red-600">{inputError}</div>
            )}
          </PageContent>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-5xl">
        <PageHeader
          title="My Assigned Work"
          subtitle={`Contractor ID: ${contractorId}`}
        />
        <PageContent>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {message}
            </div>
          )}

      {requests.length === 0 ? (
        <div style={{ padding: "20px", textAlign: "center", color: "#888" }}>
          No requests assigned to you yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-50/70">
              <tr>
                <th className="h-12 px-4 text-left align-middle text-xs font-semibold text-slate-600 border-b border-slate-200">
                  Created
                </th>
                <th className="h-12 px-4 text-left align-middle text-xs font-semibold text-slate-600 border-b border-slate-200">
                  Category
                </th>
                <th className="h-12 px-4 text-left align-middle text-xs font-semibold text-slate-600 border-b border-slate-200">
                  Appliance / Model
                </th>
                <th className="h-12 px-4 text-left align-middle text-xs font-semibold text-slate-600 border-b border-slate-200">
                  Description
                </th>
                <th className="h-12 px-4 text-left align-middle text-xs font-semibold text-slate-600 border-b border-slate-200">
                  Est. Cost
                </th>
                <th className="h-12 px-4 text-left align-middle text-xs font-semibold text-slate-600 border-b border-slate-200">
                  Status
                </th>
                <th className="h-12 px-4 text-left align-middle text-xs font-semibold text-slate-600 border-b border-slate-200">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => {
                const b = badgeForStatus(r.status);
                const busy = updating === r.id;
                  const canStartWork =
                    r.status === "AUTO_APPROVED" || r.status === "APPROVED";
                  const canComplete = r.status === "IN_PROGRESS";

                return (
                  <>
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 align-middle text-sm text-slate-700 whitespace-nowrap">
                      {fmtDate(r.createdAt)}
                    </td>
                    <td className="px-4 py-3 align-middle text-sm text-slate-700">
                      {r.category || "(none)"}
                    </td>
                    <td className="px-4 py-3 align-middle text-sm text-slate-700">
                      {r.appliance ? (
                        <div>
                          <div className="font-medium text-slate-900">{r.appliance.name}</div>
                          {r.appliance.assetModel ? (
                            <div className="text-xs text-slate-500">
                              {r.appliance.assetModel.manufacturer} {r.appliance.assetModel.model}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400">(No model info)</div>
                          )}
                          {r.appliance.serial && (
                            <div className="text-[11px] text-slate-400">SN: {r.appliance.serial}</div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-slate-400">(No appliance)</div>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle text-sm text-slate-700">
                      <div className="font-medium text-slate-900">{r.description}</div>
                      <div className="text-xs text-slate-500">{r.id}</div>
                    </td>
                    <td className="px-4 py-3 align-middle text-sm text-slate-700 whitespace-nowrap">
                      {typeof r.estimatedCost === "number" ? `${r.estimatedCost} CHF` : "(none)"}
                    </td>
                    <td className="px-4 py-3 align-middle text-sm text-slate-700">
                      <span
                        style={{
                          padding: "4px 8px",
                          borderRadius: 999,
                          background: b.bg,
                          border: `1px solid ${b.border}`,
                          color: b.color,
                          fontWeight: 700,
                          fontSize: 12,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {b.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle text-sm text-slate-700">
                      <div className="flex flex-wrap gap-2">
                        {canStartWork ? (
                          <button
                            onClick={() => updateStatus(r.id, "IN_PROGRESS")}
                            disabled={busy}
                            style={{
                              padding: "6px 12px",
                              background: "#ff9800",
                              color: "white",
                              border: "none",
                              borderRadius: 4,
                              cursor: busy ? "not-allowed" : "pointer",
                              opacity: busy ? 0.6 : 1,
                            }}
                          >
                            {busy ? "..." : "Start"}
                          </button>
                        ) : null}
                        {canComplete ? (
                          <button
                            onClick={() => updateStatus(r.id, "COMPLETED")}
                            disabled={busy}
                            style={{
                              padding: "6px 12px",
                              background: "#4caf50",
                              color: "white",
                              border: "none",
                              borderRadius: 4,
                              cursor: busy ? "not-allowed" : "pointer",
                              opacity: busy ? 0.6 : 1,
                            }}
                          >
                            {busy ? "..." : "Complete"}
                          </button>
                        ) : null}
                        {!canStartWork && !canComplete ? (
                          <span className="text-xs text-slate-400">(no actions)</span>
                        ) : null}
                        <button
                          style={{ padding: "6px 12px", background: "#2196f3", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}
                          onClick={() => {
                            if (openTimeline === r.id) {
                              setOpenTimeline(null);
                            } else {
                              setOpenTimeline(r.id);
                              loadTimeline(r.id);
                            }
                          }}
                        >
                          {openTimeline === r.id ? "Hide Timeline" : "Show Timeline"}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {openTimeline === r.id && (
                    <tr>
                      <td colSpan={7} className="bg-slate-50/70 px-6 py-5">
                        <div className="mb-2 text-sm font-semibold text-slate-900">Event Timeline</div>
                        {eventLoading ? (
                          <div className="text-sm text-slate-500">Loading...</div>
                        ) : eventError ? (
                          <div className="text-sm text-red-600">
                            {eventError === "Not found" || eventError?.toLowerCase().includes("not found")
                              ? "No timeline events found for this request."
                              : eventError}
                          </div>
                        ) : (
                          <ul className="space-y-2 text-sm text-slate-700">
                            {(eventData[r.id] || []).length === 0 ? (
                              <li className="text-slate-400">(No events logged yet)</li>
                            ) : (
                              eventData[r.id].map(ev => (
                                <li key={ev.id}>
                                  <span className="font-medium text-slate-900">{ev.type}</span>
                                  {ev.message ? <>: <span>{ev.message}</span></> : null}
                                  <span className="ml-3 text-xs text-slate-500">{fmtDate(ev.timestamp)}</span>
                                </li>
                              ))
                            )}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

          <div className="text-sm text-slate-600">
            <p className="font-semibold text-slate-800">How it works:</p>
            <ul className="ml-5 list-disc space-y-1">
              <li>Once a request is <strong>Approved</strong> by the manager, you can click <strong>Start</strong> to begin work.</li>
              <li>While working, the status shows <strong>In Progress</strong>.</li>
              <li>When done, click <strong>Complete</strong> to mark it finished.</li>
            </ul>
          </div>
        </PageContent>
      </div>
    </PageShell>
  );
}
