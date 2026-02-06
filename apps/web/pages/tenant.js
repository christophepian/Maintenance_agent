import { useState } from "react";
import { useRouter } from "next/router";

export default function TenantPhone() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const trimmed = phone.trim();
    if (!trimmed) {
      setNotice({ type: "err", msg: "Phone number is required." });
      return;
    }

    setLoading(true);
    setNotice(null);

    try {
      const res = await fetch("/api/tenant-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: trimmed }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 404) {
          setNotice({
            type: "err",
            msg: "We couldn’t find you. Please contact your property manager.",
          });
          return;
        }
        setNotice({ type: "err", msg: data?.error?.message || "Lookup failed." });
        return;
      }

      localStorage.setItem("tenantSession", JSON.stringify(data.data));
      router.push("/tenant-chat");
    } catch (e) {
      setNotice({ type: "err", msg: String(e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="main-container">
      <h1>Tenant sign-in</h1>
      <div className="subtle">Enter your phone number to continue.</div>

      {notice ? (
        <div className={`notice ${notice.type === "ok" ? "notice-ok" : "notice-err"}`}>
          {notice.msg}
        </div>
      ) : null}

      <form className="card" onSubmit={submit}>
        <label className="label">Phone number</label>
        <input
          className="input"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+41 79 123 45 67"
        />
        <button className="button-primary" type="submit" disabled={loading}>
          {loading ? "Checking…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
