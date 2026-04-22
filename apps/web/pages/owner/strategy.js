import { useState } from "react";
import { useRouter } from "next/router";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import ErrorBanner from "../../components/ui/ErrorBanner";
import { cn } from "../../lib/utils";
import { ownerAuthHeaders } from "../../lib/api";

/* ─── Constants ─────────────────────────────────────────────── */

const USER_LABELS = {
  exit_optimizer: "Prepare for sale",
  yield_maximizer: "Maximize income",
  value_builder: "Improve long-term value",
  capital_preserver: "Keep things stable",
  opportunistic_repositioner: "Upgrade and reposition",
};

const EXPLANATIONS = {
  exit_optimizer:
    "You're preparing this property for sale. We'll prioritise decisions that improve presentation and reduce buyer risk, with a short payback horizon.",
  yield_maximizer:
    "You want steady, reliable income. We'll favour options that protect cash flow and avoid costly surprises over major upgrade projects.",
  value_builder:
    "You're focused on growing the long-term worth of your property. We'll favour investments that extend asset life and improve quality over quick fixes.",
  capital_preserver:
    "Stability matters most to you. We'll recommend low-risk, predictable options that avoid large disruptions or uncertain outcomes.",
  opportunistic_repositioner:
    "You're ready to invest significantly to reposition this property. We'll favour upgrades with strong long-term upside, even if the upfront cost is higher.",
};

