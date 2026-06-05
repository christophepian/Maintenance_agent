/**
 * Login page — split-screen redesign (Stripe-benchmarked, Sencilo brand).
 *
 * Layout:
 *   Left  — immersive dark hero panel reusing the marketing hero photo
 *           (/website/assets/hero-bg.png) with Sencilo branding + tagline.
 *           Hidden below lg; on mobile a compact brand header shows instead.
 *   Right — fixed light card with the auth form (Stripe-minimal).
 *
 * The right panel is intentionally always light (it sits on the dark hero
 * and must stay legible regardless of the app's dark-mode toggle), so it
 * uses explicit slate/white Tailwind palette utilities rather than the
 * theme-aware semantic tokens used elsewhere in the app.
 *
 * Two auth methods in a tab strip:
 *   Magic link  — email OTP, no password needed (primary)
 *   Password    — email + password with inline "Forgot password?" recovery
 *
 * Flows (unchanged):
 *   magic link  → sendMagicLink() → "Check your inbox" confirmation screen
 *   password    → signInWithPassword() → redirectAfterLogin()
 *   forgot pwd  → sendPasswordReset() → "Reset link sent" confirmation screen
 *                 user clicks email link → /reset-password
 *
 * First-time users (invited):
 *   invite link → /api/auth/callback → detects no password set → /set-password
 */

import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { createClient } from "../lib/supabase/client";
import { setAuthToken } from "../lib/api";
import { withTranslations } from "../lib/i18n";
import { useTranslation } from "next-i18next";
import { cn } from "../lib/utils";

/* Shared input + primary-button styling for the fixed-light card */
const INPUT_CLASS =
  "w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition";
const PRIMARY_BTN_CLASS =
  "w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-gradient-to-br from-indigo-600 to-violet-600 shadow-sm shadow-indigo-600/25 hover:opacity-95 active:translate-y-px disabled:opacity-60 transition";

const ROLE_HOME = {
  MANAGER: "/manager",
  CONTRACTOR: "/contractor",
  OWNER: "/owner",
  TENANT: "/tenant/leases",
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
      className={cn(
        "flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-150",
        active
          ? "bg-white text-slate-900 shadow-sm border border-slate-200"
          : "text-slate-500 hover:text-slate-700",
      )}
    >
      {children}
    </button>
  );
}

/* Sencilo gradient logo mark — matches the marketing hero */
function BrandMark({ size = "md" }) {
  const dim = size === "lg" ? "w-10 h-10 text-base" : "w-9 h-9 text-sm";
  return (
    <div
      className={cn(
        "rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center font-extrabold tracking-tight text-white shadow-lg shadow-indigo-600/30",
        dim,
      )}
      aria-hidden="true"
    >
      S
    </div>
  );
}

