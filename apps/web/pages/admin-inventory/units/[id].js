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
export default function UnitDetail() {
  const router = useRouter();
  const { id } = router.query;

  const [unit, setUnit] = useState(null);
  const [appliances, setAppliances] = useState([]);
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
  const [createApplianceName, setCreateApplianceName] = useState("");
  const [createApplianceCategory, setCreateApplianceCategory] = useState("");
  const [createApplianceSerial, setCreateApplianceSerial] = useState("");
  const [createApplianceModel, setCreateApplianceModel] = useState("");
  const [creatingApplianceModelId, setCreatingApplianceModelId] = useState(null);
  const [activeTab, setActiveTab] = useState("Tenants");
  const [tenantAction, setTenantAction] = useState(null);
  const [applianceAction, setApplianceAction] = useState(null);
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
      await loadAppliances();
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

  useEffect(() => {
    if (id) loadUnit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onCreateAppliance(e) {
    e.preventDefault();
    if (!createApplianceName.trim()) return setErr("Appliance name is required.");

    try {
      setLoading(true);
      await fetchJSON(`/units/${id}/appliances`, {
        method: "POST",
        body: JSON.stringify({
          name: createApplianceName,
          ...(createApplianceCategory.trim() ? { category: createApplianceCategory } : {}),
          serial: createApplianceSerial || undefined,
          assetModelId: createApplianceModel || undefined,
        }),
      });
      await loadAppliances();
      setCreateApplianceName("");
      setCreateApplianceCategory("");
      setCreateApplianceSerial("");
      setCreateApplianceModel("");
      setApplianceAction(null);
      setOk("Appliance created.");
    } catch (e) {
      setErr(`Create appliance failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function onCreateApplianceFromModel(model) {
    try {
      setCreatingApplianceModelId(model.id);
      await fetchJSON(`/units/${id}/appliances`, {
        method: "POST",
        body: JSON.stringify({
          name: model.name,
          ...(model.category ? { category: model.category } : {}),
          assetModelId: model.id,
        }),
      });
      await loadAppliances();
      setOk("Appliance created.");
    } catch (e) {
      setErr(`Create appliance failed: ${e.message}`);
    } finally {
      setCreatingApplianceModelId(null);
    }
  }

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

  async function onDeactivateAppliance(applianceId) {
    if (!confirm("Deactivate this appliance?")) return;
    try {
      await fetchJSON(`/appliances/${applianceId}`, { method: "DELETE" });
      await loadAppliances();
      setOk("Appliance deactivated.");
    } catch (e) {
      setErr(`Deactivate failed: ${e.message}`);
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
  const isBusy = tenants.length > 0;
  const occupancyLabel = isBusy ? "Busy" : "Empty";
  const orgModels = assetModels.filter((m) => m.orgId);

  if (loading) {
    return (
      <AppShell role="MANAGER">
        <PageShell variant="embedded">
          <PageHeader title="Unit" />
          <PageContent><p className="loading-text">Loading unit…</p></PageContent>
        </PageShell>
      </AppShell>
    );
  }

  return (
    <AppShell role="MANAGER">
      <PageShell variant="embedded">
        <div className="mb-3">
          <Link href={unit?.building?.id ? `/admin-inventory/buildings/${unit.building.id}` : "/admin-inventory"} className="text-sm font-medium text-slate-600 hover:text-slate-900">
            ← Back
          </Link>
        </div>
        <PageHeader
          title={`Unit ${unit?.unitNumber || "Detail"}`}
          subtitle={unit?.building?.name ? `Building: ${unit.building.name}` : undefined}
          actions={(
            <div className="flex items-center gap-2">
              {editMode ? (
                <>
                  <button type="button" className="button-secondary" onClick={() => {
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
                  <button type="button" className="button-primary" onClick={onSaveUnit} disabled={loading}>
                    Save
                  </button>
                </>
              ) : (
                <button type="button" className="button-primary" onClick={() => setEditMode(true)}>
                  Edit
                </button>
              )}
            </div>
          )}
        />
        <PageContent>
          {notice && (
            <div className={cn("notice", notice.type === "ok" ? "notice-ok" : "notice-err")}>
              {notice.message}
            </div>
          )}

          <Panel title="Unit Details" actions={<Badge variant={isBusy ? "info" : "muted"} size="sm">{occupancyLabel}</Badge>}>
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
            <div className="grid grid-cols-3 gap-4 mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
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

      <div className="pill-tab-row">
        {["Tenants", "Appliances", "Assets", "Rent Estimate", "Documents", "Invoices", "Contracts"].map((tab) => (
          <button
            key={tab}
            type="button"
            className={cn(activeTab === tab ? "pill-tab-active" : "pill-tab")}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Appliances" && (
        <Panel title="Appliances">
          <div className="flex flex-col gap-3">
            {appliances.length === 0 ? (
              <div className="empty-state-text py-6 text-center italic">No appliances yet.</div>
            ) : (
              appliances.map((a) => (
                <div key={a.id} className="flex justify-between items-center p-3 border border-slate-200 rounded-lg bg-slate-50">
                  <div>
                    <div className="font-semibold text-sm">
                      {a.name}
                      {a.category && <Badge variant="muted" size="sm" className="ml-1.5">{a.category}</Badge>}
                    </div>
                    <div className="text-sm text-slate-500 mt-1">
                      {a.serial && <>SN: <code className="code-small">{a.serial}</code> • </>}
                      <code className="code-small">{a.id}</code>
                    </div>
                    {a.assetModel && (
                      <div className="text-sm text-slate-500 mt-1">
                        Model: <strong>{a.assetModel.name}</strong> {a.assetModel.category && `(${a.assetModel.category})`}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg border-none bg-red-600 hover:bg-red-700 text-white cursor-pointer font-semibold text-sm"
                    onClick={() => onDeactivateAppliance(a.id)}
                    disabled={loading}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex flex-col gap-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm">Add appliance</div>
                <div className="text-sm text-slate-500 mt-1">Create an appliance or manage models.</div>
              </div>
              {applianceAction ? (
                <button type="button" className="button-secondary" onClick={() => setApplianceAction(null)}>
                  Close
                </button>
              ) : (
                <button type="button" className="button-primary" onClick={() => setApplianceAction("menu")}>
                  Add
                </button>
              )}
            </div>

            {applianceAction === "menu" && (
              <div className="grid gap-2.5">
                <button type="button" className="button-secondary text-left" onClick={() => setApplianceAction("create")}> 
                  Create appliance
                  <div className="text-sm text-slate-500 mt-1">Add a unit appliance with optional model.</div>
                </button>
                <button type="button" className="button-secondary text-left" onClick={() => setApplianceAction("orgModels")}>
                  Your organization models
                  <div className="text-sm text-slate-500 mt-1">Browse existing models.</div>
                </button>
              </div>
            )}

            {applianceAction === "create" && (
              <>
                <button type="button" className="button-secondary" onClick={() => setApplianceAction("menu")}>
                  Back to options
                </button>
                <form onSubmit={onCreateAppliance} className="mb-2">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="filter-label">Name</label>
                      <input
                        className="filter-input w-full"
                        value={createApplianceName}
                        onChange={(e) => setCreateApplianceName(e.target.value)}
                        placeholder="e.g. Kitchen Sink"
                      />
                    </div>
                    <div>
                      <label className="filter-label">Category</label>
                      <select
                        className="filter-input w-full"
                        value={createApplianceCategory}
                        onChange={(e) => setCreateApplianceCategory(e.target.value)}
                      >
                        <option value="">— None —</option>
                        {ALLOWED_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="filter-label">Serial (optional)</label>
                      <input
                        className="filter-input w-full"
                        value={createApplianceSerial}
                        onChange={(e) => setCreateApplianceSerial(e.target.value)}
                        placeholder="Serial number"
                      />
                    </div>
                    <div>
                      <label className="filter-label">Asset Model (optional)</label>
                      <select
                        className="filter-input w-full"
                        value={createApplianceModel}
                        onChange={(e) => setCreateApplianceModel(e.target.value)}
                      >
                        <option value="">— None —</option>
                        {assetModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} {m.category ? `(${m.category})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button type="submit" className="button-primary" disabled={loading}>
                    Create appliance
                  </button>
                </form>
              </>
            )}

            {applianceAction === "orgModels" && (
              <>
                <button type="button" className="button-secondary" onClick={() => setApplianceAction("menu")}>
                  Back to options
                </button>
                <div className="flex flex-col gap-3">
                  {orgModels.length === 0 ? (
                    <div className="empty-state-text py-6 text-center italic">No organization models yet.</div>
                  ) : (
                    orgModels.map((m) => (
                      <div
                        key={m.id}
                        className={cn("flex justify-between items-center p-3 border border-slate-200 rounded-lg bg-slate-50", "cursor-pointer")}
                      >
                        <div>
                          <div className="font-semibold text-sm">
                            {m.name} {m.category && <Badge variant="muted" size="sm" className="ml-1.5">{m.category}</Badge>}
                          </div>
                          <div className="text-sm text-slate-500 mt-1">
                            {m.manufacturer && <>Mfg: {m.manufacturer} • </>}
                            {m.model && <>Model: {m.model} • </>}
                            <code className="code-small">{m.id}</code>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="button-primary"
                          onClick={() => onCreateApplianceFromModel(m)}
                          disabled={creatingApplianceModelId === m.id}
                        >
                          {creatingApplianceModelId === m.id ? "Adding..." : "Add"}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </Panel>
      )}

      {activeTab === "Assets" && (
        <Panel title="Asset Inventory & Depreciation">
          {assetInventoryLoading ? (
            <p className="text-center text-slate-400">Loading assets…</p>
          ) : (
            <AssetInventoryPanel
              assets={assetInventory}
              onRefresh={loadAssetInventory}
              scope="unit"
              parentId={id}
              unitId={id}
            />
          )}
        </Panel>
      )}

      {activeTab === "Tenants" && (
        <Panel title="Tenants">
          <div className="flex flex-col gap-3">
            {tenants.length === 0 ? (
              <div className="empty-state-text py-6 text-center italic">No tenants assigned to this unit.</div>
            ) : (
              tenants.map((t) => (
                <div key={t.id} className="flex justify-between items-center p-3 border border-slate-200 rounded-lg bg-slate-50">
                  <div>
                    <div className="font-semibold text-sm">
                      <Link href={`/manager/people/tenants/${t.id}`} className="text-blue-600 hover:underline">
                        {t.name || "Tenant"}
                      </Link>
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

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex flex-col gap-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm">Add tenant</div>
                <div className="text-sm text-slate-500 mt-1">Assign an existing tenant or create a new one.</div>
              </div>
              {tenantAction ? (
                <button type="button" className="button-secondary" onClick={() => setTenantAction(null)}>
                  Close
                </button>
              ) : (
                <button type="button" className="button-primary" onClick={() => setTenantAction("menu")}>
                  Add
                </button>
              )}
            </div>

            {tenantAction === "menu" && (
              <div className="grid gap-2.5">
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
                <button type="button" className="button-secondary" onClick={() => setTenantAction("menu")}>
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
                <button type="button" className="button-secondary" onClick={() => setTenantAction("menu")}>
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
        </Panel>
      )}

      {activeTab === "Rent Estimate" && (
        <Panel title="Rent Estimate">
          {!unit?.livingAreaSqm ? (
            <div className={cn("notice", "notice-err")}>
              Living area (m²) is required to estimate rent. Click <strong>Edit</strong> above and fill in the estimation inputs.
            </div>
          ) : (
            <>
              <button
                type="button"
                className="button-primary"
                disabled={estimateLoading}
                onClick={async () => {
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
                }}
              >
                {estimateLoading ? "Calculating…" : rentEstimate ? "Recalculate" : "Calculate Estimate"}
              </button>

              {estimateError && (
                <div className={cn("notice notice-err", "mt-3")}>{estimateError}</div>
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

      {activeTab === "Invoices" && (
        <Panel title="Invoices">
          <div className={cn("empty-state-text py-6 text-center italic", "p-8")}>Empty for now.</div>
        </Panel>
      )}

      {activeTab === "Contracts" && (
        <Panel title="Contracts">
          <div className={cn("empty-state-text py-6 text-center italic", "p-8")}>Empty for now.</div>
        </Panel>
      )}
      </PageContent>
    </PageShell>
    </AppShell>
  );
}
