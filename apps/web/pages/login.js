/**
 * Login page — redesigned (Clerk-style).
 *
 * Two auth methods in a tab strip:
 *   Magic link  — email OTP, no password needed (primary)
 *   Password    — email + password with inline "Forgot password?" recovery
 *
 * Flows:
 *   magic link  → sendMagicLink() → "Check your inbox" confirmation screen
 *   password    → signInWithPassword() → redirectAfterLogin()
 *   forgot pwd  → sendPasswordReset() → "Reset link sent" confirmation screen
 *                 user clicks email link → /reset-password
 *
 * First-time users (invited):
 *   invite link → /api/auth/callback → detects no password set → /set-password
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

/* ── Small shared components ──────────────────────────────────── */

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 inline shrink-0"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function MethodTab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-150",
        active
          ? "bg-white text-slate-900 shadow-sm border border-slate-200"
          : "text-slate-500 hover:text-slate-700",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Notice({ type, msg }) {
  const isErr = type === "err";
  return (
    <div
      className={[
        "flex items-start gap-2.5 px-3.5 py-3 rounded-xl mb-5 text-sm border",
        isErr
          ? "bg-destructive-light border-destructive-ring text-destructive-text"
          : "bg-success-light border-success-ring text-success-dark",
      ].join(" ")}
    >
      {isErr ? (
        <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ) : (
        <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )}
      <span>{msg}</span>
    </div>
  );
}

/* ── Outer centered shell ─────────────────────────────────────── */

function AuthShell({ children, footer }) {
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

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-8 py-7">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <p className="text-center text-xs text-slate-400 mt-5">{footer}</p>
        )}
      </div>
    </div>
  );
}

/* ── Confirmation screens ─────────────────────────────────────── */

function MagicLinkSentScreen({ email, onBack }) {
  return (
    <AuthShell>
      <div className="text-center py-2">
        <div className="w-14 h-14 bg-brand-light rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Check your inbox</h2>
        <p className="text-sm text-slate-500 leading-relaxed mb-6">
          We sent a sign-in link to{" "}
          <span className="font-medium text-slate-700">{email}</span>.
          <br />
          The link expires in 1 hour.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-brand hover:text-brand-dark font-medium inline-flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Use a different email
        </button>
      </div>
    </AuthShell>
  );
}

function ResetSentScreen({ email, onBack }) {
  return (
    <AuthShell>
      <div className="text-center py-2">
        <div className="w-14 h-14 bg-success-light rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Reset link sent</h2>
        <p className="text-sm text-slate-500 leading-relaxed mb-6">
          Check your inbox at{" "}
          <span className="font-medium text-slate-700">{email}</span>
          <br />
          for a password reset link.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-brand hover:text-brand-dark font-medium inline-flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to sign in
        </button>
      </div>
    </AuthShell>
  );
}

/* ── Main page ────────────────────────────────────────────────── */

export default function LoginPage() {
  const router = useRouter();
  const { next, error: queryError } = router.query;

  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [method, setMethod]       = useState("magic"); // "magic" | "password"
  const [notice, setNotice]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Redirect if already signed in, or handle implicit-flow tokens from invites
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) redirectAfterLogin(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => { if (session) redirectAfterLogin(session); }
    );
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Surface errors forwarded from /api/auth/callback
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
    const userMeta = session.user?.user_metadata ?? {};
    setAuthToken(session.access_token);
    if (meta.appRole) localStorage.setItem("role", meta.appRole);

    // First-time users: no password_set flag → prompt them to create a password
    if (!userMeta.password_set) {
      const dest = next ? `/set-password?next=${encodeURIComponent(next)}` : "/set-password";
      router.push(dest);
      return;
    }

    const target =
      (typeof next === "string" && next.startsWith("/") ? next : null) ||
      (meta.accessLevel === "DOCS_INVESTOR" ? "/docs/pitchdeck.html" : null) ||
      (meta.appRole ? ROLE_HOME[meta.appRole] : null) ||
      "/manager";
    router.push(target);
  }

  /* ── Magic link ─────────────────────────────────────────────── */
  async function sendMagicLink(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setNotice(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/api/auth/callback${
        next ? `?next=${encodeURIComponent(next)}` : ""
      }`;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
      });
      if (error) {
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

  /* ── Password sign-in ───────────────────────────────────────── */
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
        setNotice({ type: "err", msg: "Incorrect email or password." });
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

  /* ── Forgot password ────────────────────────────────────────── */
  async function sendPasswordReset(e) {
    e.preventDefault();
    if (!email.trim()) {
      setNotice({ type: "err", msg: "Enter your email address first." });
      return;
    }
    setNotice(null);
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setResetSent(true);
    } catch {
      setNotice({ type: "err", msg: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  /* ── Confirmation screens ───────────────────────────────────── */
  if (magicSent) {
    return (
      <MagicLinkSentScreen
        email={email}
        onBack={() => { setMagicSent(false); setNotice(null); }}
      />
    );
  }

  if (resetSent) {
    return (
      <ResetSentScreen
        email={email}
        onBack={() => { setResetSent(false); setNotice(null); }}
      />
    );
  }

  /* ── Main form ──────────────────────────────────────────────── */
  return (
    <AuthShell footer="Access is by invitation only. Contact your administrator.">
      <h2 className="text-lg font-semibold text-slate-900 mb-1">Sign in</h2>
      <p className="text-sm text-slate-500 mb-6">to your account</p>

      {notice && <Notice type={notice.type} msg={notice.msg} />}

      {/* Method tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6">
        <MethodTab
          active={method === "magic"}
          onClick={() => { setMethod("magic"); setNotice(null); }}
        >
          Magic link
        </MethodTab>
        <MethodTab
          active={method === "password"}
          onClick={() => { setMethod("password"); setNotice(null); }}
        >
          Password
        </MethodTab>
      </div>

      {/* Magic link form */}
      {method === "magic" && (
        <form onSubmit={sendMagicLink}>
          <div className="mb-5">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Email address
            </label>
            <input
              type="email"
              className="input mb-0"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="button-primary w-full flex items-center justify-center gap-2 text-sm"
          >
            {loading && <Spinner />}
            {loading ? "Sending…" : "Send sign-in link"}
          </button>
          <p className="text-xs text-center text-slate-400 mt-4">
            A one-click link will be sent to your inbox.
          </p>
        </form>
      )}

      {/* Password form */}
      {method === "password" && (
        <form onSubmit={signInWithPassword}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Email address
            </label>
            <input
              type="email"
              className="input mb-0"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
            />
          </div>

          <div className="mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <button
                type="button"
                onClick={sendPasswordReset}
                disabled={loading}
                className="text-xs text-brand hover:text-brand-dark font-medium disabled:opacity-50"
              >
                Forgot password?
              </button>
            </div>
            <input
              type="password"
              className="input mb-0"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="button-primary w-full flex items-center justify-center gap-2 text-sm"
          >
            {loading && <Spinner />}
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

export const getStaticProps = withTranslations(["common"]);