function Notice({ type, msg }) {
  const isErr = type === "err";
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 px-3.5 py-3 rounded-xl mb-5 text-sm border",
        isErr
          ? "bg-red-50 border-red-200 text-red-700"
          : "bg-emerald-50 border-emerald-200 text-emerald-700",
      )}
      role="alert"
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
    <div className="relative min-h-screen overflow-hidden">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap"
          rel="stylesheet"
        />
      </Head>

      {/* ── Background: full-bleed dark gradient (matches dark theme) ── */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(105deg, #1c2548 0%, #141d38 22%, #0d1226 50%, #05081a 100%)",
        }}
      />

      {/* ── Left hero photo panel (lg+) ───────────────────────── */}
      <div className="hidden lg:block absolute inset-y-0 left-0 w-1/2 overflow-hidden bg-[#05081a]">
        {/* Hero photo — flipped + offset like the marketing hero */}
        <img
          src="/website/assets/hero-bg.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: "65% center", transform: "scaleX(-1)" }}
        />
        {/* Strong left→right dark gradient (matches website hero-photo-overlay)
            so the white type sits on the darkest part and reads cleanly */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(105deg, rgba(5,8,26,0.93) 0%, rgba(5,8,26,0.85) 30%, rgba(5,8,26,0.60) 55%, rgba(5,8,26,0.30) 100%)",
          }}
        />
        {/* Faint grid overlay (matches website hero-grid) */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            maskImage:
              "radial-gradient(ellipse 80% 80% at 30% 50%, black, transparent)",
            WebkitMaskImage:
              "radial-gradient(ellipse 80% 80% at 30% 50%, black, transparent)",
          }}
        />
      </div>

      {/* ── Brand mark — pinned top-left on desktop ───────────── */}
      <div className="hidden lg:flex absolute z-20 top-12 left-12 xl:top-16 xl:left-16 items-center gap-3 text-white">
        <BrandMark size="lg" />
        <span className="text-xl font-semibold tracking-tight">
          {process.env.NEXT_PUBLIC_SANDBOX === "true" ? "Sandbox" : "Sencilo"}
        </span>
      </div>

      {/* ── Centered content row ──────────────────────────────── */}
      <div className="relative z-10 min-h-screen flex items-center">
        <div className="flex w-full">
          {/* Left: headline — self-start aligns its top to the card top */}
          <div className="hidden lg:flex lg:w-1/2 self-start px-12 xl:px-16">
            <div className="max-w-md text-white">
              <h2
                className="text-4xl xl:text-5xl leading-[1.05] tracking-tight"
                style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}
              >
                {process.env.NEXT_PUBLIC_SANDBOX === "true" ? (
                  <>User test<br /><em className="not-italic" style={{ fontStyle: "italic", color: "#818cf8" }}>environment.</em></>
                ) : (
                  <>Swiss property,<br /><em className="not-italic" style={{ fontStyle: "italic", color: "#818cf8" }}>made simple.</em></>
                )}
              </h2>
            </div>
          </div>

          {/* Right: auth card */}
          <div className="w-full lg:w-1/2 flex justify-center px-6 sm:px-8">
            <div className="w-full max-w-sm">
              {/* Mobile brand header (hero hidden below lg) */}
              <div className="flex items-center gap-2.5 mb-8 lg:hidden">
                <BrandMark />
                <span className="text-lg font-semibold tracking-tight text-white">
                  {process.env.NEXT_PUBLIC_SANDBOX === "true" ? "Sandbox" : "Sencilo"}
                </span>
              </div>

              {/* Card */}
              <div className="bg-white rounded-2xl border border-white/10 shadow-2xl shadow-black/40 px-8 py-8">
                {children}
              </div>

              {/* Footer */}
              {footer && (
                <p className="text-center text-xs text-white/40 mt-6">{footer}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Confirmation screens ─────────────────────────────────────── */

function MagicLinkSentScreen({ email, onBack }) {
  const { t } = useTranslation("common");
  return (
    <AuthShell>
      <div className="text-center py-2">
        <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">{t("login.checkInbox.title")}</h2>
        <p className="text-sm text-slate-500 leading-relaxed mb-6">
          {t("login.checkInbox.body", { email })}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium inline-flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t("login.checkInbox.useDifferentEmail")}
        </button>
      </div>
    </AuthShell>
  );
}

function ResetSentScreen({ email, onBack }) {
  const { t } = useTranslation("common");
  return (
    <AuthShell>
      <div className="text-center py-2">
        <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">{t("login.resetSent.title")}</h2>
        <p className="text-sm text-slate-500 leading-relaxed mb-6">
          {t("login.resetSent.body", { email })}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium inline-flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t("login.resetSent.backToSignIn")}
        </button>
      </div>
    </AuthShell>
  );
}

/* ── Main page ────────────────────────────────────────────────── */

