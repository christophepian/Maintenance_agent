import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../../components/AppShell";
import PageShell from "../../../../components/layout/PageShell";
import PageHeader from "../../../../components/layout/PageHeader";
import { formatDateTime } from "../../../../lib/format";
import PageContent from "../../../../components/layout/PageContent";
import Panel from "../../../../components/layout/Panel";

export default function TenantDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [tenant, setTenant] = useState(null);
  const [formData, setFormData] = useState({ name: "", phone: "", email: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("Personal information");

  function authHeaders() {
    if (typeof window === "undefined") return {};
    const token = localStorage.getItem("authToken");
    if (token) return { Authorization: `Bearer ${token}` };
    const role = localStorage.getItem("role") || "MANAGER";
    return {
      "x-dev-role": role,
      "x-dev-org-id": "default-org",
      "x-dev-user-id": "dev-user",
      "x-dev-email": "dev@local",
    };
  }

  useEffect(() => {
    if (!id) return;
    loadTenant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadTenant() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/tenants/${id}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || data?.error || "Failed to load tenant");
      }
      const tenantData = data?.data || null;
      setTenant(tenantData);
      setFormData({
        name: tenantData?.name || "",
        phone: tenantData?.phone || "",
        email: tenantData?.email || "",
      });
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  const unitLabel = useMemo(() => {
    if (!tenant) return "—";
    return tenant?.unit?.unitNumber || tenant?.unitId || "—";
  }, [tenant]);

  async function handleSave() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        ...(formData.name.trim() ? { name: formData.name.trim() } : { name: "" }),
        ...(formData.phone.trim() ? { phone: formData.phone.trim() } : {}),
        ...(formData.email.trim() ? { email: formData.email.trim() } : { email: "" }),
      };
      const res = await fetch(`/api/tenants/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || data?.error || "Failed to update tenant");
      }
      setTenant(data?.data || tenant);
      setMessage("Tenant updated successfully.");
      setIsEditing(false);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (!tenant) return;
    setFormData({
      name: tenant?.name || "",
      phone: tenant?.phone || "",
      email: tenant?.email || "",
    });
    setIsEditing(false);
  }

  return (
    <AppShell role="MANAGER">
      <PageShell variant="embedded">
        <div className="mb-3">
            <button
              type="button"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
              onClick={() => router.back()}
            >
              ← Back
            </button>
        </div>
        <PageHeader
          title={tenant?.name || "Tenant"}
          subtitle="Tenant profile and contact details."
          actions={(
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={handleCancel}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="button-primary"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="button-primary"
                  onClick={() => setIsEditing(true)}
                  disabled={loading || !tenant}
                >
                  Edit
                </button>
              )}
            </div>
          )}
        />
        <PageContent>
          {message ? (
            <Panel>
              <div className="text-sm text-slate-700">{message}</div>
            </Panel>
          ) : null}
          {error ? (
            <Panel>
              <div className="text-sm text-red-600">{error}</div>
            </Panel>
          ) : null}

          {loading ? (
            <Panel>
              <p className="text-sm text-slate-600">Loading tenant...</p>
            </Panel>
          ) : tenant ? (
            <div className="grid gap-4">
              <div className="flex flex-wrap gap-2">
                {["Personal information", "Unit", "Contracts", "Invoices"].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={
                      "rounded-full border px-3 py-1.5 text-xs font-semibold transition " +
                      (activeTab === tab
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900")
                    }
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {activeTab === "Personal information" && (
                <Panel title="Personal information">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</span>
                      {isEditing ? (
                        <input
                          className="input text-sm text-slate-700"
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                          placeholder="Tenant name"
                        />
                      ) : (
                        <div className="text-sm text-slate-700">{formData.name || "—"}</div>
                      )}
                    </label>
                    <label className="grid gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</span>
                      {isEditing ? (
                        <input
                          className="input text-sm text-slate-700"
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                          placeholder="+41 XX XXX XXXX"
                        />
                      ) : (
                        <div className="text-sm text-slate-700">{formData.phone || "—"}</div>
                      )}
                    </label>
                    <label className="grid gap-2 sm:col-span-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</span>
                      {isEditing ? (
                        <input
                          className="input text-sm text-slate-700"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                          placeholder="tenant@example.com"
                        />
                      ) : (
                        <div className="text-sm text-slate-700">{formData.email || "—"}</div>
                      )}
                    </label>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tenant ID</div>
                      <div className="text-sm text-slate-700 mt-1">{tenant?.id}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Org ID</div>
                      <div className="text-sm text-slate-700 mt-1">{tenant?.orgId || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Created</div>
                      <div className="text-sm text-slate-700 mt-1">
                        {tenant?.createdAt ? formatDateTime(tenant.createdAt) : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Updated</div>
                      <div className="text-sm text-slate-700 mt-1">
                        {tenant?.updatedAt ? formatDateTime(tenant.updatedAt) : "—"}
                      </div>
                    </div>
                  </div>
                </Panel>
              )}

              {activeTab === "Unit" && (
                <Panel title="Professional">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unit</div>
                      <div className="text-sm text-slate-700 mt-1">{unitLabel}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Building ID</div>
                      <div className="text-sm text-slate-700 mt-1">{tenant?.unit?.buildingId || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unit ID</div>
                      <div className="text-sm text-slate-700 mt-1">{tenant?.unit?.id || tenant?.unitId || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Floor</div>
                      <div className="text-sm text-slate-700 mt-1">{tenant?.unit?.floor || "—"}</div>
                    </div>
                  </div>
                </Panel>
              )}

              {activeTab === "Contracts" && (
                <Panel title="Contracts">
                  <div className="text-sm text-slate-600">Empty for now.</div>
                </Panel>
              )}

              {activeTab === "Invoices" && (
                <Panel title="Invoices">
                  <div className="text-sm text-slate-600">Empty for now.</div>
                </Panel>
              )}
            </div>
          ) : (
            <Panel>
              <p className="text-sm text-slate-600">Tenant not found.</p>
              <div className="mt-3">
                <button type="button" className="button-secondary" onClick={() => router.back()}>
                  Go back
                </button>
              </div>
            </Panel>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
