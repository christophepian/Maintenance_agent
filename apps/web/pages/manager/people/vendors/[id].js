import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../../../components/AppShell";
import PageShell from "../../../../components/layout/PageShell";
import PageHeader from "../../../../components/layout/PageHeader";
import { formatDateTime, formatDate, formatChf } from "../../../../lib/format";
import PageContent from "../../../../components/layout/PageContent";
import Panel from "../../../../components/layout/Panel";
import { ALLOWED_CATEGORIES } from "../../../../lib/categories";
import { authHeaders } from "../../../../lib/api";
import Badge from "../../../../components/ui/Badge";
import ErrorBanner from "../../../../components/ui/ErrorBanner";
import { cn } from "../../../../lib/utils";
import { jobVariant, invoiceVariant } from "../../../../lib/statusVariants";
import ScrollableTabs from "../../../../components/mobile/ScrollableTabs";
import SortableHeader from "../../../../components/SortableHeader";
import { useLocalSort, clientSort } from "../../../../lib/tableUtils";
import { withServerTranslations } from "../../../../lib/i18n";
import { useTranslation } from "next-i18next";

export default function ContractorDetailPage() {
  const { t } = useTranslation("manager");
  const router = useRouter();
  const { id } = router.query;
  const [contractor, setContractor] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    addressLine1: "",
    addressLine2: "",
    postalCode: "",
    city: "",
    country: "CH",
    iban: "",
    vatNumber: "",
    defaultVatRate: "7.7",
    hourlyRate: 50,
    serviceCategories: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const { sortField: jSortField, sortDir: jSortDir, handleSort: handleJobSort } = useLocalSort("createdAt", "desc");
  const { sortField: invSortField, sortDir: invSortDir, handleSort: handleInvSort } = useLocalSort("submittedAt", "desc");
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("personal");
  const TABS = [
    { id: "personal",  label: t("manager:peopleVendorsId.tab.personalInformation") },
    { id: "service",   label: t("manager:peopleVendorsId.tab.serviceDetails") },
    { id: "contracts", label: t("manager:peopleVendorsId.tab.contracts") },
    { id: "invoices",  label: t("manager:peopleVendorsId.tab.invoices") },
  ];
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [contractorInvoices, setContractorInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadContractor();
    loadContractorJobs();
    loadContractorInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadContractorJobs() {
    setJobsLoading(true);
    try {
      const res = await fetch(`/api/jobs?contractorId=${id}`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      setJobs(data?.data || []);
    } catch {} finally {
      setJobsLoading(false);
    }
  }

  async function loadContractorInvoices() {
    setInvoicesLoading(true);
    try {
      const res = await fetch(`/api/invoices?contractorId=${id}`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      setContractorInvoices(data?.data || []);
    } catch {} finally {
      setInvoicesLoading(false);
    }
  }

  async function loadContractor() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/contractors/${id}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || data?.error || "Failed to load contractor");
      }
      const contractorData = data?.data || null;
      setContractor(contractorData);
      setFormData({
        name: contractorData?.name || "",
        phone: contractorData?.phone || "",
        email: contractorData?.email || "",
        addressLine1: contractorData?.addressLine1 || "",
        addressLine2: contractorData?.addressLine2 || "",
        postalCode: contractorData?.postalCode || "",
        city: contractorData?.city || "",
        country: contractorData?.country || "CH",
        iban: contractorData?.iban || "",
        vatNumber: contractorData?.vatNumber || "",
        defaultVatRate: String(contractorData?.defaultVatRate ?? "7.7"),
        hourlyRate: contractorData?.hourlyRate ?? 50,
        serviceCategories: contractorData?.serviceCategories || [],
      });
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  const statusLabel = useMemo(() => {
    if (!contractor) return "—";
    return contractor.isActive ? "Active" : "Deactivated";
  }, [contractor]);

  function toggleCategory(category) {
    setFormData((prev) => {
      const exists = prev.serviceCategories.includes(category);
      return {
        ...prev,
        serviceCategories: exists
          ? prev.serviceCategories.filter((c) => c !== category)
          : [...prev.serviceCategories, category],
      };
    });
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (!formData.serviceCategories.length) {
        throw new Error("Select at least one service category.");
      }
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        addressLine1: formData.addressLine1.trim(),
        addressLine2: formData.addressLine2.trim() || undefined,
        postalCode: formData.postalCode.trim(),
        city: formData.city.trim(),
        country: formData.country.trim() || "CH",
        iban: formData.iban.trim(),
        vatNumber: formData.vatNumber.trim() || undefined,
        defaultVatRate: formData.defaultVatRate ? Number(formData.defaultVatRate) : undefined,
        hourlyRate: Number(formData.hourlyRate || 0),
        serviceCategories: formData.serviceCategories,
      };
      const res = await fetch(`/api/contractors/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || data?.error || "Failed to update contractor");
      }
      setContractor(data?.data || contractor);
      setMessage("Contractor updated successfully.");
      setIsEditing(false);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (!contractor) return;
    setFormData({
      name: contractor?.name || "",
      phone: contractor?.phone || "",
      email: contractor?.email || "",
      addressLine1: contractor?.addressLine1 || "",
      addressLine2: contractor?.addressLine2 || "",
      postalCode: contractor?.postalCode || "",
      city: contractor?.city || "",
      country: contractor?.country || "CH",
      iban: contractor?.iban || "",
      vatNumber: contractor?.vatNumber || "",
      defaultVatRate: String(contractor?.defaultVatRate ?? "7.7"),
      hourlyRate: contractor?.hourlyRate ?? 50,
      serviceCategories: contractor?.serviceCategories || [],
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
            {t("manager:peopleVendorsId.text.back")}
          </button>
        </div>
        <PageHeader
          title={contractor?.name || "Contractor"}
          subtitle={t("manager:peopleVendorsId.prop.contractorProfileAndServiceDetails")}
        />
        <PageContent>
          {message ? (
            <div className="notice notice-ok">{message}</div>
          ) : null}
          <ErrorBanner error={error} onDismiss={() => setError("")} />

          {loading ? (
            <p className="loading-text">{t("manager:peopleVendorsId.text.loadingContractor")}</p>
          ) : contractor ? (
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

              {activeTab === "personal" && (
                <Panel
                  title={t("manager:peopleVendorsId.title.personalInformation")}
                  actions={
                    isEditing ? (
                      <div className="flex items-center gap-2">
                        <button type="button" className="button-secondary text-sm" onClick={handleCancel} disabled={saving}>{t("manager:peopleVendorsId.text.cancel")}</button>
                        <button type="button" className="button-primary text-sm" onClick={handleSave} disabled={saving}>{saving ? t("manager:peopleVendorsId.text.saving") : t("manager:peopleVendorsId.text.save")}</button>
                      </div>
                    ) : (
                      <button type="button" className="button-primary text-sm" onClick={() => setIsEditing(true)} disabled={loading || !contractor}>{t("manager:peopleVendorsId.text.edit")}</button>
                    )
                  }
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("manager:peopleVendorsId.text.name")}</span>
                      {isEditing ? (
                        <input
                          className="input text-sm text-slate-700"
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                          placeholder={t("manager:peopleVendorsId.placeholder.contractorName")}
                        />
                      ) : (
                        <div className="text-sm text-slate-700">{formData.name || "—"}</div>
                      )}
                    </label>
                    <label className="grid gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("manager:peopleVendorsId.text.phone")}</span>
                      {isEditing ? (
                        <input
                          className="input text-sm text-slate-700"
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                          placeholder={t("manager:peopleVendorsId.placeholder.41XxXxxXxxx")}
                        />
                      ) : (
                        <div className="text-sm text-slate-700">{formData.phone || "—"}</div>
                      )}
                    </label>
                    <label className="grid gap-2 sm:col-span-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("manager:peopleVendorsId.text.email")}</span>
                      {isEditing ? (
                        <input
                          className="input text-sm text-slate-700"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                          placeholder={t("manager:peopleVendorsId.placeholder.contractorExampleCom")}
                        />
                      ) : (
                        <div className="text-sm text-slate-700">{formData.email || "—"}</div>
                      )}
                    </label>
                    <label className="grid gap-2 sm:col-span-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("manager:peopleVendorsId.text.addressLine1")}</span>
                      {isEditing ? (
                        <input
                          className="input text-sm text-slate-700"
                          type="text"
                          value={formData.addressLine1}
                          onChange={(e) => setFormData((prev) => ({ ...prev, addressLine1: e.target.value }))}
                          placeholder={t("manager:peopleVendorsId.placeholder.streetAndNumber")}
                        />
                      ) : (
                        <div className="text-sm text-slate-700">{formData.addressLine1 || "—"}</div>
                      )}
                    </label>
                    <label className="grid gap-2 sm:col-span-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("manager:peopleVendorsId.text.addressLine2")}</span>
                      {isEditing ? (
                        <input
                          className="input text-sm text-slate-700"
                          type="text"
                          value={formData.addressLine2}
                          onChange={(e) => setFormData((prev) => ({ ...prev, addressLine2: e.target.value }))}
                          placeholder={t("manager:peopleVendorsId.placeholder.suiteFloorEtc")}
                        />
                      ) : (
                        <div className="text-sm text-slate-700">{formData.addressLine2 || "—"}</div>
                      )}
                    </label>
                    <label className="grid gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("manager:peopleVendorsId.text.postalCode")}</span>
                      {isEditing ? (
                        <input
                          className="input text-sm text-slate-700"
                          type="text"
                          value={formData.postalCode}
                          onChange={(e) => setFormData((prev) => ({ ...prev, postalCode: e.target.value }))}
                        />
                      ) : (
                        <div className="text-sm text-slate-700">{formData.postalCode || "—"}</div>
                      )}
                    </label>
                    <label className="grid gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("manager:peopleVendorsId.text.city")}</span>
                      {isEditing ? (
                        <input
                          className="input text-sm text-slate-700"
                          type="text"
                          value={formData.city}
                          onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                        />
                      ) : (
                        <div className="text-sm text-slate-700">{formData.city || "—"}</div>
                      )}
                    </label>
                    <label className="grid gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("manager:peopleVendorsId.text.country")}</span>
                      {isEditing ? (
                        <input
                          className="input text-sm text-slate-700"
                          type="text"
                          value={formData.country}
                          onChange={(e) => setFormData((prev) => ({ ...prev, country: e.target.value }))}
                        />
                      ) : (
                        <div className="text-sm text-slate-700">{formData.country || "—"}</div>
                      )}
                    </label>
                    <label className="grid gap-2 sm:col-span-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("manager:peopleVendorsId.text.iban")}</span>
                      {isEditing ? (
                        <input
                          className="input text-sm text-slate-700"
                          type="text"
                          value={formData.iban}
                          onChange={(e) => setFormData((prev) => ({ ...prev, iban: e.target.value }))}
                          placeholder={t("manager:peopleVendorsId.placeholder.cH9300762011623852957")}
                        />
                      ) : (
                        <div className="text-sm text-slate-700">{formData.iban || "—"}</div>
                      )}
                    </label>
                    <label className="grid gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("manager:peopleVendorsId.text.vATNumber")}</span>
                      {isEditing ? (
                        <input
                          className="input text-sm text-slate-700"
                          type="text"
                          value={formData.vatNumber}
                          onChange={(e) => setFormData((prev) => ({ ...prev, vatNumber: e.target.value }))}
                          placeholder={t("manager:peopleVendorsId.placeholder.cHE123456789")}
                        />
                      ) : (
                        <div className="text-sm text-slate-700">{formData.vatNumber || "—"}</div>
                      )}
                    </label>
                    <label className="grid gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("manager:peopleVendorsId.text.defaultVatRate")}</span>
                      {isEditing ? (
                        <input
                          className="input text-sm text-slate-700"
                          type="number"
                          step="0.1"
                          value={formData.defaultVatRate}
                          onChange={(e) => setFormData((prev) => ({ ...prev, defaultVatRate: e.target.value }))}
                        />
                      ) : (
                        <div className="text-sm text-slate-700">{formData.defaultVatRate || "—"}</div>
                      )}
                    </label>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("manager:peopleVendorsId.text.contractorId")}</div>
                      <div className="text-sm text-slate-700 mt-1">{contractor?.id}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("manager:peopleVendorsId.text.orgId")}</div>
                      <div className="text-sm text-slate-700 mt-1">{contractor?.orgId || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("manager:peopleVendorsId.text.created")}</div>
                      <div className="text-sm text-slate-700 mt-1">
                        {contractor?.createdAt ? formatDateTime(contractor.createdAt) : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("manager:peopleVendorsId.text.updated")}</div>
                      <div className="text-sm text-slate-700 mt-1">
                        {contractor?.updatedAt ? formatDateTime(contractor.updatedAt) : "—"}
                      </div>
                    </div>
                  </div>
                </Panel>
              )}

              {activeTab === "service" && (
                <Panel
                  title={t("manager:peopleVendorsId.title.serviceDetails")}
                  actions={
                    isEditing ? (
                      <div className="flex items-center gap-2">
                        <button type="button" className="button-secondary text-sm" onClick={handleCancel} disabled={saving}>{t("manager:peopleVendorsId.text.cancel")}</button>
                        <button type="button" className="button-primary text-sm" onClick={handleSave} disabled={saving}>{saving ? t("manager:peopleVendorsId.text.saving") : t("manager:peopleVendorsId.text.save")}</button>
                      </div>
                    ) : (
                      <button type="button" className="button-primary text-sm" onClick={() => setIsEditing(true)} disabled={loading || !contractor}>{t("manager:peopleVendorsId.text.edit")}</button>
                    )
                  }
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("manager:peopleVendorsId.text.hourlyRate")}</div>
                      {isEditing ? (
                        <input
                          className="input text-sm text-slate-700 mt-2"
                          type="number"
                          min="10"
                          max="500"
                          value={formData.hourlyRate}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              hourlyRate: parseInt(e.target.value || "0", 10),
                            }))
                          }
                        />
                      ) : (
                        <div className="text-sm text-slate-700 mt-1">CHF {formData.hourlyRate}/hr</div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("manager:peopleVendorsId.text.status")}</div>
                      <div className="text-sm text-slate-700 mt-1">{statusLabel}</div>
                    </div>
                    <div className="sm:col-span-2">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("manager:peopleVendorsId.text.serviceCategories")}</div>
                      {isEditing ? (
                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {ALLOWED_CATEGORIES.map((cat) => (
                            <label key={cat} className="flex items-center gap-2 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={formData.serviceCategories.includes(cat)}
                                onChange={() => toggleCategory(cat)}
                              />
                              {cat}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-slate-700 mt-1">
                          {formData.serviceCategories.length
                            ? formData.serviceCategories.join(", ")
                            : "—"}
                        </div>
                      )}
                    </div>
                  </div>
                </Panel>
              )}

              {activeTab === "contracts" && (
                <Panel title={t("manager:peopleVendorsId.title.contracts")}>
                  {jobsLoading ? (
                    <p className="text-sm text-slate-600">{t("manager:peopleVendorsId.text.loadingJobs")}</p>
                  ) : jobs.length === 0 ? (
                    <p className="text-sm text-slate-500">{t("manager:peopleVendorsId.text.noJobsFoundForThisContractor")}</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-table-border">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <SortableHeader label={t("manager:peopleVendorsId.prop.job")} field="jobId" sortField={jSortField} sortDir={jSortDir} onSort={handleJobSort} />
                            <SortableHeader label={t("manager:peopleVendorsId.prop.requestTitle")} field="request" sortField={jSortField} sortDir={jSortDir} onSort={handleJobSort} />
                            <SortableHeader label={t("manager:peopleVendorsId.prop.building")} field="building" sortField={jSortField} sortDir={jSortDir} onSort={handleJobSort} />
                            <SortableHeader label={t("manager:peopleVendorsId.prop.status")} field="status" sortField={jSortField} sortDir={jSortDir} onSort={handleJobSort} />
                            <SortableHeader label={t("manager:peopleVendorsId.prop.createdDate")} field="createdAt" sortField={jSortField} sortDir={jSortDir} onSort={handleJobSort} />
                          </tr>
                        </thead>
                        <tbody>
                          {[...jobs].sort((a, b) => {
                            let va = "", vb = "";
                            if (jSortField === "status") { va = a.status || ""; vb = b.status || ""; }
                            else if (jSortField === "building") { va = a.request?.unit?.building?.name || ""; vb = b.request?.unit?.building?.name || ""; }
                            else if (jSortField === "request") { va = a.request?.description || ""; vb = b.request?.description || ""; }
                            else { va = a.createdAt || ""; vb = b.createdAt || ""; }
                            return jSortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
                          }).map((job) => (
                            <tr key={job.id}>
                              <td>
                                <Link href="/manager/requests" className="cell-link">
                                  {job.id?.slice(0, 8)}
                                </Link>
                              </td>
                              <td>{job.request?.description?.slice(0, 60) || "—"}{job.request?.description?.length > 60 ? "…" : ""}</td>
                              <td>{job.request?.unit?.building?.name || "—"}</td>
                              <td>
                                <Badge variant={jobVariant(job.status)} size="sm">
                                  {job.status}
                                </Badge>
                              </td>
                              <td>{formatDate(job.createdAt)}</td>
                            </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Panel>
              )}

              {activeTab === "invoices" && (
                <Panel title={t("manager:peopleVendorsId.title.invoices")}>
                  {invoicesLoading ? (
                    <p className="text-sm text-slate-600">{t("manager:peopleVendorsId.text.loadingInvoices")}</p>
                  ) : contractorInvoices.length === 0 ? (
                    <p className="text-sm text-slate-500">{t("manager:peopleVendorsId.text.noInvoicesFoundForThisContractor")}</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-table-border">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <SortableHeader label={t("manager:peopleVendorsId.prop.invoice")} field="invoiceNumber" sortField={invSortField} sortDir={invSortDir} onSort={handleInvSort} />
                            <SortableHeader label={t("manager:peopleVendorsId.prop.job")} field="jobId" sortField={invSortField} sortDir={invSortDir} onSort={handleInvSort} />
                            <SortableHeader label={t("manager:peopleVendorsId.prop.amount")} field="amount" sortField={invSortField} sortDir={invSortDir} onSort={handleInvSort} className="text-right" />
                            <SortableHeader label={t("manager:peopleVendorsId.prop.status")} field="status" sortField={invSortField} sortDir={invSortDir} onSort={handleInvSort} />
                            <SortableHeader label={t("manager:peopleVendorsId.prop.submittedDate")} field="submittedAt" sortField={invSortField} sortDir={invSortDir} onSort={handleInvSort} />
                          </tr>
                        </thead>
                        <tbody>
                          {[...contractorInvoices].sort((a, b) => {
                            let va = "", vb = "";
                            if (invSortField === "status") { va = a.status || ""; vb = b.status || ""; }
                            else if (invSortField === "amount") { return invSortDir === "asc" ? (a.totalAmount ?? 0) - (b.totalAmount ?? 0) : (b.totalAmount ?? 0) - (a.totalAmount ?? 0); }
                            else if (invSortField === "jobId") { va = a.jobId || ""; vb = b.jobId || ""; }
                            else if (invSortField === "invoiceNumber") { va = a.invoiceNumber || ""; vb = b.invoiceNumber || ""; }
                            else { va = a.submittedAt || ""; vb = b.submittedAt || ""; }
                            return invSortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
                          }).map((inv) => (
                            <tr key={inv.id}>
                              <td>{inv.invoiceNumber || inv.id?.slice(0, 8) || "—"}</td>
                              <td>
                                <Link href="/manager/requests" className="cell-link">
                                  {inv.jobId?.slice(0, 8) || "—"}
                                </Link>
                              </td>
                              <td className="text-right">
                                {inv.totalAmount != null ? formatChf(inv.totalAmount) : "—"}
                              </td>
                              <td>
                                <Badge variant={invoiceVariant(inv.status)} size="sm">
                                  {inv.status}
                                </Badge>
                              </td>
                              <td>{formatDate(inv.submittedAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Panel>
              )}
            </div>
          ) : (
            <Panel>
              <p className="text-sm text-slate-600">{t("manager:peopleVendorsId.text.contractorNotFound")}</p>
              <div className="mt-3">
                <button type="button" className="button-secondary" onClick={() => router.back()}>
                  {t("manager:peopleVendorsId.text.goBack")}
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
