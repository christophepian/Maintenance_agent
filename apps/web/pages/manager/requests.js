import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import { styles } from "../../styles/managerStyles";

const STATUS_TABS = [
  { key: "ALL", label: "All" },
  { key: "PENDING_REVIEW", label: "Pending Review" },
  { key: "PENDING_OWNER_APPROVAL", label: "Owner Approval" },
  { key: "APPROVED", label: "Approved" },
  { key: "ASSIGNED", label: "Assigned" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "COMPLETED", label: "Completed" },
];

function authHeaders() {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function formatCurrency(chf) {
  if (typeof chf !== "number") return "—";
  const str = chf.toFixed(0);
  const formatted = str.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `CHF ${formatted}`;
}

const statusColors = {
  PENDING_REVIEW: { bg: "#fff8e1", color: "#7a4a00", border: "#ffe082" },
  PENDING_OWNER_APPROVAL: { bg: "#fce4ec", color: "#7a1f1f", border: "#ef9a9a" },
  APPROVED: { bg: "#e8f5e9", color: "#1b5e20", border: "#a5d6a7" },
  AUTO_APPROVED: { bg: "#e8f5e9", color: "#1b5e20", border: "#a5d6a7" },
  ASSIGNED: { bg: "#e3f2fd", color: "#0b3a75", border: "#90caf9" },
  IN_PROGRESS: { bg: "#e3f2fd", color: "#0b3a75", border: "#90caf9" },
  COMPLETED: { bg: "#f3e5f5", color: "#4a148c", border: "#ce93d8" },
};

function StatusBadge({ status }) {
  const c = statusColors[status] || { bg: "#f5f5f5", color: "#666", border: "#ccc" };
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 12,
      fontSize: "0.8em", fontWeight: 600,
      backgroundColor: c.bg, color: c.color, border: `1px solid ${c.border}`,
    }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default function ManagerRequestsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requests, setRequests] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [activeTab, setActiveTab] = useState("ALL");
  const [actionLoading, setActionLoading] = useState(null);

  // Assign modal state
  const [assigningId, setAssigningId] = useState(null);
  const [selectedContractorId, setSelectedContractorId] = useState("");

  // Pick up initial filter from query string
  useEffect(() => {
    if (router.query.filter) setActiveTab(router.query.filter);
  }, [router.query.filter]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [reqRes, conRes] = await Promise.all([
        fetch("/api/requests?view=summary", { headers: authHeaders() }),
        fetch("/api/contractors", { headers: authHeaders() }),
      ]);
      const reqData = await reqRes.json();
      const conData = await conRes.json();
      if (!reqRes.ok) throw new Error(reqData?.error?.message || "Failed to load requests");
      setRequests(reqData?.data || []);
      setContractors(conData?.data || []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredRequests = useMemo(() => {
    if (activeTab === "ALL") return requests;
    return requests.filter((r) => r.status === activeTab);
  }, [requests, activeTab]);

  // ─── Actions ───
  async function approveRequest(id) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/requests/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status: "APPROVED" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message || "Failed to approve");
      }
      await loadData();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setActionLoading(null);
    }
  }

  async function doAssignContractor(requestId) {
    if (!selectedContractorId) return;
    setActionLoading(requestId);
    try {
      const res = await fetch(`/api/requests/${requestId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ contractorId: selectedContractorId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message || "Failed to assign");
      }
      setAssigningId(null);
      setSelectedContractorId("");
      await loadData();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setActionLoading(null);
    }
  }

  async function doUnassignContractor(requestId) {
    setActionLoading(requestId);
    try {
      const res = await fetch(`/api/requests/${requestId}/assign`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message || "Failed to unassign");
      }
      await loadData();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader title="Requests Inbox" />
        <PageContent>
          {error && (
            <Panel style={{ backgroundColor: "#fff0f0", borderColor: "#ffb3b3" }}>
              <strong style={styles.errorText}>Error:</strong> {error}
              <button onClick={() => setError("")} style={{ marginLeft: 12, fontSize: "0.85em" }}>Dismiss</button>
            </Panel>
          )}

          {/* Status Tabs */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 16 }}>
            {STATUS_TABS.map((tab) => {
              const count = tab.key === "ALL"
                ? requests.length
                : requests.filter((r) => r.status === tab.key).length;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    padding: "6px 14px", borderRadius: 6, fontSize: "0.85em", fontWeight: active ? 700 : 400,
                    border: active ? "2px solid #0b3a75" : "1px solid #ccc",
                    backgroundColor: active ? "#e3f2fd" : "#fff",
                    color: active ? "#0b3a75" : "#333", cursor: "pointer",
                  }}
                >
                  {tab.label} ({count})
                </button>
              );
            })}
          </div>

          {loading ? (
            <p>Loading requests...</p>
          ) : filteredRequests.length === 0 ? (
            <Panel>
              <p style={styles.headingFlush}>No requests match this filter.</p>
            </Panel>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #ddd", textAlign: "left" }}>
                    <th style={{ padding: "8px 6px" }}>Status</th>
                    <th style={{ padding: "8px 6px" }}>Building / Unit</th>
                    <th style={{ padding: "8px 6px" }}>Category</th>
                    <th style={{ padding: "8px 6px" }}>Description</th>
                    <th style={{ padding: "8px 6px" }}>Est. Cost</th>
                    <th style={{ padding: "8px 6px" }}>Contractor</th>
                    <th style={{ padding: "8px 6px" }}>Created</th>
                    <th style={{ padding: "8px 6px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((r) => (
                    <tr key={r.id} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "8px 6px" }}>
                        <StatusBadge status={r.status} />
                      </td>
                      <td style={{ padding: "8px 6px" }}>
                        {r.buildingName || "—"}
                        {r.unitNumber ? ` / ${r.unitNumber}` : ""}
                      </td>
                      <td style={{ padding: "8px 6px" }}>{r.category || "—"}</td>
                      <td style={{ padding: "8px 6px", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.description || "—"}
                      </td>
                      <td style={{ padding: "8px 6px" }}>{typeof r.estimatedCost === "number" ? formatCurrency(r.estimatedCost) : "—"}</td>
                      <td style={{ padding: "8px 6px" }}>{r.assignedContractorName || "—"}</td>
                      <td style={{ padding: "8px 6px" }}>{formatDate(r.createdAt)}</td>
                      <td style={{ padding: "8px 6px" }}>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {/* Approve — only for PENDING_REVIEW */}
                          {r.status === "PENDING_REVIEW" && (
                            <button
                              onClick={() => approveRequest(r.id)}
                              disabled={actionLoading === r.id}
                              style={{
                                padding: "4px 10px", borderRadius: 4, fontSize: "0.8em",
                                backgroundColor: "#1b5e20", color: "#fff", border: "none", cursor: "pointer",
                              }}
                            >
                              {actionLoading === r.id ? "…" : "Approve"}
                            </button>
                          )}

                          {/* Assign contractor */}
                          {!r.assignedContractorName && assigningId !== r.id && (
                            <button
                              onClick={() => setAssigningId(r.id)}
                              style={{
                                padding: "4px 10px", borderRadius: 4, fontSize: "0.8em",
                                backgroundColor: "#0b3a75", color: "#fff", border: "none", cursor: "pointer",
                              }}
                            >
                              Assign
                            </button>
                          )}

                          {/* Unassign */}
                          {r.assignedContractorName && (
                            <button
                              onClick={() => doUnassignContractor(r.id)}
                              disabled={actionLoading === r.id}
                              style={{
                                padding: "4px 10px", borderRadius: 4, fontSize: "0.8em",
                                backgroundColor: "#b71c1c", color: "#fff", border: "none", cursor: "pointer",
                              }}
                            >
                              {actionLoading === r.id ? "…" : "Unassign"}
                            </button>
                          )}

                          {/* Assign picker (inline) */}
                          {assigningId === r.id && (
                            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                              <select
                                value={selectedContractorId}
                                onChange={(e) => setSelectedContractorId(e.target.value)}
                                style={{ fontSize: "0.8em", padding: "3px 6px" }}
                              >
                                <option value="">Select…</option>
                                {contractors.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name || c.companyName || c.id.slice(0, 8)}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => doAssignContractor(r.id)}
                                disabled={!selectedContractorId || actionLoading === r.id}
                                style={{
                                  padding: "3px 8px", borderRadius: 4, fontSize: "0.8em",
                                  backgroundColor: "#0b3a75", color: "#fff", border: "none", cursor: "pointer",
                                }}
                              >
                                {actionLoading === r.id ? "…" : "OK"}
                              </button>
                              <button
                                onClick={() => { setAssigningId(null); setSelectedContractorId(""); }}
                                style={{
                                  padding: "3px 8px", borderRadius: 4, fontSize: "0.8em",
                                  backgroundColor: "#eee", color: "#333", border: "1px solid #ccc", cursor: "pointer",
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