const BULLETS = {
  exit_optimizer: [
    "We'll prioritise fixes that improve presentation and reduce buyer risk",
    "For repair vs. replace decisions, we'll favour lower upfront cost unless the item directly affects sale readiness",
    "We'll highlight compliance issues that could affect a sale transaction",
  ],
  yield_maximizer: [
    "We'll favour reliable, low-disruption maintenance over ambitious upgrades",
    "Recommendations will protect your rental income first — we'll flag anything that risks tenant satisfaction or occupancy",
    "For cashflow planning, we'll lean toward predictable spend and flag surprise-risk items",
  ],
  value_builder: [
    "When an asset fails, we'll lean toward replacement if it's past 60% of its useful life rather than patching it",
    "In cashflow planning, we'll flag which investments are worth making now vs. which can wait",
    "Compliance and energy efficiency upgrades will rank higher in our recommendations",
  ],
  capital_preserver: [
    "We'll recommend the lowest-risk, most predictable option — repairs over replacements where the risk is manageable",
    "We'll flag any option that introduces cost uncertainty or significant tenant disruption",
    "Large renovation projects will be flagged as low-priority unless compliance requires them",
  ],
  opportunistic_repositioner: [
    "We'll look for upgrade opportunities, not just like-for-like replacements",
    "Higher upfront cost is acceptable when the long-term value or rental uplift case is strong",
    "We'll flag modernisation opportunities — energy efficiency, spec upgrades — that align with repositioning",
  ],
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

const QUESTIONS = [
  {
    key: "mainGoal",
    title: "When a major system in your property needs attention, what\u2019s your first instinct?",
    options: [
      "Whatever gets it looking good fastest \u2014 I may sell soon",
      "Fix it well but don\u2019t go overboard \u2014 keep rental income flowing",
      "Take the opportunity to upgrade \u2014 long-term quality matters",
      "Get it fixed as cheaply as possible \u2014 minimal cost, minimal risk",
      "See if this opens up a bigger improvement opportunity",
    ],
  },
  {
    key: "holdPeriod",
    title: "How long do you expect to keep this property?",
    options: [
      "Less than 3 years",
      "3 to 5 years",
      "5 to 10 years",
      "More than 10 years",
    ],
  },
  {
    key: "renovationAppetite",
    title: "How comfortable are you with larger renovation projects?",
    options: [
      "Avoid them whenever possible",
      "Only when clearly necessary",
      "Comfortable with selective projects",
      "Comfortable with major upgrades",
      "Comfortable with major repositioning",
    ],
  },
  {
    key: "cashSensitivity",
    title: "How important is it to avoid large surprise expenses?",
    options: [
      "Extremely important",
      "Very important",
      "Moderately important",
      "Slightly important",
      "Not a major concern",
    ],
  },
  {
    key: "disruptionTolerance",
    title:
      "How much disruption can this property tolerate if the result is better long term?",
    options: [
      "Almost none",
      "Low",
      "Moderate",
      "Significant",
      "High",
    ],
  },
];

const ROLE_INTENT_OPTIONS = [
  { value: "sell", label: "Sell soon" },
  { value: "income", label: "Income generator" },
  { value: "long_term_quality", label: "Long-term hold" },
  { value: "reposition", label: "Upgrade candidate" },
  { value: "stable_hold", label: "Stable hold" },
];

const CONDITION_OPTIONS = [
  { value: "poor", label: "Poor" },
  { value: "fair", label: "Fair" },
  { value: "good", label: "Good" },
  { value: "very_good", label: "Very good" },
];

const BUILDING_TYPE_OPTIONS = [
  { value: "residential", label: "Residential" },
  { value: "mixed", label: "Mixed use" },
  { value: "commercial", label: "Commercial" },
];

function archetypeToRoleIntent(archetype) {
  switch (archetype) {
    case "exit_optimizer":
      return "sell";
    case "yield_maximizer":
      return "income";
    case "value_builder":
      return "long_term_quality";
    case "capital_preserver":
      return "stable_hold";
    case "opportunistic_repositioner":
      return "reposition";
    default:
      return "";
  }
}

function createBuildingEntry(defaultRoleIntent = "") {
  return {
    name: "",
    address: "",
    strategyMode: "same",
    roleIntent: defaultRoleIntent,
    buildingType: "",
    conditionRating: "",
    approxUnits: "",
  };
}

/* ─── Radio Group ───────────────────────────────────────────── */

function RadioGroup({ options, value, onChange, name }) {
  return (
    <div className="space-y-3">
      {options.map((option, idx) => {
        const optValue = typeof option === "string" ? idx + 1 : option.value;
        const label = typeof option === "string" ? option : option.label;
        const selected = value === optValue;
        return (
          <label
            key={optValue}
            className={cn(
              "flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors",
              selected
                ? "border-indigo-300 bg-indigo-50"
                : "border-slate-200 bg-white hover:bg-slate-50"
            )}
          >
            <input
              type="radio"
              name={name}
              value={optValue}
              checked={selected}
              onChange={() => onChange(optValue)}
              className="accent-indigo-600"
            />
            <span className="text-sm text-slate-900">{label}</span>
          </label>
        );
      })}
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────── */

export default function StrategyPage() {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0-4 = questions, 5 = display, 6 = building setup
  const [answers, setAnswers] = useState({});
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Building setup state — multi-building creation
  const [buildingEntries, setBuildingEntries] = useState([createBuildingEntry("")]);

  const portfolioArchetype = profile?.primaryArchetype || "";
  const portfolioArchetypeLabel = USER_LABELS[portfolioArchetype] || portfolioArchetype;
  const portfolioRoleIntent = archetypeToRoleIntent(portfolioArchetype);

  const currentQuestion = QUESTIONS[step];
  const totalQuestions = QUESTIONS.length;

  async function handleSubmitQuestionnaire() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/strategy/owner-profile", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...ownerAuthHeaders(),
        },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || data.error || "Failed to save strategy");
      setProfile(data.profile);
      setStep(5); // strategy display
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function updateBuildingEntry(index, field, value) {
    setBuildingEntries((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry))
    );
  }

  function addBuildingEntry() {
    setBuildingEntries((prev) => [
      ...prev,
      createBuildingEntry(portfolioRoleIntent),
    ]);
  }

  function removeBuildingEntry(index) {
    setBuildingEntries((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmitBuildingSetup() {
    const valid = buildingEntries.filter((e) => {
      if (!e.name.trim()) return false;
      if (e.strategyMode === "same") return Boolean(portfolioRoleIntent);
      return Boolean(e.roleIntent);
    });
    if (valid.length === 0) return;
    setSubmitting(true);
    setError("");
    try {
      for (const entry of valid) {
        const effectiveRoleIntent =
          entry.strategyMode === "same" ? portfolioRoleIntent : entry.roleIntent;
        const res = await fetch("/api/strategy/building-profile", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...ownerAuthHeaders(),
          },
          body: JSON.stringify({
            building: { name: entry.name.trim(), address: entry.address.trim() },
            ownerProfileId: profile.id,
            roleIntent: effectiveRoleIntent,
            buildingType: entry.buildingType || undefined,
            conditionRating: entry.conditionRating || undefined,
            approxUnits: entry.approxUnits ? parseInt(entry.approxUnits, 10) : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || data.error || "Failed to save building");
      }
      router.push("/owner");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleNext() {
    if (step < totalQuestions - 1) {
      setStep(step + 1);
    } else {
      handleSubmitQuestionnaire();
    }
  }

  function handleBack() {
    if (step === 5) {
      // "Change my answers" — go back to first question
      setStep(0);
      setProfile(null);
    } else if (step > 0) {
      setStep(step - 1);
    }
  }

  /* ─── Strategy display screen (step 5) ─── */
  if (step === 5 && profile) {
    const archetype = profile.primaryArchetype;
    const secondary = profile.secondaryArchetype;
    return (
      <AppShell role="OWNER">
        <PageShell>
          <PageHeader title="Your Strategy" />
          <PageContent>
            <Panel>
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Your current strategy
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-900">
                    {USER_LABELS[archetype] || archetype}
                  </h2>
                  {secondary && secondary !== archetype && (
                    <p className="mt-2 text-sm text-slate-600">
                      With a secondary lean toward:{" "}
                      <span className="font-semibold">
                        {USER_LABELS[secondary] || secondary}
                      </span>
                    </p>
                  )}
                </div>

                <p className="text-sm text-slate-700 leading-relaxed">
                  {EXPLANATIONS[archetype]}
                </p>

                {/* What this means in practice */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">
                    What this means in practice
                  </h3>
                  <ul className="space-y-2">
                    {(BULLETS[archetype] || []).map((bullet, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-slate-700"
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Deprioritize note */}
                <p className="text-sm text-slate-500 italic">
                  {DEPRIORITIZE[archetype]}
                </p>

                {/* Confidence */}
                {profile.confidence && (
                  <p className="text-xs text-slate-400">
                    Confidence: {profile.confidence}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-4 pt-2">
                  <button
                    onClick={() => {
                      setBuildingEntries([createBuildingEntry(archetypeToRoleIntent(profile.primaryArchetype))]);
                      setStep(6);
                    }}
                    className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                  >
                    Continue to set up your property
                  </button>
                  <button
                    onClick={handleBack}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    Change my answers
                  </button>
                </div>
              </div>
            </Panel>
          </PageContent>
        </PageShell>
      </AppShell>
    );
  }

  /* ─── Building setup screen (step 6) ─── */
  if (step === 6) {
    const canSubmit = buildingEntries.some((e) => {
      if (!e.name.trim()) return false;
      if (e.strategyMode === "same") return Boolean(portfolioRoleIntent);
      return Boolean(e.roleIntent);
    });
    return (
      <AppShell role="OWNER">
        <PageShell>
          <PageHeader title="Set up your properties" subtitle="Add the buildings you own or manage" />
          <PageContent>
            <ErrorBanner error={error} />

            {buildingEntries.map((entry, idx) => (
              <Panel key={idx}>
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Building {idx + 1}
                    </h3>
                    {buildingEntries.length > 1 && (
                      <button
                        onClick={() => removeBuildingEntry(idx)}
                        className="text-xs text-red-500 hover:text-red-700 transition-colors"
                        aria-label={`Remove building ${idx + 1}`}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {/* Name + Address */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor={`bname-${idx}`} className="block text-sm font-medium text-slate-700 mb-1">
                        Building name *
                      </label>
                      <input
                        id={`bname-${idx}`}
                        type="text"
                        value={entry.name}
                        onChange={(e) => updateBuildingEntry(idx, "name", e.target.value)}
                        placeholder="e.g. Rue du Lac 12"
                        className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor={`baddr-${idx}`} className="block text-sm font-medium text-slate-700 mb-1">
                        Address
                      </label>
                      <input
                        id={`baddr-${idx}`}
                        type="text"
                        value={entry.address}
                        onChange={(e) => updateBuildingEntry(idx, "address", e.target.value)}
                        placeholder="e.g. 1003 Lausanne"
                        className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  {/* Building type */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Building type
                    </label>
                    <RadioGroup
                      options={BUILDING_TYPE_OPTIONS}
                      value={entry.buildingType}
                      onChange={(val) => updateBuildingEntry(idx, "buildingType", val)}
                      name={`buildingType-${idx}`}
                    />
                  </div>

                  {/* Approximate units */}
                  <div>
                    <label htmlFor={`units-${idx}`} className="block text-sm font-medium text-slate-700 mb-1">
                      Approximate number of units (optional)
                    </label>
                    <input
                      id={`units-${idx}`}
                      type="number"
                      min="1"
                      value={entry.approxUnits}
                      onChange={(e) => updateBuildingEntry(idx, "approxUnits", e.target.value)}
                      placeholder="e.g. 12"
                      className="block w-full max-w-[120px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>

                  {/* Condition rating */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Current condition
                    </label>
                    <RadioGroup
                      options={CONDITION_OPTIONS}
                      value={entry.conditionRating}
                      onChange={(val) => updateBuildingEntry(idx, "conditionRating", val)}
                      name={`conditionRating-${idx}`}
                    />
                  </div>

                  {/* Role intent */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      What is your intent for this building? *
                    </label>
                    <RadioGroup
                      options={[
                        {
                          value: "same",
                          label: `Same strategy as overall portfolio${portfolioArchetypeLabel ? ` (${portfolioArchetypeLabel})` : ""}`,
                        },
                        {
                          value: "different",
                          label: "Different strategy than overall portfolio",
                        },
                      ]}
                      value={entry.strategyMode}
                      onChange={(val) =>
                        updateBuildingEntry(idx, "strategyMode", val)
                      }
                      name={`strategyMode-${idx}`}
                    />

                    {entry.strategyMode === "different" && (
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                        This building will be treated differently by the decision engine than buildings following your overall portfolio strategy (for example, maintenance and CAPEX decisions).
                      </div>
                    )}

                    {entry.strategyMode === "different" && (
                      <div className="mt-3">
                        <RadioGroup
                          options={ROLE_INTENT_OPTIONS}
                          value={entry.roleIntent}
                          onChange={(val) => updateBuildingEntry(idx, "roleIntent", val)}
                          name={`roleIntent-${idx}`}
                        />
                      </div>
                    )}

                    {entry.strategyMode === "same" && (
                      <p className="mt-3 text-xs text-slate-600">
                        This building will use your overall portfolio strategy{portfolioArchetypeLabel ? `: ${portfolioArchetypeLabel}.` : "."}
                      </p>
                    )}
                  </div>
                </div>
              </Panel>
            ))}

            {/* Add another building */}
            <div className="pt-2">
              <button
                onClick={addBuildingEntry}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                + Add another building
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4 pt-4">
              <button
                onClick={handleSubmitBuildingSetup}
                disabled={!canSubmit || submitting}
                className={cn(
                  "rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors",
                  !canSubmit || submitting
                    ? "bg-slate-300 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700"
                )}
              >
                {submitting ? "Saving..." : "Save and continue"}
              </button>
              <button
                onClick={() => router.push("/owner")}
                className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
              >
                Skip for now
              </button>
            </div>
          </PageContent>
        </PageShell>
      </AppShell>
    );
  }

  /* ─── Questionnaire screens (steps 0–4) ─── */
  return (
    <AppShell role="OWNER">
      <PageShell>
        <PageHeader
          title="Strategy Questionnaire"
          subtitle={`Question ${step + 1} of ${totalQuestions}`}
        />
        <PageContent>
          <ErrorBanner error={error} />
          <Panel>
            <div className="space-y-6 max-w-lg">
              <h2 className="text-lg font-semibold text-slate-900">
                {currentQuestion.title}
              </h2>

              <RadioGroup
                options={currentQuestion.options}
                value={answers[currentQuestion.key]}
                onChange={(val) =>
                  setAnswers((prev) => ({ ...prev, [currentQuestion.key]: val }))
                }
                name={currentQuestion.key}
              />

              <div className="flex items-center gap-4 pt-2">
                {step > 0 && (
                  <button
                    onClick={handleBack}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Back
                  </button>
                )}
                <button
                  onClick={handleNext}
                  disabled={!answers[currentQuestion.key] || submitting}
                  className={cn(
                    "rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors",
                    !answers[currentQuestion.key] || submitting
                      ? "bg-slate-300 cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-700"
                  )}
                >
                  {step === totalQuestions - 1
                    ? submitting
                      ? "Calculating..."
                      : "See my strategy"
                    : "Next"}
                </button>
              </div>

              {/* Progress bar */}
              <div className="pt-2">
                <div className="h-1.5 w-full rounded-full bg-slate-100">
                  <div
                    className="h-1.5 rounded-full bg-indigo-500 transition-all"
                    style={{ width: `${((step + 1) / totalQuestions) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </Panel>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
