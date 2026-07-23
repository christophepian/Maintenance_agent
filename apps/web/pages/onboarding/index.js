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

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { useTranslation } from "next-i18next";
import { createClient } from "../../lib/supabase/client";
import { setAuthToken, authHeaders } from "../../lib/api";
import { withTranslations } from "../../lib/i18n";
import { resolveLandingPath } from "../../lib/roleRouting";
import { useTheme } from "../../hooks/useTheme";

const PROGRESS_KEY = "onboarding_progress_v1";

const STEPS = [
  { key: "role", label: "Your role" },
  { key: "profile", label: "Your details" },
  { key: "property", label: "Your property" },
  { key: "risk", label: "Your strategy" },
  { key: "connections", label: "Connections" },
  { key: "preferences", label: "Preferences" },
  { key: "done", label: "All set" },
];

/* Archetype → per-building roleIntent (mirrors owner/strategy.js). */
function archetypeToRoleIntent(archetype) {
  switch (archetype) {
    case "exit_optimizer": return "sell";
    case "yield_maximizer": return "income";
    case "value_builder": return "long_term_quality";
    case "capital_preserver": return "stable_hold";
    case "opportunistic_repositioner": return "reposition";
    default: return "stable_hold";
  }
}

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

/* ── Property step — create manually OR import a régie package ────
 *
 * Choosing "import" and continuing fires the (slow) package analysis in the
 * background while the user answers the risk questionnaire — so the building is
 * staged and ready to commit by the time they finish. This is the "seamless"
 * mechanic: they never sit and wait for OCR/extraction.
 */
