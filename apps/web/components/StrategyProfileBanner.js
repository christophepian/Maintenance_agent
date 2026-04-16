import { useState } from "react";
import Link from "next/link";
import { cn } from "../lib/utils";

/**
 * Dismissable banner prompting owners to set up their strategy profile.
 * Shown on the owner dashboard when no OwnerStrategyProfile exists.
 * Persists dismissal in sessionStorage so it reappears on next login.
 */
export default function StrategyProfileBanner() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("strategyBannerDismissed") === "true";
  });

  if (dismissed) return null;

  function handleDismiss() {
    sessionStorage.setItem("strategyBannerDismissed", "true");
    setDismissed(true);
  }

  return (
    <div className={cn(
      "relative rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-4 mb-6",
      "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    )}>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-indigo-900">
          Set your property strategy
        </p>
        <p className="mt-1 text-sm text-indigo-700">
          Get tailored recommendations on maintenance, cashflow, and repair decisions. Takes under 2 minutes.
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Link
          href="/owner/strategy"
          className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors no-underline"
        >
          Set my strategy
        </Link>
        <button
          onClick={handleDismiss}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
          aria-label="Dismiss strategy banner"
        >
          Remind me later
        </button>
      </div>
    </div>
  );
}
