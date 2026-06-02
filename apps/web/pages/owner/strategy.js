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
import { withTranslations } from "../../lib/i18n";
import { useTranslation } from "next-i18next";

/* ─── i18n helpers ──────────────────────────────────────────── */

function getRoleIntentOptions(t) {
  return [
    { value: "sell", label: t("owner:strategy.roleIntent.sell") },
    { value: "income", label: t("owner:strategy.roleIntent.income") },
    { value: "long_term_quality", label: t("owner:strategy.roleIntent.long_term_quality") },
    { value: "reposition", label: t("owner:strategy.roleIntent.reposition") },
    { value: "stable_hold", label: t("owner:strategy.roleIntent.stable_hold") },
  ];
}

function getConditionOptions(t) {
  return [
    { value: "poor", label: t("owner:strategy.condition.poor") },
    { value: "fair", label: t("owner:strategy.condition.fair") },
    { value: "good", label: t("owner:strategy.condition.good") },
    { value: "very_good", label: t("owner:strategy.condition.very_good") },
  ];
}

function getBuildingTypeOptions(t) {
  return [
    { value: "residential", label: t("owner:strategy.buildingType.residential") },
    { value: "mixed", label: t("owner:strategy.buildingType.mixed") },
    { value: "commercial", label: t("owner:strategy.buildingType.commercial") },
  ];
}

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
                : "border-surface-border bg-surface hover:bg-surface-subtle"
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
            <span className="text-sm text-foreground">{label}</span>
          </label>
        );
      })}
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────── */

