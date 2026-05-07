/**
 * Set password page — first-time users.
 *
 * New users (invited via Supabase dashboard or admin invite) land here after
 * their first magic link / invite link click. The callback handler detects
 * that no password has been set (user_metadata.password_set !== true) and
 * redirects here.
 *
 * The session is already active when this page loads.
 *
 * After setting a password we mark user_metadata.password_set = true so the
 * callback handler won't redirect here again on subsequent logins.
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

export default function SetPasswordPage() {
  const router = useRouter();
  const { next } = router.query;

  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [notice, setNotice]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [appMeta, setAppMeta]     = useState({});

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // No session — they got here directly without an invite link
        router.replace("/login");
        return;
      }
      setAuthToken(session.access_token);
      setUserEmail(session.user?.email ?? "");
      setAppMeta(session.user?.app_metadata ?? {});
    });
  }, [router]);

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
      const { error } = await supabase.auth.updateUser({
        password,
        data: { password_set: true },
      });

      if (error) {
        setNotice({ type: "err", msg: error.message || "Failed to set password. Please try again." });
        return;
      }

      setDone(true);

      setTimeout(() => {
        const target =
          (typeof next === "string" && next.startsWith("/") ? next : null) ||
          (appMeta.appRole ? ROLE_HOME[appMeta.appRole] : null) ||
          "/manager";
        router.push(target);
      }, 1800);
    } catch {
      setNotice({ type: "err", msg: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  async function skipForNow() {
    const target =
      (typeof next === "string" && next.startsWith("/") ? next : null) ||
      (appMeta.appRole ? ROLE_HOME[appMeta.appRole] : null) ||
      "/manager";
    router.push(target);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-11 h-11 bg-brand rounded-xl flex items-center justify-center shadow-md mb-4">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            Maintenance Agent
          </h1>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-8 py-7">

          {done ? (
            /* ── Success ───────────────────────────────────── */
            <div className="text-center py-2">
              <div className="w-14 h-14 bg-success-light rounded-full flex items-center justify-center mx-auto mb-5">
                <svg className="w-7 h-7 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">You're all set!</h2>
              <p className="text-sm text-slate-500">Taking you to your account…</p>
            </div>
          ) : (
            /* ── Form ──────────────────────────────────────── */
            <>
              {/* Welcome header */}
              <div className="flex items-center gap-3 mb-6 pb-5 border-b border-slate-100">
                <div className="w-9 h-9 bg-brand-light rounded-full flex items-center justify-center shrink-0">
                  <svg className="w-4.5 h-4.5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">Welcome!</p>
                  {userEmail && (
                    <p className="text-xs text-slate-500 truncate">{userEmail}</p>
                  )}
                </div>
              </div>

              <h2 className="text-lg font-semibold text-slate-900 mb-1">Create your password</h2>
              <p className="text-sm text-slate-500 mb-6">
                Secure your account with a password so you can sign in directly next time.
              </p>

              {notice && (
                <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl mb-5 text-sm border bg-destructive-light border-destructive-ring text-destructive-text">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{notice.msg}</span>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Password
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
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Confirm password
                  </label>
                  <input
                    type="password"
                    className="input mb-0"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Repeat your password"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="button-primary w-full flex items-center justify-center gap-2 text-sm"
                >
                  {loading && <Spinner />}
                  {loading ? "Saving…" : "Create password & continue"}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={skipForNow}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Skip for now — I'll use magic link
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export const getStaticProps = withTranslations(["common"]);
