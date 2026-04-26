import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import ErrorBanner from "../../../components/ui/ErrorBanner";
import { ALLOWED_CATEGORIES } from "../../../lib/categories";
import DocumentsPanel from "../../../components/DocumentsPanel";
import AssetInventoryPanel from "../../../components/AssetInventoryPanel";
import Badge from "../../../components/ui/Badge";
import { cn } from "../../../lib/utils";
import { invoiceVariant, leaseVariant, reconciliationVariant } from "../../../lib/statusVariants";
import { formatChf, formatDate, formatChfCents } from "../../../lib/format";
import { authHeaders } from "../../../lib/api";
import ScrollableTabs from "../../../components/mobile/ScrollableTabs";
export default function UnitDetail() {
  const router = useRouter();
  const { id, role } = router.query;
  const isOwner = role === "owner";

  const [unit, setUnit] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [allTenants, setAllTenants] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [assigningTenant, setAssigningTenant] = useState(false);
  const [unassigningTenantId, setUnassigningTenantId] = useState(null);
  const [createTenantName, setCreateTenantName] = useState("");
  const [createTenantPhone, setCreateTenantPhone] = useState("");
  const [createTenantEmail, setCreateTenantEmail] = useState("");
  const [creatingTenant, setCreatingTenant] = useState(false);
  const [assetModels, setAssetModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editNumber, setEditNumber] = useState("");
  const [editFloor, setEditFloor] = useState("");
  const [editType, setEditType] = useState("");
  const [activeTab, setActiveTab] = useState("Details");
  const [tenantAction, setTenantAction] = useState(null);
  const [applicationIds, setApplicationIds] = useState([]);

  // Rent estimation fields
  const [editLivingArea, setEditLivingArea] = useState("");
  const [editRooms, setEditRooms] = useState("");
  const [editBalcony, setEditBalcony] = useState(false);
  const [editTerrace, setEditTerrace] = useState(false);
  const [editParking, setEditParking] = useState(false);
  const [editLocationSegment, setEditLocationSegment] = useState("");
  const [editLastRenovation, setEditLastRenovation] = useState("");
  const [editInsulation, setEditInsulation] = useState("");
  const [editEnergyLabel, setEditEnergyLabel] = useState("");
  const [editHeatingType, setEditHeatingType] = useState("");
  const [editMonthlyRent, setEditMonthlyRent] = useState("");
  const [editMonthlyCharges, setEditMonthlyCharges] = useState("");
  const [rentEstimate, setRentEstimate] = useState(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateError, setEstimateError] = useState(null);

  // Asset inventory state
  const [assetInventory, setAssetInventory] = useState([]);
  const [assetInventoryLoading, setAssetInventoryLoading] = useState(false);
  const [showAssetAddForm, setShowAssetAddForm] = useState(false);

  // Invoice state (all invoices — used inside Financials tab)
  const [unitInvoices, setUnitInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  // Financials tab state
  const [incomingInvoices, setIncomingInvoices] = useState([]);
  const [outgoingInvoices, setOutgoingInvoices] = useState([]);
  const [unitReconciliations, setUnitReconciliations] = useState([]);
  const [financialsLoading, setFinancialsLoading] = useState(false);
  const [financialsLoaded, setFinancialsLoaded] = useState(false);
  const [financialsSubTab, setFinancialsSubTab] = useState("overview");

  // Requests tab state
  const [unitRequests, setUnitRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsLoaded, setRequestsLoaded] = useState(false);

  // Lease / contracts state
  const [unitLeases, setUnitLeases] = useState([]);
  const [leasesLoading, setLeasesLoading] = useState(false);

  function setOk(message) {
    setNotice({ type: "ok", message });
    setTimeout(() => setNotice(null), 4000);
  }
  function setErr(message) {
    setNotice({ type: "err", message });
  }

  async function fetchJSON(path, options = {}) {
    const apiPath = path.startsWith("/api/") ? path : `/api${path}`;
    const res = await fetch(apiPath, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {}
    if (!res.ok) {
      const msg =
        data?.error?.message ||
        data?.error?.code ||
        data?.error ||
        data?.message ||
        `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return data;
  }

  async function loadUnit() {
    if (!id) return;
    try {
      setLoading(true);
      const data = await fetchJSON(`/units/${id}`);
      const u = data?.data || data;
      if (!u) {
        setErr("Unit not found");
        return;
      }
      setUnit(u);
      setEditNumber(u.unitNumber || u.name || "");
      setEditFloor(u.floor || "");
      setEditType(u.type || "");
      setEditLivingArea(u.livingAreaSqm ?? "");
      setEditRooms(u.rooms ?? "");
      setEditBalcony(!!u.hasBalcony);
      setEditTerrace(!!u.hasTerrace);
      setEditParking(!!u.hasParking);
      setEditLocationSegment(u.locationSegment || "");
      setEditLastRenovation(u.lastRenovationYear ?? "");
      setEditInsulation(u.insulationQuality || "");
      setEditEnergyLabel(u.energyLabel || "");
      setEditHeatingType(u.heatingType || "");
      setEditMonthlyRent(u.monthlyRentChf ?? "");
      setEditMonthlyCharges(u.monthlyChargesChf ?? "");
      await loadTenants();
      await loadAllTenants();
      await loadAssetModels();
      await loadAssetInventory();
      // Fetch leases for the unit to find linked rental application IDs
      try {
        const leasesData = await fetchJSON(`/leases?unitId=${id}`);
        const leases = Array.isArray(leasesData) ? leasesData : leasesData?.data || [];
        const appIds = leases.map((l) => l.applicationId).filter(Boolean);
        setApplicationIds([...new Set(appIds)]);
      } catch {}
    } catch (e) {
      setErr(`Failed to load unit: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  // TODO: Legacy — replace with filtered Asset query (category=EQUIPMENT) once Appliance model is retired
  async function loadAppliances() {
    if (!id) return;
    try {
      const data = await fetchJSON(`/units/${id}/appliances`);
      setAppliances(Array.isArray(data) ? data : data?.data || []);
    } catch (e) {
      setErr(`Failed to load appliances: ${e.message}`);
    }
  }

  async function loadTenants() {
    if (!id) return;
    try {
      const data = await fetchJSON(`/units/${id}/tenants`);
      setTenants(Array.isArray(data) ? data : data?.data || []);
    } catch (e) {
      // Silently fail; tenants may not be set up yet
    }
  }

  async function loadAllTenants() {
    try {
      const data = await fetchJSON(`/tenants`);
      setAllTenants(Array.isArray(data) ? data : data?.data || []);
    } catch (e) {
      // Silently fail
    }
  }

  async function loadAssetModels() {
    try {
      const data = await fetchJSON(`/asset-models`);
      setAssetModels(Array.isArray(data) ? data : data?.data || []);
    } catch (e) {
      // Silently fail
    }
  }

  async function loadAssetInventory() {
    if (!id) return;
    try {
      setAssetInventoryLoading(true);
      const data = await fetchJSON(`/units/${id}/asset-inventory`);
      setAssetInventory(Array.isArray(data) ? data : data?.data || []);
    } catch (e) {
      // Silently fail
    } finally {
      setAssetInventoryLoading(false);
    }
  }

  async function loadInvoices() {
    if (!id) return;
    try {
      setInvoicesLoading(true);
      const res = await fetchJSON(`/invoices?unitId=${id}&view=summary`);
      setUnitInvoices(Array.isArray(res) ? res : res?.data || []);
    } catch (e) {
      // Silently fail — tab will show empty state
    } finally {
      setInvoicesLoading(false);
    }
  }

  async function loadUnitFinancials() {
    if (!id || financialsLoaded) return;
    try {
      setFinancialsLoading(true);
      const [incRes, outRes, recRes, allInvRes] = await Promise.all([
        fetch(`/api/invoices?unitId=${id}&direction=INCOMING`, { headers: authHeaders() }),
        fetch(`/api/invoices?unitId=${id}&direction=OUTGOING`, { headers: authHeaders() }),
        fetch(`/api/charge-reconciliations`, { headers: authHeaders() }),
        fetchJSON(`/invoices?unitId=${id}&view=summary`),
      ]);
      const incJson = await incRes.json();
      const outJson = await outRes.json();
      const recJson = await recRes.json();
      setIncomingInvoices(Array.isArray(incJson) ? incJson : incJson?.data || []);
      setOutgoingInvoices(Array.isArray(outJson) ? outJson : outJson?.data || []);
      const allRec = Array.isArray(recJson) ? recJson : recJson?.data || [];
      setUnitReconciliations(allRec.filter((r) => r.lease?.unitId === id));
      setUnitInvoices(Array.isArray(allInvRes) ? allInvRes : allInvRes?.data || []);
      setFinancialsLoaded(true);
    } catch (e) {
      // Silently fail — tab will show empty state
    } finally {
      setFinancialsLoading(false);
    }
  }

  async function loadUnitRequests() {
    if (!id || requestsLoaded) return;
    try {
      setRequestsLoading(true);
      const res = await fetch(`/api/requests`, { headers: authHeaders() });
      const json = await res.json();
      const all = Array.isArray(json) ? json : json?.data || [];
      const OPEN_STATUSES = new Set(["PENDING_REVIEW", "APPROVED", "ASSIGNED", "IN_PROGRESS", "RFP_PENDING", "PENDING_OWNER_APPROVAL"]);
      setUnitRequests(all.filter((r) => r.unitId === id && OPEN_STATUSES.has(r.status)));
      setRequestsLoaded(true);
    } catch (e) {
      // Silently fail
    } finally {
      setRequestsLoading(false);
    }
  }

  useEffect(() => {
    if (id) loadUnit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadLeases() {
    if (!id) return;
    try {
      setLeasesLoading(true);
      const res = await fetchJSON(`/leases?unitId=${id}`);
      setUnitLeases(Array.isArray(res) ? res : res?.data || []);
    } catch (e) {
      // Silently fail
    } finally {
      setLeasesLoading(false);
    }
  }

  useEffect(() => {
    if (id && activeTab === "Contracts") loadLeases();
    if (id && activeTab === "Financials") loadUnitFinancials();
    if (id && activeTab === "Requests") loadUnitRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, activeTab]);

  async function onDeactivateUnit() {
    if (!confirm("Deactivate this unit? This cannot be undone.")) return;
    try {
      setLoading(true);
      await fetchJSON(`/units/${id}`, { method: "DELETE" });
      setOk("Unit deactivated. Redirecting...");
      setTimeout(() => router.back(), 1500);
    } catch (e) {
      setErr(`Deactivate failed: ${e.message}`);
      setLoading(false);
    }
  }

  async function onCalculateEstimate() {
    try {
      setEstimateLoading(true);
      setEstimateError(null);
      const data = await fetchJSON(`/units/${id}/rent-estimate`);
      setRentEstimate(data?.data || data);
    } catch (e) {
      setEstimateError(e.message);
      setRentEstimate(null);
    } finally {
      setEstimateLoading(false);
    }
  }

  async function onSaveUnit() {
    try {
      setLoading(true);
      const payload = {
        unitNumber: editNumber.trim() || undefined,
        floor: editFloor.trim() || undefined,
        type: editType || undefined,
        livingAreaSqm: editLivingArea !== "" ? Number(editLivingArea) : undefined,
        rooms: editRooms !== "" ? Number(editRooms) : undefined,
        hasBalcony: editBalcony,
        hasTerrace: editTerrace,
        hasParking: editParking,
        locationSegment: editLocationSegment || undefined,
        lastRenovationYear: editLastRenovation !== "" ? Number(editLastRenovation) : undefined,
        insulationQuality: editInsulation || undefined,
        energyLabel: editEnergyLabel || undefined,
        heatingType: editHeatingType || undefined,
        monthlyRentChf: editMonthlyRent !== "" ? Number(editMonthlyRent) : null,
        monthlyChargesChf: editMonthlyCharges !== "" ? Number(editMonthlyCharges) : null,
      };
      const data = await fetchJSON(`/units/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      const updated = data?.data || data;
      setUnit(updated);
      setEditMode(false);
      setOk("Unit updated.");
    } catch (e) {
      setErr(`Update failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }


  async function onAssignTenant(e) {
    e.preventDefault();
    if (!selectedTenantId) return setErr("Select a tenant to assign.");
    try {
      setAssigningTenant(true);
      await fetchJSON(`/units/${id}/tenants`, {
        method: "POST",
        body: JSON.stringify({ tenantId: selectedTenantId }),
      });
      setSelectedTenantId("");
      await loadTenants();
      await loadAllTenants();
      setTenantAction(null);
      setOk("Tenant assigned.");
    } catch (e) {
      setErr(`Assign failed: ${e.message}`);
    } finally {
      setAssigningTenant(false);
    }
  }

  async function onUnassignTenant(tenantId) {
    if (!confirm("Remove this tenant from the unit?")) return;
    try {
      setUnassigningTenantId(tenantId);
      await fetchJSON(`/units/${id}/tenants/${tenantId}`, { method: "DELETE" });
      await loadTenants();
      await loadAllTenants();
      setOk("Tenant unassigned.");
    } catch (e) {
      setErr(`Unassign failed: ${e.message}`);
    } finally {
      setUnassigningTenantId(null);
    }
  }

  async function onCreateTenant(e) {
    e.preventDefault();
    if (!createTenantPhone.trim()) return setErr("Phone is required.");
    try {
      setCreatingTenant(true);
      const payload = {
        phone: createTenantPhone.trim(),
        ...(createTenantName.trim() ? { name: createTenantName.trim() } : {}),
        ...(createTenantEmail.trim() ? { email: createTenantEmail.trim() } : {}),
      };
      const created = await fetchJSON(`/tenants`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const createdTenantId = created?.data?.id || created?.id;
      if (createdTenantId) {
        await fetchJSON(`/units/${id}/tenants`, {
          method: "POST",
          body: JSON.stringify({ tenantId: createdTenantId }),
        });
      }
      setCreateTenantName("");
      setCreateTenantPhone("");
      setCreateTenantEmail("");
      await loadTenants();
      await loadAllTenants();
      setTenantAction(null);
      setOk("Tenant created and assigned.");
    } catch (e) {
      setErr(`Create tenant failed: ${e.message}`);
    } finally {
      setCreatingTenant(false);
    }
  }

  const assignedTenantIds = new Set(tenants.map((t) => t.id));
  const hasActiveLease = (unit?.leases ?? []).length > 0;
  const occupancyStatus = hasActiveLease ? "OCCUPIED" : unit?.isVacant ? "LISTED" : "VACANT";
  const occupancyLabel = occupancyStatus === "OCCUPIED" ? "Occupied" : occupancyStatus === "LISTED" ? "Listed" : "Vacant";
  const occupancyVariant = occupancyStatus === "OCCUPIED" ? "success" : occupancyStatus === "LISTED" ? "info" : "destructive";
  const orgModels = assetModels.filter((m) => m.orgId);

  if (loading) {
    return (
      <AppShell role={isOwner ? "OWNER" : "MANAGER"}>
        <PageShell variant="embedded">
          <PageHeader title="Unit" />
          <PageContent><p className="loading-text">Loading unit…</p></PageContent>
        </PageShell>
      </AppShell>
    );
  }

  return (
    <AppShell role={isOwner ? "OWNER" : "MANAGER"}>
      <PageShell variant="embedded">
        <div className="mb-3">
          <Link href={unit?.building?.id ? `/admin-inventory/buildings/${unit.building.id}${isOwner ? "?role=owner" : ""}` : (isOwner ? "/owner/properties" : "/admin-inventory")} className="text-sm font-medium text-slate-600 hover:text-slate-900">
            ← Back
          </Link>
        </div>
        <PageHeader
          title={`Unit ${unit?.unitNumber || "Detail"}`}
          subtitle={unit?.building?.name ? `Building: ${unit.building.name}` : undefined}
        />
        <PageContent>
          {notice && (
            <div className={cn("notice", notice.type === "ok" ? "notice-ok" : "notice-err")}>
              {notice.message}
            </div>
          )}

          <ScrollableTabs activeIndex={["Details", "Tenants", "Assets", "Rent Estimate", "Documents", "Financials", "Contracts", "Requests"].indexOf(activeTab)}>
            {["Details", "Tenants", "Assets", "Rent Estimate", "Documents", "Financials", "Contracts", "Requests"].map((tab) => (
              <button key={tab} type="button"
                className={activeTab === tab ? "tab-btn-active" : "tab-btn"}
                onClick={() => setActiveTab(tab)}>
                {tab}
              </button>
            ))}
          </ScrollableTabs>

          {activeTab === "Details" && (
          <Panel title="Unit Details" actions={editMode ? (
              <>
                <button type="button" className="button-primary text-sm" onClick={onSaveUnit} disabled={loading}>
                  {loading ? "Saving…" : "Save changes"}
                </button>
                <button type="button" className="button-cancel text-sm" onClick={() => {
                    setEditMode(false);
                    setEditNumber(unit?.unitNumber || "");
                    setEditFloor(unit?.floor || "");
                    setEditType(unit?.type || "");
                    setEditLivingArea(unit?.livingAreaSqm ?? "");
                    setEditRooms(unit?.rooms ?? "");
                    setEditBalcony(!!unit?.hasBalcony);
                    setEditTerrace(!!unit?.hasTerrace);
                    setEditParking(!!unit?.hasParking);
                    setEditLocationSegment(unit?.locationSegment || "");
                    setEditLastRenovation(unit?.lastRenovationYear ?? "");
                    setEditInsulation(unit?.insulationQuality || "");
                    setEditEnergyLabel(unit?.energyLabel || "");
                    setEditHeatingType(unit?.heatingType || "");
                    setEditMonthlyRent(unit?.monthlyRentChf ?? "");
                    setEditMonthlyCharges(unit?.monthlyChargesChf ?? "");
                  }}>
                  Cancel
                </button>
              </>
            ) : (
                <button type="button" className="button-primary text-sm" onClick={() => setEditMode(true)}>
                  Edit
                </button>
            )}>
            {editMode ? (
              <div className="mb-4">
                <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Unit number</span>
                <input className="filter-input w-full" value={editNumber} onChange={(e) => setEditNumber(e.target.value)} placeholder="e.g. Apt 3B" />
              </div>
              <div className="grid gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Floor</span>
                <input className="filter-input w-full" value={editFloor} onChange={(e) => setEditFloor(e.target.value)} placeholder="e.g. 3" />
              </div>
              <div className="grid gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Type</span>
                <select className="filter-input w-full" value={editType} onChange={(e) => setEditType(e.target.value)}>
                  <option value="">— Select type —</option>
                  <option value="RESIDENTIAL">Residential</option>
                  <option value="COMMON_AREA">Common area</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Living area (m²)</span>
                <input className="filter-input w-full" type="number" step="0.1" min="0" value={editLivingArea} onChange={(e) => setEditLivingArea(e.target.value)} placeholder="e.g. 75" />
              </div>
              <div className="grid gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Rooms</span>
                <input className="filter-input w-full" type="number" step="0.5" min="0" value={editRooms} onChange={(e) => setEditRooms(e.target.value)} placeholder="e.g. 3.5" />
              </div>
              <div className="grid gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Location segment</span>
                <select className="filter-input w-full" value={editLocationSegment} onChange={(e) => setEditLocationSegment(e.target.value)}>
                  <option value="">— Select —</option>
                  <option value="PRIME">Prime</option>
                  <option value="STANDARD">Standard</option>
                  <option value="PERIPHERY">Periphery</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Last renovation year</span>
                <input className="filter-input w-full" type="number" min="1900" max="2099" value={editLastRenovation} onChange={(e) => setEditLastRenovation(e.target.value)} placeholder="e.g. 2015" />
              </div>
              <div className="grid gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Energy label</span>
                <select className="filter-input w-full" value={editEnergyLabel} onChange={(e) => setEditEnergyLabel(e.target.value)}>
                  <option value="">— Select —</option>
                  {["A","B","C","D","E","F","G"].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="grid gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Heating type</span>
                <select className="filter-input w-full" value={editHeatingType} onChange={(e) => setEditHeatingType(e.target.value)}>
                  <option value="">— Select —</option>
                  <option value="HEAT_PUMP">Heat pump</option>
                  <option value="DISTRICT">District</option>
                  <option value="GAS">Gas</option>
                  <option value="OIL">Oil</option>
                  <option value="ELECTRIC">Electric</option>
                  <option value="UNKNOWN">Unknown</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Insulation quality</span>
                <select className="filter-input w-full" value={editInsulation} onChange={(e) => setEditInsulation(e.target.value)}>
                  <option value="">— Select —</option>
                  <option value="EXCELLENT">Excellent</option>
                  <option value="GOOD">Good</option>
                  <option value="AVERAGE">Average</option>
                  <option value="POOR">Poor</option>
                  <option value="UNKNOWN">Unknown</option>
                </select>
              </div>
              <div className="flex items-end gap-5 pb-1 col-span-full">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={editBalcony} onChange={(e) => setEditBalcony(e.target.checked)} /> Balcony
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={editTerrace} onChange={(e) => setEditTerrace(e.target.checked)} /> Terrace
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={editParking} onChange={(e) => setEditParking(e.target.checked)} /> Parking
                </label>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-4">
            {/* ── Pricing ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Net rent</div>
                <div className="text-lg font-bold text-slate-900 mt-1">{unit?.monthlyRentChf != null ? `CHF ${unit.monthlyRentChf}.-` : "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Charges</div>
                <div className="text-lg font-bold text-slate-900 mt-1">{unit?.monthlyChargesChf != null ? `CHF ${unit.monthlyChargesChf}.-` : "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Total incl. charges</div>
                <div className="text-lg font-bold text-slate-900 mt-1">{unit?.monthlyRentChf != null || unit?.monthlyChargesChf != null ? `CHF ${(unit?.monthlyRentChf || 0) + (unit?.monthlyChargesChf || 0)}.-` : "—"}</div>
              </div>
            </div>
            {/* ── Unit details grid ── */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Unit number</div>
                <div className="text-sm text-slate-700 mt-1">{unit?.unitNumber || unit?.name || "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Floor</div>
                <div className="text-sm text-slate-700 mt-1">{unit?.floor || "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Type</div>
                <div className="text-sm text-slate-700 mt-1">{unit?.type || "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Living area</div>
                <div className="text-sm text-slate-700 mt-1">{unit?.livingAreaSqm != null ? `${unit.livingAreaSqm} m²` : "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Rooms</div>
                <div className="text-sm text-slate-700 mt-1">{unit?.rooms ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Location</div>
                <div className="text-sm text-slate-700 mt-1">{unit?.locationSegment || "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Last renovation</div>
                <div className="text-sm text-slate-700 mt-1">{unit?.lastRenovationYear || "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Energy label</div>
                <div className="text-sm text-slate-700 mt-1">{unit?.energyLabel || "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Heating</div>
                <div className="text-sm text-slate-700 mt-1">{unit?.heatingType ? unit.heatingType.replace(/_/g, " ").toLowerCase() : "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Insulation</div>
                <div className="text-sm text-slate-700 mt-1">{unit?.insulationQuality ? unit.insulationQuality.toLowerCase() : "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Status</div>
                <div className="text-sm text-slate-700 mt-1"><Badge variant={occupancyVariant} size="sm">{occupancyLabel}</Badge></div>
              </div>
              <div className="col-span-full">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Features</div>
                <div className="text-sm text-slate-700 mt-1 flex gap-2">
                  {unit?.hasBalcony && <Badge variant="info" size="md">Balcony</Badge>}
                  {unit?.hasTerrace && <Badge variant="info" size="md">Terrace</Badge>}
                  {unit?.hasParking && <Badge variant="info" size="md">Parking</Badge>}
                  {!unit?.hasBalcony && !unit?.hasTerrace && !unit?.hasParking && "—"}
                </div>
              </div>
            </div>
          </div>
        )}
        <button type="button" className="px-4 py-2 rounded-lg border-none bg-red-600 hover:bg-red-700 text-white cursor-pointer font-semibold text-sm" onClick={onDeactivateUnit} disabled={loading}>
          Deactivate unit
        </button>
      </Panel>
          )}

          {activeTab === "Assets" && (
        <Panel title="Asset Inventory & Depreciation" actions={
            showAssetAddForm ? (
              <button type="button" className="button-cancel text-sm" onClick={() => setShowAssetAddForm(false)}>Cancel</button>
            ) : (
              <button type="button" className="button-primary text-sm" onClick={() => setShowAssetAddForm(true)}>Add asset</button>
            )
          }>
          {assetInventoryLoading ? (
            <p className="text-center text-slate-400">Loading assets…</p>
          ) : (
            <AssetInventoryPanel
              assets={assetInventory}
              onRefresh={loadAssetInventory}
              scope="unit"
              parentId={id}
              unitId={id}
              showAddForm={showAssetAddForm}
              setShowAddForm={setShowAssetAddForm}
            />
          )}
        </Panel>
          )}

          {activeTab === "Tenants" && (
        <Panel title="Tenants" actions={
            tenantAction ? (
              <button type="button" className="button-cancel text-sm" onClick={() => setTenantAction(null)}>Close</button>
            ) : (
              <button type="button" className="button-primary text-sm" onClick={() => {
                if (!hasActiveLease && tenants.length === 0) {
                  setTenantAction("no-lease");
                } else if (tenants.length > 0) {
                  setTenantAction("add-secondary");
                } else {
                  setTenantAction("menu");
                }
              }}>Add tenant</button>
            )
          }>
          <div className="flex flex-col gap-3">
            {tenants.length === 0 ? (
              <div className="empty-state-text py-6 text-center italic">No tenants assigned to this unit.</div>
            ) : (
              tenants.map((t, idx) => (
                <div key={t.id} className="flex justify-between items-center p-3 border border-slate-200 rounded-lg bg-slate-50">
                  <div>
                    <div className="font-semibold text-sm">
                      {isOwner ? (
                        <span>{t.name || "Tenant"}</span>
                      ) : (
                        <Link href={`/manager/people/tenants/${t.id}`} className="text-blue-600 hover:underline">
                          {t.name || "Tenant"}
                        </Link>
                      )}
                      {idx === 0 && <span className="ml-2 text-xs text-slate-400 font-normal">(primary)</span>}
                    </div>
                    <div className="text-sm text-slate-500 mt-1">Phone: {t.phone || "—"}</div>
                  </div>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => onUnassignTenant(t.id)}
                    disabled={unassigningTenantId === t.id}
                  >
                    {unassigningTenantId === t.id ? "Removing..." : "Remove"}
                  </button>
                </div>
              ))
            )}
          </div>

          {tenantAction && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex flex-col gap-4 mt-4">
            {tenantAction === "no-lease" && (
              <div className="text-sm text-slate-600">
                <div className="font-semibold text-slate-800 mb-2">Lease required</div>
                <p className="mb-3">
                  A primary tenant must be added through a lease contract. Create a lease for this unit first — the tenant will be automatically assigned when the lease is sent for signature.
                </p>
                {!isOwner && (
                  <Link
                    href={`/manager/leases?unitId=${id}`}
                    className="button-primary inline-block text-sm"
                  >
                    Go to Leases →
                  </Link>
                )}
              </div>
            )}

            {tenantAction === "add-secondary" && (
              <div className="grid gap-2.5">
                <div className="text-sm text-slate-600 mb-1">
                  <span className="font-semibold text-slate-800">Add additional occupant</span> — choose how to add this person:
                </div>
                <button type="button" className="button-secondary text-left" onClick={() => setTenantAction("lease-amendment")}>
                  Add to lease (amendment)
                  <div className="text-sm text-slate-500 mt-1">This person has contractual authority and should appear on the lease.</div>
                </button>
                <button type="button" className="button-secondary text-left" onClick={() => setTenantAction("menu")}>
                  Add as occupant only
                  <div className="text-sm text-slate-500 mt-1">No lease change needed (e.g. children, dependants without contractual authority).</div>
                </button>
              </div>
            )}

            {tenantAction === "lease-amendment" && (
              <div className="text-sm text-slate-600">
                <div className="font-semibold text-slate-800 mb-2">Lease amendment required</div>
                <p className="mb-3">
                  Adding a co-tenant to the lease requires an amendment to the existing contract. This will be available as a workflow in a future update.
                </p>
                <p className="text-xs text-slate-400">
                  For now, you can add the person as an occupant and manually update the lease contract.
                </p>
                <div className="mt-3 flex gap-2">
                  <button type="button" className="button-secondary text-sm" onClick={() => setTenantAction("menu")}>
                    Add as occupant instead
                  </button>
                  <button type="button" className="button-cancel text-sm" onClick={() => setTenantAction(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {tenantAction === "menu" && (
              <div className="grid gap-2.5">
                {tenants.length > 0 && (
                  <div className="text-xs text-slate-400 mb-1">Adding as occupant only — no lease change.</div>
                )}
                <button type="button" className="button-secondary text-left" onClick={() => setTenantAction("assign")}>
                  Assign tenant
                  <div className="text-sm text-slate-500 mt-1">Pick from existing tenants.</div>
                </button>
                <button type="button" className="button-secondary text-left" onClick={() => setTenantAction("create")}>
                  Create new tenant + assign
                  <div className="text-sm text-slate-500 mt-1">Enter name, phone, and email.</div>
                </button>
              </div>
            )}

            {tenantAction === "assign" && (
              <>
                <button type="button" className="button-secondary" onClick={() => setTenantAction(tenants.length > 0 ? "add-secondary" : "menu")}>
                  Back to options
                </button>
                <form onSubmit={onAssignTenant} className="flex gap-4 items-end mb-4 flex-wrap">
                  <div className="min-w-[280px]">
                    <label className="filter-label">Assign tenant</label>
                    <select
                      className="filter-input w-full"
                      value={selectedTenantId}
                      onChange={(e) => setSelectedTenantId(e.target.value)}
                      disabled={assigningTenant}
                    >
                      <option value="">— Select tenant —</option>
                      {allTenants.map((t) => (
                        <option key={t.id} value={t.id} disabled={assignedTenantIds.has(t.id)}>
                          {t.name || "Tenant"} • {t.phone || "no phone"}
                          {assignedTenantIds.has(t.id) ? " (assigned)" : ""}
                        </option>
                      ))}
                    </select>
                    {allTenants.length === 0 && (
                      <div className="text-sm text-slate-500 mt-1">No tenants found in the system.</div>
                    )}
                  </div>
                  <button type="submit" className="button-primary" disabled={assigningTenant || !selectedTenantId}>
                    Assign tenant
                  </button>
                </form>
              </>
            )}

            {tenantAction === "create" && (
              <>
                <button type="button" className="button-secondary" onClick={() => setTenantAction(tenants.length > 0 ? "add-secondary" : "menu")}>
                  Back to options
                </button>
                <form onSubmit={onCreateTenant} className="flex gap-4 items-end mb-4 flex-wrap">
                  <div className="min-w-[240px]">
                    <label className="filter-label">Name (optional)</label>
                    <input
                      className="filter-input w-full"
                      value={createTenantName}
                      onChange={(e) => setCreateTenantName(e.target.value)}
                      placeholder="e.g. Jane Doe"
                    />
                  </div>
                  <div className="min-w-[240px]">
                    <label className="filter-label">Phone</label>
                    <input
                      className="filter-input w-full"
                      value={createTenantPhone}
                      onChange={(e) => setCreateTenantPhone(e.target.value)}
                      placeholder="+41 79 123 45 67"
                    />
                  </div>
                  <div className="min-w-[240px]">
                    <label className="filter-label">Email (optional)</label>
                    <input
                      className="filter-input w-full"
                      value={createTenantEmail}
                      onChange={(e) => setCreateTenantEmail(e.target.value)}
                      placeholder="tenant@example.com"
                    />
                  </div>
                  <button type="submit" className="button-primary" disabled={creatingTenant}>
                    {creatingTenant ? "Creating..." : "Create + assign"}
                  </button>
                </form>
              </>
            )}
          </div>
          )}
        </Panel>
          )}

          {activeTab === "Rent Estimate" && (
        <Panel title="Rent Estimate" actions={unit?.livingAreaSqm ? (
              <button
                type="button"
                className="button-primary text-sm"
                disabled={estimateLoading}
                onClick={onCalculateEstimate}
              >
                {estimateLoading ? "Calculating…" : rentEstimate ? "Recalculate" : "Calculate Estimate"}
              </button>
            ) : null}>
          {!unit?.livingAreaSqm ? (
            <div className={cn("notice", "notice-err")}>
              Living area (m²) is required to estimate rent. Switch to the <strong>Details</strong> tab, click <strong>Edit</strong>, and fill in the estimation inputs.
            </div>
          ) : (
            <>
              {estimateError && (
                <div className={cn("notice notice-err")}>{estimateError}</div>
              )}

              {rentEstimate && (
                <div className="mt-5">
                  {/* Main figures */}
                  <div className="grid grid-cols-3 gap-4 mb-5">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                      <div className="text-xs font-semibold uppercase text-green-700">Net Rent</div>
                      <div className="text-2xl font-bold text-green-800">CHF {rentEstimate.netRentChfMonthly}</div>
                      <div className="text-sm text-slate-500">per month</div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                      <div className="text-xs font-semibold uppercase text-blue-700">Total (optimistic)</div>
                      <div className="text-2xl font-bold text-blue-800">CHF {rentEstimate.totalOptimisticChfMonthly}</div>
                      <div className="text-sm text-slate-500">incl. charges CHF {rentEstimate.chargesOptimisticChfMonthly}</div>
                    </div>
                    <div className="bg-amber-100 border border-amber-300 rounded-lg p-4 text-center">
                      <div className="text-xs font-semibold uppercase text-amber-800">Total (pessimistic)</div>
                      <div className="text-2xl font-bold text-amber-900">CHF {rentEstimate.totalPessimisticChfMonthly}</div>
                      <div className="text-sm text-slate-500">incl. charges CHF {rentEstimate.chargesPessimisticChfMonthly}</div>
                    </div>
                  </div>

                  {/* Coefficients breakdown */}
                  <details className="mb-3">
                    <summary className="cursor-pointer font-semibold text-[0.95rem] text-slate-700">Applied Coefficients</summary>
                    <div className="grid grid-cols-2 gap-2 mt-2.5 text-sm">
                      <div>Base rent/m²: <strong>CHF {rentEstimate.appliedCoefficients.baseRentPerSqm}</strong></div>
                      <div>Location: <strong>×{rentEstimate.appliedCoefficients.locationCoef}</strong></div>
                      <div>Age: <strong>×{rentEstimate.appliedCoefficients.ageCoef}</strong></div>
                      <div>Energy: <strong>×{rentEstimate.appliedCoefficients.energyCoef}</strong></div>
                      <div>Charges rate (opt): <strong>{(rentEstimate.appliedCoefficients.chargesRateOptimistic * 100).toFixed(1)}%</strong></div>
                      <div>Charges rate (pes): <strong>{(rentEstimate.appliedCoefficients.chargesRatePessimistic * 100).toFixed(1)}%</strong></div>
                      <div>Heating adj: <strong>{rentEstimate.appliedCoefficients.heatingAdj >= 0 ? "+" : ""}{(rentEstimate.appliedCoefficients.heatingAdj * 100).toFixed(1)}%</strong></div>
                      <div>Service adj: <strong>+{(rentEstimate.appliedCoefficients.serviceAdj * 100).toFixed(1)}%</strong></div>
                    </div>
                  </details>

                  {/* Inputs used */}
                  <details className="mb-3">
                    <summary className="cursor-pointer font-semibold text-[0.95rem] text-slate-700">Inputs Used</summary>
                    <div className="grid grid-cols-2 gap-2 mt-2.5 text-sm">
                      <div>Living area: <strong>{rentEstimate.inputsUsed.livingAreaSqm} m²</strong></div>
                      <div>Segment: <strong>{rentEstimate.inputsUsed.segment}</strong></div>
                      <div>Effective year: <strong>{rentEstimate.inputsUsed.effectiveYear || "—"}</strong></div>
                      <div>Energy: <strong>{rentEstimate.inputsUsed.energyLabel || "—"}</strong></div>
                      <div>Heating: <strong>{rentEstimate.inputsUsed.heatingType || "—"}</strong></div>
                      <div>Elevator: <strong>{rentEstimate.inputsUsed.hasElevator ? "Yes" : "No"}</strong></div>
                      <div>Concierge: <strong>{rentEstimate.inputsUsed.hasConcierge ? "Yes" : "No"}</strong></div>
                    </div>
                  </details>

                  {/* Warnings */}
                  {rentEstimate.warnings?.length > 0 && (
                    <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 mt-2">
                      <div className="font-semibold text-sm text-amber-800 mb-1">⚠ Warnings</div>
                      <ul className="m-0 pl-[18px] text-sm text-amber-900">
                        {rentEstimate.warnings.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </Panel>
          )}

          {activeTab === "Documents" && (
        <Panel title="Corroborative Documents">
          {applicationIds.length === 0 ? (
            <div className="empty-state-text py-6 text-center italic">No rental application linked to this unit.</div>
          ) : (
            applicationIds.map((appId) => (
              <div key={appId} className="mb-4">
                <DocumentsPanel applicationId={appId} />
              </div>
            ))
          )}
        </Panel>
          )}

          {activeTab === "Financials" && (
        <div>
          {/* Segmented pill control */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 gap-0.5 mt-4 mb-6 flex-wrap">
            {[
              { key: "overview", label: "Overview" },
              { key: "reconciliations", label: "Reconciliations" },
              { key: "invoices", label: "Invoices" },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFinancialsSubTab(key)}
                className={financialsSubTab === key
                  ? "rounded-md bg-white shadow-sm px-4 py-1.5 text-sm font-medium text-slate-900 transition"
                  : "rounded-md px-4 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition"}
              >
                {label}
              </button>
            ))}
          </div>

          {financialsLoading ? (
            <div className="py-6 text-center text-sm text-slate-500">Loading financials…</div>
          ) : (
            <>
              {financialsSubTab === "overview" && (() => {
                const totalIncome = incomingInvoices.reduce((s, inv) => s + (inv.totalAmount ?? 0), 0);
                const totalExpenses = outgoingInvoices.reduce((s, inv) => s + (inv.totalAmount ?? 0), 0);
                const net = totalIncome - totalExpenses;
                return (
                  <div className="space-y-6">
                    <Panel title="Income vs. Expenses">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <div className="text-xs font-medium uppercase tracking-wide text-green-700">Income (tenant invoices)</div>
                          <div className="text-2xl font-bold text-green-800 mt-1">{formatChf(totalIncome)}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{incomingInvoices.length} invoice{incomingInvoices.length !== 1 ? "s" : ""}</div>
                        </div>
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                          <div className="text-xs font-medium uppercase tracking-wide text-red-700">Expenses (maintenance)</div>
                          <div className="text-2xl font-bold text-red-800 mt-1">{formatChf(totalExpenses)}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{outgoingInvoices.length} invoice{outgoingInvoices.length !== 1 ? "s" : ""}</div>
                        </div>
                        <div className={cn("p-4 border rounded-lg", net >= 0 ? "bg-blue-50 border-blue-200" : "bg-amber-50 border-amber-200")}>
                          <div className={cn("text-xs font-medium uppercase tracking-wide", net >= 0 ? "text-blue-700" : "text-amber-700")}>Net</div>
                          <div className={cn("text-2xl font-bold mt-1", net >= 0 ? "text-blue-800" : "text-amber-800")}>{formatChf(net)}</div>
                        </div>
                      </div>
                    </Panel>
                    {unitReconciliations.length > 0 && (
                      <Panel title="Nebenkosten Summary">
                        <div className="overflow-x-auto">
                          <table className="data-table w-full text-sm">
                            <thead>
                              <tr>
                                <th className="text-left px-3 py-2">Year</th>
                                <th className="text-left px-3 py-2">Status</th>
                                <th className="text-right px-3 py-2">Acompte Paid</th>
                                <th className="text-right px-3 py-2">Actual Costs</th>
                                <th className="text-right px-3 py-2">Balance</th>
                              </tr>
                            </thead>
                            <tbody>
                              {unitReconciliations.map((r) => (
                                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/manager/charge-reconciliations/${r.id}`)}>
                                  <td className="px-3 py-2 tabular-nums">{r.fiscalYear}</td>
                                  <td className="px-3 py-2"><Badge variant={reconciliationVariant(r.status)} size="sm">{r.status}</Badge></td>
                                  <td className="px-3 py-2 text-right tabular-nums">{formatChfCents(r.totalAcomptePaidCents)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{formatChfCents(r.totalActualCostsCents)}</td>
                                  <td className={cn("px-3 py-2 text-right tabular-nums", r.balanceCents > 0 ? "text-red-600" : r.balanceCents < 0 ? "text-green-600" : "")}>
                                    {r.balanceCents > 0 ? "+" : ""}{formatChfCents(r.balanceCents)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Panel>
                    )}
                  </div>
                );
              })()}

              {financialsSubTab === "reconciliations" && (
                <Panel title="Charge Reconciliations (Nebenkosten)">
                  {unitReconciliations.length === 0 ? (
                    <div className="empty-state-text py-6 text-center italic">No charge reconciliations for this unit.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="data-table w-full text-sm">
                        <thead>
                          <tr>
                            <th className="text-left px-3 py-2">Tenant</th>
                            <th className="text-left px-3 py-2">Year</th>
                            <th className="text-left px-3 py-2">Status</th>
                            <th className="text-right px-3 py-2">Acompte Paid</th>
                            <th className="text-right px-3 py-2">Actual Costs</th>
                            <th className="text-right px-3 py-2">Balance</th>
                            <th className="text-right px-3 py-2">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unitReconciliations.map((r) => (
                            <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                              <td className="px-3 py-2">
                                <Link href={`/manager/charge-reconciliations/${r.id}`} className="cell-link">
                                  {r.lease?.tenantName || "—"}
                                </Link>
                              </td>
                              <td className="px-3 py-2 tabular-nums">{r.fiscalYear}</td>
                              <td className="px-3 py-2"><Badge variant={reconciliationVariant(r.status)} size="sm">{r.status}</Badge></td>
                              <td className="px-3 py-2 text-right tabular-nums">{formatChfCents(r.totalAcomptePaidCents)}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{formatChfCents(r.totalActualCostsCents)}</td>
                              <td className={cn("px-3 py-2 text-right tabular-nums", r.balanceCents > 0 ? "text-red-600" : r.balanceCents < 0 ? "text-green-600" : "")}>
                                {r.balanceCents > 0 ? "+" : ""}{formatChfCents(r.balanceCents)}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <Link href={`/manager/charge-reconciliations/${r.id}`} className="cell-link">
                                  {r.status === "DRAFT" ? "Edit" : "View"}
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Panel>
              )}

              {financialsSubTab === "invoices" && (
                <Panel title="Invoices">
                  {unitInvoices.length === 0 ? (
                    <div className="empty-state-text py-6 text-center italic">No invoices linked to this unit.</div>
                  ) : (
                    <>
                      <div className="sm:hidden space-y-2">
                        {unitInvoices.map((inv) => (
                          <div key={inv.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-900 truncate">{inv.invoiceNumber || "Draft"}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{formatChf(inv.totalAmount)}</p>
                            </div>
                            <Badge variant={invoiceVariant(inv.status)}>{inv.status}</Badge>
                          </div>
                        ))}
                      </div>
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="data-table w-full text-sm">
                          <thead>
                            <tr>
                              <th className="text-left px-3 py-2">Status</th>
                              <th className="text-left px-3 py-2">Invoice #</th>
                              <th className="text-left px-3 py-2">Description</th>
                              <th className="text-right px-3 py-2">Amount</th>
                              <th className="text-left px-3 py-2">Period</th>
                              <th className="text-left px-3 py-2">Due Date</th>
                              <th className="text-left px-3 py-2">Created</th>
                            </tr>
                          </thead>
                          <tbody>
                            {unitInvoices.map((inv) => (
                              <tr key={inv.id} className="border-t border-slate-100 hover:bg-slate-50">
                                <td className="px-3 py-2"><Badge variant={invoiceVariant(inv.status)}>{inv.status}</Badge></td>
                                <td className="px-3 py-2">
                                  {isOwner ? (
                                    <span>{inv.invoiceNumber || "—"}</span>
                                  ) : (
                                    <Link href={`/manager/finance/invoices/${inv.id}`} className="text-blue-600 hover:underline">
                                      {inv.invoiceNumber || "—"}
                                    </Link>
                                  )}
                                </td>
                                <td className="px-3 py-2 max-w-[200px] truncate">{inv.description || "—"}</td>
                                <td className="px-3 py-2 text-right font-medium">{formatChf(inv.totalAmount)}</td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {inv.billingPeriodStart && inv.billingPeriodEnd
                                    ? `${formatDate(inv.billingPeriodStart)} – ${formatDate(inv.billingPeriodEnd)}`
                                    : "—"}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">{inv.dueDate ? formatDate(inv.dueDate) : "—"}</td>
                                <td className="px-3 py-2 whitespace-nowrap">{formatDate(inv.createdAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </Panel>
              )}
            </>
          )}
        </div>
          )}

          {activeTab === "Contracts" && (
        <Panel title="Contracts">
          {leasesLoading ? (
            <div className="py-6 text-center text-sm text-slate-500">Loading leases…</div>
          ) : unitLeases.length === 0 ? (
            <div className="empty-state-text py-6 text-center italic">No leases found for this unit.</div>
          ) : (
            <>
              {/* Mobile: card list */}
              <div className="sm:hidden space-y-2">
                {unitLeases.map((lease) => (
                  <div key={lease.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate">{lease.tenantName || "—"}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatDate(lease.startDate)} · {formatChf(lease.netRentChf)}/mo
                      </p>
                    </div>
                    <Badge variant={leaseVariant(lease.status)}>{lease.status}</Badge>
                  </div>
                ))}
              </div>
              {/* Desktop: table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="data-table w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left px-3 py-2">Status</th>
                      <th className="text-left px-3 py-2">Tenant</th>
                      <th className="text-right px-3 py-2">Net Rent</th>
                      <th className="text-right px-3 py-2">Total</th>
                      <th className="text-left px-3 py-2">Start</th>
                      <th className="text-left px-3 py-2">End</th>
                      <th className="text-left px-3 py-2">Notice</th>
                      <th className="text-left px-3 py-2">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unitLeases.map((lease) => (
                      <tr key={lease.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-2">
                          <Badge variant={leaseVariant(lease.status)}>{lease.status}</Badge>
                        </td>
                        <td className="px-3 py-2">
                          {isOwner ? (
                            <span>{lease.tenantName || "—"}</span>
                          ) : (
                            <Link href={`/manager/leases/${lease.id}`} className="text-blue-600 hover:underline">
                              {lease.tenantName || "—"}
                            </Link>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">{formatChf(lease.netRentChf)}</td>
                        <td className="px-3 py-2 text-right">{lease.rentTotalChf != null ? formatChf(lease.rentTotalChf) : "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(lease.startDate)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{lease.endDate ? formatDate(lease.endDate) : "Open-ended"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{lease.noticeRule || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(lease.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>
          )}
          {activeTab === "Requests" && (
        <Panel title="Open Requests">
          {requestsLoading ? (
            <div className="py-6 text-center text-sm text-slate-500">Loading requests…</div>
          ) : unitRequests.length === 0 ? (
            <div className="empty-state-text py-6 text-center italic">No open requests for this unit.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left px-3 py-2">#</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">Category</th>
                    <th className="text-left px-3 py-2">Description</th>
                    <th className="text-left px-3 py-2">Urgency</th>
                    <th className="text-left px-3 py-2">Contractor</th>
                    <th className="text-left px-3 py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {unitRequests.map((r) => (
                    <tr
                      key={r.id}
                      className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                      onClick={() => router.push(`/manager/requests/${r.id}?from=/admin-inventory/units/${id}`)}
                    >
                      <td className="px-3 py-2 tabular-nums font-medium">#{r.requestNumber}</td>
                      <td className="px-3 py-2"><Badge variant="muted" size="sm">{r.status?.replace(/_/g, " ")}</Badge></td>
                      <td className="px-3 py-2">{r.category || "—"}</td>
                      <td className="px-3 py-2 max-w-[200px] truncate">{r.description || "—"}</td>
                      <td className="px-3 py-2">{r.urgency || "—"}</td>
                      <td className="px-3 py-2">{r.assignedContractor?.name || "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
          )}

      </PageContent>
    </PageShell>
    </AppShell>
  );
}
