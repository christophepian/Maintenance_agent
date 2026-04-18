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

export default function ContractorDetailPage() {
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
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("Personal information");
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
            ← Back
          </button>
        </div>
        <PageHeader
          title={contractor?.name || "Contractor"}
          subtitle="Contractor profile and service details."
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
                  disabled={loading || !contractor}
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
            <p className="loading-text">Loading contractor…</p>
          ) : contractor ? (
            <div className="grid gap-4">
              <div className="tab-strip">
                {["Personal information", "Service details", "Contracts", "Invoices"].map((tab) => (
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
                          placeholder="Contractor name"
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
                          placeholder="contractor@example.com"
                        />
                      ) : (
                        <div className="text-sm text-slate-700">{formData.email || "—"}</div>
                      )}
                    </label>
                    <label className="grid gap-2 sm:col-span-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Address line 1</span>
                      {isEditing ? (
                        <input
                          className="input text-sm text-slate-700"
                          type="text"
                          value={formData.addressLine1}
                          onChange={(e) => setFormData((prev) => ({ ...prev, addressLine1: e.target.value }))}
                          placeholder="Street and number"
                        />
                      ) : (
                        <div className="text-sm text-slate-700">{formData.addressLine1 || "—"}</div>
                      )}
                    </label>
                    <label className="grid gap-2 sm:col-span-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Address line 2</span>
                      {isEditing ? (
                        <input
                          className="input text-sm text-slate-700"
                          type="text"
                          value={formData.addressLine2}
                          onChange={(e) => setFormData((prev) => ({ ...prev, addressLine2: e.target.value }))}
                          placeholder="Suite, floor, etc."
                        />
                      ) : (
                        <div className="text-sm text-slate-700">{formData.addressLine2 || "—"}</div>
                      )}
                    </label>
                    <label className="grid gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Postal code</span>
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
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">City</span>
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
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Country</span>
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
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">IBAN</span>
                      {isEditing ? (
                        <input
                          className="input text-sm text-slate-700"
                          type="text"
                          value={formData.iban}
                          onChange={(e) => setFormData((prev) => ({ ...prev, iban: e.target.value }))}
                          placeholder="CH93 0076 2011 6238 5295 7"
                        />
                      ) : (
                        <div className="text-sm text-slate-700">{formData.iban || "—"}</div>
                      )}
                    </label>
                    <label className="grid gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">VAT number</span>
                      {isEditing ? (
                        <input
                          className="input text-sm text-slate-700"
                          type="text"
                          value={formData.vatNumber}
                          onChange={(e) => setFormData((prev) => ({ ...prev, vatNumber: e.target.value }))}
                          placeholder="CHE-123.456.789"
                        />
                      ) : (
                        <div className="text-sm text-slate-700">{formData.vatNumber || "—"}</div>
                      )}
                    </label>
                    <label className="grid gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Default VAT rate (%)</span>
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
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Contractor ID</div>
                      <div className="text-sm text-slate-700 mt-1">{contractor?.id}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Org ID</div>
                      <div className="text-sm text-slate-700 mt-1">{contractor?.orgId || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Created</div>
                      <div className="text-sm text-slate-700 mt-1">
                        {contractor?.createdAt ? formatDateTime(contractor.createdAt) : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Updated</div>
                      <div className="text-sm text-slate-700 mt-1">
                        {contractor?.updatedAt ? formatDateTime(contractor.updatedAt) : "—"}
                      </div>
                    </div>
                  </div>
                </Panel>
              )}

              {activeTab === "Service details" && (
                <Panel title="Service details">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Hourly rate</div>
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
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Status</div>
                      <div className="text-sm text-slate-700 mt-1">{statusLabel}</div>
                    </div>
                    <div className="sm:col-span-2">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Service categories</div>
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

              {activeTab === "Contracts" && (
                <Panel title="Contracts">
                  {jobsLoading ? (
                    <p className="text-sm text-slate-600">Loading jobs…</p>
                  ) : jobs.length === 0 ? (
                    <p className="text-sm text-slate-500">No jobs found for this contractor.</p>
                  ) : (
                      <table className="inline-table">
                        <thead>
                          <tr>
                            <th>Job #</th>
                            <th>Request title</th>
                            <th>Building</th>
                            <th>Status</th>
                            <th>Created date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {jobs.map((job) => (
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
                  )}
                </Panel>
              )}

              {activeTab === "Invoices" && (
                <Panel title="Invoices">
                  {invoicesLoading ? (
                    <p className="text-sm text-slate-600">Loading invoices…</p>
                  ) : contractorInvoices.length === 0 ? (
                    <p className="text-sm text-slate-500">No invoices found for this contractor.</p>
                  ) : (
                      <table className="inline-table">
                        <thead>
                          <tr>
                            <th>Invoice #</th>
                            <th>Job #</th>
                            <th className="text-right">Amount</th>
                            <th>Status</th>
                            <th>Submitted date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {contractorInvoices.map((inv) => (
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
                  )}
                </Panel>
              )}
            </div>
          ) : (
            <Panel>
              <p className="text-sm text-slate-600">Contractor not found.</p>
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