export default function LoginPage() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const { next, error: queryError, reason: queryReason } = router.query;

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

  // Surface errors forwarded from /api/auth/callback or sandbox expiry redirects
  useEffect(() => {
    if (queryError === "forbidden") {
      setNotice({ type: "err", msg: t("login.error.forbidden") });
    } else if (queryError === "auth_failed") {
      setNotice({ type: "err", msg: t("login.error.authFailed") });
    } else if (queryError === "missing_code") {
      setNotice({ type: "err", msg: t("login.error.missingCode") });
    } else if (queryReason === "expired") {
      // SANDBOX: beta trial has expired (mid-session or at login)
      setNotice({ type: "err", msg: t("login.error.betaTrialExpired") });
    } else if (queryReason === "not_allowed" || queryReason === "inactive") {
      // SANDBOX: email not on the allowlist or access revoked
      setNotice({ type: "err", msg: t("login.error.betaNotRegistered") });
    }
  }, [queryError, queryReason, t]);

  function redirectAfterLogin(session) {
    const meta = session.user?.app_metadata ?? {};
    const userMeta = session.user?.user_metadata ?? {};
    // TENANT tokens go into sessionStorage so each browser tab is isolated —
    // a manager in tab A won't be kicked out when a tenant logs in at tab B.
    if (meta.appRole === "TENANT") {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("authToken", session.access_token);
        sessionStorage.setItem("role", "TENANT");
      }
    } else {
      setAuthToken(session.access_token);
      if (meta.appRole) localStorage.setItem("role", meta.appRole);
    }

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
      // SANDBOX: check the beta allowlist before sending any OTP.
      // In non-sandbox environments this block is never reached.
      if (process.env.NEXT_PUBLIC_SANDBOX === "true") {
        const checkRes = await fetch("/api/auth/beta-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        });
        const check = await checkRes.json();
        if (!check.allowed) {
          const msgKey =
            check.reason === "expired"
              ? "login.error.betaTrialExpired"
              : "login.error.betaNotRegistered";
          setNotice({ type: "err", msg: t(msgKey) });
          return;
        }
      }

      const supabase = createClient();
      // redirectTo resolves to the current origin, which is the sandbox domain
      // in sandbox and the main domain in production — no hardcoding needed.
      const redirectTo = `${window.location.origin}/api/auth/callback${
        next ? `?next=${encodeURIComponent(next)}` : ""
      }`;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
      });
      if (error) {
        setNotice({ type: "err", msg: t("login.error.emailNotFound") });
      } else {
        setMagicSent(true);
      }
    } catch {
      setNotice({ type: "err", msg: t("error.generic") });
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
        setNotice({ type: "err", msg: t("login.error.incorrectCredentials") });
        setPassword("");
        return;
      }
      redirectAfterLogin(data.session);
    } catch {
      setNotice({ type: "err", msg: t("error.generic") });
    } finally {
      setLoading(false);
    }
  }

  /* ── Forgot password ────────────────────────────────────────── */
  async function sendPasswordReset(e) {
    e.preventDefault();
    if (!email.trim()) {
      setNotice({ type: "err", msg: t("login.error.enterEmail") });
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
      setNotice({ type: "err", msg: t("error.generic") });
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
    <AuthShell footer={t("login.footer")}>
      <h2 className="text-xl font-semibold text-slate-900 mb-1">{t("login.title")}</h2>
      <p className="text-sm text-slate-500 mb-6">{t("login.subtitle")}</p>

      {notice && <Notice type={notice.type} msg={notice.msg} />}

      {/* Method tabs — hidden in sandbox (magic link only) */}
      {process.env.NEXT_PUBLIC_SANDBOX !== "true" && (
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6">
          <MethodTab
            active={method === "magic"}
            onClick={() => { setMethod("magic"); setNotice(null); }}
          >
            {t("login.tabMagicLink")}
          </MethodTab>
          <MethodTab
            active={method === "password"}
            onClick={() => { setMethod("password"); setNotice(null); }}
          >
            {t("login.tabPassword")}
          </MethodTab>
        </div>
      )}

      {/* Magic link form — always shown in sandbox; shown when method=magic elsewhere */}
      {(process.env.NEXT_PUBLIC_SANDBOX === "true" || method === "magic") && (
        <form onSubmit={sendMagicLink}>
          <div className="mb-5">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {t("login.emailLabel")}
            </label>
            <input
              type="email"
              className={INPUT_CLASS}
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={t("login.emailPlaceholder")}
              required
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className={PRIMARY_BTN_CLASS}
          >
            {loading && <Spinner />}
            {loading ? t("login.sending") : t("login.sendSignInLink")}
          </button>
          <p className="text-xs text-center text-slate-400 mt-4">
            {t("login.oneClickHint")}
          </p>
        </form>
      )}

      {/* Password form — never shown in sandbox */}
      {process.env.NEXT_PUBLIC_SANDBOX !== "true" && method === "password" && (
        <form onSubmit={signInWithPassword}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {t("login.emailLabel")}
            </label>
            <input
              type="email"
              className={INPUT_CLASS}
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={t("login.emailPlaceholder")}
              required
              autoFocus
            />
          </div>

          <div className="mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-slate-700">
                {t("login.passwordLabel")}
              </label>
              <button
                type="button"
                onClick={sendPasswordReset}
                disabled={loading}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50"
              >
                {t("login.forgotPassword")}
              </button>
            </div>
            <input
              type="password"
              className={INPUT_CLASS}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={PRIMARY_BTN_CLASS}
          >
            {loading && <Spinner />}
            {loading ? t("login.signingIn") : t("login.signIn")}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

export const getStaticProps = withTranslations(["common"]);
