/**
 * OnboardingTour — lightweight first-run product tour ("show me around").
 *
 * Shown once, right after a user completes onboarding and lands on their role
 * home. Spotlights a few real navigation areas by querying existing links via
 * their href (no per-sidebar wiring needed); steps whose target isn't on the
 * page fall back to a centered card. Dependency-free and theme-aware.
 *
 * Gated by user_metadata.hasSeenTour (mirrors password_set / hasCompletedOnboarding):
 * the parent (AppShell) decides when to mount it and persists the flag onClose.
 */

import { useEffect, useState, useCallback } from "react";

// Role → ordered steps. `selector` is matched against the live DOM; a missing
// target degrades gracefully to a centered card.
const STEPS_BY_ROLE = {
  OWNER: [
    { selector: null, title: "Welcome to your portfolio", body: "Here's a quick tour of where to find things. It takes 20 seconds." },
    { selector: 'a[href*="/reporting"]', title: "Reporting", body: "Your portfolio dashboard — NOI, occupancy, and year-on-year performance across every building." },
    { selector: 'a[href*="/planning"], a[href*="/cashflow"], a[href*="/strategy"]', title: "Planning & strategy", body: "Model renovations, run NPV scenarios, and see recommendations tuned to the investor profile you just set." },
    { selector: 'a[href*="/properties"], a[href*="/inventory"]', title: "Your properties", body: "Every building, unit and tenant. Import more data or add buildings here anytime." },
    { selector: '[data-tour="notifications"]', title: "Stay in the loop", body: "Approvals and important updates show up here." },
  ],
  MANAGER: [
    { selector: null, title: "Welcome — here's the lay of the land", body: "A quick tour of your workspace. It takes 20 seconds." },
    { selector: 'a[href*="/finance"]', title: "Finance", body: "Invoices, imports, rent and ledger — the money side of every building." },
    { selector: 'a[href*="/requests"], a[href*="/work-requests"]', title: "Requests", body: "Tenant tickets and maintenance requests land here to triage and dispatch." },
    { selector: 'a[href*="/inventory"], a[href*="/properties"]', title: "Properties", body: "Buildings, units, tenants and leases — plus régie-package import." },
    { selector: '[data-tour="notifications"]', title: "Stay in the loop", body: "New requests and updates surface here." },
  ],
};

function centerRect() {
  if (typeof window === "undefined") return { top: 0, left: 0, width: 0, height: 0 };
  return { top: window.innerHeight / 2, left: window.innerWidth / 2, width: 0, height: 0 };
}

export default function OnboardingTour({ role, onClose }) {
  const steps = STEPS_BY_ROLE[role] || STEPS_BY_ROLE.OWNER;
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState(null); // target rect, or null → centered

  const measure = useCallback(() => {
    const step = steps[idx];
    if (!step?.selector) {
      setRect(null);
      return;
    }
    const el = document.querySelector(step.selector);
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [idx, steps]);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure]);

  const isLast = idx === steps.length - 1;
  const step = steps[idx];
  const spot = rect || centerRect();
  const pad = 8;

  // Tooltip position: below the target if there's room, otherwise above; for a
  // centered (no-target) step, pin it to the viewport center.
  const centered = !rect;
  const below = spot.top + spot.height + 12;
  const placeBelow = below + 180 < (typeof window !== "undefined" ? window.innerHeight : 800);
  const tipStyle = centered
    ? { top: "50%", left: "50%", transform: "translate(-50%, -50%)", maxWidth: 360 }
    : placeBelow
      ? { top: below, left: Math.max(12, Math.min(spot.left, (typeof window !== "undefined" ? window.innerWidth : 1000) - 340)), maxWidth: 320 }
      : { top: Math.max(12, spot.top - 12 - 160), left: Math.max(12, Math.min(spot.left, (typeof window !== "undefined" ? window.innerWidth : 1000) - 340)), maxWidth: 320 };

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Product tour">
      {/* Spotlight: a transparent box over the target with a huge shadow dimming
          the rest. For centered steps we just dim the whole screen. */}
      <div
        className="absolute rounded-xl transition-all duration-200 pointer-events-none"
        style={{
          top: centered ? 0 : spot.top - pad,
          left: centered ? 0 : spot.left - pad,
          width: centered ? "100%" : spot.width + pad * 2,
          height: centered ? "100%" : spot.height + pad * 2,
          boxShadow: centered
            ? "inset 0 0 0 9999px rgba(2,6,23,0.55)"
            : "0 0 0 9999px rgba(2,6,23,0.55)",
          outline: centered ? "none" : "2px solid var(--color-brand, #4f46e5)",
        }}
      />

      {/* Tooltip card */}
      <div
        className="absolute bg-surface rounded-2xl border border-surface-border shadow-2xl px-5 py-4 w-[calc(100%-24px)] sm:w-auto"
        style={tipStyle}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-foreground-dim">
            {idx + 1} / {steps.length}
          </span>
          <button
            type="button"
            onClick={() => onClose(true)}
            className="text-xs text-muted hover:text-foreground"
          >
            Skip tour
          </button>
        </div>
        <h3 className="text-sm font-semibold text-foreground mb-1">{step.title}</h3>
        <p className="text-sm text-muted leading-relaxed mb-4">{step.body}</p>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="text-sm text-muted hover:text-foreground disabled:opacity-40"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => (isLast ? onClose(true) : setIdx((i) => i + 1))}
            className="button-primary text-sm px-4"
          >
            {isLast ? "Got it" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
