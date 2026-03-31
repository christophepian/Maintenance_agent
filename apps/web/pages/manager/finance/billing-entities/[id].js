import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../../../components/AppShell";
import PageShell from "../../../../components/layout/PageShell";
import PageHeader from "../../../../components/layout/PageHeader";
import PageContent from "../../../../components/layout/PageContent";
import Panel from "../../../../components/layout/Panel";
import Section from "../../../../components/layout/Section";
import { authHeaders } from "../../../../lib/api";

const TYPE_LABEL = { ORG: "Organization", CONTRACTOR: "Contractor", OWNER: "Owner" };
const TYPE_CLS = {
  ORG: "bg-blue-100 text-blue-700",
  CONTRACTOR: "bg-amber-100 text-amber-700",
  OWNER: "bg-emerald-100 text-emerald-700",
};

function DetailRow({ label, value, mono }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-sm font-medium text-slate-500 sm:w-44 shrink-0">{label}</span>
      <span className={`text-sm text-slate-900 ${mono ? "font-mono" : ""}`}>{value || "—"}</span>
    </div>
  );
}

export default function BillingEntityDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [entity, setEntity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!id) return;
    loadEntity();
  }, [id]);

  async function loadEntity() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/billing-entities/${id}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to load billing entity");
      setEntity(data.data);
      resetForm(data.data);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  function resetForm(ent) {
    const e = ent || entity;
    if (!e) return;
    setForm({
      name: e.name || "",
      addressLine1: e.addressLine1 || "",
      addressLine2: e.addressLine2 || "",
      postalCode: e.postalCode || "",
      city: e.city || "",
      country: e.country || "CH",
      iban: e.iban || "",
      vatNumber: e.vatNumber || "",
      defaultVatRate: String(e.defaultVatRate ?? "7.7"),
    });
  }

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        name: form.name.trim(),
        addressLine1: form.addressLine1.trim(),
        addressLine2: form.addressLine2.trim() || undefined,
        postalCode: form.postalCode.trim(),
        city: form.city.trim(),
        country: form.country.trim() || "CH",
        iban: form.iban.trim(),
        vatNumber: form.vatNumber.trim() || undefined,
        defaultVatRate: form.defaultVatRate ? Number(form.defaultVatRate) : undefined,
      };
      const res = await fetch(`/api/billing-entities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to update billing entity");
      setEntity(data.data);
      resetForm(data.data);
      setMessage("Billing entity updated.");
      setIsEditing(false);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    resetForm();
    setIsEditing(false);
  }

  async function handleDelete() {
    if (!confirm("Delete this billing entity? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/billing-entities/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message || "Failed to delete");
      }
      router.push("/manager/finance?tab=billing-entities");
    } catch (e) {
      setError(String(e?.message || e));
    }
  }

  return (
    <AppShell role="MANAGER">
      <PageShell variant="embedded">
        <div className="mb-3">
          <button
            type="button"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
            onClick={() => router.push("/manager/finance?tab=billing-entities")}
          >
            ← Back to Billing Entities
          </button>
        </div>

        <PageHeader
          title={loading ? "Loading…" : entity?.name || "Billing Entity"}
          subtitle={entity ? (TYPE_LABEL[entity.type] || entity.type) : ""}
          actions={!loading && entity && (
            <div className="flex gap-2">
              {!isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleCancel}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                </>
              )}
            </div>
          )}
        />

        <PageContent>
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
              <button onClick={() => setError("")} className="ml-3 opacity-60 hover:opacity-100">✕</button>
            </div>
          )}
          {message && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {message}
              <button onClick={() => setMessage("")} className="ml-3 opacity-60 hover:opacity-100">✕</button>
            </div>
          )}

          {loading ? (
            <p className="loading-text">Loading billing entity…</p>
          ) : !entity ? (
            <div className="empty-state">
              <p className="empty-state-text">Billing entity not found.</p>
            </div>
          ) : isEditing ? (
            /* ─── Edit mode ─── */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Panel>
                <Section title="General">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                      <input value={TYPE_LABEL[entity.type] || entity.type} disabled
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                      <input value={form.name} onChange={(e) => setField("name", e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" required />
                    </div>
                  </div>
                </Section>
              </Panel>

              <Panel>
                <Section title="Address">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Address line 1</label>
                      <input value={form.addressLine1} onChange={(e) => setField("addressLine1", e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Address line 2</label>
                      <input value={form.addressLine2} onChange={(e) => setField("addressLine2", e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Postal code</label>
                        <input value={form.postalCode} onChange={(e) => setField("postalCode", e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" required />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                        <input value={form.city} onChange={(e) => setField("city", e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" required />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
                        <input value={form.country} onChange={(e) => setField("country", e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                      </div>
                    </div>
                  </div>
                </Section>
              </Panel>

              <Panel>
                <Section title="Banking">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">IBAN</label>
                      <input value={form.iban} onChange={(e) => setField("iban", e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono" required />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">VAT number</label>
                        <input value={form.vatNumber} onChange={(e) => setField("vatNumber", e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Default VAT rate (%)</label>
                        <input type="number" step="0.1" value={form.defaultVatRate}
                          onChange={(e) => setField("defaultVatRate", e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                      </div>
                    </div>
                  </div>
                </Section>
              </Panel>
            </div>
          ) : (
            /* ─── Read-only mode ─── */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Panel>
                <Section title="General">
                  <DetailRow label="Type" value={
                    <span className={"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold " + (TYPE_CLS[entity.type] || "bg-slate-100 text-slate-600")}>
                      {TYPE_LABEL[entity.type] || entity.type}
                    </span>
                  } />
                  <DetailRow label="Name" value={entity.name} />
                  {entity.contractorId && (
                    <DetailRow label="Linked contractor" value={entity.contractorId} />
                  )}
                </Section>
              </Panel>

              <Panel>
                <Section title="Address">
                  <DetailRow label="Address line 1" value={entity.addressLine1} />
                  <DetailRow label="Address line 2" value={entity.addressLine2} />
                  <DetailRow label="Postal code" value={entity.postalCode} />
                  <DetailRow label="City" value={entity.city} />
                  <DetailRow label="Country" value={entity.country} />
                </Section>
              </Panel>

              <Panel>
                <Section title="Banking">
                  <DetailRow label="IBAN" value={entity.iban} mono />
                  <DetailRow label="VAT number" value={entity.vatNumber} />
                  <DetailRow label="Default VAT rate" value={entity.defaultVatRate != null ? `${entity.defaultVatRate}%` : null} />
                </Section>
              </Panel>

              <Panel>
                <Section title="Invoice Settings">
                  <DetailRow label="Next invoice sequence" value={entity.nextInvoiceSequence} />
                  <DetailRow label="Entity ID" value={entity.id} mono />
                </Section>
              </Panel>
            </div>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
