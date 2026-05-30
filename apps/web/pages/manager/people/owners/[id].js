import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../../../components/AppShell";
import PageShell from "../../../../components/layout/PageShell";
import PageHeader from "../../../../components/layout/PageHeader";
import PageContent from "../../../../components/layout/PageContent";
import Panel from "../../../../components/layout/Panel";
import Badge from "../../../../components/ui/Badge";
import ErrorBanner from "../../../../components/ui/ErrorBanner";
import ScrollableTabs from "../../../../components/mobile/ScrollableTabs";
import { formatDateTime } from "../../../../lib/format";
import { authHeaders } from "../../../../lib/api";
import { withServerTranslations } from "../../../../lib/i18n";
import { useTranslation } from "next-i18next";

const BILLING_FORM_DEFAULT = {
  addressLine1: "",
  postalCode: "",
  city: "",
  iban: "",
  vatNumber: "",
};

export default function OwnerDetailPage() {
  const { t } = useTranslation("manager");
  const router = useRouter();
  const { id } = router.query;

  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Personal info editing
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", email: "" });
  const [saving, setSaving] = useState(false);

  // Billing entity creation
  const [showBillingForm, setShowBillingForm] = useState(false);
  const [billingForm, setBillingForm] = useState(BILLING_FORM_DEFAULT);
  const [billingSaving, setBillingSaving] = useState(false);

  const TABS = [
    { id: "personal", label: t("manager:peopleOwnersId.tab.personalInformation") },
    { id: "billing",  label: t("manager:peopleOwnersId.tab.billingEntity") },
    { id: "buildings", label: t("manager:peopleOwnersId.tab.buildings") },
  ];
  const [activeTab, setActiveTab] = useState("personal");

  useEffect(() => {
    if (!id) return;
    loadOwner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadOwner() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/people/owners/${id}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to load owner");
      const o = data?.data;
      setOwner(o);
      setEditForm({ name: o?.name || "", email: o?.email || "" });
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/people/owners/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to update owner");
      setMessage(t("manager:peopleOwnersId.text.ownerUpdated"));
      setIsEditing(false);
      await loadOwner();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateBillingEntity(e) {
    e.preventDefault();
    setBillingSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/people/owners/${id}/billing-entity`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ ...billingForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to create billing entity");
      setMessage(t("manager:peopleOwnersId.text.billingEntityCreated"));
      setShowBillingForm(false);
      setBillingForm(BILLING_FORM_DEFAULT);
      await loadOwner();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBillingSaving(false);
    }
  }

  return (
    <AppShell role="MANAGER">
      <PageShell variant="embedded">
        <div className="mb-3">
          <button
            type="button"
            className="text-sm font-medium text-muted-text hover:text-foreground"
            onClick={() => router.push("/manager/people?tab=owners")}
          >
            {t("manager:peopleOwnersId.text.back")}
          </button>
        </div>
        <PageHeader
          title={owner?.name || t("manager:peopleOwnersId.title.owner")}
          subtitle={t("manager:peopleOwnersId.subtitle.ownerProfile")}
        />
        <PageContent>
          {message && <div className="notice notice-ok mb-4">{message}</div>}
          <ErrorBanner error={error} onDismiss={() => setError("")} />

          {loading ? (
            <p className="loading-text">{t("manager:peopleOwnersId.text.loading")}</p>
          ) : !owner ? (
            <Panel>
              <p className="text-sm text-muted-text">{t("manager:peopleOwnersId.text.notFound")}</p>
              <button type="button" className="button-secondary mt-3" onClick={() => router.back()}>
                {t("manager:peopleOwnersId.text.goBack")}
              </button>
            </Panel>
          ) : (
            <div className="grid gap-4">
              <ScrollableTabs activeIndex={TABS.findIndex((tab) => tab.id === activeTab)}>
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={activeTab === tab.id ? "tab-btn-active" : "tab-btn"}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </ScrollableTabs>

              {/* Personal Information */}
              {activeTab === "personal" && (
                <Panel
                  title={t("manager:peopleOwnersId.title.personalInformation")}
                  actions={
                    isEditing ? (
                      <div className="flex items-center gap-2">
                        <button type="button" className="button-secondary text-sm" onClick={() => { setIsEditing(false); setEditForm({ name: owner.name || "", email: owner.email || "" }); }} disabled={saving}>
                          {t("manager:peopleOwnersId.text.cancel")}
                        </button>
                        <button type="button" className="button-primary text-sm" onClick={handleSave} disabled={saving}>
                          {saving ? t("manager:peopleOwnersId.text.saving") : t("manager:peopleOwnersId.text.save")}
                        </button>
                      </div>
                    ) : (
                      <button type="button" className="button-primary text-sm" onClick={() => setIsEditing(true)}>
                        {t("manager:peopleOwnersId.text.edit")}
                      </button>
                    )
                  }
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:peopleOwnersId.prop.name")}</span>
                      {isEditing ? (
                        <input className="input text-sm text-muted-dark" type="text" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                      ) : (
                        <div className="text-sm text-muted-dark">{owner.name || "—"}</div>
                      )}
                    </label>
                    <label className="grid gap-2 sm:col-span-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:peopleOwnersId.prop.email")}</span>
                      {isEditing ? (
                        <input className="input text-sm text-muted-dark" type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
                      ) : (
                        <div className="text-sm text-muted-dark">{owner.email || "—"}</div>
                      )}
                    </label>
                  </div>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div className="min-w-0">
                      <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:peopleOwnersId.prop.id")}</div>
                      <div className="text-sm text-muted-dark mt-1 break-all">{owner.id}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:peopleOwnersId.prop.created")}</div>
                      <div className="text-sm text-muted-dark mt-1">{owner.createdAt ? formatDateTime(owner.createdAt) : "—"}</div>
                    </div>
                  </div>
                </Panel>
              )}

              {/* Billing Entity */}
              {activeTab === "billing" && (
                <Panel
                  title={t("manager:peopleOwnersId.title.billingEntity")}
                  actions={
                    !owner.billingEntity && !showBillingForm ? (
                      <button type="button" className="button-primary text-sm" onClick={() => setShowBillingForm(true)}>
                        {t("manager:peopleOwnersId.text.createBillingEntity")}
                      </button>
                    ) : null
                  }
                >
                  {owner.billingEntity ? (
                    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                      <div>
                        <dt className="text-xs font-medium text-muted uppercase tracking-wide">{t("manager:peopleOwnersId.prop.name")}</dt>
                        <dd className="mt-0.5 text-sm text-foreground">{owner.billingEntity.name || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-muted uppercase tracking-wide">{t("manager:peopleOwnersId.prop.address")}</dt>
                        <dd className="mt-0.5 text-sm text-foreground">{owner.billingEntity.addressLine1 || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-muted uppercase tracking-wide">{t("manager:peopleOwnersId.prop.city")}</dt>
                        <dd className="mt-0.5 text-sm text-foreground">{[owner.billingEntity.postalCode, owner.billingEntity.city].filter(Boolean).join(" ") || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-muted uppercase tracking-wide">IBAN</dt>
                        <dd className="mt-0.5 text-sm text-foreground font-mono">{owner.billingEntity.iban || "—"}</dd>
                      </div>
                      {owner.billingEntity.vatNumber && (
                        <div>
                          <dt className="text-xs font-medium text-muted uppercase tracking-wide">{t("manager:peopleOwnersId.prop.vatNumber")}</dt>
                          <dd className="mt-0.5 text-sm text-foreground">{owner.billingEntity.vatNumber}</dd>
                        </div>
                      )}
                      <div>
                        <dt className="text-xs font-medium text-muted uppercase tracking-wide">{t("manager:peopleOwnersId.prop.type")}</dt>
                        <dd className="mt-0.5"><Badge variant="info" size="sm">{owner.billingEntity.type}</Badge></dd>
                      </div>
                    </dl>
                  ) : showBillingForm ? (
                    <form onSubmit={handleCreateBillingEntity} className="grid grid-cols-2 gap-4 max-w-lg">
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-muted-text mb-1">{t("manager:peopleOwnersId.prop.address")}</label>
                        <input required value={billingForm.addressLine1} onChange={(e) => setBillingForm((f) => ({ ...f, addressLine1: e.target.value }))} className="input text-sm w-full" placeholder="Rue de la Paix 1" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-text mb-1">{t("manager:peopleOwnersId.prop.postalCode")}</label>
                        <input required value={billingForm.postalCode} onChange={(e) => setBillingForm((f) => ({ ...f, postalCode: e.target.value }))} className="input text-sm w-full" placeholder="1200" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-text mb-1">{t("manager:peopleOwnersId.prop.city")}</label>
                        <input required value={billingForm.city} onChange={(e) => setBillingForm((f) => ({ ...f, city: e.target.value }))} className="input text-sm w-full" placeholder="Genève" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-muted-text mb-1">IBAN</label>
                        <input required value={billingForm.iban} onChange={(e) => setBillingForm((f) => ({ ...f, iban: e.target.value }))} className="input text-sm w-full font-mono" placeholder="CH56 0483 5012 3456 7800 9" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-text mb-1">{t("manager:peopleOwnersId.prop.vatNumber")}</label>
                        <input value={billingForm.vatNumber} onChange={(e) => setBillingForm((f) => ({ ...f, vatNumber: e.target.value }))} className="input text-sm w-full" placeholder="CHE-123.456.789" />
                      </div>
                      <div className="col-span-2 flex gap-2 pt-1">
                        <button type="submit" disabled={billingSaving} className="button-primary text-sm">
                          {billingSaving ? t("manager:peopleOwnersId.text.saving") : t("manager:peopleOwnersId.text.save")}
                        </button>
                        <button type="button" className="button-secondary text-sm" onClick={() => setShowBillingForm(false)}>
                          {t("manager:peopleOwnersId.text.cancel")}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="py-4 flex flex-col items-start gap-3">
                      <Badge variant="warning" size="md">⚠ {t("manager:peopleOwnersId.text.noBillingEntity")}</Badge>
                      <p className="text-sm text-muted">{t("manager:peopleOwnersId.text.noBillingEntityDescription")}</p>
                    </div>
                  )}
                </Panel>
              )}

              {/* Buildings */}
              {activeTab === "buildings" && (
                <Panel title={t("manager:peopleOwnersId.title.buildings")}>
                  {owner.buildings?.length === 0 ? (
                    <p className="text-sm text-muted py-2">{t("manager:peopleOwnersId.text.noBuildings")}</p>
                  ) : (
                    <>
                      {/* Mobile cards */}
                      <div className="sm:hidden divide-y divide-slate-100 -mx-4 -mb-4">
                        {owner.buildings.map((b) => (
                          <div key={b.id} className="px-4 py-3">
                            <Link href={`/manager/buildings/${b.id}`} className="cell-link font-medium">{b.name || "—"}</Link>
                            <p className="text-xs text-muted mt-0.5">{b.address || "—"}</p>
                          </div>
                        ))}
                      </div>
                      {/* Desktop table */}
                      <div className="hidden sm:block data-table-wrap -mx-4 -mb-4">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>{t("manager:peopleOwnersId.prop.building")}</th>
                              <th>{t("manager:peopleOwnersId.prop.address")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {owner.buildings.map((b) => (
                              <tr key={b.id}>
                                <td>
                                  <Link href={`/manager/buildings/${b.id}`} className="cell-link">
                                    {b.name || "—"}
                                  </Link>
                                </td>
                                <td className="text-muted">{b.address || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </Panel>
              )}
            </div>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}

export const getServerSideProps = withServerTranslations(["common", "manager"]);
