import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import { formatDate } from "../../../lib/format";
import PageContent from "../../../components/layout/PageContent";
import Section from "../../../components/layout/Section";
import { authHeaders } from "../../../lib/api";
import UndoToast, { useUndoToast } from "../../../components/ui/UndoToast";
import ConfigurableTable from "../../../components/ConfigurableTable";
import { clientSort, useLocalSort } from "../../../lib/tableUtils";
import SortableHeader from "../../../components/SortableHeader";
import Badge from "../../../components/ui/Badge";
import { leaseVariant } from "../../../lib/statusVariants";
import { cn } from "../../../lib/utils";
import ScrollableTabs from "../../../components/mobile/ScrollableTabs";
import { withTranslations } from "../../../lib/i18n";
import { useTranslation } from "next-i18next";

// Tabs: Active (ACTIVE+SIGNED), Draft (DRAFT), Submitted (READY_TO_SIGN), Archive (CANCELLED+TERMINATED)
const LEASE_TABS = [
  { key: "ACTIVE",     statuses: ["ACTIVE", "SIGNED"] },
  { key: "DRAFTS",     statuses: ["DRAFT"] },
  { key: "SUBMITTED",  statuses: ["READY_TO_SIGN"] },
  { key: "TEMPLATES",  statuses: null },
  { key: "ARCHIVE",    statuses: ["CANCELLED", "TERMINATED"] },
];

const TAB_KEYS = ["active", "drafts", "submitted", "templates", "archive"];

// ─── Business-day countdown helpers ────────────────────────────────────────

/** Add N business days (Mon–Fri) to a Date. */
function addBusinessDays(date, days) {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return result;
}

/** Count business days remaining from today until expiryDate (negative = past). */
function businessDaysUntil(expiryDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(expiryDate);
  target.setHours(0, 0, 0, 0);

  if (target < today) {
    // Already expired — count how many business days ago
    let count = 0;
    const cursor = new Date(target);
    while (cursor < today) {
      cursor.setDate(cursor.getDate() + 1);
      const d = cursor.getDay();
      if (d !== 0 && d !== 6) count++;
    }
    return -count;
  }

  let count = 0;
  const cursor = new Date(today);
  while (cursor < target) {
    cursor.setDate(cursor.getDate() + 1);
    const d = cursor.getDay();
    if (d !== 0 && d !== 6) count++;
  }
  return count;
}

function CountdownBadge({ sentForSignatureAt }) {
  const { t } = useTranslation("manager");
  if (!sentForSignatureAt) {
    return <span className="inline-block px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-500">{t("manager:leasesIndex.text.sentDateUnavailable")}</span>;
  }
  const expiry = addBusinessDays(new Date(sentForSignatureAt), 5);
  const remaining = businessDaysUntil(expiry);

  if (remaining < 0) {
    const n = Math.abs(remaining);
    return (
      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
        {t(n === 1 ? "manager:leasesIndex.text.expiredAgo" : "manager:leasesIndex.text.expiredAgo_plural", { count: n })}
      </span>
    );
  }
  if (remaining === 0) {
    return <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">{t("manager:leasesIndex.text.dueToday")}</span>;
  }
  return (
    <span className={cn("inline-block px-2 py-0.5 rounded text-xs font-medium", remaining <= 1 ? "bg-orange-100 text-orange-700" : "bg-blue-50 text-blue-700")}>
      {t(remaining === 1 ? "manager:leasesIndex.text.daysLeft" : "manager:leasesIndex.text.daysLeft_plural", { count: remaining })}
    </span>
  );
}

function isExpired(sentForSignatureAt) {
  if (!sentForSignatureAt) return false;
  const expiry = addBusinessDays(new Date(sentForSignatureAt), 5);
  return new Date() > expiry;
}

// ---------------------------------------------------------------------------
// Template helpers
// ---------------------------------------------------------------------------

function templateFieldExtractor(t, field) {
  switch (field) {
    case "templateName": return (t.templateName || "").toLowerCase();
    case "building":     return (t.unit?.building?.name || "Global").toLowerCase();
    case "landlord":     return (t.landlordName || "").toLowerCase();
    case "createdAt":    return t.createdAt || "";
    default:             return "";
  }
}

