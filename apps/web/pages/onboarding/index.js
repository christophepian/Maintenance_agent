/**
 * First-login onboarding wizard.
 *
 * Reached from the shared post-login router (lib/roleRouting.js) whenever an
 * owner/manager (or a brand-new self-service signup with no role yet) hasn't
 * completed onboarding. Takes them by the hand through:
 *
 *   1. role          — Owner / Manager / Owner+Manager (self-service)
 *   2. profile       — KYB-lite: legal identity + contact + ToS
 *   3. property      — create or import the first building (+ concurrent risk
 *                      profile) — built in a later slice
 *   4. done          — writes user_metadata.hasCompletedOnboarding and lands
 *                      the user on their role home
 *
 * State design: the completion flag lives in user_metadata (self-writable, same
 * pattern as password_set) so the routing gate stays JWT-cheap. In-progress
 * answers are mirrored to localStorage so a refresh mid-wizard resumes.
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { createClient } from "../../lib/supabase/client";
import { setAuthToken } from "../../lib/api";
import { withTranslations } from "../../lib/i18n";
import { resolveLandingPath } from "../../lib/roleRouting";

const PROGRESS_KEY = "onboarding_progress_v1";

const STEPS = [
  { key: "role", label: "Your role" },
  { key: "profile", label: "Your details" },
  { key: "property", label: "Your first property" },
  { key: "done", label: "All set" },
];

/* Map an existing appRole + capabilities back to a primaryRole for preselect. */
function inferPrimaryRole(appMeta) {
  if (appMeta.appRole === "MANAGER") return "MANAGER";
  if (appMeta.appRole === "OWNER") {
    const caps = appMeta.capabilities || [];
    return caps.includes("MANAGER") ? "OWNER_MANAGER" : "OWNER";
  }
  return null;
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 inline shrink-0" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/* ── Step rail ────────────────────────────────────────────────── */
function StepRail({ current }) {
  return (
    <ol className="flex items-center gap-2 mb-8" aria-label="Progress">
      {STEPS.map((s, i) => {
        const state = i < current ? "done" : i === current ? "active" : "todo";
        return (
          <li key={s.key} className="flex items-center gap-2 flex-1 last:flex-none">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 " +
                  (state === "done"
                    ? "bg-brand text-white"
                    : state === "active"
                      ? "bg-brand-light text-brand ring-2 ring-brand"
                      : "bg-surface-subtle text-foreground-dim")
                }
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              <span
                className={
                  "text-xs font-medium truncate hidden sm:block " +
                  (state === "todo" ? "text-foreground-dim" : "text-foreground")
                }
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span className="flex-1 h-px bg-surface-divider min-w-[12px]" aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ── Role step ────────────────────────────────────────────────── */
const ROLE_OPTIONS = [
  {
    value: "OWNER",
    title: "Owner",
    desc: "I own property and want oversight — reporting, planning, and hands-off management.",
    icon: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6",
  },
  {
    value: "OWNER_MANAGER",
    title: "Owner + Manager",
    desc: "I own and self-manage — I want owner insights plus the full day-to-day management toolkit.",
    icon: "M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33",
  },
  {
    value: "MANAGER",
    title: "Manager / Régie",
    desc: "I manage property on behalf of owners — leases, finance, requests, and contractors.",
    icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2M5 21H3m9-14h.01M9 7h1m4 0h1M9 11h1m4 0h1M9 15h1m4 0h1",
  },
];

function RoleStep({ value, onChange, onNext, saving }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground mb-1">How will you use Propfolio?</h2>
      <p className="text-sm text-muted mb-6">
        This tailors your home screen and tools. You can adjust it later in settings.
      </p>

      <div className="space-y-3 mb-6">
        {ROLE_OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={
                "w-full text-left flex items-start gap-3 px-4 py-3.5 rounded-xl border transition " +
                (active
                  ? "border-brand bg-brand-light ring-1 ring-brand"
                  : "border-surface-border bg-surface hover:border-muted-ring")
              }
            >
              <div
                className={
                  "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 " +
                  (active ? "bg-brand text-white" : "bg-surface-subtle text-muted")
                }
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d={opt.icon} />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{opt.title}</p>
                <p className="text-xs text-muted mt-0.5 leading-relaxed">{opt.desc}</p>
              </div>
              <span
                className={
                  "w-4 h-4 rounded-full border shrink-0 mt-0.5 ml-auto " +
                  (active ? "border-brand bg-brand" : "border-muted-ring")
                }
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={!value || saving}
        className="button-primary w-full flex items-center justify-center gap-2 text-sm"
      >
        {saving && <Spinner />}
        {saving ? "Saving…" : "Continue"}
      </button>
    </div>
  );
}

/* ── Profile (KYB-lite) step ──────────────────────────────────── */
function ProfileStep({ profile, onChange, onNext, onBack }) {
  const isCompany = profile.entityType === "company";
  const canContinue =
    profile.legalName.trim() &&
    profile.phone.trim() &&
    profile.acceptedTos &&
    (!isCompany || profile.companyName.trim());

  const set = (k, v) => onChange({ ...profile, [k]: v });

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground mb-1">Tell us who you are</h2>
      <p className="text-sm text-muted mb-6">
        Basic identity details so we can set up your account and documents correctly. Formal
        verification (ID / company registry) isn&apos;t required yet.
      </p>

      {/* Entity type */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-muted-dark mb-1.5">I&apos;m onboarding as</label>
        <div className="flex gap-2">
          {[
            { v: "individual", l: "An individual" },
            { v: "company", l: "A company" },
          ].map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => set("entityType", o.v)}
              className={
                "flex-1 py-2 text-sm font-medium rounded-lg border transition " +
                (profile.entityType === o.v
                  ? "border-brand bg-brand-light text-brand"
                  : "border-surface-border text-muted hover:border-muted-ring")
              }
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-muted-dark mb-1.5">
          {isCompany ? "Contact person — full legal name" : "Full legal name"}
        </label>
        <input
          className="input mb-0"
          value={profile.legalName}
          onChange={(e) => set("legalName", e.target.value)}
          placeholder="e.g. Marie Dubois"
        />
      </div>

      {isCompany && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-muted-dark mb-1.5">Company name</label>
          <input
            className="input mb-0"
            value={profile.companyName}
            onChange={(e) => set("companyName", e.target.value)}
            placeholder="e.g. Régie Dubois SA"
          />
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium text-muted-dark mb-1.5">Phone</label>
        <input
          className="input mb-0"
          value={profile.phone}
          onChange={(e) => set("phone", e.target.value)}
          placeholder="+41 79 123 45 67"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="sm:col-span-3">
          <label className="block text-sm font-medium text-muted-dark mb-1.5">Address</label>
          <input
            className="input mb-0"
            value={profile.address}
            onChange={(e) => set("address", e.target.value)}
            placeholder="Street and number"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-dark mb-1.5">Postal code</label>
          <input
            className="input mb-0"
            value={profile.postalCode}
            onChange={(e) => set("postalCode", e.target.value)}
            placeholder="1003"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-muted-dark mb-1.5">City</label>
          <input
            className="input mb-0"
            value={profile.city}
            onChange={(e) => set("city", e.target.value)}
            placeholder="Lausanne"
          />
        </div>
      </div>

      <label className="flex items-start gap-2.5 mb-6 cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={profile.acceptedTos}
          onChange={(e) => set("acceptedTos", e.target.checked)}
        />
        <span className="text-xs text-muted leading-relaxed">
          I agree to the Terms of Service and confirm the information above is accurate.
        </span>
      </label>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="button-secondary flex-1 text-sm"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canContinue}
          className="button-primary flex-[2] text-sm"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

/* ── Property step (scaffold — real create/import + risk profile next) ── */
function PropertyStep({ onNext, onBack }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground mb-1">Add your first property</h2>
      <p className="text-sm text-muted mb-6">
        In the next step you&apos;ll create a building or import one from a régie package — and
        answer a few quick questions to build your investor profile while it processes.
      </p>
      <div className="rounded-xl border border-dashed border-surface-border bg-surface-subtle px-4 py-6 text-center text-sm text-muted mb-6">
        Property setup is being wired up here.
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onBack} className="button-secondary flex-1 text-sm">
          Back
        </button>
        <button type="button" onClick={onNext} className="button-primary flex-[2] text-sm">
          Continue
        </button>
      </div>
    </div>
  );
}

/* ── Done step ────────────────────────────────────────────────── */
function DoneStep({ finishing, onFinish }) {
  return (
    <div className="text-center py-2">
      <div className="w-14 h-14 bg-success-light rounded-full flex items-center justify-center mx-auto mb-5">
        <svg className="w-7 h-7 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">You&apos;re all set!</h2>
      <p className="text-sm text-muted mb-6">
        We&apos;ll take you to your dashboard and show you around.
      </p>
      <button
        type="button"
        onClick={onFinish}
        disabled={finishing}
        className="button-primary w-full flex items-center justify-center gap-2 text-sm"
      >
        {finishing && <Spinner />}
        {finishing ? "Finishing…" : "Go to my dashboard"}
      </button>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────── */
export default function OnboardingPage() {
  const router = useRouter();
  const { next } = router.query;

  const [ready, setReady] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [appMeta, setAppMeta] = useState({});
  const [primaryRole, setPrimaryRole] = useState(null);
  const [savingRole, setSavingRole] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState({
    entityType: "individual",
    legalName: "",
    companyName: "",
    phone: "",
    address: "",
    city: "",
    postalCode: "",
    acceptedTos: false,
  });

  // Guard + hydrate
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/login");
        return;
      }
      setAuthToken(session.access_token);
      const meta = session.user?.app_metadata ?? {};
      const userMeta = session.user?.user_metadata ?? {};
      // Already onboarded (or a role that doesn't use this flow) → route out.
      if (userMeta.hasCompletedOnboarding || ["TENANT", "CONTRACTOR"].includes(meta.appRole)) {
        router.replace(resolveLandingPath({ appMeta: meta, userMeta, next }));
        return;
      }
      setAppMeta(meta);
      setPrimaryRole(inferPrimaryRole(meta));

      // Resume in-progress answers (role step is re-confirmed from the JWT).
      try {
        const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "null");
        if (saved) {
          if (saved.profile) setProfile((p) => ({ ...p, ...saved.profile }));
          if (typeof saved.stepIndex === "number") setStepIndex(saved.stepIndex);
        }
      } catch {
        /* ignore malformed progress */
      }
      setReady(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist progress
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({ stepIndex, profile }));
    } catch {
      /* storage may be unavailable — non-fatal */
    }
  }, [ready, stepIndex, profile]);

  const goNext = useCallback(() => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1)), []);
  const goBack = useCallback(() => setStepIndex((i) => Math.max(i - 1, 0)), []);

  async function saveRoleAndContinue() {
    setError(null);
    setSavingRole(true);
    try {
      const res = await fetch("/api/onboarding/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryRole }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Could not save your role. Please try again.");
        return;
      }
      // app_metadata was written with the service key — refresh the session so
      // the JWT carries the new appRole/capabilities before we route anywhere.
      const supabase = createClient();
      const { data } = await supabase.auth.refreshSession();
      if (data?.session) {
        setAuthToken(data.session.access_token);
        setAppMeta(data.session.user?.app_metadata ?? {});
      }
      goNext();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSavingRole(false);
    }
  }

  async function finish() {
    setError(null);
    setFinishing(true);
    try {
      const supabase = createClient();
      await supabase.auth.updateUser({
        data: {
          hasCompletedOnboarding: true,
          profile: {
            entityType: profile.entityType,
            legalName: profile.legalName.trim(),
            companyName: profile.companyName.trim() || null,
            phone: profile.phone.trim(),
            address: profile.address.trim() || null,
            city: profile.city.trim() || null,
            postalCode: profile.postalCode.trim() || null,
            acceptedTosAt: new Date().toISOString(),
          },
        },
      });
      try {
        localStorage.removeItem(PROGRESS_KEY);
      } catch {
        /* ignore */
      }
      const { data } = await supabase.auth.refreshSession();
      const meta = data?.session?.user?.app_metadata ?? appMeta;
      const userMeta = data?.session?.user?.user_metadata ?? { hasCompletedOnboarding: true };
      if (data?.session) setAuthToken(data.session.access_token);
      router.push(resolveLandingPath({ appMeta: meta, userMeta, next }));
    } catch {
      setError("Could not finish onboarding. Please try again.");
      setFinishing(false);
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-surface-subtle flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const stepKey = STEPS[stepIndex].key;

  return (
    <div className="min-h-screen bg-surface-subtle flex flex-col items-center justify-center p-4">
      <Head>
        <title>Get started · Propfolio</title>
      </Head>
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center mb-8">
          <div className="w-11 h-11 bg-brand rounded-xl flex items-center justify-center shadow-md mb-4">
            <span className="text-white font-extrabold">P</span>
          </div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Welcome to Propfolio
          </h1>
        </div>

        <div className="bg-surface rounded-2xl border border-surface-border shadow-sm px-6 sm:px-8 py-7">
          <StepRail current={stepIndex} />

          {error && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl mb-5 text-sm border bg-destructive-light border-destructive-ring text-destructive-text">
              <span>{error}</span>
            </div>
          )}

          {stepKey === "role" && (
            <RoleStep
              value={primaryRole}
              onChange={setPrimaryRole}
              onNext={saveRoleAndContinue}
              saving={savingRole}
            />
          )}
          {stepKey === "profile" && (
            <ProfileStep profile={profile} onChange={setProfile} onNext={goNext} onBack={goBack} />
          )}
          {stepKey === "property" && <PropertyStep onNext={goNext} onBack={goBack} />}
          {stepKey === "done" && <DoneStep finishing={finishing} onFinish={finish} />}
        </div>
      </div>
    </div>
  );
}

export const getStaticProps = withTranslations(["common"]);
