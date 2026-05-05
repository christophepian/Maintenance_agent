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
import ScrollableTabs from "../../../../components/mobile/ScrollableTabs";
import SortableHeader from "../../../../components/SortableHeader";
import { useLocalSort, clientSort } from "../../../../lib/tableUtils";
import { withServerTranslations } from "../../../../lib/i18n";
import { useTranslation } from "next-i18next";

export default function TenantDetailPage() {
  const { t } = useTranslation("manager");
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

  const { sortField: lSortField, sortDir: lSortDir, handleSort: handleLeaseSort } = useLocalSort("startDate", "desc");
  const sortedLeases = useMemo(() => clientSort(leases, lSortField, lSortDir, (l, f) => {
    if (f === "unit") return (l.unit?.unitNumber || "").toLowerCase();
    if (f === "building") return (l.unit?.building?.name || "").toLowerCase();
    if (f === "startDate") return l.startDate || "";
    if (f === "endDate") return l.endDate || "";
    if (f === "status") return l.status || "";
    if (f === "rent") return l.netRentChf ?? 0;
    return "";
  }), [leases, lSortField, lSortDir]);

  const { sortField: iSortField, sortDir: iSortDir, handleSort: handleInvSort } = useLocalSort("dueDate", "desc");
  const sortedInvoices = useMemo(() => clientSort(leaseInvoices, iSortField, iSortDir, (inv, f) => {
    if (f === "invoiceNumber") return inv.invoiceNumber || "";
    if (f === "description") return (inv.description || "").toLowerCase();
    if (f === "amount") return inv.totalAmount ?? 0;
    if (f === "dueDate") return inv.dueDate || "";
    if (f === "status") return inv.status || "";
    return "";
  }), [leaseInvoices, iSortField, iSortDir]);

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
          subtitle={t("manager:peopleTenantsId.prop.tenantProfileAndContactDetails")}
        />
        <PageContent>
          {message ? (
            <div className="notice notice-ok">{message}</div>
          ) : null}
          <ErrorBanner error={error} onDismiss={() => setError("")} />

          {loading ? (
            <p className="loading-text">{t("manager:peopleTenantsId.text.loadingTenant")}</p>
          ) : tenant ? (
            <div className="grid gap-4">
              <ScrollableTabs activeIndex={["Personal information", "Unit", "Documents", "Contracts", "Invoices"].indexOf(activeTab)}>
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
              </ScrollableTabs>

              {activeTab === "Personal information" && (
                <Panel
                  title={t("manager:peopleTenantsId.title.personalInformation")}
                  actions={
                    isEditing ? (
                      <div className="flex items-center gap-2">
                        <button type="button" className="button-secondary text-sm" onClick={handleCancel} disabled={saving}>{t("manager:peopleTenantsId.text.cancel")}</button>
                        <button type="button" className="button-primary text-sm" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
                      </div>
                    ) : (
                      <button type="button" className="button-primary text-sm" onClick={() => setIsEditing(true)} disabled={loading || !tenant}>{t("manager:peopleTenantsId.text.edit")}</button>
                    )
                  }
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("manager:peopleTenantsId.text.name")}</span>
                      {isEditing ? (
                        <input
                          className="input text-sm text-slate-700"
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                          placeholder={t("manager:peopleTenantsId.placeholder.tenantName")}
                        />
                      ) : (
                        <div className="text-sm text-slate-700">{formData.name || "—"}</div>
                      )}
                    </label>
                    <label className="grid gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("manager:peopleTenantsId.text.phone")}</span>
                      {isEditing ? (
                        <input
                          className="input text-sm text-slate-700"
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                          placeholder={t("manager:peopleTenantsId.placeholder.41XxXxxXxxx")}
                        />
                      ) : (
                        <div className="text-sm text-slate-700">{formData.phone || "—"}</div>
                      )}
                    </label>
                    <label className="grid gap-2 sm:col-span-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("manager:peopleTenantsId.text.email")}</span>
                      {isEditing ? (
                        <input
                          className="input text-sm text-slate-700"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                          placeholder={t("manager:peopleTenantsId.placeholder.tenantExampleCom")}
                        />
                      ) : (
                        <div className="text-sm text-slate-700">{formData.email || "—"}</div>
                      )}
                    </label>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div className="min-w-0">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("manager:peopleTenantsId.text.tenantId")}</div>
                      <div className="text-sm text-slate-700 mt-1 break-all">{tenant?.id}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("manager:peopleTenantsId.text.orgId")}</div>
                      <div className="text-sm text-slate-700 mt-1 break-all">{tenant?.orgId || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("manager:peopleTenantsId.text.created")}</div>
                      <div className="text-sm text-slate-700 mt-1">
                        {tenant?.createdAt ? formatDateTime(tenant.createdAt) : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("manager:peopleTenantsId.text.updated")}</div>
                      <div className="text-sm text-slate-700 mt-1">
                        {tenant?.updatedAt ? formatDateTime(tenant.updatedAt) : "—"}
                      </div>
                    </div>
                  </div>
                </Panel>
              )}

              {activeTab === "Unit" && (
                <Panel title={t("manager:peopleTenantsId.title.professional")}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("manager:peopleTenantsId.text.unit")}</div>
                      <div className="text-sm text-slate-700 mt-1">{unitLabel}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("manager:peopleTenantsId.text.buildingId")}</div>
                      <div className="text-sm text-slate-700 mt-1 break-all">
                        {tenant?.unit?.buildingId ? (
                          <Link href={`/manager/buildings/${tenant.unit.buildingId}/financials`} className="cell-link">
                            {tenant.unit.buildingId}
                          </Link>
                        ) : "—"}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("manager:peopleTenantsId.text.unitId")}</div>
                      <div className="text-sm text-slate-700 mt-1 break-all">
                        {(tenant?.unit?.id || tenant?.unitId) ? (
                          <Link href={`/admin-inventory/units/${tenant?.unit?.id || tenant?.unitId}`} className="cell-link">
                            {tenant?.unit?.id || tenant?.unitId}
                          </Link>
                        ) : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("manager:peopleTenantsId.text.floor")}</div>
                      <div className="text-sm text-slate-700 mt-1">{tenant?.unit?.floor || "—"}</div>
                    </div>
                  </div>
                </Panel>
              )}

              {activeTab === "Documents" && (
                applicationId ? (
                  <DocumentsPanel applicationId={applicationId} title={t("manager:peopleTenantsId.title.corroborativeDocuments")} />
                ) : (
                  <Panel title={t("manager:peopleTenantsId.title.corroborativeDocuments")}>
                    <p className="text-sm text-slate-500 py-2">
                      No rental application linked to this tenant.
                    </p>
                  </Panel>
                )
              )}

              {activeTab === "Contracts" && (
                <Panel title={t("manager:peopleTenantsId.title.contracts")} bodyClassName="p-0">
                  {leasesLoading ? (
                    <p className="px-4 py-3 text-sm text-slate-600">{t("manager:peopleTenantsId.text.loadingLeases")}</p>
                  ) : leases.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-slate-500">{t("manager:peopleTenantsId.text.noLeasesFoundForThisTenant")}</p>
                  ) : (
                    <>
                      {/* Mobile cards */}
                      <div className="sm:hidden divide-y divide-slate-100">
                        {sortedLeases.map((l) => (
                          <div key={l.id} className="px-4 py-3 flex flex-col gap-1">
                            <div className="flex items-center justify-between gap-2">
                              <Link href={`/manager/leases/${l.id}`} className="cell-link text-sm font-medium">
                                {l.unit?.unitNumber || l.unitId?.slice(0, 8) || "—"}
                              </Link>
                              <Badge variant={leaseVariant(l.status)} size="sm">{l.status}</Badge>
                            </div>
                            <span className="text-xs text-slate-500">{l.unit?.building?.name || "—"}</span>
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span>{formatDate(l.startDate)} – {formatDate(l.endDate)}</span>
                              <span>{l.netRentChf != null ? `CHF ${l.netRentChf}.-` : "—"}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Desktop table */}
                      <div className="hidden sm:block data-table-wrap">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <SortableHeader label={t("manager:peopleTenantsId.prop.unit")} field="unit" sortField={lSortField} sortDir={lSortDir} onSort={handleLeaseSort} />
                              <SortableHeader label={t("manager:peopleTenantsId.prop.building")} field="building" sortField={lSortField} sortDir={lSortDir} onSort={handleLeaseSort} />
                              <SortableHeader label={t("manager:peopleTenantsId.prop.startDate")} field="startDate" sortField={lSortField} sortDir={lSortDir} onSort={handleLeaseSort} />
                              <SortableHeader label={t("manager:peopleTenantsId.prop.endDate")} field="endDate" sortField={lSortField} sortDir={lSortDir} onSort={handleLeaseSort} />
                              <SortableHeader label={t("manager:peopleTenantsId.prop.status")} field="status" sortField={lSortField} sortDir={lSortDir} onSort={handleLeaseSort} />
                              <SortableHeader label={t("manager:peopleTenantsId.prop.monthlyRent")} field="rent" sortField={lSortField} sortDir={lSortDir} onSort={handleLeaseSort} className="text-right" />
                            </tr>
                          </thead>
                          <tbody>
                            {sortedLeases.map((l) => (
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
                      </div>
                    </>
                  )}
                </Panel>
              )}

              {activeTab === "Invoices" && (
                <Panel title={t("manager:peopleTenantsId.title.invoices")} bodyClassName="p-0">
                  {invoicesLoading ? (
                    <p className="px-4 py-3 text-sm text-slate-600">{t("manager:peopleTenantsId.text.loadingInvoices")}</p>
                  ) : leaseInvoices.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-slate-500">{t("manager:peopleTenantsId.text.noInvoicesFoundForThisTenant")}</p>
                  ) : (
                    <>
                      {/* Mobile cards */}
                      <div className="sm:hidden divide-y divide-slate-100">
                        {sortedInvoices.map((inv) => (
                          <div key={inv.id} className="px-4 py-3 flex flex-col gap-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-slate-800">
                                {inv.invoiceNumber || inv.id?.slice(0, 8) || "—"}
                              </span>
                              <Badge variant={invoiceVariant(inv.status)} size="sm">{inv.status}</Badge>
                            </div>
                            <span className="text-xs text-slate-500">{inv.description || "—"}</span>
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span>Due: {formatDate(inv.dueDate)}</span>
                              <span className="font-mono">{inv.totalAmount != null ? formatChf(inv.totalAmount) : "—"}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Desktop table */}
                      <div className="hidden sm:block data-table-wrap">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <SortableHeader label={t("manager:peopleTenantsId.prop.invoice")} field="invoiceNumber" sortField={iSortField} sortDir={iSortDir} onSort={handleInvSort} />
                              <SortableHeader label={t("manager:peopleTenantsId.prop.description")} field="description" sortField={iSortField} sortDir={iSortDir} onSort={handleInvSort} />
                              <SortableHeader label={t("manager:peopleTenantsId.prop.amount")} field="amount" sortField={iSortField} sortDir={iSortDir} onSort={handleInvSort} className="text-right" />
                              <SortableHeader label={t("manager:peopleTenantsId.prop.dueDate")} field="dueDate" sortField={iSortField} sortDir={iSortDir} onSort={handleInvSort} />
                              <SortableHeader label={t("manager:peopleTenantsId.prop.status")} field="status" sortField={iSortField} sortDir={iSortDir} onSort={handleInvSort} />
                            </tr>
                          </thead>
                          <tbody>
                            {sortedInvoices.map((inv) => (
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
                      </div>
                    </>
                  )}
                </Panel>
              )}
            </div>
          ) : (
            <Panel>
              <p className="text-sm text-slate-600">{t("manager:peopleTenantsId.text.tenantNotFound")}</p>
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

export const getServerSideProps = withServerTranslations(["common","manager"]);