function ActionDropdown({ actions }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);
  return (
    <div ref={ref} className="relative inline-block text-left">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition">
        Actions ▾
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-48 origin-top-right rounded-lg border border-slate-200 bg-white shadow-lg ring-1 ring-black/5">
          <div className="py-1">
            {actions.map((a, i) => (
              <button key={i} type="button"
                onClick={() => { setOpen(false); a.onClick(); }}
                className={"w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition " + (a.className || "text-slate-700")}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function buildTemplateColumns(tr, router, handleDeleteTemplate) {
  return [
    { id: "templateName", label: tr("manager:leasesIndex.col.templateName"), sortable: true, alwaysVisible: true,
      render: (tmpl) => <span className="font-medium text-slate-900">{tmpl.templateName || "Unnamed template"}</span> },
    { id: "building", label: tr("manager:leasesIndex.col.building"), sortable: true, defaultVisible: true,
      render: (tmpl) => <span className="text-slate-600">{tmpl.unit?.building?.name || "Global"}</span> },
    { id: "landlord", label: tr("manager:leasesIndex.col.landlord"), sortable: true, defaultVisible: true,
      render: (tmpl) => <span className="text-slate-600">{tmpl.landlordName || "\u2014"}</span> },
    { id: "createdAt", label: tr("manager:leasesIndex.col.created"), sortable: true, defaultVisible: true,
      render: (tmpl) => <span className="text-slate-500 text-xs">{formatDate(tmpl.createdAt)}</span> },
    { id: "actions", label: "", alwaysVisible: true, className: "text-right",
      render: (tmpl) => (
        <div onClick={(e) => e.stopPropagation()}>
          <ActionDropdown actions={[
            { label: tr("manager:leasesIndex.cta.viewTemplate"), onClick: () => router.push(`/manager/leases/${tmpl.id}`) },
            { label: tr("manager:leasesIndex.cta.delete"), onClick: () => handleDeleteTemplate(tmpl.id, tmpl.templateName), className: "text-red-600" },
          ]} />
        </div>
      ) },
  ];
}

export default function LeasesPage() {
  const { t } = useTranslation("manager");
  const router = useRouter();
  const [leases, setLeases] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [leasesTotal, setLeasesTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const activeTab = router.isReady ? (Math.max(0, TAB_KEYS.indexOf(router.query.tab)) || 0) : 0;
  const setActiveTab = useCallback((index) => {
    router.push(
      { pathname: router.pathname, query: { ...router.query, tab: TAB_KEYS[index] } },
      undefined,
      { shallow: true }
    );
  }, [router]);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [units, setUnits] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState("");
  const [createForm, setCreateForm] = useState({
    unitId: "",
    tenantName: "",
    tenantEmail: "",
    tenantPhone: "",
    tenantAddress: "",
    tenantZipCity: "",
    startDate: "",
    netRentChf: "",
    depositChf: "",
  });
  const [createError, setCreateError] = useState(null);
  const [leaseSearch, setLeaseSearch] = useState("");
  const [expiryLoading, setExpiryLoading] = useState({});
  const [expiryResult, setExpiryResult] = useState({});

  const fetchLeases = useCallback(async () => {
    setLoading(true);
    try {
      const [leaseRes, tmplRes] = await Promise.all([
        fetch("/api/leases?limit=200", { headers: authHeaders() }),
        fetch("/api/lease-templates", { headers: authHeaders() }),
      ]);
      const leaseJson = await leaseRes.json();
      const tmplJson = await tmplRes.json();
      setLeases(leaseJson.data || []);
      setLeasesTotal(leaseJson.total ?? leaseJson.data?.length ?? 0);
      setTemplates(tmplJson.data || []);
      setError(null);
    } catch (err) {
      setError("Failed to load leases");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeases(); }, [fetchLeases]);

  // Template tab state
  const [tmplSelectedBuildingId, setTmplSelectedBuildingId] = useState("");
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [tmplCreateMode, setTmplCreateMode] = useState("scratch");
  const [tmplCreateError, setTmplCreateError] = useState(null);
  const [tmplCreating, setTmplCreating] = useState(false);
  const [leaseFormTmpl, setLeaseFormTmpl] = useState({ leaseId: "", templateName: "", buildingId: "" });
  const [scratchForm, setScratchForm] = useState({
    templateName: "", buildingId: "", landlordName: "", landlordAddress: "",
    landlordZipCity: "", landlordPhone: "", landlordEmail: "",
    noticeRule: "3_MONTHS", paymentDueDayOfMonth: "1", paymentIban: "",
    referenceRatePercent: "1.75", depositDueRule: "AT_SIGNATURE", includesHouseRules: true,
  });
  const { sortField: tmplSortField, sortDir: tmplSortDir, handleSort: handleTmplSort } = useLocalSort("templateName", "asc");
  const { sortField: subSF, sortDir: subSD, handleSort: handleSubSort } = useLocalSort("sentForSignatureAt", "desc");
  const { sortField: lsSF, sortDir: lsSD, handleSort: handleLsSort } = useLocalSort("tenantName", "asc");
  const toast = useUndoToast();

  const availableBuildings = useMemo(() => {
    const taken = new Set(templates.map((t) => t.templateBuildingId).filter(Boolean));
    return buildings.filter((b) => !taken.has(b.id));
  }, [buildings, templates]);

  const filteredTemplates = useMemo(() => {
    if (!tmplSelectedBuildingId) return templates;
    return templates.filter((t) => t.templateBuildingId === tmplSelectedBuildingId || t.unit?.building?.id === tmplSelectedBuildingId);
  }, [templates, tmplSelectedBuildingId]);

  const sortedTemplates = useMemo(
    () => clientSort(filteredTemplates, tmplSortField, tmplSortDir, templateFieldExtractor),
    [filteredTemplates, tmplSortField, tmplSortDir]
  );

  // Load buildings on mount (needed for lease + template create forms)
  useEffect(() => {
    fetch("/api/buildings", { headers: authHeaders() })
      .then((r) => r.json())
      .then((json) => setBuildings(json.data || []))
      .catch(() => {});
  }, []);

  // Auto-open template create form when ?autoCreate=true
  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.autoCreate === "true" && activeTab === 3) {
      setShowCreateTemplate(true);
    }
  }, [router.isReady, router.query.autoCreate, activeTab]);

  // Load units when building selected
  useEffect(() => {
    if (!selectedBuildingId) { setUnits([]); return; }
    fetch(`/api/buildings/${selectedBuildingId}/units`, { headers: authHeaders() })
      .then(r => r.json())
      .then(json => setUnits(json.data || []))
      .catch(() => {});
  }, [selectedBuildingId]);

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError(null);
    if (!createForm.unitId || !createForm.tenantName || !createForm.startDate || !createForm.netRentChf) {
      setCreateError("Unit, tenant name, start date and net rent are required.");
      return;
    }
    try {
      const res = await fetch("/api/leases", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          ...createForm,
          netRentChf: parseInt(createForm.netRentChf, 10),
          depositChf: createForm.depositChf ? parseInt(createForm.depositChf, 10) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCreateError(json.error?.message || "Failed to create lease");
        return;
      }
      setShowCreate(false);
      router.push(`/manager/leases/${json.data.id}`);
    } catch (err) {
      setCreateError(err.message);
    }
  }

  async function handleExpiry(lease) {
    if (!window.confirm(`Handle expired lease for ${lease.tenantName}?\n\nThis will cancel the lease and either create a new draft for the backup candidate or relist the unit.`)) return;
    setExpiryLoading(l => ({ ...l, [lease.id]: true }));
    setExpiryResult(r => ({ ...r, [lease.id]: null }));
    try {
      const res = await fetch(`/api/leases/${lease.id}/handle-expiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
      });
      const json = await res.json();
      if (!res.ok) {
        setExpiryResult(r => ({ ...r, [lease.id]: { error: json.error?.message || "Failed" } }));
      } else {
        setExpiryResult(r => ({ ...r, [lease.id]: { ok: json.data } }));
        fetchLeases();
      }
    } catch (err) {
      setExpiryResult(r => ({ ...r, [lease.id]: { error: err.message } }));
    } finally {
      setExpiryLoading(l => ({ ...l, [lease.id]: false }));
    }
  }

  // Template functions
  function onScratchBuildingChange(id) {
    setScratchForm((f) => ({ ...f, buildingId: id }));
    const b = buildings.find((x) => x.id === id);
    if (b) {
      setScratchForm((f) => ({
        ...f, buildingId: id,
        templateName: `${b.name} Template`,
        landlordAddress: f.landlordAddress || b.address?.split(",")[0]?.trim() || "",
        landlordZipCity: f.landlordZipCity || b.address?.split(",").slice(1).join(",").trim() || "",
      }));
    }
  }

  async function handleCreateFromLease(e) {
    e.preventDefault();
    setTmplCreateError(null);
    if (!leaseFormTmpl.leaseId || !leaseFormTmpl.templateName) {
      setTmplCreateError("Please select a source lease and provide a template name.");
      return;
    }
    setTmplCreating(true);
    try {
      const res = await fetch("/api/lease-templates/from-lease", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ leaseId: leaseFormTmpl.leaseId, templateName: leaseFormTmpl.templateName.trim(), buildingId: leaseFormTmpl.buildingId || undefined }),
      });
      const json = await res.json();
      if (!res.ok) { setTmplCreateError(json.error?.message || "Failed to create template"); return; }
      setShowCreateTemplate(false);
      setLeaseFormTmpl({ leaseId: "", templateName: "", buildingId: "" });
      fetchLeases();
    } catch (err) { setTmplCreateError(err.message); }
    finally { setTmplCreating(false); }
  }

  async function handleCreateFromScratch(e) {
    e.preventDefault();
    setTmplCreateError(null);
    if (!scratchForm.buildingId || !scratchForm.landlordName || !scratchForm.landlordAddress || !scratchForm.landlordZipCity) {
      setTmplCreateError("Building, landlord name, address, and zip/city are required.");
      return;
    }
    setTmplCreating(true);
    try {
      const res = await fetch("/api/lease-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          templateName: scratchForm.templateName.trim(), buildingId: scratchForm.buildingId,
          landlordName: scratchForm.landlordName.trim(), landlordAddress: scratchForm.landlordAddress.trim(),
          landlordZipCity: scratchForm.landlordZipCity.trim(), landlordPhone: scratchForm.landlordPhone.trim() || undefined,
          landlordEmail: scratchForm.landlordEmail.trim() || undefined, noticeRule: scratchForm.noticeRule,
          paymentDueDayOfMonth: parseInt(scratchForm.paymentDueDayOfMonth) || 1,
          paymentIban: scratchForm.paymentIban.trim() || undefined, referenceRatePercent: scratchForm.referenceRatePercent || undefined,
          depositDueRule: scratchForm.depositDueRule, includesHouseRules: scratchForm.includesHouseRules,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setTmplCreateError(json.error?.message || "Failed to create template"); return; }
      setShowCreateTemplate(false);
      setScratchForm({ templateName: "", buildingId: "", landlordName: "", landlordAddress: "", landlordZipCity: "", landlordPhone: "", landlordEmail: "", noticeRule: "3_MONTHS", paymentDueDayOfMonth: "1", paymentIban: "", referenceRatePercent: "1.75", depositDueRule: "AT_SIGNATURE", includesHouseRules: true });
      fetchLeases();
    } catch (err) { setTmplCreateError(err.message); }
    finally { setTmplCreating(false); }
  }

  async function handleDeleteTemplate(id, name) {
    try {
      const res = await fetch(`/api/lease-templates/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) { const json = await res.json().catch(() => ({})); throw new Error(json.error?.message || "Failed to delete"); }
      fetchLeases();
      toast.show(`Template "${name || "Unnamed"}" deleted`, async () => {
        await fetch(`/api/lease-templates/${id}/restore`, { method: "POST", headers: authHeaders() });
        fetchLeases();
      });
    } catch (err) { setError(err.message); }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const templateColumns = useMemo(() => buildTemplateColumns(t, router, handleDeleteTemplate), [t, router]);

  // Derive filtered lease lists
  const searchedLeases = useMemo(() => {
    if (!leaseSearch.trim()) return leases;
    const q = leaseSearch.toLowerCase();
    return leases.filter((l) =>
      (l.tenantName || "").toLowerCase().includes(q) ||
      (l.unit?.building?.name || "").toLowerCase().includes(q) ||
      (l.unit?.unitNumber || "").toLowerCase().includes(q)
    );
  }, [leases, leaseSearch]);
  const activeLease  = searchedLeases.filter(l => ["ACTIVE", "SIGNED"].includes(l.status));
  const draftLeases  = searchedLeases.filter(l => l.status === "DRAFT");
  const submitted    = searchedLeases.filter(l => l.status === "READY_TO_SIGN");
  const archived     = searchedLeases.filter(l => ["CANCELLED", "TERMINATED"].includes(l.status));

  function leaseExtractor(lease, f) {
    if (f === "tenantName") return (lease.tenantName || "").toLowerCase();
    if (f === "unit") return (lease.unit?.unitNumber || "").toLowerCase();
    if (f === "building") return (lease.unit?.building?.name || "").toLowerCase();
    if (f === "rent") return lease.rentTotalChf ?? lease.netRentChf ?? 0;
    if (f === "netRentChf") return lease.netRentChf ?? 0;
    if (f === "startDate") return lease.startDate || "";
    if (f === "sentForSignatureAt") return lease.sentForSignatureAt || "";
    if (f === "status") return (lease.status || "").toLowerCase();
    return "";
  }
  const sortedSubmitted = useMemo(() => clientSort(submitted, subSF, subSD, leaseExtractor), [submitted, subSF, subSD]);
  const sortedActive    = useMemo(() => clientSort(activeLease, lsSF, lsSD, leaseExtractor), [activeLease, lsSF, lsSD]);
  const sortedDraft     = useMemo(() => clientSort(draftLeases, lsSF, lsSD, leaseExtractor), [draftLeases, lsSF, lsSD]);
  const sortedArchived  = useMemo(() => clientSort(archived, lsSF, lsSD, leaseExtractor), [archived, lsSF, lsSD]);

  const tabCounts = [activeLease.length, draftLeases.length, submitted.length, templates.length, archived.length];

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader
          title={t("manager:leasesIndex.title.leases")}
          subtitle={t("manager:leasesIndex.prop.manageRentalContracts")}
        />
        <PageContent>
          {/* Create lease form */}
          {showCreate && (
            <Section title={t("manager:leasesIndex.title.createNewLease")}>
              <form onSubmit={handleCreate} className="bg-white rounded-lg border p-6 space-y-4 max-w-2xl">
                {createError && <p className="text-sm text-red-600">{createError}</p>}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t("manager:leasesIndex.text.building")}</label>
                    <select
                      value={selectedBuildingId}
                      onChange={e => { setSelectedBuildingId(e.target.value); setCreateForm(f => ({ ...f, unitId: "" })); }}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">{t("manager:leasesIndex.text.selectBuilding")}</option>
                      {buildings.map(b => <option key={b.id} value={b.id}>{b.name} — {b.address}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t("manager:leasesIndex.text.unit")}</label>
                    <select
                      value={createForm.unitId}
                      onChange={e => setCreateForm(f => ({ ...f, unitId: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      disabled={!selectedBuildingId}
                    >
                      <option value="">{t("manager:leasesIndex.text.selectUnit")}</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.unitNumber} (Floor {u.floor || "—"})</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t("manager:leasesIndex.text.tenantName")}</label>
                    <input
                      type="text"
                      value={createForm.tenantName}
                      onChange={e => setCreateForm(f => ({ ...f, tenantName: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      placeholder={t("manager:leasesIndex.placeholder.jeanDupont")}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t("manager:leasesIndex.text.tenantEmail")}</label>
                    <input
                      type="email"
                      value={createForm.tenantEmail}
                      onChange={e => setCreateForm(f => ({ ...f, tenantEmail: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      placeholder={t("manager:leasesIndex.placeholder.jeanExampleCom")}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t("manager:leasesIndex.text.startDate")}</label>
                    <input
                      type="date"
                      value={createForm.startDate}
                      onChange={e => setCreateForm(f => ({ ...f, startDate: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Net Rent (CHF/month) *</label>
                    <input
                      type="number"
                      value={createForm.netRentChf}
                      onChange={e => setCreateForm(f => ({ ...f, netRentChf: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      placeholder="1500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Deposit (CHF)</label>
                  <input
                    type="number"
                    value={createForm.depositChf}
                    onChange={e => setCreateForm(f => ({ ...f, depositChf: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm max-w-xs"
                    placeholder="4500"
                  />
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                >
                  Create Lease Draft
                </button>
              </form>
            </Section>
          )}

          {/* Tab strip */}
          <ScrollableTabs activeIndex={activeTab}>
            {LEASE_TABS.map((tab, i) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(i)}
                className={activeTab === i ? "tab-btn-active" : "tab-btn"}
              >
                {t(`leasesIndex.tabs.${tab.key.toLowerCase()}`)}
              </button>
            ))}
          </ScrollableTabs>

          {/* Count + toolbar row */}
          <span className="tab-panel-count">
            {activeTab === 0 && `${activeLease.length} active lease${activeLease.length !== 1 ? "s" : ""}`}
            {activeTab === 1 && `${draftLeases.length} draft${draftLeases.length !== 1 ? "s" : ""}`}
            {activeTab === 2 && `${submitted.length} awaiting signature`}
            {activeTab === 3 && `${templates.length} template${templates.length !== 1 ? "s" : ""}`}
            {activeTab === 4 && `${archived.length} archived`}
          </span>
          <div className="flex items-center gap-2">
            <input
              type="search"
              placeholder={t("manager:leasesIndex.placeholder.searchByTenantBuildingOrUnit")}
              value={leaseSearch}
              onChange={(e) => setLeaseSearch(e.target.value)}
              className="filter-input flex-1 min-w-0 mb-0"
            />
            <button
              onClick={activeTab === 3 ? () => setShowCreateTemplate((v) => !v) : () => setShowCreate((v) => !v)}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-brand bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark transition-colors"
            >
              {activeTab === 3
                ? (showCreateTemplate ? "Cancel" : "+ New Template")
                : (showCreate ? "Cancel" : "+ New Lease")}
            </button>
          </div>

            {/* Templates tab (index 3) */}
            <div className={activeTab === 3 ? "tab-panel-active" : "tab-panel"}>
              {/* Template create form */}
              {showCreateTemplate && (
                <div className="px-4 pt-4">
                  <div className="flex gap-2 mb-4">
                    <button onClick={() => { setTmplCreateMode("scratch"); setTmplCreateError(null); }}
                      className={cn("px-4 py-2 text-sm font-medium rounded-lg transition-colors", tmplCreateMode === "scratch" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
                      From Scratch
                    </button>
                    <button onClick={() => { setTmplCreateMode("lease"); setTmplCreateError(null); }}
                      className={cn("px-4 py-2 text-sm font-medium rounded-lg transition-colors", tmplCreateMode === "lease" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
                      Copy from Existing Lease
                    </button>
                  </div>
                  {tmplCreateError && <p className="text-sm text-red-600 mb-4">{tmplCreateError}</p>}
                  {tmplCreateMode === "scratch" && (
                    <form onSubmit={handleCreateFromScratch} className="bg-white rounded-lg border p-6 space-y-4 mb-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-slate-700 mb-1">{t("manager:leasesIndex.text.building2")}</label>
                          <select value={scratchForm.buildingId} onChange={(e) => onScratchBuildingChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                            <option value="">{t("manager:leasesIndex.text.selectABuilding")}</option>
                            {availableBuildings.map((b) => <option key={b.id} value={b.id}>{b.name} — {b.address}</option>)}
                          </select>
                          {availableBuildings.length === 0 && buildings.length > 0 && <p className="text-xs text-amber-600 mt-1">{t("manager:leasesIndex.text.allBuildingsAlreadyHaveATemplate")}</p>}
                        </div>
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-slate-700 mb-1">{t("manager:leasesIndex.text.templateName")} <span className="ml-2 text-xs font-normal text-slate-400">(auto-derived from building)</span></label>
                          <input type="text" value={scratchForm.templateName} onChange={(e) => setScratchForm((f) => ({ ...f, templateName: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder={t("manager:leasesIndex.placeholder.selectABuildingToAutoFill")} />
                        </div>
                      </div>
                      <div className="border-t pt-4">
                        <h4 className="text-sm font-semibold text-slate-800 mb-3">{t("manager:leasesIndex.text.1LandlordRgie")}</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">{t("manager:leasesIndex.text.landlordName")}</label>
                            <input type="text" value={scratchForm.landlordName} onChange={(e) => setScratchForm((f) => ({ ...f, landlordName: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder={t("manager:leasesIndex.placeholder.eGRGieDuLacSa")} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{t("manager:leasesIndex.text.address")}</label>
                            <input type="text" value={scratchForm.landlordAddress} onChange={(e) => setScratchForm((f) => ({ ...f, landlordAddress: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder={t("manager:leasesIndex.placeholder.eGRueDuLac15")} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{t("manager:leasesIndex.text.zipCity")}</label>
                            <input type="text" value={scratchForm.landlordZipCity} onChange={(e) => setScratchForm((f) => ({ ...f, landlordZipCity: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder={t("manager:leasesIndex.placeholder.eG1003Lausanne")} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{t("manager:leasesIndex.text.phone")}</label>
                            <input type="text" value={scratchForm.landlordPhone} onChange={(e) => setScratchForm((f) => ({ ...f, landlordPhone: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder={t("manager:leasesIndex.placeholder.4121")} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{t("manager:leasesIndex.text.email")}</label>
                            <input type="text" value={scratchForm.landlordEmail} onChange={(e) => setScratchForm((f) => ({ ...f, landlordEmail: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder={t("manager:leasesIndex.placeholder.regieExampleCh")} />
                          </div>
                        </div>
                      </div>
                      <div className="border-t pt-4">
                        <h4 className="text-sm font-semibold text-slate-800 mb-3">§3–4 Termination &amp; Deposit</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{t("manager:leasesIndex.text.noticeRule")}</label>
                            <select value={scratchForm.noticeRule} onChange={(e) => setScratchForm((f) => ({ ...f, noticeRule: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                              <option value="3_MONTHS">{t("manager:leasesIndex.text.3Months")}</option>
                              <option value="EXTENDED">Extended (custom)</option>
                              <option value="2_WEEKS">{t("manager:leasesIndex.text.2Weeks")}</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{t("manager:leasesIndex.text.depositDue")}</label>
                            <select value={scratchForm.depositDueRule} onChange={(e) => setScratchForm((f) => ({ ...f, depositDueRule: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                              <option value="AT_SIGNATURE">{t("manager:leasesIndex.text.atSignature")}</option>
                              <option value="BY_START">{t("manager:leasesIndex.text.byLeaseStart")}</option>
                              <option value="BY_DATE">{t("manager:leasesIndex.text.bySpecificDate")}</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      <div className="border-t pt-4">
                        <h4 className="text-sm font-semibold text-slate-800 mb-3">{t("manager:leasesIndex.text.6Payment")}</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{t("manager:leasesIndex.text.paymentDueDay")}</label>
                            <input type="number" min="1" max="28" value={scratchForm.paymentDueDayOfMonth} onChange={(e) => setScratchForm((f) => ({ ...f, paymentDueDayOfMonth: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{t("manager:leasesIndex.text.paymentIban")}</label>
                            <input type="text" value={scratchForm.paymentIban} onChange={(e) => setScratchForm((f) => ({ ...f, paymentIban: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder={t("manager:leasesIndex.placeholder.cH9300762011623852957")} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{t("manager:leasesIndex.text.referenceRate")}</label>
                            <input type="text" value={scratchForm.referenceRatePercent} onChange={(e) => setScratchForm((f) => ({ ...f, referenceRatePercent: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                          </div>
                          <div className="flex items-center gap-2 pt-5">
                            <input type="checkbox" id="houseRules" checked={scratchForm.includesHouseRules} onChange={(e) => setScratchForm((f) => ({ ...f, includesHouseRules: e.target.checked }))} className="rounded" />
                            <label htmlFor="houseRules" className="text-sm text-slate-700">{t("manager:leasesIndex.text.includesHouseRules")}</label>
                          </div>
                        </div>
                      </div>
                      <button type="submit" disabled={tmplCreating} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                        {tmplCreating ? "Creating..." : "Create Template"}
                      </button>
                    </form>
                  )}
                  {tmplCreateMode === "lease" && (
                    <form onSubmit={handleCreateFromLease} className="bg-white rounded-lg border p-6 space-y-4 mb-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t("manager:leasesIndex.text.templateName2")}</label>
                        <input type="text" value={leaseFormTmpl.templateName} onChange={(e) => setLeaseFormTmpl((f) => ({ ...f, templateName: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder={t("manager:leasesIndex.placeholder.eGStandard3RoomApartment")} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t("manager:leasesIndex.text.sourceLease")}</label>
                        <select value={leaseFormTmpl.leaseId} onChange={(e) => setLeaseFormTmpl((f) => ({ ...f, leaseId: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                          <option value="">{t("manager:leasesIndex.text.selectALeaseToCopyFrom")}</option>
                          {leases.map((l) => <option key={l.id} value={l.id}>{l.tenantName} — {l.unit?.unitNumber || "?"} @ {l.unit?.building?.name || "?"} ({l.status})</option>)}
                        </select>
                        {leases.length === 0 && <p className="text-xs text-amber-600 mt-1">No leases found. Use the &quot;From Scratch&quot; tab to create a template without an existing lease.</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Assign to Building (optional)</label>
                        <select value={leaseFormTmpl.buildingId} onChange={(e) => setLeaseFormTmpl((f) => ({ ...f, buildingId: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                          <option value="">All buildings (global)</option>
                          {availableBuildings.map((b) => <option key={b.id} value={b.id}>{b.name} — {b.address}</option>)}
                        </select>
                        {availableBuildings.length === 0 && buildings.length > 0 && <p className="text-xs text-amber-600 mt-1">{t("manager:leasesIndex.text.allBuildingsAlreadyHaveATemplate")}</p>}
                      </div>
                      <button type="submit" disabled={tmplCreating} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                        {tmplCreating ? "Creating..." : "Create Template"}
                      </button>
                    </form>
                  )}
                </div>
              )}
              {loading ? (
                <p className="loading-text px-4 py-4">{t("manager:leasesIndex.text.loadingTemplates")}</p>
              ) : templates.length === 0 ? (
                <div className="empty-state">
                  <p className="empty-state-text text-lg mb-2">{t("manager:leasesIndex.text.noTemplatesYet")}</p>
                  <p className="empty-state-text">Click &quot;+ New Template&quot; to create one.</p>
                </div>
              ) : (
                <div>
                  <ConfigurableTable
                    tableId="lease-templates"
                    columns={templateColumns}
                    data={sortedTemplates}
                    rowKey={(t) => t.id}
                    sortField={tmplSortField}
                    sortDir={tmplSortDir}
                    onSort={handleTmplSort}
                    onRowClick={(t) => router.push(`/manager/leases/${t.id}`)}
                    emptyState={<p className="text-sm text-slate-500 px-4 py-4">{t("manager:leasesIndex.text.noTemplatesMatchThisFilter")}</p>}
                    mobileCard={(t) => (
                      <div className="table-card cursor-pointer" onClick={() => router.push(`/manager/leases/${t.id}`)}>
                        <p className="table-card-head">{t.name || "—"}</p>
                        <div className="table-card-footer">
                          <span>{t.buildingName || "—"}</span>
                          {t.landlordName && <span>{t.landlordName}</span>}
                        </div>
                      </div>
                    )}
                  />
                </div>
              )}
            </div>

            {/* Submitted tab (index 2) */}
            <div className={activeTab === 2 ? "tab-panel-active" : "tab-panel"}>
              <div className="px-4 py-4">
                {loading ? (
                  <p className="loading-text">{t("manager:leasesIndex.text.loading")}</p>
                ) : error ? (
                  <p className="text-sm text-red-600">{error}</p>
                ) : submitted.length === 0 ? (
                  <div className="empty-state">
                    <p className="empty-state-text text-lg mb-2">{t("manager:leasesIndex.text.noSubmittedLeases")}</p>
                    <p className="empty-state-text">{t("manager:leasesIndex.text.leasesSentToCandidatesForSignatureAppearHere")}</p>
                  </div>
                ) : (
                  <>
                    {/* Mobile card list — sm:hidden */}
                    <div className="sm:hidden overflow-hidden rounded-lg border border-table-border divide-y divide-table-divider">
                      {sortedSubmitted.map(lease => {
                        const expired = isExpired(lease.sentForSignatureAt);
                        const result = expiryResult[lease.id];
                        return (
                          <div
                            key={lease.id}
                            className={cn("table-card cursor-pointer hover:bg-slate-50/80 transition-colors", expired ? "bg-red-50" : "")}
                            onClick={() => router.push(`/manager/leases/${lease.id}`)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="table-card-head">{lease.tenantName}</span>
                              <CountdownBadge sentForSignatureAt={lease.sentForSignatureAt} />
                            </div>
                            <p className="table-card-sub">{lease.unit?.building?.name || "—"}{lease.unit?.unitNumber ? ` / ${lease.unit.unitNumber}` : ""}</p>
                            <div className="table-card-footer">
                              <span className="font-medium">CHF {lease.rentTotalChf ?? lease.netRentChf}.-</span>
                              <span>{lease.sentForSignatureAt ? formatDate(lease.sentForSignatureAt) : "—"}</span>
                            </div>
                            {expired && (
                              <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => handleExpiry(lease)}
                                  disabled={expiryLoading[lease.id]}
                                  className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50 font-medium"
                                >
                                  {expiryLoading[lease.id] ? "Processing…" : "Handle expired"}
                                </button>
                                {result?.ok && <p className="text-xs text-green-700 mt-1">{result.ok.message}</p>}
                                {result?.error && <p className="text-xs text-red-600 mt-1">{result.error}</p>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Wide table — hidden sm:block */}
                    <div className="hidden sm:block overflow-x-auto rounded-lg border border-table-border">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <SortableHeader label={t("manager:leasesIndex.prop.tenant")} field="tenantName" sortField={subSF} sortDir={subSD} onSort={handleSubSort} />
                            <SortableHeader label={t("manager:leasesIndex.prop.unit")} field="unit" sortField={subSF} sortDir={subSD} onSort={handleSubSort} />
                            <SortableHeader label={t("manager:leasesIndex.prop.building")} field="building" sortField={subSF} sortDir={subSD} onSort={handleSubSort} />
                            <SortableHeader label={t("manager:leasesIndex.prop.rent")} field="rent" sortField={subSF} sortDir={subSD} onSort={handleSubSort} />
                            <SortableHeader label={t("manager:leasesIndex.prop.sent")} field="sentForSignatureAt" sortField={subSF} sortDir={subSD} onSort={handleSubSort} />
                            <th>{t("manager:leasesIndex.col.deadline")}</th>
                            <th>{t("manager:leasesIndex.col.actions")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedSubmitted.map(lease => {
                            const expired = isExpired(lease.sentForSignatureAt);
                            const result = expiryResult[lease.id];
                            return (
                              <tr key={lease.id} onClick={() => router.push(`/manager/leases/${lease.id}`)} className={cn("cursor-pointer hover:bg-slate-50", expired ? "bg-red-50" : "")}>
                                <td className="cell-bold">{lease.tenantName}</td>
                                <td>{lease.unit?.unitNumber || "—"}</td>
                                <td>{lease.unit?.building?.name || "—"}</td>
                                <td>CHF {lease.rentTotalChf ?? lease.netRentChf}.-</td>
                                <td>{lease.sentForSignatureAt ? formatDate(lease.sentForSignatureAt) : "—"}</td>
                                <td><CountdownBadge sentForSignatureAt={lease.sentForSignatureAt} /></td>
                                <td onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                      onClick={() => router.push(`/manager/leases/${lease.id}`)}
                                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                                    >
                                      View →
                                    </button>
                                    {expired && (
                                      <button
                                        onClick={() => handleExpiry(lease)}
                                        disabled={expiryLoading[lease.id]}
                                        className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50 font-medium"
                                      >
                                        {expiryLoading[lease.id] ? "Processing…" : "Handle expired"}
                                      </button>
                                    )}
                                  </div>
                                  {result?.ok && (
                                    <p className="text-xs text-green-700 mt-1">{result.ok.message}</p>
                                  )}
                                  {result?.error && (
                                    <p className="text-xs text-red-600 mt-1">{result.error}</p>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* List tabs: Active (0), Draft (1), Archive (4) */}
            {[0, 1, 4].map((tabIndex) => {
              const tab = LEASE_TABS[tabIndex];
              const filtered = [activeLease, draftLeases, null, null, archived][tabIndex];
              const sortedFiltered = [sortedActive, sortedDraft, null, null, sortedArchived][tabIndex];
              return (
                <div key={tabIndex} className={activeTab === tabIndex ? "tab-panel-active" : "tab-panel"}>
                  {loading ? (
                    <p className="loading-text">{t("manager:leasesIndex.text.loadingLeases")}</p>
                  ) : error ? (
                    <p className="text-sm text-red-600">{error}</p>
                  ) : filtered.length === 0 ? (
                    <div className="empty-state">
                      <p className="empty-state-text text-lg mb-2">{t("manager:leasesIndex.text.noLeasesFound")}</p>
                      <p className="empty-state-text">Click &quot;+ New Lease&quot; to create your first rental contract.</p>
                    </div>
                  ) : (
                    <>
                      {/* Mobile card list — sm:hidden */}
                      <div className="sm:hidden overflow-hidden rounded-lg border border-table-border divide-y divide-table-divider">
                        {sortedFiltered.slice(0, 200).map(lease => {
                          const netRent = lease.netRentChf ?? 0;
                          const charges = lease.chargesTotalChf ?? 0;
                          const totalMo = netRent + charges;
                          return (
                            <div
                              key={lease.id}
                              className="table-card cursor-pointer hover:bg-slate-50/80 transition-colors"
                              onClick={() => router.push(`/manager/leases/${lease.id}`)}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="table-card-head">{lease.tenantName}</span>
                                <Badge variant={leaseVariant(lease.status)} size="sm">
                                  {lease.status.replace(/_/g, " ")}
                                </Badge>
                              </div>
                              <p className="table-card-sub">{lease.unit?.building?.name || "—"}{lease.unit?.unitNumber ? ` / ${lease.unit.unitNumber}` : ""}</p>
                              <div className="table-card-footer">
                                <span className="font-medium">CHF {tabIndex === 0 ? totalMo : netRent}.-</span>
                                <span>{formatDate(lease.startDate)}</span>
                                {tabIndex === 1 && lease.applicationId && (
                                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">{t("manager:leasesIndex.text.readyForReview")}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Wide table — hidden sm:block */}
                      <div className="hidden sm:block overflow-x-auto rounded-lg border border-table-border">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <SortableHeader label={t("manager:leasesIndex.prop.tenant")} field="tenantName" sortField={lsSF} sortDir={lsSD} onSort={handleLsSort} />
                              <SortableHeader label={t("manager:leasesIndex.prop.unit")} field="unit" sortField={lsSF} sortDir={lsSD} onSort={handleLsSort} />
                              <SortableHeader label={t("manager:leasesIndex.prop.building")} field="building" sortField={lsSF} sortDir={lsSD} onSort={handleLsSort} />
                              <SortableHeader label={t("manager:leasesIndex.prop.netRent")} field="netRentChf" sortField={lsSF} sortDir={lsSD} onSort={handleLsSort} />
                              {tabIndex === 0 && <th>{t("manager:leasesIndex.col.charges")}</th>}
                              {tabIndex === 0 && <th>{t("manager:leasesIndex.col.totalMo")}</th>}
                              <SortableHeader label={t("manager:leasesIndex.prop.start")} field="startDate" sortField={lsSF} sortDir={lsSD} onSort={handleLsSort} />
                              <SortableHeader label={t("manager:leasesIndex.prop.status")} field="status" sortField={lsSF} sortDir={lsSD} onSort={handleLsSort} />
                              {tabIndex === 1 && <th>{t("manager:leasesIndex.col.tag")}</th>}
                              <th>{t("manager:leasesIndex.col.actions")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedFiltered.slice(0, 200).map(lease => {
                              const netRent = lease.netRentChf ?? 0;
                              const charges = lease.chargesTotalChf ?? 0;
                              const totalMo = netRent + charges;
                              return (
                              <tr key={lease.id} onClick={() => router.push(`/manager/leases/${lease.id}`)} className="cursor-pointer hover:bg-slate-50">
                                <td className="cell-bold">{lease.tenantName}</td>
                                <td>{lease.unit?.unitNumber || "—"}</td>
                                <td>{lease.unit?.building?.name || "—"}</td>
                                <td>CHF {netRent}.-</td>
                                {tabIndex === 0 && <td>{charges ? `CHF ${charges}.-` : "—"}</td>}
                                {tabIndex === 0 && <td className="font-semibold">CHF {totalMo}.-</td>}
                                <td>{formatDate(lease.startDate)}</td>
                                <td>
                                  <Badge variant={leaseVariant(lease.status)}>
                                    {lease.status.replace(/_/g, " ")}
                                  </Badge>
                                </td>
                                {tabIndex === 1 && (
                                  <td>
                                    {lease.applicationId ? (
                                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                                        Ready for review
                                      </span>
                                    ) : null}
                                  </td>
                                )}
                                <td onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => router.push(`/manager/leases/${lease.id}`)}
                                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                                  >
                                    Edit →
                                  </button>
                                </td>
                              </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
        </PageContent>
        <UndoToast {...toast} />
      </PageShell>
    </AppShell>
  );
}

export const getStaticProps = withTranslations(["common","manager"]);
