/**
 * Login page — Supabase Auth.
 *
 * Primary flow:   Email → magic link (works for all user types)
 * Secondary flow: Email + password (founders / admins who prefer it)
 *
 * After a successful magic-link click the browser is redirected to
 * /api/auth/callback which sets the session cookie and redirects to the
 * correct home page based on app_metadata.accessLevel / appRole.
 *
 * After a successful password login the session is set directly here and
 * we redirect client-side.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { createClient } from "../lib/supabase/client";
import { setAuthToken } from "../lib/api";
import { withTranslations } from "../lib/i18n";
import { cn } from "../lib/utils";

const ROLE_HOME = {
  MANAGER: "/manager",
  CONTRACTOR: "/contractor",
  OWNER: "/owner",
  TENANT: "/tenant/inbox",
};

export default function LoginPage() {
  const router = useRouter();
  const { next, error: queryError } = router.query;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  // On mount: check for an existing session.
  // Handles two cases:
  //   1. Supabase implicit-flow tokens in the URL hash (dashboard invites)
  //      — the browser client picks these up automatically via getSession()
  //   2. User navigates to /login while already signed in — redirect them away
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) redirectAfterLogin(session);
    });
    // Also listen for the TOKEN_HASH exchange that happens client-side
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => { if (session) redirectAfterLogin(session); }
    );
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show error messages coming from the callback redirect
  useEffect(() => {
    if (queryError === "forbidden") {
      setNotice({ type: "err", msg: "You don't have permission to access that page." });
    } else if (queryError === "auth_failed") {
      setNotice({ type: "err", msg: "Authentication failed. Please try again." });
    } else if (queryError === "missing_code") {
      setNotice({ type: "err", msg: "Invalid login link. Please request a new one." });
    }
  }, [queryError]);

  function redirectAfterLogin(session) {
    const meta = session.user?.app_metadata ?? {};
    const accessLevel = meta.accessLevel;
    const appRole = meta.appRole;

    // Store Supabase access token in localStorage so fetchWithAuth works
    setAuthToken(session.access_token);
    // Cache role for AppShell
    if (appRole) localStorage.setItem("role", appRole);

    const target =
      (typeof next === "string" && next.startsWith("/") ? next : null) ||
      (accessLevel === "DOCS_INVESTOR" ? "/docs/pitchdeck.html" : null) ||
      (appRole ? ROLE_HOME[appRole] : null) ||
      "/manager";

    router.push(target);
  }

  // ── Magic link ────────────────────────────────────────────────────────────
  async function sendMagicLink(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setNotice(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/api/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`;

      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
      });

      if (error) {
        // "Email not confirmed" or "User not found" — be intentionally vague
        setNotice({ type: "err", msg: "If that address is registered you'll receive a link shortly." });
      } else {
        setMagicSent(true);
      }
    } catch {
      setNotice({ type: "err", msg: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  // ── Password login ────────────────────────────────────────────────────────
  async function signInWithPassword(e) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setNotice(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error || !data.session) {
        setNotice({ type: "err", msg: "Invalid email or password." });
        setPassword("");
        return;
      }

      redirectAfterLogin(data.session);
    } catch {
      setNotice({ type: "err", msg: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  // ── Magic link sent screen ────────────────────────────────────────────────
  if (magicSent) {
    return (
      <div className="main-container">
        <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
          <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>✉️</div>
          <h1 style={{ marginBottom: "0.5rem" }}>Check your inbox</h1>
          <p className="subtle" style={{ marginBottom: "1.5rem" }}>
            We've sent a sign-in link to <strong>{email}</strong>.
            <br />
            Click it to access your account — the link expires in 1 hour.
          </p>
          <button
            className="button-secondary"
            type="button"
            onClick={() => { setMagicSent(false); setNotice(null); }}
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="main-container">
      <h1>Sign in</h1>
      <p className="subtle">Enter your email to receive a sign-in link.</p>

      {notice && (
        <div className={cn("notice", notice.type === "ok" ? "notice-ok" : "notice-err")}>
          {notice.msg}
        </div>
      )}

      {/* ── Magic link form (primary) ── */}
      {!showPassword && (
        <form className="card" onSubmit={sendMagicLink}>
          <label className="label">
            Email
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
            />
          </label>

          <button className="button-primary" type="submit" disabled={loading}>
            {loading ? "Sending…" : "Send sign-in link"}
          </button>

          <button
            className="button-secondary"
            type="button"
            style={{ marginTop: "0.5rem" }}
            onClick={() => { setShowPassword(true); setNotice(null); }}
          >
            Use password instead
          </button>
        </form>
      )}

      {/* ── Password form (secondary — founders) ── */}
      {showPassword && (
        <form className="card" onSubmit={signInWithPassword}>
          <label className="label">
            Email
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
            />
          </label>

          <label className="label">
            Password
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              required
            />
          </label>

          <button className="button-primary" type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
            <button
              className="button-secondary"
              type="button"
              onClick={() => { setShowPassword(false); setPassword(""); setNotice(null); }}
            >
              Send magic link instead
            </button>
            <button
              className="button-secondary"
              type="button"
              onClick={async () => {
                if (!email.trim()) {
                  setNotice({ type: "err", msg: "Enter your email first." });
                  return;
                }
                setLoading(true);
                const supabase = createClient();
                await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
                  redirectTo: `${window.location.origin}/api/auth/callback`,
                });
                setNotice({ type: "ok", msg: "Password reset email sent. Check your inbox." });
                setLoading(false);
              }}
            >
              Forgot password?
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export const getStaticProps = withTranslations(["common"]);