function PropertyStep({ prop, onChange, onImportFiles, importStatus, onNext, onBack }) {
  const set = (k, v) => onChange({ ...prop, [k]: v });
  const canContinue =
    prop.mode === "create"
      ? prop.name.trim() || prop.address.trim()
      : prop.mode === "import"
        ? prop.files.length > 0
        : false;

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground mb-1">Add your first property</h2>
      <p className="text-sm text-muted mb-6">
        Start with one building — you can add the rest anytime. Import lets us hydrate units,
        tenants and finances from your régie&apos;s year-end package.
      </p>

      {/* Mode choice */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {[
          { v: "create", t: "Create manually", d: "Enter the basics now" },
          { v: "import", t: "Import a package", d: "Régie PDF or CSVs" },
        ].map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => set("mode", o.v)}
            className={
              "text-left px-4 py-3 rounded-xl border transition " +
              (prop.mode === o.v
                ? "border-brand bg-brand-light ring-1 ring-brand"
                : "border-surface-border hover:border-muted-ring")
            }
          >
            <p className="text-sm font-semibold text-foreground">{o.t}</p>
            <p className="text-xs text-muted mt-0.5">{o.d}</p>
          </button>
        ))}
      </div>

      {prop.mode === "create" && (
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-muted-dark mb-1.5">Building name</label>
            <input
              className="input mb-0"
              value={prop.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Rue du Lac 12"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-dark mb-1.5">Address</label>
            <input
              className="input mb-0"
              value={prop.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="e.g. 1003 Lausanne"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-dark mb-1.5">
              Approx. units <span className="text-foreground-dim">(optional)</span>
            </label>
            <input
              type="number"
              min="1"
              className="input mb-0 max-w-[140px]"
              value={prop.approxUnits}
              onChange={(e) => set("approxUnits", e.target.value)}
              placeholder="12"
            />
          </div>
        </div>
      )}

      {prop.mode === "import" && (
        <div className="mb-6">
          <label
            className="block border-2 border-dashed border-muted-ring rounded-xl px-4 py-6 text-center cursor-pointer hover:border-brand-ring transition"
          >
            <input
              type="file"
              multiple
              accept=".csv,text/csv,.tsv,.pdf,application/pdf"
              className="hidden"
              onChange={(e) => onImportFiles(Array.from(e.target.files || []))}
            />
            {prop.files.length ? (
              <p className="text-sm text-brand-dark font-medium">{prop.files.length} file(s) selected</p>
            ) : (
              <p className="text-sm text-muted">
                Drop the year-end package — a régie PDF, or CSVs (balance sheet, income statement,
                rent roll, general ledger)
              </p>
            )}
          </label>
          {importStatus && (
            <p className="text-xs text-muted mt-2">{importStatus}</p>
          )}
          <p className="text-xs text-foreground-dim mt-2">
            Nothing is created yet. We&apos;ll analyze it while you answer a few quick questions next.
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={onBack} className="button-secondary flex-1 text-sm">
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

/* ── Risk-profile step — the 5 strategy questions (reused from owner wizard),
 * with a live indicator of the background import. ──────────────── */
function RiskStep({ questions, answers, onAnswer, importState, busy, onSubmit, onBack }) {
  const answeredAll = questions.length > 0 && questions.every((q) => answers[q.key]);

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground mb-1">A few questions about your goals</h2>
      <p className="text-sm text-muted mb-4">
        This builds your investor profile so recommendations fit how you actually think about your
        property.
      </p>

      {/* Background import indicator */}
      {importState && importState.active && (
        <div
          className={
            "flex items-center gap-2 rounded-lg px-3 py-2 mb-5 text-xs border " +
            (importState.ready
              ? "border-success-ring bg-success-light text-success"
              : importState.error
                ? "border-warning-ring bg-warning-light text-warning-text"
                : "border-surface-border bg-surface-subtle text-muted")
          }
        >
          {importState.ready ? (
            <>✓ Your building is ready to import</>
          ) : importState.error ? (
            <>⚠ We couldn&apos;t analyze the package — you can retry later from Properties</>
          ) : (
            <>
              <Spinner /> Analyzing your building in the background…
            </>
          )}
        </div>
      )}

      <div className="space-y-6 mb-6">
        {questions.map((q, qi) => (
          <fieldset key={q.key}>
            <legend className="text-sm font-semibold text-foreground mb-2">
              {qi + 1}. {q.title}
            </legend>
            <div className="space-y-2">
              {q.options.map((opt, idx) => {
                const val = idx + 1;
                const active = answers[q.key] === val;
                return (
                  <label
                    key={val}
                    className={
                      "flex items-center gap-3 rounded-lg border px-3.5 py-2.5 cursor-pointer transition " +
                      (active
                        ? "border-brand bg-brand-light"
                        : "border-surface-border hover:bg-surface-subtle")
                    }
                  >
                    <input
                      type="radio"
                      name={q.key}
                      checked={active}
                      onChange={() => onAnswer(q.key, val)}
                      className="accent-brand"
                    />
                    <span className="text-sm text-foreground">{opt}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onBack} className="button-secondary flex-1 text-sm">
          Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!answeredAll || busy}
          className="button-primary flex-[2] text-sm flex items-center justify-center gap-2"
        >
          {busy && <Spinner />}
          {busy ? "Setting up…" : "See my strategy & finish"}
        </button>
      </div>
    </div>
  );
}

/* ── Connections step — invite the manager (régie) and, for imported
 * buildings, the tenants. Tenant invites are added with the SMS backend. ── */
function ConnectionsStep({ summary, onNext, onBack }) {
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [invited, setInvited] = useState(null);
  const [err, setErr] = useState(null);

  async function inviteManager() {
    setErr(null);
    setInviting(true);
    try {
      const res = await fetch("/api/onboarding/invite-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(body.error || "Could not send the invite.");
        return;
      }
      setInvited(email.trim());
      setEmail("");
    } catch {
      setErr("Something went wrong. Please try again.");
    } finally {
      setInviting(false);
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground mb-1">Bring in your team</h2>
      <p className="text-sm text-muted mb-6">
        Invite the manager or régie who handles day-to-day operations. They&apos;ll get access to
        your buildings.
      </p>

      <div className="rounded-xl border border-surface-border p-4 mb-4">
        <label className="block text-sm font-medium text-muted-dark mb-1.5">Manager email</label>
        <div className="flex gap-2">
          <input
            type="email"
            className="input mb-0 flex-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="manager@regie.ch"
          />
          <button
            type="button"
            onClick={inviteManager}
            disabled={!email.trim() || inviting}
            className="button-secondary text-sm whitespace-nowrap"
          >
            {inviting ? "Sending…" : "Send invite"}
          </button>
        </div>
        {invited && (
          <p className="text-xs text-success mt-2">✓ Invite sent to {invited}</p>
        )}
        {err && <p className="text-xs text-destructive-text mt-2">{err}</p>}
      </div>

      {summary?.imported && (
        <div className="rounded-xl border border-surface-border bg-surface-subtle p-4 mb-6 text-sm text-muted">
          <p className="font-medium text-foreground mb-0.5">Your tenants are imported</p>
          <p className="text-xs">
            You&apos;ll be able to invite them to the tenant app (to see leases, invoices and send
            requests) from the building&apos;s Tenants tab.
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={onBack} className="button-secondary flex-1 text-sm">
          Back
        </button>
        <button type="button" onClick={onNext} className="button-primary flex-[2] text-sm">
          {invited ? "Continue" : "Skip for now"}
        </button>
      </div>
    </div>
  );
}

/* ── Preferences step — real theme + automation defaults ──────── */
function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors " +
        (checked ? "bg-brand" : "bg-surface-border")
      }
    >
      <span
        className={
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform " +
          (checked ? "translate-x-5" : "translate-x-0.5")
        }
      />
    </button>
  );
}

function PreferencesStep({ theme, onTheme, prefs, onPrefs, onNext, onBack }) {
  const rows = [
    { key: "overdueReminders", title: "Overdue-rent reminders", desc: "Automatically remind tenants when rent is late." },
    { key: "ownerReport", title: "Monthly owner report", desc: "Email a portfolio summary at the start of each month." },
    { key: "autoRouteMaintenance", title: "Auto-route maintenance", desc: "Send new maintenance requests to your preferred contractors." },
  ];
  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground mb-1">Make it yours</h2>
      <p className="text-sm text-muted mb-6">
        Set your defaults — you can fine-tune everything (including per building) later in settings.
      </p>

      {/* Theme */}
      <div className="mb-6">
        <p className="text-sm font-medium text-muted-dark mb-2">Appearance</p>
        <div className="flex gap-2">
          {[
            { v: "light", l: "Light" },
            { v: "dark", l: "Dark" },
          ].map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => onTheme(o.v)}
              className={
                "flex-1 py-2.5 text-sm font-medium rounded-lg border transition " +
                (theme === o.v
                  ? "border-brand bg-brand-light text-brand"
                  : "border-surface-border text-muted hover:border-muted-ring")
              }
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {/* Automation defaults */}
      <div className="space-y-3 mb-6">
        <p className="text-sm font-medium text-muted-dark">Automations</p>
        {rows.map((r) => (
          <div key={r.key} className="flex items-start justify-between gap-4 rounded-xl border border-surface-border px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{r.title}</p>
              <p className="text-xs text-muted mt-0.5">{r.desc}</p>
            </div>
            <Toggle checked={!!prefs[r.key]} onChange={(v) => onPrefs({ ...prefs, [r.key]: v })} />
          </div>
        ))}
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
function DoneStep({ summary, finishing, onFinish }) {
  return (
    <div className="text-center py-2">
      <div className="w-14 h-14 bg-success-light rounded-full flex items-center justify-center mx-auto mb-5">
        <svg className="w-7 h-7 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">You&apos;re all set!</h2>

      {summary ? (
        <div className="text-sm text-muted mb-6 space-y-1.5">
          {summary.buildingName && (
            <p>
              <span className="text-foreground font-medium">{summary.buildingName}</span> is set up
              {summary.imported ? " and your package is importing." : "."}
            </p>
          )}
          {summary.archetypeLabel && (
            <p>
              Your investor profile: <span className="text-foreground font-medium">{summary.archetypeLabel}</span>.
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted mb-6">We&apos;ll take you to your dashboard and show you around.</p>
      )}

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
  const { t: tOwner } = useTranslation("owner");
  const { theme, setTheme } = useTheme();
  const rawQuestions = tOwner("strategy.questions", { returnObjects: true });
  const questions = Array.isArray(rawQuestions) ? rawQuestions : [];

  const [ready, setReady] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [appMeta, setAppMeta] = useState({});
  const [primaryRole, setPrimaryRole] = useState(null);
  const [savingRole, setSavingRole] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [busy, setBusy] = useState(false);
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

  // Property + import + risk-profile state
  const [prop, setProp] = useState({ mode: "create", name: "", address: "", approxUnits: "", files: [] });
  const [importState, setImportState] = useState(null); // { active, ready, error, analysis }
  const [answers, setAnswers] = useState({});
  const [summary, setSummary] = useState(null); // { buildingName, archetypeLabel, imported }
  const [prefs, setPrefs] = useState({ overdueReminders: true, ownerReport: true, autoRouteMaintenance: false });

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

      // Resume in-progress answers (role step is re-confirmed from the JWT;
      // uploaded files can't be serialized so the import step re-prompts).
      try {
        const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "null");
        if (saved) {
          if (saved.profile) setProfile((p) => ({ ...p, ...saved.profile }));
          if (saved.prop) setProp((p) => ({ ...p, ...saved.prop, files: [] }));
          if (saved.answers) setAnswers(saved.answers);
          if (saved.prefs) setPrefs((p) => ({ ...p, ...saved.prefs }));
          // Don't resume onto the import/risk steps — files are gone; clamp to profile.
          if (typeof saved.stepIndex === "number") setStepIndex(Math.min(saved.stepIndex, 2));
        }
      } catch {
        /* ignore malformed progress */
      }
      setReady(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist progress (files are intentionally excluded — not serializable)
  useEffect(() => {
    if (!ready) return;
    try {
      const { files, ...propRest } = prop;
      localStorage.setItem(
        PROGRESS_KEY,
        JSON.stringify({ stepIndex, profile, prop: propRest, answers, prefs }),
      );
    } catch {
      /* storage may be unavailable — non-fatal */
    }
  }, [ready, stepIndex, profile, prop, answers, prefs]);

  const goNext = useCallback(() => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1)), []);
  const goBack = useCallback(() => setStepIndex((i) => Math.max(i - 1, 0)), []);

  // Holds the in-flight package analysis so the finish step can await it even
  // if it started while the user was answering the questionnaire.
  const analyzeRef = useRef(null);

  function beginImportAnalysis(files) {
    setImportState({ active: true, ready: false, error: false, analysis: null });
    const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL;
    const url = backendBase
      ? `${backendBase}/onboarding/package/analyze`
      : `/api/onboarding/package/analyze`;
    const p = (async () => {
      const form = new FormData();
      files.forEach((f) => form.append("file", f));
      const res = await fetch(url, { method: "POST", headers: authHeaders(), body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Analysis failed");
      return json.data;
    })();
    analyzeRef.current = p;
    p.then((data) => setImportState({ active: true, ready: true, error: false, analysis: data })).catch(
      () => setImportState({ active: true, ready: false, error: true, analysis: null }),
    );
  }

  // Property "Continue": kick off the (slow) import analysis in the background so
  // it overlaps the questionnaire, then advance.
  function handlePropertyContinue() {
    if (prop.mode === "import" && prop.files.length) beginImportAnalysis(prop.files);
    goNext();
  }

  async function commitAnalyzedPackage(analysis) {
    const eb = analysis?.extractedBuilding || {};
    const name = (eb.name || prop.name || eb.address || prop.address || "My building").trim();
    const address = (eb.address || prop.address || eb.name || name).trim();
    const cRes = await fetch("/api/buildings", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        name,
        address: address || name,
        city: eb.city || undefined,
        postalCode: eb.postalCode || undefined,
      }),
    });
    const cJson = await cRes.json();
    if (!cRes.ok) throw new Error(cJson?.error?.message || "Failed to create building");
    const buildingId = cJson.data.id;

    // Commit the package — snapshot / reference-only during onboarding (safe: no
    // billing side-effects; they can activate ongoing management later).
    const form = new FormData();
    const extracted = analysis?.extractedFiles;
    if (extracted?.length) {
      extracted.forEach((ef) =>
        form.append("file", new Blob([ef.text], { type: "text/csv" }), ef.fileName),
      );
    } else {
      prop.files.forEach((f) => form.append("file", f));
    }
    form.append("billingMode", "snapshot");
    form.append("fiscalYear", String(analysis?.fiscalYear || ""));
    const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL;
    const commitPath = `/buildings/${buildingId}/onboarding/package/commit`;
    await fetch(backendBase ? `${backendBase}${commitPath}` : `/api${commitPath}`, {
      method: "POST",
      headers: authHeaders(),
      body: form,
    });
    return { buildingId, buildingName: name };
  }

  async function attachBuildingStrategy({ buildingId, ownerProfileId, roleIntent }) {
    try {
      await fetch("/api/strategy/building-profile", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ buildingId, ownerProfileId, roleIntent }),
      });
    } catch {
      /* non-fatal — strategy can be set later on the building page */
    }
  }

  async function submitRiskAndFinish() {
    setError(null);
    setBusy(true);
    try {
      // 1. Owner strategy profile from the questionnaire answers.
      const opRes = await fetch("/api/strategy/owner-profile", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ answers }),
      });
      const opJson = await opRes.json();
      if (!opRes.ok) throw new Error(opJson.error?.message || opJson.error || "Failed to save strategy");
      const ownerProfile = opJson.profile;
      const roleIntent = archetypeToRoleIntent(ownerProfile.primaryArchetype);
      const archetypeLabel =
        tOwner(`strategy.archetype.${ownerProfile.primaryArchetype}`) || ownerProfile.primaryArchetype;

      let buildingName = (prop.name || prop.address || "").trim();
      let buildingId = null;
      let imported = false;

      if (prop.mode === "import") {
        try {
          const analysis = analyzeRef.current
            ? await analyzeRef.current
            : importState?.analysis || null;
          if (analysis) {
            const res = await commitAnalyzedPackage(analysis);
            buildingName = res.buildingName;
            buildingId = res.buildingId;
            imported = true;
            await attachBuildingStrategy({
              buildingId: res.buildingId,
              ownerProfileId: ownerProfile.id,
              roleIntent,
            });
          }
        } catch {
          // Non-fatal: don't trap the user in onboarding over an import hiccup.
          setError(
            "Your strategy was saved, but the package import didn't finish — you can retry it from Properties.",
          );
        }
      } else {
        // Create-manual: building-profile endpoint creates the building + strategy.
        const bpRes = await fetch("/api/strategy/building-profile", {
          method: "POST",
          headers: { "content-type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            building: {
              name: (prop.name || prop.address).trim(),
              address: (prop.address || prop.name).trim(),
            },
            ownerProfileId: ownerProfile.id,
            roleIntent,
            approxUnits: prop.approxUnits ? parseInt(prop.approxUnits, 10) : undefined,
          }),
        });
        const bpJson = await bpRes.json();
        if (!bpRes.ok) throw new Error(bpJson.error?.message || bpJson.error || "Failed to save building");
        buildingName = (prop.name || prop.address).trim();
        buildingId = bpJson.profile?.buildingId || bpJson.building?.id || null;
      }

      setSummary({ buildingName, buildingId, archetypeLabel, imported });
      goNext();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

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
          theme,
          preferences: prefs,
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
          {stepKey === "property" && (
            <PropertyStep
              prop={prop}
              onChange={setProp}
              onImportFiles={(files) => setProp((p) => ({ ...p, files }))}
              importStatus={
                importState?.active
                  ? importState.ready
                    ? "Analysis complete."
                    : importState.error
                      ? "Analysis will be retried at the next step."
                      : "Analyzing…"
                  : null
              }
              onNext={handlePropertyContinue}
              onBack={goBack}
            />
          )}
          {stepKey === "risk" && (
            <RiskStep
              questions={questions}
              answers={answers}
              onAnswer={(key, val) => setAnswers((a) => ({ ...a, [key]: val }))}
              importState={prop.mode === "import" ? importState : null}
              busy={busy}
              onSubmit={submitRiskAndFinish}
              onBack={goBack}
            />
          )}
          {stepKey === "connections" && (
            <ConnectionsStep summary={summary} onNext={goNext} onBack={goBack} />
          )}
          {stepKey === "preferences" && (
            <PreferencesStep
              theme={theme}
              onTheme={setTheme}
              prefs={prefs}
              onPrefs={setPrefs}
              onNext={goNext}
              onBack={goBack}
            />
          )}
          {stepKey === "done" && (
            <DoneStep summary={summary} finishing={finishing} onFinish={finish} />
          )}
        </div>
      </div>
    </div>
  );
}

export const getStaticProps = withTranslations(["common", "owner"]);
