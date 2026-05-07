import { useState } from "react";
import { useRouter } from "next/router";
import AppShell from "../components/AppShell";

import { cn } from "../lib/utils";
import { withTranslations } from "../lib/i18n";
import { useTranslation } from "next-i18next";
export default function TenantPhone() {
  const { t } = useTranslation("tenant");
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

      // Write token to both keys: tenantToken (phone-login key) and authToken
      // (read by tenantHeaders() / tenantFetch in all tenant portal pages).
      if (data.data.token) {
        localStorage.setItem("tenantToken", data.data.token);
        localStorage.setItem("authToken", data.data.token);
      }
      localStorage.setItem("tenantSession", JSON.stringify(data.data));
      router.push("/tenant/inbox");
    } catch (e) {
      setNotice({ type: "err", msg: String(e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell role="TENANT">
      <div className="main-container">
      <h1>{t("tenant:index.heading.tenantSignIn")}</h1>
      <div className="subtle">Enter your phone number to continue.</div>

      {notice ? (
        <div className={cn("notice", notice.type === "ok" ? "notice-ok" : "notice-err")}>
          {notice.msg}
        </div>
      ) : null}

      <form className="card" onSubmit={submit}>
        <label className="label">Phone number</label>
        <input
          className="input"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t("tenant:index.placeholder.41791234567")}
        />
        <button className="button-primary" type="submit" disabled={loading}>
          {loading ? "Checking…" : "Continue"}
        </button>
      </form>
      </div>
    </AppShell>
  );
}

export const getStaticProps = withTranslations(["common","tenant"]);
