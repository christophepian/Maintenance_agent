import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import { authHeaders } from "../../../lib/api";
import { withTranslations } from "../../../lib/i18n";
import { useTranslation } from "next-i18next";

const TEMPLATE_TYPES = [
  { value: "GENERAL",             label: "Général" },
  { value: "MAINTENANCE_NOTICE",  label: "Avis de maintenance" },
  { value: "COMPLIANCE_REQUEST",  label: "Demande de conformité" },
  { value: "FINANCIAL_NOTICE",    label: "Avis financier" },
  { value: "SEASONAL",            label: "Saisonnier" },
  { value: "LEASE_ADMIN",         label: "Administratif bail" },
];

const LANGS = [
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "en", label: "English" },
];

export default function NewLetter() {
  const { t } = useTranslation("manager");
  const router = useRouter();

  const [templateType, setTemplateType] = useState("GENERAL");
  const [lang, setLang] = useState("fr");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [buildings, setBuildings] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [selectedTenantIds, setSelectedTenantIds] = useState([]);
  const [targetMode, setTargetMode] = useState("single"); // single | building | multi-building
  const [selectedBuildingIds, setSelectedBuildingIds] = useState([]);

  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [letterId, setLetterId] = useState(null);

  // Load buildings + tenants for recipient selection
  useEffect(() => {
    Promise.all([
      fetch("/api/buildings", { headers: authHeaders() }).then((r) => r.json()),
      fetch("/api/people/tenants", { headers: authHeaders() }).then((r) => r.json()),
    ]).then(([bld, ten]) => {
      setBuildings(bld?.data || []);
      setTenants(ten?.data || []);
    }).catch(() => {});
  }, []);

  // Hydrate form when editing an existing draft (?edit=<id>)
  const { edit } = router.query;
  useEffect(() => {
    if (!edit) return;
    fetch(`/api/correspondence/${edit}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        const l = data.data;
        if (!l || l.status !== "DRAFT") return;
        setLetterId(l.id);
        setSubject(l.subject || "");
        setBody(l.body || "");
        setTemplateType(l.templateType || "GENERAL");
        setLang(l.lang || "fr");
      })
      .catch(() => {});
  }, [edit]);

  // Derive displayed tenants based on target mode + selected buildings
  const displayedTenants = (() => {
    if (targetMode === "single") return tenants;
    const buildingUnitIds = new Set(
      buildings
        .filter((b) => selectedBuildingIds.includes(b.id))
        .flatMap((b) => (b.units || []).map((u) => u.id))
    );
    return tenants.filter((ten) =>
      (ten.occupancies || []).some((o) => buildingUnitIds.has(o.unitId))
    );
  })();

  // Auto-select all tenants when building is chosen
  useEffect(() => {
    if (targetMode !== "single") {
      setSelectedTenantIds(displayedTenants.map((t) => t.id));
    }
  }, [selectedBuildingIds, targetMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const ensureDraft = useCallback(async () => {
    if (letterId) return letterId;
    const res = await fetch("/api/correspondence", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ subject, body, templateType, lang }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || "Failed to create draft");
    setLetterId(data.data.id);
    return data.data.id;
  }, [letterId, subject, body, templateType, lang]);

  const saveDraft = useCallback(async () => {
    setSaving(true);
    setError("");
    try {
      const id = await ensureDraft();
      await fetch(`/api/correspondence/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ subject, body, templateType, lang }),
      });
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }, [ensureDraft, subject, body, templateType, lang]);

  const generateDraft = useCallback(async () => {
    setDrafting(true);
    setError("");
    try {
      const id = await ensureDraft();
      // Save current state first
      await fetch(`/api/correspondence/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ subject, body, templateType, lang }),
      });
      const res = await fetch(`/api/correspondence/${id}/ai-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ additionalContext }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "AI draft failed");
      setSubject(data.data.subject);
      setBody(data.data.body);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setDrafting(false);
    }
  }, [ensureDraft, subject, body, templateType, lang, additionalContext]);

  const send = useCallback(async () => {
    if (selectedTenantIds.length === 0) {
      setError(t("correspondence.noRecipientsError"));
      return;
    }
    if (!subject.trim() || !body.trim()) {
      setError(t("correspondence.emptyLetterError"));
      return;
    }
    setSending(true);
    setError("");
    try {
      const id = await ensureDraft();
      // Save latest edits
      await fetch(`/api/correspondence/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ subject, body, templateType, lang }),
      });
      // Send
      const res = await fetch(`/api/correspondence/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ tenantIds: selectedTenantIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to send");
      router.push(`/manager/correspondence/${id}`);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSending(false);
    }
  }, [ensureDraft, subject, body, templateType, lang, selectedTenantIds, router, t]);

  const toggleTenant = (id) => {
    setSelectedTenantIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader
          title={t("correspondence.newLetter")}
          actions={
            <div className="flex gap-2">
              <button
                onClick={saveDraft}
                disabled={saving}
                className="rounded-lg border border-surface-border px-4 py-2 text-sm font-medium text-muted-dark hover:bg-surface-subtle disabled:opacity-50 transition-colors"
              >
                {saving ? t("correspondence.saving") : t("correspondence.saveDraft")}
              </button>
              <button
                onClick={send}
                disabled={sending || selectedTenantIds.length === 0}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50 transition-colors"
              >
                {sending ? t("correspondence.sending") : `${t("correspondence.send")} (${selectedTenantIds.length})`}
              </button>
            </div>
          }
        />
        <PageContent>
          {error && <div className="notice notice-err mb-4">{error}</div>}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            {/* ── Left: compose ── */}
            <div className="space-y-4">
              {/* Template + language */}
              <div className="card border p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-dark mb-1">{t("correspondence.templateType")}</label>
                    <select
                      value={templateType}
                      onChange={(e) => setTemplateType(e.target.value)}
                      className="input mb-0"
                    >
                      {TEMPLATE_TYPES.map((tt) => (
                        <option key={tt.value} value={tt.value}>{tt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-dark mb-1">{t("correspondence.language")}</label>
                    <select
                      value={lang}
                      onChange={(e) => setLang(e.target.value)}
                      className="input mb-0"
                    >
                      {LANGS.map((l) => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Optional context for AI */}
                <div>
                  <label className="block text-xs font-medium text-muted-dark mb-1">{t("correspondence.additionalContext")}</label>
                  <input
                    type="text"
                    value={additionalContext}
                    onChange={(e) => setAdditionalContext(e.target.value)}
                    placeholder={t("correspondence.additionalContextPlaceholder")}
                    className="input mb-0"
                  />
                </div>

                <button
                  onClick={generateDraft}
                  disabled={drafting}
                  className="w-full rounded-lg border border-brand bg-brand-light px-4 py-2 text-sm font-medium text-brand hover:bg-brand hover:text-white disabled:opacity-50 transition-colors"
                >
                  {drafting ? t("correspondence.drafting") : t("correspondence.generateDraft")}
                </button>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-medium text-muted-dark mb-1">{t("correspondence.subject")}</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={t("correspondence.subjectPlaceholder")}
                  className="input mb-0"
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-xs font-medium text-muted-dark mb-1">{t("correspondence.body")}</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={16}
                  placeholder={t("correspondence.bodyPlaceholder")}
                  className="input mb-0 resize-y font-mono text-sm"
                />
              </div>
            </div>

            {/* ── Right: recipients ── */}
            <div className="space-y-4">
              <div className="card border p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground">{t("correspondence.recipients")}</p>

                {/* Target mode */}
                <div className="space-y-1">
                  {[
                    { value: "single",         label: t("correspondence.targetSingle") },
                    { value: "building",        label: t("correspondence.targetBuilding") },
                    { value: "multi-building",  label: t("correspondence.targetMultiBuilding") },
                  ].map((mode) => (
                    <label key={mode.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="targetMode"
                        value={mode.value}
                        checked={targetMode === mode.value}
                        onChange={() => { setTargetMode(mode.value); setSelectedBuildingIds([]); setSelectedTenantIds([]); }}
                        className="accent-brand"
                      />
                      <span className="text-sm text-foreground">{mode.label}</span>
                    </label>
                  ))}
                </div>

                {/* Building selector */}
                {(targetMode === "building" || targetMode === "multi-building") && (
                  <div className="space-y-1 max-h-40 overflow-y-auto border border-surface-border rounded-lg p-2">
                    {buildings.map((b) => (
                      <label key={b.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                        <input
                          type={targetMode === "building" ? "radio" : "checkbox"}
                          name="building"
                          checked={selectedBuildingIds.includes(b.id)}
                          onChange={() => {
                            setSelectedBuildingIds((prev) =>
                              targetMode === "building"
                                ? [b.id]
                                : prev.includes(b.id) ? prev.filter((x) => x !== b.id) : [...prev, b.id]
                            );
                          }}
                          className="accent-brand"
                        />
                        <span className="text-sm text-foreground truncate">{b.name}</span>
                      </label>
                    ))}
                  </div>
                )}

                {/* Tenant list */}
                <div className="space-y-1 max-h-64 overflow-y-auto border border-surface-border rounded-lg p-2">
                  {displayedTenants.length === 0 ? (
                    <p className="text-xs text-foreground-dim py-2 text-center">{t("correspondence.noTenants")}</p>
                  ) : (
                    displayedTenants.map((ten) => (
                      <label key={ten.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                        <input
                          type="checkbox"
                          checked={selectedTenantIds.includes(ten.id)}
                          onChange={() => toggleTenant(ten.id)}
                          className="accent-brand"
                        />
                        <div className="min-w-0">
                          <p className="text-sm text-foreground truncate">{ten.name || ten.email || ten.phone}</p>
                        </div>
                      </label>
                    ))
                  )}
                </div>

                <p className="text-xs text-foreground-dim">
                  {selectedTenantIds.length} {t("correspondence.selected")}
                </p>
              </div>
            </div>
          </div>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}

export const getStaticProps = withTranslations(["common", "manager"]);
