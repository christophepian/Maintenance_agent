import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

export default function TenantChat() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([
    { role: "system", text: "Hi there! Tell me what’s going on." },
  ]);
  const [suggestions, setSuggestions] = useState([]);
  const [currentIssue, setCurrentIssue] = useState("");
  const [detectedCategory, setDetectedCategory] = useState(null);
  const [candidateApplianceId, setCandidateApplianceId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem("tenantSession") : null;
    if (!raw) {
      router.push("/tenant");
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setSession(parsed);
    } catch {
      localStorage.removeItem("tenantSession");
      router.push("/tenant");
    }
  }, [router]);

  const contextLabel = useMemo(() => {
    if (!session) return "";
    const name = session.tenant?.name || "there";
    const building = session.building?.address || session.building?.name || "";
    const unit = session.unit?.unitNumber ? `Unit ${session.unit.unitNumber}` : "";
    return `${name}${building ? ` • ${building}` : ""}${unit ? ` • ${unit}` : ""}`;
  }, [session]);

  async function sendMessage(e) {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || !session?.unit?.id) return;

    setLoading(true);
    setNotice(null);
    setCurrentIssue(trimmed);
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);

    try {
      const res = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId: session.unit.id, message: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ type: "err", msg: data?.error?.message || "Triage failed." });
        return;
      }

      const result = data?.data || {};
      setDetectedCategory(result.detectedCategory || null);
      setCandidateApplianceId(result.candidateApplianceIds?.[0] || null);
      setSuggestions(Array.isArray(result.suggestions) ? result.suggestions : []);

      if (result.needsClarification && result.clarifyingQuestion) {
        setMessages((prev) => [...prev, { role: "system", text: result.clarifyingQuestion }]);
      }
    } catch (e) {
      setNotice({ type: "err", msg: String(e) });
    } finally {
      setLoading(false);
      setMessage("");
    }
  }

  async function createRequest() {
    if (!session || !currentIssue) return;
    setLoading(true);
    setNotice(null);

    try {
      const payload = {
        description: currentIssue,
        category: detectedCategory || undefined,
        tenantId: session.tenant?.id || undefined,
        unitId: session.unit?.id || undefined,
        applianceId: candidateApplianceId || undefined,
      };

      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setNotice({ type: "err", msg: data?.error?.message || "Request failed." });
        return;
      }

      setMessages((prev) => [
        ...prev,
        { role: "system", text: `Thanks! Your request is submitted. Reference: ${data?.data?.id || "N/A"}` },
      ]);
      setSuggestions([]);
    } catch (e) {
      setNotice({ type: "err", msg: String(e) });
    } finally {
      setLoading(false);
    }
  }

  if (!session) return null;

  return (
    <div className="main-container">
      <h1>Maintenance help</h1>
      <div className="subtle">{contextLabel}</div>

      {notice ? (
        <div className={`notice ${notice.type === "ok" ? "notice-ok" : "notice-err"}`}>
          {notice.msg}
        </div>
      ) : null}

      <div className="card">
        <div style={{ display: "grid", gap: 8 }}>
          {messages.map((m, idx) => (
            <div key={idx} className="help">
              <strong>{m.role === "user" ? "You" : "Assistant"}:</strong> {m.text}
            </div>
          ))}
        </div>
      </div>

      {suggestions.length > 0 ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Quick fixes</h3>
          {suggestions.map((s, idx) => (
            <div key={idx} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600 }}>{s.title}</div>
              <ul>
                {s.steps.map((step, stepIndex) => (
                  <li key={stepIndex} className="help">
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="row">
            <button className="button-secondary" type="button" onClick={() => setSuggestions([])}>
              That fixed it
            </button>
            <button className="button-primary" type="button" onClick={createRequest} disabled={loading}>
              Still broken
            </button>
          </div>
        </div>
      ) : null}

      <form className="card" onSubmit={sendMessage}>
        <label className="label">Describe the problem</label>
        <textarea
          className="input textarea"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g., The oven is overheating"
        />
        <button className="button-primary" type="submit" disabled={loading}>
          {loading ? "Working…" : "Send"}
        </button>
      </form>
    </div>
  );
}
