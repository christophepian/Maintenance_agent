import { useEffect, useMemo, useState } from "react";
import AppShell from "../../components/AppShell";
import Link from "next/link";

export default function ManagerSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [savingMode, setSavingMode] = useState(false);
  const [savingLimit, setSavingLimit] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [orgMode, setOrgMode] = useState("MANAGED");
  const [autoApproveLimit, setAutoApproveLimit] = useState(null);
  const [limitDraft, setLimitDraft] = useState("");

  function authHeaders() {
    if (typeof window === "undefined") return {};
    const token = localStorage.getItem("authToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function loadOrgConfig() {
    const r = await fetch("/api/org-config", { headers: authHeaders() });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error?.message || j?.error || "Failed to load org config");
    return j?.data;
  }

  useEffect(() => {
    let mounted = true;
    loadOrgConfig()
      .then((cfg) => {
        if (!mounted) return;
        setOrgMode(cfg?.mode || "MANAGED");
        setAutoApproveLimit(cfg?.autoApproveLimit ?? null);
        setLimitDraft(cfg?.autoApproveLimit != null ? String(cfg.autoApproveLimit) : "");
      })
      .catch((e) => setError(String(e?.message || e)))
      .finally(() => setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

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

  async function saveOrgMode() {
    setError("");
    setNotice("");
    setSavingMode(true);
    try {
      const r = await fetch("/api/org-config", {
        method: "PUT",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ mode: orgMode }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message || j?.error || "Failed to update org mode");
      setOrgMode(j?.data?.mode || orgMode);
      setNotice("Org mode updated.");
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSavingMode(false);
    }
  }

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
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ autoApproveLimit: v.value }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message || j?.error || "Failed to update threshold");
      setAutoApproveLimit(j?.data?.autoApproveLimit ?? autoApproveLimit);
      setLimitDraft(String(j?.data?.autoApproveLimit ?? v.value));
      setNotice("Threshold updated.");
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSavingLimit(false);
    }
  }

  return (
    <AppShell role="MANAGER">
      <div className="main-container">
        <h1>Settings</h1>
        <p className="subtle">Configure governance mode and default auto-approval settings.</p>

        {error ? (
          <div className="notice notice-err" style={{ marginTop: 12 }}>
            <strong style={{ color: "crimson" }}>Error:</strong> {error}
          </div>
        ) : null}
        {notice ? (
          <div className="notice notice-ok" style={{ marginTop: 12 }}>
            <strong style={{ color: "#116b2b" }}>OK:</strong> {notice}
          </div>
        ) : null}

        <div className="card" style={{ marginTop: 16, display: "grid", gap: 12 }}>
          <div style={{ fontWeight: 700 }}>Org mode</div>
          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <select
              className="input"
              style={{ maxWidth: 240 }}
              value={orgMode}
              onChange={(e) => setOrgMode(e.target.value)}
              disabled={loading}
            >
              <option value="MANAGED">Managed</option>
              <option value="OWNER_DIRECT">Owner-direct</option>
            </select>
            <button
              className="button-primary"
              onClick={saveOrgMode}
              disabled={savingMode || loading}
            >
              {savingMode ? "Saving…" : "Save mode"}
            </button>
            <span className="help">Owner-direct restricts governance to owners only.</span>
          </div>
        </div>

        <div className="card" style={{ marginTop: 16, display: "grid", gap: 12 }}>
          <div style={{ fontWeight: 700 }}>Auto-approval threshold</div>
          <div className="subtle">
            Current: <strong>{autoApproveLimit == null ? "(unavailable)" : `${autoApproveLimit} CHF`}</strong>
          </div>
          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <label className="row" style={{ gap: 8 }}>
              <span className="subtle" style={{ color: "#444" }}>Set to</span>
              <input
                type="number"
                step="1"
                min="0"
                max="100000"
                value={limitDraft}
                onChange={(e) => setLimitDraft(e.target.value)}
                className="input"
                style={{ width: 140, marginBottom: 0 }}
                disabled={loading}
              />
              <span className="subtle" style={{ color: "#444" }}>CHF</span>
            </label>
            <button
              className="button-primary"
              onClick={saveThreshold}
              disabled={savingLimit || loading || !limitValidation.ok}
            >
              {savingLimit ? "Saving…" : "Save threshold"}
            </button>
            {!limitValidation.ok ? (
              <span className="notice notice-err" style={{ padding: 6, marginBottom: 0 }}>
                {limitValidation.error}
              </span>
            ) : (
              <span className="help">Requests with estimated cost ≤ this value auto-approve.</span>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          <Link className="button-primary" href="/manager/work-requests">
            Open Work Requests Dashboard
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
