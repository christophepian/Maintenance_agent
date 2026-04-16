import { useState } from "react";
import { useRouter } from "next/router";

import { cn } from "../lib/utils";
const ROLE_HOME = {
  MANAGER: "/manager",
  CONTRACTOR: "/contractor",
  OWNER: "/owner",
  TENANT: "/tenant/inbox",
};

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login"); // login | register
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("MANAGER");
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setNotice(null);
    setLoading(true);

    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload = mode === "login"
        ? { email, password }
        : { email, password, name, role };

      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setNotice({ type: "err", msg: data?.error?.message || "Authentication failed." });
        return;
      }

      const token = data?.data?.token;
      if (token) {
        localStorage.setItem("authToken", token);
        localStorage.setItem("authUser", JSON.stringify(data.data.user));
      }

      // Redirect to role-specific home page
      const userRole = data?.data?.user?.role;
      const target = ROLE_HOME[userRole] || "/manager";
      router.push(target);
    } catch (e2) {
      setNotice({ type: "err", msg: String(e2) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="main-container">
      <h1>{mode === "login" ? "Sign in" : "Create account"}</h1>
      <div className="subtle">
        Use your manager or contractor credentials.
      </div>

      <div className="row" className="mb-4">
        <button
          className={mode === "login" ? "button-primary" : "button-secondary"}
          type="button"
          onClick={() => setMode("login")}
        >
          Login
        </button>
        <button
          className={mode === "register" ? "button-primary" : "button-secondary"}
          type="button"
          onClick={() => setMode("register")}
        >
          Register
        </button>
      </div>

      {notice ? (
        <div className={cn("notice", notice.type === "ok" ? "notice-ok" : "notice-err")}>
          {notice.msg}
        </div>
      ) : null}

      <form className="card" onSubmit={submit}>
        {mode === "register" ? (
          <label className="label">
            Name
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </label>
        ) : null}

        <label className="label">
          Email
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </label>

        <label className="label">
          Password
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            required
          />
        </label>

        {mode === "register" ? (
          <label className="label">
            Role
            <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="MANAGER">Manager</option>
              <option value="CONTRACTOR">Contractor</option>
              <option value="TENANT">Tenant</option>
            </select>
          </label>
        ) : null}

        <button className="button-primary" type="submit" disabled={loading}>
          {loading ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
    </div>
  );
}
