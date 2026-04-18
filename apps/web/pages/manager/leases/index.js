import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import { formatDate } from "../../../lib/format";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import Section from "../../../components/layout/Section";
import { authHeaders } from "../../../lib/api";
import UndoToast, { useUndoToast } from "../../../components/ui/UndoToast";
import ConfigurableTable from "../../../components/ConfigurableTable";
import { clientSort } from "../../../lib/tableUtils";
import Badge from "../../../components/ui/Badge";
import { leaseVariant } from "../../../lib/statusVariants";
import { cn } from "../../../lib/utils";

// Tabs: Active (ACTIVE+SIGNED), Draft (DRAFT), Submitted (READY_TO_SIGN), Archive (CANCELLED+TERMINATED)
const LEASE_TABS = [
  { key: "ACTIVE",     label: "Active",    statuses: ["ACTIVE", "SIGNED"] },
  { key: "DRAFTS",     label: "Draft",     statuses: ["DRAFT"] },
  { key: "SUBMITTED",  label: "Submitted", statuses: ["READY_TO_SIGN"] },
  { key: "TEMPLATES",  label: "Templates", statuses: null },
  { key: "ARCHIVE",    label: "Archive",   statuses: ["CANCELLED", "TERMINATED"] },
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
  if (!sentForSignatureAt) {
    return <span className="inline-block px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-500">Sent date unavailable</span>;
  }
  const expiry = addBusinessDays(new Date(sentForSignatureAt), 5);
  const remaining = businessDaysUntil(expiry);

  if (remaining < 0) {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
        Expired {Math.abs(remaining)} business day{Math.abs(remaining) !== 1 ? "s" : ""} ago
      </span>
    );
  }
  if (remaining === 0) {
    return <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">Due today</span>;
  }
  return (
    <span className={cn("inline-block px-2 py-0.5 rounded text-xs font-medium", remaining <= 1 ? "bg-orange-100 text-orange-700" : "bg-blue-50 text-blue-700")}>
      {remaining} business day{remaining !== 1 ? "s" : ""} left
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

function buildTemplateColumns(router, handleDeleteTemplate) {
  return [
    { id: "templateName", label: "Template Name", sortable: true, alwaysVisible: true,
      render: (t) => <span className="font-medium text-slate-900">{t.templateName || "Unnamed template"}</span> },
    { id: "building", label: "Building", sortable: true, defaultVisible: true,
      render: (t) => <span className="text-slate-600">{t.unit?.building?.name || "Global"}</span> },
    { id: "landlord", label: "Landlord", sortable: true, defaultVisible: true,
      render: (t) => <span className="text-slate-600">{t.landlordName || "\u2014"}</span> },
    { id: "createdAt", label: "Created", sortable: true, defaultVisible: true,
      render: (t) => <span className="text-slate-500 text-xs">{formatDate(t.createdAt)}</span> },
    { id: "actions", label: "", alwaysVisible: true, className: "text-right",
      render: (t) => (
        <div onClick={(e) => e.stopPropagation()}>
          <ActionDropdown actions={[
            { label: "\uD83D\uDCC4 View Template", onClick: () => router.push(`/manager/leases/${t.id}`) },
            { label: "\uD83D\uDDD1\uFE0F Delete", onClick: () => handleDeleteTemplate(t.id, t.templateName), className: "text-red-600" },
          ]} />
        </div>
      ) },
  ];
}

export default function LeasesPage() {
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
  const [tmplSortField, setTmplSortField] = useState("templateName");
  const [tmplSortDir, setTmplSortDir] = useState("asc");
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

  function handleTmplSort(field) {
    if (tmplSortField === field) setTmplSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setTmplSortField(field); setTmplSortDir("asc"); }
  }

  // Load buildings on mount (needed for lease + template create forms)
  useEffect(() => {
    fetch("/api/buildings", { headers: authHeaders() })
      .then((r) => r.json())
      .then((json) => setBuildings(json.data || []))
      .catch(() => {});
  }, []);

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
  const templateColumns = useMemo(() => buildTemplateColumns(router, handleDeleteTemplate), [router]);

  // Derive filtered lease lists
  const activeLease  = leases.filter(l => ["ACTIVE", "SIGNED"].includes(l.status));
  const draftLeases  = leases.filter(l => l.status === "DRAFT");
  const submitted    = leases.filter(l => l.status === "READY_TO_SIGN");
  const archived     = leases.filter(l => ["CANCELLED", "TERMINATED"].includes(l.status));

  const tabCounts = [activeLease.length, draftLeases.length, submitted.length, templates.length, archived.length];

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader
          title="Leases"
          subtitle="Manage rental contracts"
        />
        <PageContent>
          {/* Create lease form */}
          {showCreate && (
            <Section title="Create New Lease">
              <form onSubmit={handleCreate} className="bg-white rounded-lg border p-6 space-y-4 max-w-2xl">
                {createError && <p className="text-sm text-red-600">{createError}</p>}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Building</label>
                    <select
                      value={selectedBuildingId}
                      onChange={e => { setSelectedBuildingId(e.target.value); setCreateForm(f => ({ ...f, unitId: "" })); }}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Select building...</option>
                      {buildings.map(b => <option key={b.id} value={b.id}>{b.name} — {b.address}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Unit *</label>
                    <select
                      value={createForm.unitId}
                      onChange={e => setCreateForm(f => ({ ...f, unitId: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      disabled={!selectedBuildingId}
                    >
                      <option value="">Select unit...</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.unitNumber} (Floor {u.floor || "—"})</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tenant Name *</label>
                    <input
                      type="text"
                      value={createForm.tenantName}
                      onChange={e => setCreateForm(f => ({ ...f, tenantName: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      placeholder="Jean Dupont"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tenant Email</label>
                    <input
                      type="email"
                      value={createForm.tenantEmail}
                      onChange={e => setCreateForm(f => ({ ...f, tenantEmail: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      placeholder="jean@example.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Start Date *</label>
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
          <div className="tab-strip">
            {LEASE_TABS.map((tab, i) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(i)}
                className={activeTab === i ? "tab-btn-active" : "tab-btn"}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Count + CTA row */}
          <div className="flex items-center justify-between">
            <span className="tab-panel-count">
              {activeTab === 0 && `${activeLease.length} active lease${activeLease.length !== 1 ? "s" : ""}`}
              {activeTab === 1 && `${draftLeases.length} draft${draftLeases.length !== 1 ? "s" : ""}`}
              {activeTab === 2 && `${submitted.length} awaiting signature`}
              {activeTab === 3 && `${templates.length} template${templates.length !== 1 ? "s" : ""}`}
              {activeTab === 4 && `${archived.length} archived`}
            </span>
            <button
              onClick={activeTab === 3 ? () => setShowCreateTemplate((v) => !v) : () => setShowCreate((v) => !v)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              {activeTab === 3
                ? (showCreateTemplate ? "Cancel" : "+ New Template")
                : (showCreate ? "Cancel" : "+ New Lease")}
            </button>
          </div>

          <Panel bodyClassName="p-0">
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
                    <form onSubmit={handleCreateFromScratch} className="bg-white rounded-lg border p-6 space-y-4 max-w-2xl mb-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-slate-700 mb-1">Building *</label>
                          <select value={scratchForm.buildingId} onChange={(e) => onScratchBuildingChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                            <option value="">Select a building...</option>
                            {availableBuildings.map((b) => <option key={b.id} value={b.id}>{b.name} — {b.address}</option>)}
                          </select>
                          {availableBuildings.length === 0 && buildings.length > 0 && <p className="text-xs text-amber-600 mt-1">All buildings already have a template.</p>}
                        </div>
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-slate-700 mb-1">Template Name <span className="ml-2 text-xs font-normal text-slate-400">(auto-derived from building)</span></label>
                          <input type="text" value={scratchForm.templateName} onChange={(e) => setScratchForm((f) => ({ ...f, templateName: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Select a building to auto-fill" />
                        </div>
                      </div>
                      <div className="border-t pt-4">
                        <h4 className="text-sm font-semibold text-slate-800 mb-3">§1 Landlord / Régie</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Landlord Name *</label>
                            <input type="text" value={scratchForm.landlordName} onChange={(e) => setScratchForm((f) => ({ ...f, landlordName: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Régie du Lac SA" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Address *</label>
                            <input type="text" value={scratchForm.landlordAddress} onChange={(e) => setScratchForm((f) => ({ ...f, landlordAddress: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Rue du Lac 15" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Zip / City *</label>
                            <input type="text" value={scratchForm.landlordZipCity} onChange={(e) => setScratchForm((f) => ({ ...f, landlordZipCity: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. 1003 Lausanne" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                            <input type="text" value={scratchForm.landlordPhone} onChange={(e) => setScratchForm((f) => ({ ...f, landlordPhone: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="+41 21 ..." />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                            <input type="text" value={scratchForm.landlordEmail} onChange={(e) => setScratchForm((f) => ({ ...f, landlordEmail: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="regie@example.ch" />
                          </div>
                        </div>
                      </div>
                      <div className="border-t pt-4">
                        <h4 className="text-sm font-semibold text-slate-800 mb-3">§3–4 Termination &amp; Deposit</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Notice Rule</label>
                            <select value={scratchForm.noticeRule} onChange={(e) => setScratchForm((f) => ({ ...f, noticeRule: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                              <option value="3_MONTHS">3 months</option>
                              <option value="EXTENDED">Extended (custom)</option>
                              <option value="2_WEEKS">2 weeks</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Deposit Due</label>
                            <select value={scratchForm.depositDueRule} onChange={(e) => setScratchForm((f) => ({ ...f, depositDueRule: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                              <option value="AT_SIGNATURE">At signature</option>
                              <option value="BY_START">By lease start</option>
                              <option value="BY_DATE">By specific date</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      <div className="border-t pt-4">
                        <h4 className="text-sm font-semibold text-slate-800 mb-3">§6 Payment</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Payment Due Day</label>
                            <input type="number" min="1" max="28" value={scratchForm.paymentDueDayOfMonth} onChange={(e) => setScratchForm((f) => ({ ...f, paymentDueDayOfMonth: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Payment IBAN</label>
                            <input type="text" value={scratchForm.paymentIban} onChange={(e) => setScratchForm((f) => ({ ...f, paymentIban: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="CH93 0076 2011 6238 5295 7" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Reference Rate %</label>
                            <input type="text" value={scratchForm.referenceRatePercent} onChange={(e) => setScratchForm((f) => ({ ...f, referenceRatePercent: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                          </div>
                          <div className="flex items-center gap-2 pt-5">
                            <input type="checkbox" id="houseRules" checked={scratchForm.includesHouseRules} onChange={(e) => setScratchForm((f) => ({ ...f, includesHouseRules: e.target.checked }))} className="rounded" />
                            <label htmlFor="houseRules" className="text-sm text-slate-700">Includes house rules</label>
                          </div>
                        </div>
                      </div>
                      <button type="submit" disabled={tmplCreating} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                        {tmplCreating ? "Creating..." : "Create Template"}
                      </button>
                    </form>
                  )}
                  {tmplCreateMode === "lease" && (
                    <form onSubmit={handleCreateFromLease} className="bg-white rounded-lg border p-6 space-y-4 max-w-2xl mb-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Template Name *</label>
                        <input type="text" value={leaseFormTmpl.templateName} onChange={(e) => setLeaseFormTmpl((f) => ({ ...f, templateName: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Standard 3-room apartment" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Source Lease *</label>
                        <select value={leaseFormTmpl.leaseId} onChange={(e) => setLeaseFormTmpl((f) => ({ ...f, leaseId: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                          <option value="">Select a lease to copy from...</option>
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
                        {availableBuildings.length === 0 && buildings.length > 0 && <p className="text-xs text-amber-600 mt-1">All buildings already have a template.</p>}
                      </div>
                      <button type="submit" disabled={tmplCreating} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                        {tmplCreating ? "Creating..." : "Create Template"}
                      </button>
                    </form>
                  )}
                </div>
              )}
              {loading ? (
                <p className="loading-text px-4 py-4">Loading templates…</p>
              ) : templates.length === 0 ? (
                <div className="empty-state">
                  <p className="empty-state-text text-lg mb-2">No templates yet</p>
                  <p className="empty-state-text">Click &quot;+ New Template&quot; to create one.</p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between px-4 pt-4 pb-2">
                    <span className="text-sm text-slate-500">{sortedTemplates.length} of {templates.length} template{templates.length !== 1 ? "s" : ""}</span>
                    <select value={tmplSelectedBuildingId} onChange={(e) => setTmplSelectedBuildingId(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700">
                      <option value="">All buildings</option>
                      {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <ConfigurableTable
                    tableId="lease-templates"
                    columns={templateColumns}
                    data={sortedTemplates}
                    rowKey={(t) => t.id}
                    sortField={tmplSortField}
                    sortDir={tmplSortDir}
                    onSort={handleTmplSort}
                    onRowClick={(t) => router.push(`/manager/leases/${t.id}`)}
                    emptyState={<p className="text-sm text-slate-500 px-4 py-4">No templates match this filter.</p>}
                  />
                </div>
              )}
            </div>

            {/* Submitted tab (index 2) */}
            <div className={activeTab === 2 ? "tab-panel-active" : "tab-panel"}>
              <div className="px-4 py-4">
                {loading ? (
                  <p className="loading-text">Loading…</p>
                ) : error ? (
                  <p className="text-sm text-red-600">{error}</p>
                ) : submitted.length === 0 ? (
                  <div className="empty-state">
                    <p className="empty-state-text text-lg mb-2">No submitted leases</p>
                    <p className="empty-state-text">Leases sent to candidates for signature appear here.</p>
                  </div>
                ) : (
                  <table className="inline-table">
                    <thead>
                      <tr>
                        <th>Tenant</th>
                        <th>Unit</th>
                        <th>Building</th>
                        <th>Rent</th>
                        <th>Sent</th>
                        <th>Deadline</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submitted.map(lease => {
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
                )}
              </div>
            </div>

            {/* List tabs: Active (0), Draft (1), Archive (4) */}
            {[0, 1, 4].map((tabIndex) => {
              const tab = LEASE_TABS[tabIndex];
              const filtered = [activeLease, draftLeases, null, null, archived][tabIndex];
              return (
                <div key={tabIndex} className={activeTab === tabIndex ? "tab-panel-active" : "tab-panel"}>
                  {loading ? (
                    <p className="loading-text">Loading leases...</p>
                  ) : error ? (
                    <p className="text-sm text-red-600">{error}</p>
                  ) : filtered.length === 0 ? (
                    <div className="empty-state">
                      <p className="empty-state-text text-lg mb-2">No leases found</p>
                      <p className="empty-state-text">Click &quot;+ New Lease&quot; to create your first rental contract.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="inline-table">
                        <thead>
                          <tr>
                            <th>Tenant</th>
                            <th>Unit</th>
                            <th>Building</th>
                            <th>Net Rent</th>
                            {tabIndex === 0 && <th>Charges</th>}
                            {tabIndex === 0 && <th>Total/mo</th>}
                            <th>Start</th>
                            <th>Status</th>
                            {tabIndex === 1 && <th>Tag</th>}
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.slice(0, 200).map(lease => {
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
                                  {/* "Ready for review" tag for backup-candidate redrafts */}
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
                  )}
                </div>
              );
            })}
          </Panel>
        </PageContent>
        <UndoToast {...toast} />
      </PageShell>
    </AppShell>
  );
}
