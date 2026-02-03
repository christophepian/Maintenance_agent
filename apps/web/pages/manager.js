import { useEffect, useMemo, useState } from "react";

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function badgeForStatus(status) {
  if (status === "AUTO_APPROVED") {
    return { label: "AUTO_APPROVED", bg: "#e9f8ee", border: "#7bd89a", color: "#116b2b" };
  }
  if (status === "PENDING_REVIEW") {
    return { label: "PENDING_REVIEW", bg: "#fff5e6", border: "#ffd08a", color: "#7a4a00" };
  }
  if (status === "APPROVED") {
    return { label: "APPROVED", bg: "#e8f2ff", border: "#90c2ff", color: "#0b3a75" };
  }
  return { label: String(status || "UNKNOWN"), bg: "#f1f1f1", border: "#ddd", color: "#333" };
}

export default function Manager() {
  const [loading, setLoading] = useState(true);

  // Org config
  const [autoApproveLimit, setAutoApproveLimit] = useState(null);
  const [limitDraft, setLimitDraft] = useState("");
  const [savingLimit, setSavingLimit] = useState(false);

  // Requests
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState("ALL"); // ALL | NEEDS_APPROVAL | AUTO_APPROVED
  const [search, setSearch] = useState("");

  // Per-row action state
  const [approvingId, setApprovingId] = useState(null);

  // Errors / messages
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadOrgConfig() {
    const r = await fetch("/api/org-config");
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error?.message || j?.error || "Failed to load org config");
    return j?.data;
  }

  async function loadRequests() {
    const r = await fetch("/api/requests");
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error?.message || j?.error || "Failed to load requests");
    return j?.data || [];
  }

  // Load requests even if org-config fails (keeps dashboard useful)
  async function refreshAll() {
    setError("");
    setNotice("");
    setLoading(true);

    try {
      const reqs = await loadRequests();
      setRequests(reqs);
    } catch (e) {
      setError(String(e?.message || e));
    }

    try {
      const cfg = await loadOrgConfig();
      setAutoApproveLimit(cfg.autoApproveLimit);
      setLimitDraft(String(cfg.autoApproveLimit));
    } catch (e) {
      setError((prev) => prev || String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function refreshRequestsOnly() {
    try {
      const reqs = await loadRequests();
      setRequests(reqs);
    } catch (e) {
      setError(String(e?.message || e));
    }
  }

  useEffect(() => {
    refreshAll().catch(() => {});
  }, []);

  const filteredRequests = useMemo(() => {
    const q = (search || "").trim().toLowerCase();

    return (requests || [])
      .filter((r) => {
        if (filter === "NEEDS_APPROVAL") return r.status === "PENDING_REVIEW";
        if (filter === "AUTO_APPROVED") return r.status === "AUTO_APPROVED";
        return true;
      })
      .filter((r) => {
        if (!q) return true;
        const hay = `${r.description || ""} ${r.category || ""} ${r.status || ""}`.toLowerCase();
        return hay.includes(q);
      });
  }, [requests, filter, search]);

  function parseLimitDraft(s) {
    const raw = String(s ?? "").trim();
    if (!raw) return { ok: false, value: null, error: "Threshold is required." };
    const n = Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      return { ok: false, value: null, error: "Threshold must be a whole number." };
    }
    if (n < 0) return { ok: false, value: null, error: "Threshold must be >= 0." };
    if (n > 100000) return { ok: false, value: null, error: "Threshold must be <= 100000." };
    return { ok: true, value: n, error: "" };
  }

  const limitValidation = useMemo(() => parseLimitDraft(limitDraft), [limitDraft]);

  async function saveThreshold() {
    setError("");
    setNotice("");

    const v = parseLimitDraft(limitDraft);
    if (!v.ok) {
      setError(v.error);
      return;
    }

    setSavingLimit(true);
    try {
      const r = await fetch("/api/org-config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ autoApproveLimit: v.value }),
      });
      const j = await r.json();

      if (!r.ok) {
        const msg = j?.error?.message || j?.error || "Failed to update threshold";
        throw new Error(msg);
      }

      setAutoApproveLimit(j.data.autoApproveLimit);
      setLimitDraft(String(j.data.autoApproveLimit));
      setNotice("Threshold updated.");
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSavingLimit(false);
    }
  }

  // NOTE: uses the flat route you actually have: /api/requests/approve?id=...
  async function approveRequest(id) {
    setError("");
    setNotice("");
    setApprovingId(id);

    try {
      const r = await fetch(`/api/requests/approve?id=${encodeURIComponent(id)}`, {
        method: "POST",
      });
      const j = await r.json();

      if (!r.ok) throw new Error(j?.error?.message || j?.error || "Failed to approve request.");

      setNotice("Request approved.");
      await refreshRequestsOnly();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16 }}>
        <div>
          <h1 style={{ marginBottom: 6 }}>Manager Dashboard</h1>
          <div style={{ color: "#555" }}>
            Configure auto-approval and review requests that need attention.
          </div>
        </div>

        <button onClick={refreshAll} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <hr style={{ margin: "18px 0" }} />

      {/* Threshold */}
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 10,
          padding: 14,
          background: "#fafafa",
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontWeight: 700 }}>Auto-approval threshold</div>
          <div style={{ color: "#666", fontSize: 13 }}>
            Current:{" "}
            <strong>{autoApproveLimit == null ? "(unavailable)" : `${autoApproveLimit} CHF`}</strong>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#444" }}>Set to</span>
            <input
              type="number"
              step="1"
              min="0"
              max="100000"
              value={limitDraft}
              onChange={(e) => setLimitDraft(e.target.value)}
              style={{ width: 140 }}
            />
            <span style={{ fontSize: 13, color: "#444" }}>CHF</span>
          </label>

          <button onClick={saveThreshold} disabled={savingLimit || !limitValidation.ok}>
            {savingLimit ? "Saving…" : "Save"}
          </button>

          {!limitValidation.ok ? (
            <span style={{ fontSize: 13, color: "crimson" }}>{limitValidation.error}</span>
          ) : (
            <span style={{ fontSize: 13, color: "#666" }}>
              Requests with estimated cost ≤ this value auto-approve.
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ marginTop: 12 }}>
        {error ? (
          <div style={{ padding: 12, background: "#ffecec", border: "1px solid #ffb3b3" }}>
            <strong style={{ color: "crimson" }}>Error:</strong> {error}
          </div>
        ) : null}

        {notice ? (
          <div style={{ padding: 12, background: "#eefaf1", border: "1px solid #7bd89a", marginTop: 10 }}>
            <strong style={{ color: "#116b2b" }}>OK:</strong> {notice}
          </div>
        ) : null}
      </div>

      <hr style={{ margin: "18px 0" }} />

      {/* Requests */}
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>Requests</h2>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              style={{ minWidth: 220 }}
            />

            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setFilter("ALL")} disabled={filter === "ALL"}>All</button>
              <button onClick={() => setFilter("NEEDS_APPROVAL")} disabled={filter === "NEEDS_APPROVAL"}>
                Needs approval
              </button>
              <button onClick={() => setFilter("AUTO_APPROVED")} disabled={filter === "AUTO_APPROVED"}>
                Auto-approved
              </button>
            </div>
          </div>
        </div>

        <div style={{ color: "#666", fontSize: 13 }}>
          Showing <strong>{filteredRequests.length}</strong> of <strong>{requests.length}</strong>
        </div>

        <div style={{ overflowX: "auto", border: "1px solid #ddd", borderRadius: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f6f6f6" }}>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}>Created</th>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}>Category</th>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}>Description</th>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}>Est. cost</th>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}>Status</th>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}>Actions</th>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}>Contractor</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: 12, color: "#666" }}>Loading…</td></tr>
              ) : filteredRequests.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 12, color: "#666" }}>No requests match your filter/search.</td></tr>
              ) : (
                filteredRequests.map((r) => {
                  const b = badgeForStatus(r.status);
                  const canApprove = r.status === "PENDING_REVIEW";
                  const busy = approvingId === r.id;

                  return (
                    <tr key={r.id}>
                      <td style={{ padding: 10, borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>
                        {fmtDate(r.createdAt)}
                      </td>
                      <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{r.category || "(none)"}</td>
                      <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>
                        <div style={{ fontWeight: 600 }}>{r.description}</div>
                        <div style={{ fontSize: 12, color: "#888" }}>{r.id}</div>
                      </td>
                      <td style={{ padding: 10, borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>
                        {typeof r.estimatedCost === "number" ? `${r.estimatedCost} CHF` : "(none)"}
                      </td>
                      <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>
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
                      <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>
                        {canApprove ? (
                          <button onClick={() => approveRequest(r.id)} disabled={busy}>
                            {busy ? "Approving…" : "Approve"}
                          </button>
                        ) : (
                          <span style={{ color: "#888", fontSize: 12 }}>(none)</span>
                        )}
                      </td>
                      <td style={{ padding: 10, borderBottom: "1px solid #eee", color: "#666" }}>
                        (not implemented)
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div style={{ color: "#666", fontSize: 12 }}>
          Note: contractor assignment will appear here once we implement routing/assignment (Option C).
        </div>
      </div>
    </div>
  );
}
