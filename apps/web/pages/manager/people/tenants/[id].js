import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../../../components/AppShell";
import PageShell from "../../../../components/layout/PageShell";
import PageHeader from "../../../../components/layout/PageHeader";
import { formatDateTime, formatDate, formatChf } from "../../../../lib/format";
import PageContent from "../../../../components/layout/PageContent";
import Panel from "../../../../components/layout/Panel";
import DocumentsPanel from "../../../../components/DocumentsPanel";
import { authHeaders } from "../../../../lib/api";
import Badge from "../../../../components/ui/Badge";
import ErrorBanner from "../../../../components/ui/ErrorBanner";
import { cn } from "../../../../lib/utils";
import { leaseVariant, invoiceVariant } from "../../../../lib/statusVariants";

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
  const [applicationId, setApplicationId] = useState(null);
  const [leases, setLeases] = useState([]);
  const [leasesLoading, setLeasesLoading] = useState(false);
  const [leaseInvoices, setLeaseInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

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
      // Fetch leases for the tenant's unit to find applicationId
      if (tenantData?.unitId) {
        try {
          setLeasesLoading(true);
          const leasesRes = await fetch(`/api/leases?unitId=${tenantData.unitId}`, { headers: authHeaders() });
          const leasesData = await leasesRes.json().catch(() => ({}));
          const fetchedLeases = (leasesData?.data || []).filter((l) => !l.isTemplate);
          setLeases(fetchedLeases);
          const leaseWithApp = fetchedLeases.find((l) => l.applicationId);
          if (leaseWithApp) setApplicationId(leaseWithApp.applicationId);
          // Fetch invoices for each lease
          setInvoicesLoading(true);
          const allInvoices = [];
          for (const lease of fetchedLeases) {
            try {
              const invRes = await fetch(`/api/leases/${lease.id}/invoices`, { headers: authHeaders() });
              const invData = await invRes.json().catch(() => ({}));
              if (invData?.data) allInvoices.push(...invData.data);
            } catch {}
          }
          setLeaseInvoices(allInvoices);
          setInvoicesLoading(false);
          setLeasesLoading(false);
        } catch {
          setLeasesLoading(false);
          setInvoicesLoading(false);
        }
      }
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
            <div className="notice notice-ok">{message}</div>
          ) : null}
          <ErrorBanner error={error} onDismiss={() => setError("")} />

          {loading ? (
            <p className="loading-text">Loading tenant…</p>
          ) : tenant ? (
            <div className="grid gap-4">
              <div className="tab-strip">
                {["Personal information", "Unit", "Documents", "Contracts", "Invoices"].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={activeTab === tab ? "tab-btn-active" : "tab-btn"}
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
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Name</span>
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
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Phone</span>
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
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Email</span>
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
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Tenant ID</div>
                      <div className="text-sm text-slate-700 mt-1">{tenant?.id}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Org ID</div>
                      <div className="text-sm text-slate-700 mt-1">{tenant?.orgId || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Created</div>
                      <div className="text-sm text-slate-700 mt-1">
                        {tenant?.createdAt ? formatDateTime(tenant.createdAt) : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Updated</div>
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
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Unit</div>
                      <div className="text-sm text-slate-700 mt-1">{unitLabel}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Building ID</div>
                      <div className="text-sm text-slate-700 mt-1">
                        {tenant?.unit?.buildingId ? (
                          <Link href={`/manager/buildings/${tenant.unit.buildingId}/financials`} className="cell-link">
                            {tenant.unit.buildingId}
                          </Link>
                        ) : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Unit ID</div>
                      <div className="text-sm text-slate-700 mt-1">
                        {(tenant?.unit?.id || tenant?.unitId) ? (
                          <Link href={`/admin-inventory/units/${tenant?.unit?.id || tenant?.unitId}`} className="cell-link">
                            {tenant?.unit?.id || tenant?.unitId}
                          </Link>
                        ) : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Floor</div>
                      <div className="text-sm text-slate-700 mt-1">{tenant?.unit?.floor || "—"}</div>
                    </div>
                  </div>
                </Panel>
              )}

              {activeTab === "Documents" && (
                applicationId ? (
                  <DocumentsPanel applicationId={applicationId} title="Corroborative Documents" />
                ) : (
                  <Panel title="Corroborative Documents">
                    <p className="text-sm text-slate-500 py-2">
                      No rental application linked to this tenant.
                    </p>
                  </Panel>
                )
              )}

              {activeTab === "Contracts" && (
                <Panel title="Contracts">
                  {leasesLoading ? (
                    <p className="text-sm text-slate-600">Loading leases…</p>
                  ) : leases.length === 0 ? (
                    <p className="text-sm text-slate-500">No leases found for this tenant.</p>
                  ) : (
                      <table className="inline-table">
                        <thead>
                          <tr>
                            <th>Unit</th>
                            <th>Building</th>
                            <th>Start date</th>
                            <th>End date</th>
                            <th>Status</th>
                            <th className="text-right">Monthly rent</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leases.map((l) => (
                            <tr key={l.id}>
                              <td>
                                <Link href={`/manager/leases/${l.id}`} className="cell-link">
                                  {l.unit?.unitNumber || l.unitId?.slice(0, 8) || "—"}
                                </Link>
                              </td>
                              <td>{l.unit?.building?.name || "—"}</td>
                              <td>{formatDate(l.startDate)}</td>
                              <td>{formatDate(l.endDate)}</td>
                              <td>
                                <Badge variant={leaseVariant(l.status)} size="sm">
                                  {l.status}
                                </Badge>
                              </td>
                              <td className="text-right">
                                {l.netRentChf != null ? `CHF ${l.netRentChf}.-` : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                  )}
                </Panel>
              )}

              {activeTab === "Invoices" && (
                <Panel title="Invoices">
                  {invoicesLoading ? (
                    <p className="text-sm text-slate-600">Loading invoices…</p>
                  ) : leaseInvoices.length === 0 ? (
                    <p className="text-sm text-slate-500">No invoices found for this tenant.</p>
                  ) : (
                      <table className="inline-table">
                        <thead>
                          <tr>
                            <th>Invoice #</th>
                            <th>Description</th>
                            <th className="text-right">Amount</th>
                            <th>Due date</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leaseInvoices.map((inv) => (
                            <tr key={inv.id}>
                              <td>{inv.invoiceNumber || inv.id?.slice(0, 8) || "—"}</td>
                              <td>{inv.description || "—"}</td>
                              <td className="text-right">
                                {inv.totalAmount != null ? formatChf(inv.totalAmount) : "—"}
                              </td>
                              <td>{formatDate(inv.dueDate)}</td>
                              <td>
                                <Badge variant={invoiceVariant(inv.status)} size="sm">
                                  {inv.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                  )}
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
