import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import ErrorBanner from "../../../components/ui/ErrorBanner";
import { ownerAuthHeaders } from "../../../lib/api";

const USER_LABELS = {
  exit_optimizer: "Prepare for sale",
  yield_maximizer: "Maximize income",
  value_builder: "Improve long-term value",
  capital_preserver: "Keep things stable",
  opportunistic_repositioner: "Upgrade and reposition",
};

const DEPRIORITIZE = {
  exit_optimizer:
    "We'll deprioritize long-term upgrades with payback beyond your expected sale horizon.",
  yield_maximizer:
    "We'll deprioritize modernisation projects that disrupt tenants without near-term income impact.",
  value_builder:
    "We'll deprioritize short-payback cosmetic fixes in favour of durable investments.",
  capital_preserver:
    "We'll deprioritize any project that introduces cost uncertainty or tenant disruption, even when the long-term upside is real.",
  opportunistic_repositioner:
    "We'll deprioritize low-impact repairs when a meaningful upgrade option exists.",
};

export default function StrategySettingsPage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        // Get current user ID from token
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("ownerToken")
            : null;
        if (!token) {
          setLoading(false);
          return;
        }
        // Decode JWT payload to get userId
        const payload = JSON.parse(atob(token.split(".")[1]));
        const userId = payload.sub || payload.userId;
        if (!userId) {
          setLoading(false);
          return;
        }
        const res = await fetch(`/api/strategy/owner-profile/${userId}`, {
          headers: ownerAuthHeaders(),
        });
        const data = await res.json();
        if (res.ok && data.profile) {
          setProfile(data.profile);
        }
      } catch (err) {
        setError(err.message || "Failed to load strategy profile");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const archetype = profile?.primaryArchetype;

  return (
    <AppShell role="OWNER">
      <PageShell>
        <PageHeader title="My Strategy" />
        <PageContent>
          <ErrorBanner error={error} />
          {loading && (
            <p className="text-sm text-slate-500">Loading...</p>
          )}
          {!loading && !profile && (
            <Panel>
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  You haven't set a strategy profile yet. Complete the short
                  questionnaire to get tailored recommendations.
                </p>
                <Link
                  href="/owner/strategy"
                  className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors no-underline"
                >
                  Set my strategy
                </Link>
              </div>
            </Panel>
          )}
          {!loading && profile && (
            <Panel>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Current strategy
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">
                    {USER_LABELS[archetype] || archetype}
                  </h2>
                </div>
                <p className="text-sm text-slate-500 italic">
                  {DEPRIORITIZE[archetype]}
                </p>
                {profile.confidence && (
                  <p className="text-xs text-slate-400">
                    Confidence: {profile.confidence}
                  </p>
                )}
                <Link
                  href="/owner/strategy"
                  className="inline-flex items-center rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors no-underline"
                >
                  Change my strategy
                </Link>
              </div>
            </Panel>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
