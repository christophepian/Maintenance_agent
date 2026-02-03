import { useEffect, useState } from "react";

function badgeForStatus(status) {
  if (status === "PENDING_REVIEW")
    return { label: "Pending Manager", bg: "#fff5e6", border: "#ffd08a", color: "#7a4a00" };
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
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function ContractorPortal() {
  const [contractorId, setContractorId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [updating, setUpdating] = useState(null);

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
      setError("No contractor ID provided. Use ?contractorId=<uuid>");
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
        const r = await fetch(`/api/requests/contractor/${contractorId}`);
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
        headers: { "Content-Type": "application/json" },
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

  if (loading) {
    return (
      <div style={{ maxWidth: "900px", margin: "40px auto", padding: "16px", fontFamily: "system-ui" }}>
        <h1>Contractor Portal</h1>
        <p style={{ color: "#666" }}>Loading...</p>
      </div>
    );
  }

  if (!contractorId) {
    return (
      <div style={{ maxWidth: "900px", margin: "40px auto", padding: "16px", fontFamily: "system-ui" }}>
        <h1>Contractor Portal</h1>
        <div style={{ padding: "12px", background: "#ffecec", border: "1px solid #ffb3b3" }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "900px", margin: "40px auto", padding: "16px", fontFamily: "system-ui" }}>
      <h1>My Assigned Work</h1>
      <p style={{ color: "#666" }}>Contractor ID: {contractorId}</p>

      {error && (
        <div style={{ padding: "12px", background: "#ffecec", border: "1px solid #ffb3b3", marginBottom: "16px" }}>
          {error}
        </div>
      )}

      {message && (
        <div style={{ padding: "12px", background: "#e8f5e9", border: "1px solid #81c784", marginBottom: "16px" }}>
          {message}
        </div>
      )}

      {requests.length === 0 ? (
        <div style={{ padding: "20px", textAlign: "center", color: "#888" }}>
          No requests assigned to you yet.
        </div>
      ) : (
        <div
          style={{
            overflowX: "auto",
            border: "1px solid #ddd",
            borderRadius: 8,
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f5f5f5" }}>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: 600, borderBottom: "2px solid #ddd" }}>
                  Created
                </th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: 600, borderBottom: "2px solid #ddd" }}>
                  Category
                </th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: 600, borderBottom: "2px solid #ddd" }}>
                  Appliance / Model
                </th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: 600, borderBottom: "2px solid #ddd" }}>
                  Description
                </th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: 600, borderBottom: "2px solid #ddd" }}>
                  Est. Cost
                </th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: 600, borderBottom: "2px solid #ddd" }}>
                  Status
                </th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: 600, borderBottom: "2px solid #ddd" }}>
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
                  <tr key={r.id}>
                    <td style={{ padding: "10px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>
                      {fmtDate(r.createdAt)}
                    </td>
                    <td style={{ padding: "10px", borderBottom: "1px solid #eee" }}>
                      {r.category || "(none)"}
                    </td>
                    <td style={{ padding: "10px", borderBottom: "1px solid #eee" }}>
                      {r.appliance ? (
                        <div>
                          <div style={{ fontWeight: 500 }}>{r.appliance.name}</div>
                          {r.appliance.assetModel ? (
                            <div style={{ fontSize: 12, color: "#666" }}>
                              {r.appliance.assetModel.manufacturer} {r.appliance.assetModel.model}
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, color: "#999" }}>(No model info)</div>
                          )}
                          {r.appliance.serial && (
                            <div style={{ fontSize: 11, color: "#999" }}>SN: {r.appliance.serial}</div>
                          )}
                        </div>
                      ) : (
                        <div style={{ color: "#999" }}>(No appliance)</div>
                      )}
                    </td>
                    <td style={{ padding: "10px", borderBottom: "1px solid #eee" }}>
                      <div style={{ fontWeight: 500 }}>{r.description}</div>
                      <div style={{ fontSize: 12, color: "#888" }}>{r.id}</div>
                    </td>
                    <td style={{ padding: "10px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>
                      {typeof r.estimatedCost === "number" ? `${r.estimatedCost} CHF` : "(none)"}
                    </td>
                    <td style={{ padding: "10px", borderBottom: "1px solid #eee" }}>
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
                    <td style={{ padding: "10px", borderBottom: "1px solid #eee" }}>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
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
                          <span style={{ color: "#ccc", fontSize: 12 }}>(no actions)</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: "20px", color: "#666", fontSize: 13 }}>
        <p>
          <strong>How it works:</strong>
        </p>
        <ul style={{ marginLeft: "20px" }}>
          <li>Once a request is <strong>Approved</strong> by the manager, you can click <strong>Start</strong> to begin work.</li>
          <li>While working, the status shows <strong>In Progress</strong>.</li>
          <li>When done, click <strong>Complete</strong> to mark it finished.</li>
        </ul>
      </div>
    </div>
  );
}
