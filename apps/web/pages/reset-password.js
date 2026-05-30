/**
 * Reset password page.
 *
 * Supabase redirects here (via /api/auth/callback) after a user clicks the
 * "Reset password" email link. By the time this page loads the session is
 * already established by the callback handler.
 *
 * Flow:
 *   1. User clicks "Forgot password?" on /login
 *   2. We call supabase.auth.resetPasswordForEmail({ redirectTo: /reset-password })
 *   3. Supabase sends email → user clicks link → /api/auth/callback?code=…
 *   4. callback.js exchanges code for session, sees type=recovery, redirects here
 *   5. User sets new password → we call supabase.auth.updateUser({ password })
 *   6. We mark password_set in user_metadata, then redirect to their home
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { createClient } from "../lib/supabase/client";
import { setAuthToken } from "../lib/api";
import { withTranslations } from "../lib/i18n";

const ROLE_HOME = {
  MANAGER: "/manager",
  CONTRACTOR: "/contractor",
  OWNER: "/owner",
  TENANT: "/tenant/inbox",
};

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 inline shrink-0" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const { next } = router.query;

  const [password, setPassword]     = useState("");
  const [confirm, setConfirm]       = useState("");
  const [notice, setNotice]         = useState(null);
  const [loading, setLoading]       = useState(false);
  const [done, setDone]             = useState(false);
  const [sessionReady, setSession]  = useState(false);

  // Supabase appends ?code= to the redirectTo URL. Exchange it for a session.
  useEffect(() => {
    const supabase = createClient();
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (error || !data.session) {
          setNotice({ type: "err", msg: "This link is invalid or has expired. Please request a new one." });
          return;
        }
        setAuthToken(data.session.access_token);
        setSession(true);
      });
    } else {
      // No code — check for an existing session (e.g. user navigated here directly)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setAuthToken(session.access_token);
          setSession(true);
        } else {
          setNotice({ type: "err", msg: "This link is invalid or has expired. Please request a new one." });
        }
      });
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) {
      setNotice({ type: "err", msg: "Passwords don't match." });
      return;
    }
    if (password.length < 8) {
      setNotice({ type: "err", msg: "Password must be at least 8 characters." });
      return;
    }

    setNotice(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.updateUser({
        password,
        data: { password_set: true },
      });

      if (error) {
        setNotice({ type: "err", msg: error.message || "Failed to update password. Please try again." });
        return;
      }

      // Cache role for AppShell
      const meta = data.user?.app_metadata ?? {};
      if (meta.appRole) localStorage.setItem("role", meta.appRole);

      setDone(true);

      // Redirect after a short pause so the user sees the success message
      setTimeout(() => {
        const target =
          (typeof next === "string" && next.startsWith("/") ? next : null) ||
          (meta.appRole ? ROLE_HOME[meta.appRole] : null) ||
          "/manager";
        router.push(target);
      }, 1800);
    } catch {
      setNotice({ type: "err", msg: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-subtle flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-11 h-11 bg-brand rounded-xl flex items-center justify-center shadow-md mb-4">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            Maintenance Agent
          </h1>
        </div>

        <div className="bg-surface rounded-2xl border border-surface-border shadow-sm px-8 py-7">

          {done ? (
            /* ── Success state ─────────────────────────────── */
            <div className="text-center py-2">
              <div className="w-14 h-14 bg-success-light rounded-full flex items-center justify-center mx-auto mb-5">
                <svg className="w-7 h-7 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Password updated</h2>
              <p className="text-sm text-muted">Redirecting you now…</p>
            </div>
          ) : (
            /* ── Form ──────────────────────────────────────── */
            <>
              <h2 className="text-lg font-semibold text-foreground mb-1">Set new password</h2>
              <p className="text-sm text-muted mb-6">Choose a strong password for your account.</p>

              {notice && (
                <div className={[
                  "flex items-start gap-2.5 px-3.5 py-3 rounded-xl mb-5 text-sm border",
                  notice.type === "err"
                    ? "bg-destructive-light border-destructive-ring text-destructive-text"
                    : "bg-success-light border-success-ring text-success-dark",
                ].join(" ")}>
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{notice.msg}</span>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-muted-dark mb-1.5">
                    New password
                  </label>
                  <input
                    type="password"
                    className="input mb-0"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    minLength={8}
                    autoFocus
                    disabled={!sessionReady}
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-muted-dark mb-1.5">
                    Confirm password
                  </label>
                  <input
                    type="password"
                    className="input mb-0"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Repeat your password"
                    required
                    disabled={!sessionReady}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !sessionReady}
                  className="button-primary w-full flex items-center justify-center gap-2 text-sm disabled:opacity-60"
                >
                  {loading && <Spinner />}
                  {loading ? "Saving…" : "Set password"}
                </button>
              </form>

              <div className="mt-5 text-center">
                <a
                  href="/login"
                  className="text-sm text-brand hover:text-brand-dark font-medium inline-flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to sign in
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export const getStaticProps = withTranslations(["common"]);