export default function StrategyPage() {
  const { t } = useTranslation("owner");
  const router = useRouter();
  const [step, setStep] = useState(0); // 0-4 = questions, 5 = display, 6 = building setup
  const [answers, setAnswers] = useState({});
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Building setup state — multi-building creation
  const [buildingEntries, setBuildingEntries] = useState([createBuildingEntry("")]);

  const questions = t("owner:strategy.questions", { returnObjects: true });
  const totalQuestions = questions.length;

  const portfolioArchetype = profile?.primaryArchetype || "";
  const portfolioArchetypeLabel = portfolioArchetype
    ? t(`owner:strategy.archetype.${portfolioArchetype}`)
    : "";
  const portfolioRoleIntent = archetypeToRoleIntent(portfolioArchetype);

  const currentQuestion = questions[step];

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
          <PageHeader title={t("owner:strategy.title.yourStrategy")} />
          <PageContent>
            <Panel>
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-foreground-dim">
                    {t("owner:strategy.text.yourCurrentStrategy")}
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-foreground">
                    {t(`owner:strategy.archetype.${archetype}`) || archetype}
                  </h2>
                  {secondary && secondary !== archetype && (
                    <p className="mt-2 text-sm text-muted-text">
                      {t("owner:strategy.text.withSecondaryLeanToward")}{" "}
                      <span className="font-semibold">
                        {t(`owner:strategy.archetype.${secondary}`) || secondary}
                      </span>
                    </p>
                  )}
                </div>

                <p className="text-sm text-muted-dark leading-relaxed">
                  {t(`owner:strategy.explanation.${archetype}`)}
                </p>

                {/* What this means in practice */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">{t("owner:strategy.heading.whatThisMeansInPractice")}</h3>
                  <ul className="space-y-2">
                    {(t(`owner:strategy.bullets.${archetype}`, { returnObjects: true }) || []).map((bullet, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-muted-dark"
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Deprioritize note */}
                <p className="text-sm text-muted italic">
                  {t(`owner:strategy.deprioritize.${archetype}`)}
                </p>

                {/* Confidence */}
                {profile.confidence && (
                  <p className="text-xs text-foreground-dim">
                    {t("owner:strategy.text.confidence", { value: profile.confidence })}
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
                    {t("owner:strategy.button.continueToSetUp")}
                  </button>
                  <button
                    onClick={handleBack}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    {t("owner:strategy.button.changeMyAnswers")}
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
          <PageHeader title={t("owner:strategy.title.setUpYourProperties")} subtitle={t("owner:strategy.prop.addTheBuildingsYouOwnOrManage")} />
          <PageContent>
            <ErrorBanner error={error} />

            {buildingEntries.map((entry, idx) => (
              <Panel key={idx}>
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">
                      {t("owner:strategy.text.buildingN", { n: idx + 1 })}
                    </h3>
                    {buildingEntries.length > 1 && (
                      <button
                        onClick={() => removeBuildingEntry(idx)}
                        className="text-xs text-red-500 hover:text-red-700 transition-colors"
                        aria-label={`${t("owner:strategy.label.remove")} ${idx + 1}`}
                      >
                        {t("owner:strategy.label.remove")}
                      </button>
                    )}
                  </div>

                  {/* Name + Address */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor={`bname-${idx}`} className="block text-sm font-medium text-muted-dark mb-1">
                        {t("owner:strategy.label.buildingName")}
                      </label>
                      <input
                        id={`bname-${idx}`}
                        type="text"
                        value={entry.name}
                        onChange={(e) => updateBuildingEntry(idx, "name", e.target.value)}
                        placeholder={t("owner:strategy.placeholder.eGRueDuLac12")}
                        className="block w-full rounded-lg border border-muted-ring px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor={`baddr-${idx}`} className="block text-sm font-medium text-muted-dark mb-1">
                        {t("owner:strategy.label.address")}
                      </label>
                      <input
                        id={`baddr-${idx}`}
                        type="text"
                        value={entry.address}
                        onChange={(e) => updateBuildingEntry(idx, "address", e.target.value)}
                        placeholder={t("owner:strategy.placeholder.eG1003Lausanne")}
                        className="block w-full rounded-lg border border-muted-ring px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  {/* Building type */}
                  <div>
                    <label className="block text-sm font-medium text-muted-dark mb-2">
                      {t("owner:strategy.label.buildingType")}
                    </label>
                    <RadioGroup
                      options={getBuildingTypeOptions(t)}
                      value={entry.buildingType}
                      onChange={(val) => updateBuildingEntry(idx, "buildingType", val)}
                      name={`buildingType-${idx}`}
                    />
                  </div>

                  {/* Approximate units */}
                  <div>
                    <label htmlFor={`units-${idx}`} className="block text-sm font-medium text-muted-dark mb-1">
                      {t("owner:strategy.label.approxUnits")}
                    </label>
                    <input
                      id={`units-${idx}`}
                      type="number"
                      min="1"
                      value={entry.approxUnits}
                      onChange={(e) => updateBuildingEntry(idx, "approxUnits", e.target.value)}
                      placeholder={t("owner:strategy.placeholder.eG12")}
                      className="block w-full max-w-[120px] rounded-lg border border-muted-ring px-3 py-2 text-sm"
                    />
                  </div>

                  {/* Condition rating */}
                  <div>
                    <label className="block text-sm font-medium text-muted-dark mb-2">
                      {t("owner:strategy.label.currentCondition")}
                    </label>
                    <RadioGroup
                      options={getConditionOptions(t)}
                      value={entry.conditionRating}
                      onChange={(val) => updateBuildingEntry(idx, "conditionRating", val)}
                      name={`conditionRating-${idx}`}
                    />
                  </div>

                  {/* Role intent */}
                  <div>
                    <label className="block text-sm font-medium text-muted-dark mb-2">
                      {t("owner:strategy.label.intent")}
                    </label>
                    <RadioGroup
                      options={[
                        {
                          value: "same",
                          label: portfolioArchetypeLabel
                            ? t("owner:strategy.option.sameStrategyWithLabel", { label: portfolioArchetypeLabel })
                            : t("owner:strategy.option.sameStrategy"),
                        },
                        {
                          value: "different",
                          label: t("owner:strategy.option.differentStrategy"),
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
                        {t("owner:strategy.text.differentStrategyNote")}
                      </div>
                    )}

                    {entry.strategyMode === "different" && (
                      <div className="mt-3">
                        <RadioGroup
                          options={getRoleIntentOptions(t)}
                          value={entry.roleIntent}
                          onChange={(val) => updateBuildingEntry(idx, "roleIntent", val)}
                          name={`roleIntent-${idx}`}
                        />
                      </div>
                    )}

                    {entry.strategyMode === "same" && (
                      <p className="mt-3 text-xs text-muted-text">
                        {portfolioArchetypeLabel
                          ? t("owner:strategy.text.sameStrategyNoteWithLabel", { label: portfolioArchetypeLabel })
                          : t("owner:strategy.text.sameStrategyNote")}
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
                {t("owner:strategy.button.addAnotherBuilding")}
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
                    ? "bg-muted-ring cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700"
                )}
              >
                {submitting ? t("owner:strategy.button.saving") : t("owner:strategy.button.saveAndContinue")}
              </button>
              <button
                onClick={() => router.push("/owner")}
                className="text-sm font-medium text-muted hover:text-muted-dark transition-colors"
              >
                {t("owner:strategy.button.skipForNow")}
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
          title={t("owner:strategy.title.strategyQuestionnaire")}
          subtitle={t("owner:strategy.text.questionOf", { current: step + 1, total: totalQuestions })}
        />
        <PageContent>
          <ErrorBanner error={error} />
          <Panel>
            <div className="space-y-6 max-w-lg">
              <h2 className="text-lg font-semibold text-foreground">
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
                    className="rounded-lg border border-surface-border bg-surface px-4 py-2 text-sm font-medium text-muted-dark hover:bg-surface-subtle transition-colors"
                  >
                    {t("owner:strategy.button.back")}
                  </button>
                )}
                <button
                  onClick={handleNext}
                  disabled={!answers[currentQuestion.key] || submitting}
                  className={cn(
                    "rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors",
                    !answers[currentQuestion.key] || submitting
                      ? "bg-muted-ring cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-700"
                  )}
                >
                  {step === totalQuestions - 1
                    ? submitting
                      ? t("owner:strategy.button.calculating")
                      : t("owner:strategy.button.seeMyStrategy")
                    : t("owner:strategy.button.next")}
                </button>
              </div>

              {/* Progress bar */}
              <div className="pt-2">
                <div className="h-1.5 w-full rounded-full bg-surface-hover">
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

export const getStaticProps = withTranslations(["common","owner"]);
