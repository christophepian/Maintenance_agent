import { useRouter } from "next/router";
import { useEffect, useState, useCallback, useMemo } from "react";

function CorrespondenceTab({ buildingId }) {
  const [letters, setLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!buildingId) return;
    fetch(`/api/owner/letters?buildingId=${buildingId}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => { setLetters(d?.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [buildingId]);
  if (loading) return <p className="text-sm text-muted py-4">Chargement…</p>;
  if (letters.length === 0) return <p className="text-sm text-muted italic py-4">Aucune correspondance envoyée pour cet immeuble.</p>;
  return (
    <div className="space-y-2">
      {letters.map((l) => (
        <div key={l.id} className="card border px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-foreground truncate">{l.subject}</p>
            <div className="shrink-0 text-right">
              <p className="text-xs text-foreground-dim">{l.sentAt ? new Date(l.sentAt).toLocaleDateString("de-CH") : "—"}</p>
              <p className="text-xs text-foreground-dim">{l.recipientCount} destinataire{l.recipientCount !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import UndoToast, { useUndoToast } from "../../../components/ui/UndoToast";
import Badge from "../../../components/ui/Badge";
import AssetInventoryPanel from "../../../components/AssetInventoryPanel";
import BuildingFinancialsView from "../../../components/BuildingFinancialsView";
import { authHeaders } from "../../../lib/api";
import ScrollableTabs from "../../../components/mobile/ScrollableTabs";
import SortableHeader from "../../../components/SortableHeader";
import { useLocalSort, clientSort } from "../../../lib/tableUtils";
import { formatDate, formatChfCents, formatPercent } from "../../../lib/format";
import { cn } from "../../../lib/utils";
import { ARCHETYPE_LABELS, ARCHETYPE_EXPLANATION_COPY } from "../../../lib/archetypes";
import KpiInlineGrid from "../../../components/ui/KpiInlineGrid";
import { withServerTranslations } from "../../../lib/i18n";
import { useTranslation } from "next-i18next";
function displayDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

export default function BuildingDetail() {
  const { t } = useTranslation("manager");
  const router = useRouter();
  const { id, from, role } = router.query;
  const isOwner = role === "owner";
  const backHref = from || (isOwner ? "/owner/properties" : "/manager/inventory?tab=buildings");
  const [activeTab, setActiveTab] = useState("Building information");

  // ui object removed — all styles now use Tailwind className

  const [building, setBuilding] = useState(null);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editYearBuilt, setEditYearBuilt] = useState("");
  const [editElevator, setEditElevator] = useState(false);
  const [editConcierge, setEditConcierge] = useState(false);
  const [editManagedSince, setEditManagedSince] = useState("");
  const [createUnitName, setCreateUnitName] = useState("");
  const [createUnitType, setCreateUnitType] = useState("RESIDENTIAL");
  const [unitAction, setUnitAction] = useState(null);
  const [configMode, setConfigMode] = useState(null);
  const [configAutoApprove, setConfigAutoApprove] = useState("");
  const [configEmergency, setConfigEmergency] = useState(false);
  const [configOwnerThreshold, setConfigOwnerThreshold] = useState("");
  const [buildingConfig, setBuildingConfig] = useState(null);
  const [rules, setRules] = useState([]);
  const [createRuleMode, setCreateRuleMode] = useState(false);
  const [newRuleName, setNewRuleName] = useState("");
  const [newRulePriority, setNewRulePriority] = useState("0");
  const [newRuleConditions, setNewRuleConditions] = useState([{ field: "CATEGORY", operator: "EQUALS", value: "" }]);
  const [newRuleAction, setNewRuleAction] = useState("AUTO_APPROVE");
  const [message, setMessage] = useState("");
  const [leaseTemplates, setLeaseTemplates] = useState([]);
  const toast = useUndoToast();

  // ─── Unit filter state ───
  const [unitFilter, setUnitFilter] = useState("ALL");

  // ─── Ownership editing state ───
  const [ownerCandidates, setOwnerCandidates] = useState([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [ownerStrategyProfiles, setOwnerStrategyProfiles] = useState({});
  const [buildingStrategyProfile, setBuildingStrategyProfile] = useState(null);

  // ─── Asset inventory state ───
  const [assetInventory, setAssetInventory] = useState([]);
  const [assetInventoryLoading, setAssetInventoryLoading] = useState(false);
  const [assetAddMode, setAssetAddMode] = useState(false);
  const [assetSeeding, setAssetSeeding] = useState(false);

  // ─── Building KPI state ───
  const [buildingKpis, setBuildingKpis] = useState(null);
  const [kpisLoading, setKpisLoading] = useState(false);

  // ─── Building requests tab state ───
  const [buildingRequests, setBuildingRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsLoaded, setRequestsLoaded] = useState(false);

  // ─── House rules state ───
  const [houseRulesText, setHouseRulesText] = useState("");
  const [houseRulesEditing, setHouseRulesEditing] = useState(false);
  const [houseRulesSaving, setHouseRulesSaving] = useState(false);
  const [houseRulesPreviewUrl, setHouseRulesPreviewUrl] = useState(null);
  const [legalSources, setLegalSources] = useState([]);
  const [legalSourcesLoading, setLegalSourcesLoading] = useState(false);

  // ─── Sort state for Tenants + Requests tabs (must be here, before early returns) ───
  const { sortField: tenSF, sortDir: tenSD, handleSort: handleTenSort } = useLocalSort("name", "asc");
  const { sortField: reqSF, sortDir: reqSD, handleSort: handleReqSort } = useLocalSort("createdAt", "desc");
  const sortedBuildingTenants = useMemo(() => clientSort(building?.tenants ?? [], tenSF, tenSD, (ten, f) => {
    if (f === "name") return (ten.name || "").toLowerCase();
    if (f === "unit") return (ten.unitNumber || "").toLowerCase();
    if (f === "phone") return (ten.phone || "").toLowerCase();
    if (f === "email") return (ten.email || "").toLowerCase();
    if (f === "moveIn") return ten.moveInDate || "";
    if (f === "source") return (ten.source || "").toLowerCase();
    return "";
  }), [building?.tenants, tenSF, tenSD]);
  const sortedBuildingRequests = useMemo(() => clientSort(buildingRequests, reqSF, reqSD, (r, f) => {
    if (f === "status") return (r.status || "").toLowerCase();
    if (f === "category") return (r.category || "").toLowerCase();
    if (f === "unit") return (r.unit?.unitNumber || "").toLowerCase();
    if (f === "urgency") return ({ LOW: 1, MEDIUM: 2, HIGH: 3, EMERGENCY: 4 }[r.urgency] || 0);
    if (f === "contractor") return (r.contractor?.name || "").toLowerCase();
    if (f === "createdAt") return r.createdAt || "";
    return "";
  }), [buildingRequests, reqSF, reqSD]);

  useEffect(() => {
    if (activeTab === "Assets" && assetInventory.length === 0 && !assetInventoryLoading) {
      loadAssetInventory();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "Requests" && !requestsLoaded && !requestsLoading) {
      loadBuildingRequests();
    }
  }, [activeTab]);

  function setOk(message) {
    setNotice({ type: "ok", message });
    setTimeout(() => setNotice(null), 4000);
  }
  function setErr(message) {
    setNotice({ type: "err", message });
  }

  async function fetchJSON(path, options = {}) {
    const res = await fetch(`/api${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...authHeaders(), ...(options.headers || {}) },
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {}
    if (!res.ok) {
      const msg = (data && (data.error?.message || data.message || (typeof data.error === "string" && data.error))) || `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return data;
  }

  async function loadBuilding() {
    try {
      const res = await fetch(`/api/buildings/${id}`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to load building");
      const b = json?.data || json;
      if (!b) throw new Error("Building not found");
      setBuilding(b);
      setEditName(b.name);
      setEditAddress(b.address || "");
      setEditYearBuilt(b.yearBuilt != null ? String(b.yearBuilt) : "");
      setEditElevator(!!b.hasElevator);
      setEditConcierge(!!b.hasConcierge);
      setEditManagedSince(b.managedSince ? b.managedSince.slice(0, 10) : "");
      setHouseRulesText(b.houseRulesText || "");
      await loadUnits();
      await loadBuildingConfig();
      await loadApprovalRules();
      await loadLeaseTemplates();
      loadLegalSources();
      loadBuildingKpis();
      if (b.owners && b.owners.length > 0) {
        loadOwnerStrategyProfiles(b.owners.map((o) => o.id));
      }
      loadBuildingStrategyProfile();
    } catch (e) {
      setErr(`Failed to load building: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadBuildingKpis() {
    if (!id) return;
    setKpisLoading(true);
    try {
      const now = new Date();
      const from = `${now.getFullYear()}-01-01`;
      const to = now.toISOString().slice(0, 10);
      const [reqRes, jobRes, finRes, portRes] = await Promise.all([
        fetch("/api/requests?limit=2000&order=desc", { headers: authHeaders() }),
        fetch("/api/jobs?limit=2000", { headers: authHeaders() }),
        fetch(`/api/buildings/${id}/financial-summary?from=${from}&to=${to}`, { headers: authHeaders() }),
        fetch(`/api/financials/portfolio-summary?from=${from}&to=${to}`, { headers: authHeaders() }),
      ]);
      const [reqData, jobData, finData, portData] = await Promise.all([
        reqRes.json(), jobRes.json(), finRes.json(), portRes.json(),
      ]);
      const allRequests = reqData?.data || [];
      const allJobs = jobData?.data || [];
      const openRequests = allRequests.filter(
        (r) => r.unit?.building?.id === id && ["PENDING_REVIEW", "PENDING_OWNER_APPROVAL", "RFP_PENDING", "APPROVED", "ASSIGNED"].includes(r.status)
      ).length;
      const openJobs = allJobs.filter(
        (j) => j.request?.unit?.building?.id === id && ["PENDING", "IN_PROGRESS"].includes(j.status)
      ).length;
      const financials = finData?.data || null;
      const portfolio = portData?.data || null;
      let portfolioComparison = null;
      if (portfolio && portfolio.buildingCount > 0 && financials) {
        const buildingNoi = financials.netIncomeCents ?? 0;
        const portfolioBuildings = portfolio.buildings || [];
        if (portfolioBuildings.length > 1) {
          const otherBuildings = portfolioBuildings.filter((b) => b.buildingId !== id);
          if (otherBuildings.length > 0) {
            const avgOtherNoi = otherBuildings.reduce((sum, b) => sum + (b.netIncomeCents ?? 0), 0) / otherBuildings.length;
            if (avgOtherNoi !== 0) {
              const pct = ((buildingNoi - avgOtherNoi) / Math.abs(avgOtherNoi)) * 100;
              portfolioComparison = { pct: Math.round(pct), better: pct >= 0 };
            }
          }
        }
      }
      setBuildingKpis({ openRequests, openJobs, financials, portfolioComparison });
    } catch (e) {
      // non-fatal — KPIs just won't show
    } finally {
      setKpisLoading(false);
    }
  }

  async function loadOwnerStrategyProfiles(ownerIds) {
    const results = {};
    await Promise.all(
      ownerIds.map(async (ownerId) => {
        try {
          const res = await fetch(`/api/strategy/owner-profile/${ownerId}`, { headers: authHeaders() });
          if (res.ok) {
            const json = await res.json();
            if (json?.profile) results[ownerId] = json.profile;
          }
        } catch {
          // non-fatal
        }
      })
    );
    setOwnerStrategyProfiles(results);
  }

  async function loadBuildingStrategyProfile() {
    if (!id) return;
    try {
      const res = await fetch(`/api/strategy/building-profile/${id}`, { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json();
        setBuildingStrategyProfile(json?.profile ?? null);
      }
    } catch {
      // non-fatal
    }
  }

  async function loadBuildingRequests() {
    if (!id) return;
    setRequestsLoading(true);
    try {
      const res = await fetch("/api/requests?limit=2000&order=desc", { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to load requests");
      const all = json?.data || [];
      setBuildingRequests(all.filter((r) => r.unit?.building?.id === id));
      setRequestsLoaded(true);
    } catch (e) {
      setBuildingRequests([]);
    } finally {
      setRequestsLoading(false);
    }
  }

  async function loadBuildingConfig() {
    if (!id) return;
    try {
      const data = await fetchJSON(`/buildings/${id}/config`);
      const cfg = data?.data || null;
      setBuildingConfig(cfg);
      if (cfg) {
        setConfigAutoApprove(cfg.autoApproveLimit != null ? String(cfg.autoApproveLimit) : "");
        setConfigEmergency(cfg.emergencyAutoDispatch || false);
        setConfigOwnerThreshold(cfg.requireOwnerApprovalAbove != null ? String(cfg.requireOwnerApprovalAbove) : "");
      }
    } catch (e) {
      setErr(`Failed to load building config: ${e.message}`);
    }
  }

  async function loadApprovalRules() {
    if (!id) return;
    try {
      const data = await fetchJSON(`/approval-rules?buildingId=${id}`);
      setRules(Array.isArray(data) ? data : data?.data || []);
    } catch (e) {
      console.error("Failed to load approval rules:", e);
      setRules([]);
    }
  }

  async function loadLeaseTemplates() {
    if (!id) return;
    try {
      const data = await fetchJSON(`/lease-templates?buildingId=${id}`);
      setLeaseTemplates(Array.isArray(data) ? data : data?.data || []);
    } catch (e) {
      console.error("Failed to load lease templates:", e);
      setLeaseTemplates([]);
    }
  }

  async function loadLegalSources() {
    if (!id || legalSources.length > 0) return;
    setLegalSourcesLoading(true);
    try {
      const data = await fetchJSON(`/buildings/${id}/legal-sources`);
      setLegalSources(Array.isArray(data) ? data : data?.data || []);
    } catch (e) {
      console.error("Failed to load legal sources:", e);
      setLegalSources([]);
    } finally {
      setLegalSourcesLoading(false);
    }
  }

  async function loadUnits() {
    if (!id) return;
    try {
      const data = await fetchJSON(`/buildings/${id}/units`);
      setUnits(Array.isArray(data) ? data : data?.data || []);
    } catch (e) {
      setErr(`Failed to load units: ${e.message}`);
    }
  }

  async function loadAssetInventory() {
    if (!id) return;
    try {
      setAssetInventoryLoading(true);
      const data = await fetchJSON(`/buildings/${id}/asset-inventory`);
      setAssetInventory(Array.isArray(data) ? data : data?.data || []);
    } catch (e) {
      // Silently fail
    } finally {
      setAssetInventoryLoading(false);
    }
  }

  async function seedDefaultAssets() {
    if (!id || assetSeeding) return;
    setAssetSeeding(true);
    try {
      await fetchJSON(`/buildings/${id}/seed-default-assets`, { method: "POST" });
      await loadAssetInventory();
    } catch (e) {
      setErr(`Failed to populate default assets: ${e.message}`);
    } finally {
      setAssetSeeding(false);
    }
  }

  // ─── Owner management ───

  async function loadOwnerCandidates() {
    try {
      const res = await fetch(`/api/buildings/${id}/owners/candidates`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) return;
      setOwnerCandidates(json?.data || []);
    } catch (e) {
      console.error("Failed to load owner candidates:", e);
    }
  }

  async function onAddOwner() {
    if (!selectedCandidateId) return;
    try {
      setOwnerLoading(true);
      const res = await fetch(`/api/buildings/${id}/owners`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ userId: selectedCandidateId }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message || json?.message || `Failed (${res.status})`);
      }
      setSelectedCandidateId("");
      await loadBuilding();
      await loadOwnerCandidates();
      setOk("Owner added.");
    } catch (e) {
      setErr(`Failed to add owner: ${e.message}`);
    } finally {
      setOwnerLoading(false);
    }
  }

  async function onRemoveOwner(userId) {
    try {
      setOwnerLoading(true);
      await fetch(`/api/buildings/${id}/owners/${userId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      await loadBuilding();
      await loadOwnerCandidates();
      setOk("Owner removed.");
    } catch (e) {
      setErr(`Failed to remove owner: ${e.message}`);
    } finally {
      setOwnerLoading(false);
    }
  }

  useEffect(() => {
    if (id) loadBuilding();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onUpdateBuilding(e) {
    e.preventDefault();
    if (!editName.trim()) return setErr("Building name is required.");
    try {
      setLoading(true);
      await fetchJSON(`/buildings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName,
          address: editAddress,
          ...(editYearBuilt ? { yearBuilt: Number(editYearBuilt) } : {}),
          hasElevator: editElevator,
          hasConcierge: editConcierge,
          managedSince: editManagedSince ? new Date(editManagedSince).toISOString() : null,
        }),
      });
      await loadBuilding();
      setEditMode(false);
      setOk("Building updated.");
    } catch (e) {
      setErr(`Update failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function onSaveHouseRules() {
    try {
      setHouseRulesSaving(true);
      await fetchJSON(`/buildings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ houseRulesText: houseRulesText || null }),
      });
      setBuilding((b) => ({ ...b, houseRulesText: houseRulesText || null }));
      setHouseRulesEditing(false);
      setOk("House rules saved.");
    } catch (e) {
      setErr(`Failed to save house rules: ${e.message}`);
    } finally {
      setHouseRulesSaving(false);
    }
  }

  async function onPreviewHouseRulesPdf() {
    if (houseRulesPreviewUrl) { URL.revokeObjectURL(houseRulesPreviewUrl); setHouseRulesPreviewUrl(null); return; }
    try {
      const res = await fetch(`/api/buildings/${id}/house-rules-pdf`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      setHouseRulesPreviewUrl(URL.createObjectURL(blob));
    } catch (e) {
      setErr(`PDF preview failed: ${e.message}`);
    }
  }

  async function onDownloadHouseRulesPdf() {
    try {
      const res = await fetch(`/api/buildings/${id}/house-rules-pdf`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `house-rules-${id.slice(0, 8)}.pdf`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      setErr(`PDF download failed: ${e.message}`);
    }
  }

  async function onCreateUnit(e) {
    e.preventDefault();
    if (!createUnitName.trim()) return setErr("Unit name is required.");
    try {
      setLoading(true);
      await fetchJSON(`/buildings/${id}/units`, {
        method: "POST",
        body: JSON.stringify({ unitNumber: createUnitName, type: createUnitType }),
      });
      await loadUnits();
      setCreateUnitName("");
      setUnitAction(null);
      setOk("Unit created.");
    } catch (e) {
      setErr(`Create unit failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function onDeactivateBuilding() {
    if (!confirm("Deactivate this building? This cannot be undone.")) return;
    try {
      setLoading(true);
      await fetchJSON(`/buildings/${id}`, { method: "DELETE" });
      setOk("Building deactivated. Redirecting...");
      setTimeout(() => router.push(isOwner ? "/owner/properties" : "/manager/inventory?tab=buildings"), 1500);
    } catch (e) {
      setErr(`Deactivate failed: ${e.message}`);
      setLoading(false);
    }
  }

  async function onSaveBuildingConfig(e) {
    e.preventDefault();
    try {
      setLoading(true);
      const payload = {};
      if (configAutoApprove.trim()) {
        const n = Number(configAutoApprove);
        if (!Number.isInteger(n) || n < 0 || n > 100000) {
          return setErr("Auto-approve limit must be an integer 0–100000 or blank.");
        }
        payload.autoApproveLimit = n;
      } else {
        payload.autoApproveLimit = null;
      }
      payload.emergencyAutoDispatch = configEmergency;
      if (configOwnerThreshold.trim()) {
        const n = Number(configOwnerThreshold);
        if (!Number.isInteger(n) || n < 0 || n > 100000) {
          return setErr("Owner threshold must be an integer 0–100000 or blank.");
        }
        payload.requireOwnerApprovalAbove = n;
      } else {
        payload.requireOwnerApprovalAbove = null;
      }
      await fetchJSON(`/buildings/${id}/config`, { method: "PUT", body: JSON.stringify(payload) });
      await loadBuildingConfig();
      setConfigMode(null);
      setOk("Building config saved.");
    } catch (e) {
      setErr(`Config save failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function onCreateRule(e) {
    e.preventDefault();
    if (!newRuleName.trim()) return setErr("Rule name is required.");
    const validConditions = newRuleConditions.filter((c) => c.value);
    if (validConditions.length === 0) return setErr("At least one condition with a value is required.");
    try {
      setLoading(true);
      const payload = {
        buildingId: id,
        name: newRuleName,
        priority: parseInt(newRulePriority) || 0,
        conditions: validConditions,
        action: newRuleAction,
      };
      await fetchJSON(`/approval-rules`, { method: "POST", body: JSON.stringify(payload) });
      await loadApprovalRules();
      setNewRuleName("");
      setNewRulePriority("0");
      setNewRuleConditions([{ field: "CATEGORY", operator: "EQUALS", value: "" }]);
      setNewRuleAction("AUTO_APPROVE");
      setCreateRuleMode(false);
      setOk("Approval rule created.");
    } catch (e) {
      setErr(`Create rule failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function onDeleteRule(ruleId) {
    if (!confirm("Delete this approval rule?")) return;
    try {
      setLoading(true);
      await fetchJSON(`/approval-rules/${ruleId}`, { method: "DELETE" });
      await loadApprovalRules();
      setOk("Approval rule deleted.");
    } catch (e) {
      setErr(`Delete rule failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function onToggleRuleActive(ruleId, currentActive) {
    try {
      setLoading(true);
      await fetchJSON(`/approval-rules/${ruleId}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !currentActive }),
      });
      await loadApprovalRules();
      setOk("Rule status updated.");
    } catch (e) {
      setErr(`Toggle rule failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  function addCondition() {
    setNewRuleConditions([...newRuleConditions, { field: "CATEGORY", operator: "EQUALS", value: "" }]);
  }

  function removeCondition(index) {
    setNewRuleConditions(newRuleConditions.filter((_, i) => i !== index));
  }

  function updateCondition(index, key, value) {
    const updated = [...newRuleConditions];
    updated[index][key] = value;
    setNewRuleConditions(updated);
  }

  if (loading && !building) {
    return (
      <AppShell role={isOwner ? "OWNER" : "MANAGER"}>
        <PageShell variant="embedded">
          <PageContent>
            <Panel>
              <p className="text-sm text-muted-text">Loading building...</p>
            </Panel>
          </PageContent>
        </PageShell>
      </AppShell>
    );
  }

  if (!building) {
    return (
      <AppShell role={isOwner ? "OWNER" : "MANAGER"}>
        <PageShell variant="embedded">
          <PageContent>
            <Panel>
              <p className="text-sm text-muted-text">Building not found.</p>
            </Panel>
          </PageContent>
        </PageShell>
      </AppShell>
    );
  }

  const residentialUnits = units.filter((u) => u.type === "RESIDENTIAL" || !u.type);
  const commonUnits = units.filter((u) => u.type === "COMMON_AREA");

  // ─── Occupancy counts (always across ALL units) ───
  const occupiedCount = units.filter((u) => u.occupancyStatus === "OCCUPIED").length;
  const vacantCount = units.filter((u) => u.occupancyStatus === "VACANT").length;
  const listedCount = units.filter((u) => u.occupancyStatus === "LISTED").length;

  // ─── Filter units by occupancy status ───
  const filteredResidential = unitFilter === "ALL"
    ? residentialUnits
    : residentialUnits.filter((u) => u.occupancyStatus === unitFilter);
  const filteredCommon = unitFilter === "ALL"
    ? commonUnits
    : commonUnits.filter((u) => u.occupancyStatus === unitFilter);

  return (
    <AppShell role={isOwner ? "OWNER" : "MANAGER"}>
      <PageShell variant="embedded">
        <PageHeader
          title={building?.name || "Building"}
          subtitle={building?.address || "Building details and configuration."}
          backButton={
            <button
              onClick={() => router.push(backHref)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground hover:bg-surface-hover"
              aria-label={t("manager:buildingsId.ariaLabel.backToInventory")}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          }
        />
        <PageContent>
          {notice && (
            <Panel>
              <div className={cn("text-sm", notice.type === "ok" ? "text-green-600" : "text-red-600")}>
                {notice.message}
              </div>
            </Panel>
          )}

          {/* Tabs Navigation */}
          {(() => {
            const TAB_KEYS = ["Building information", "Units", "Tenants", "Assets", "Documents", "Policies", "Financials", "Requests", "Correspondence"];
            const TAB_I18N = {
              "Building information": t("manager:buildingsId.tabs.buildingInformation"),
              "Units":                t("manager:buildingsId.tabs.units"),
              "Tenants":              t("manager:buildingsId.tabs.tenants"),
              "Assets":               t("manager:buildingsId.tabs.assets"),
              "Documents":            t("manager:buildingsId.tabs.documents"),
              "Policies":             t("manager:buildingsId.tabs.policies"),
              "Financials":           t("manager:buildingsId.tabs.financials"),
              "Requests":             t("manager:buildingsId.tabs.requests"),
              "Correspondence":       t("manager:buildingsId.tabs.correspondence"),
            };
            return (
              <ScrollableTabs activeIndex={TAB_KEYS.indexOf(activeTab)}>
                {TAB_KEYS.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={activeTab === tab ? "tab-btn-active" : "tab-btn"}
                    onClick={() => setActiveTab(tab)}
                  >
                    {TAB_I18N[tab]}
                  </button>
                ))}
              </ScrollableTabs>
            );
          })()}

          {/* Building information tab */}
          {activeTab === "Building information" && (
            <>
              {/* KPIs — mobile: compact inline grid */}
              <div className="sm:hidden mb-4">
                <KpiInlineGrid
                  items={[
                    { label: t("manager:buildingsId.kpi.openRequests"), value: kpisLoading ? "…" : (buildingKpis?.openRequests ?? "—"), tone: buildingKpis?.openRequests > 20 ? "warn" : undefined },
                    { label: t("manager:buildingsId.kpi.openJobs"),     value: kpisLoading ? "…" : (buildingKpis?.openJobs ?? "—"), tone: buildingKpis?.openJobs > 15 ? "warn" : undefined },
                    { label: t("manager:buildingsId.kpi.noiYtd"),       value: kpisLoading ? "…" : (buildingKpis?.financials ? formatChfCents(buildingKpis.financials.netIncomeCents) : "—"), tone: buildingKpis?.financials ? (buildingKpis.financials.netIncomeCents >= 0 ? "good" : "warn") : undefined },
                    { label: t("manager:buildingsId.kpi.vsPortfolio"),  value: kpisLoading ? "…" : (buildingKpis?.portfolioComparison ? `${buildingKpis.portfolioComparison.better ? "+" : ""}${buildingKpis.portfolioComparison.pct}%` : "—"), tone: buildingKpis?.portfolioComparison ? (buildingKpis.portfolioComparison.better ? "good" : "warn") : undefined },
                  ]}
                />
              </div>
              {/* KPIs — desktop: card grid */}
              <div className="hidden sm:grid kpi-grid gap-4 xl:grid-cols-4 mb-4">
                {/* Open Requests */}
                <div className="rounded-2xl border border-surface-border bg-surface p-5 shadow-sm">
                  <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.kpi.openRequests")}</div>
                  {kpisLoading ? (
                    <div className="mt-3 text-sm text-foreground-dim">{t("common:loading")}</div>
                  ) : (
                    <>
                      <div className={cn("mt-3 text-2xl font-semibold tracking-tight", buildingKpis?.openRequests > 20 ? "text-amber-700" : "text-foreground")}>
                        {buildingKpis?.openRequests ?? "—"}
                      </div>
                      <div className="text-sm text-muted-text">{t("manager:buildingsId.kpi.pendingApprovedAssigned")}</div>
                    </>
                  )}
                </div>
                {/* Open Jobs */}
                <div className="rounded-2xl border border-surface-border bg-surface p-5 shadow-sm">
                  <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.kpi.openJobs")}</div>
                  {kpisLoading ? (
                    <div className="mt-3 text-sm text-foreground-dim">{t("common:loading")}</div>
                  ) : (
                    <>
                      <div className={cn("mt-3 text-2xl font-semibold tracking-tight", buildingKpis?.openJobs > 15 ? "text-amber-700" : "text-foreground")}>
                        {buildingKpis?.openJobs ?? "—"}
                      </div>
                      <div className="text-sm text-muted-text">{t("manager:buildingsId.kpi.pendingPlusInProgress")}</div>
                    </>
                  )}
                </div>
                {/* Building NOI */}
                <div className="rounded-2xl border border-surface-border bg-surface p-5 shadow-sm">
                  <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.kpi.buildingNoiYtd")}</div>
                  {kpisLoading ? (
                    <div className="mt-3 text-sm text-foreground-dim">{t("common:loading")}</div>
                  ) : (
                    <>
                      <div className={cn("mt-3 text-2xl font-semibold tracking-tight", !buildingKpis?.financials ? "text-foreground-dim" : buildingKpis.financials.netIncomeCents >= 0 ? "text-green-700" : "text-red-700")}>
                        {buildingKpis?.financials ? formatChfCents(buildingKpis.financials.netIncomeCents) : "—"}
                      </div>
                      <div className="text-sm text-muted-text">
                        {buildingKpis?.financials ? `${formatPercent(buildingKpis.financials.collectionRate)} ${t("manager:buildingsId.kpi.collectionRate")}` : t("manager:buildingsId.kpi.noFinancialData")}
                      </div>
                    </>
                  )}
                </div>
                {/* Portfolio Comparison */}
                <div className="rounded-2xl border border-surface-border bg-surface p-5 shadow-sm">
                  <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.kpi.vsPortfolioLong")}</div>
                  {kpisLoading ? (
                    <div className="mt-3 text-sm text-foreground-dim">{t("common:loading")}</div>
                  ) : buildingKpis?.portfolioComparison ? (
                    <>
                      <div className={cn("mt-3 text-2xl font-semibold tracking-tight", buildingKpis.portfolioComparison.better ? "text-green-700" : "text-red-700")}>
                        {buildingKpis.portfolioComparison.better ? "+" : ""}{buildingKpis.portfolioComparison.pct}%
                      </div>
                      <div className="text-sm text-muted-text">
                        {buildingKpis.portfolioComparison.better ? t("manager:buildingsId.kpi.betterThanOtherAssets") : t("manager:buildingsId.kpi.worseThanOtherAssets")}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mt-3 text-2xl font-semibold tracking-tight text-foreground-dim">—</div>
                      <div className="text-sm text-muted-text">{t("manager:buildingsId.kpi.notEnoughPortfolioData")}</div>
                    </>
                  )}
                </div>
              </div>{/* end desktop grid */}

            <Panel
              title={t("manager:buildingsId.title.buildingInformation")}
              actions={!isOwner && editMode ? (
                <>
                  <button
                    type="button"
                    className="button-primary text-sm"
                    disabled={loading}
                    onClick={onUpdateBuilding}
                  >
                    {loading ? t("manager:buildingsId.btn.saving") : t("manager:buildingsId.btn.saveChanges")}
                  </button>
                  <button
                    type="button"
                    className="button-cancel text-sm"
                    onClick={() => {
                      setEditMode(false);
                      setEditName(building?.name || "");
                      setEditAddress(building?.address || "");
                      setEditYearBuilt(building?.yearBuilt != null ? String(building.yearBuilt) : "");
                      setEditElevator(!!building?.hasElevator);
                      setEditConcierge(!!building?.hasConcierge);
                      setEditManagedSince(building?.managedSince ? building.managedSince.slice(0, 10) : "");
                    }}
                  >
                    {t("manager:buildingsId.btn.cancel")}
                  </button>
                  <button
                    type="button"
                    className="button-danger text-sm"
                    onClick={onDeactivateBuilding}
                    disabled={loading}
                  >
                    {t("manager:buildingsId.btn.deactivate")}
                  </button>
                </>
              ) : !isOwner ? (
                <button
                  type="button"
                  className="button-primary text-sm"
                  onClick={() => { setEditMode(true); loadOwnerCandidates(); }}
                  disabled={loading}
                >
                  {t("manager:buildingsId.btn.edit")}
                </button>
              ) : null}
            >
              {editMode ? (
                <form onSubmit={onUpdateBuilding}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.label.name")}</span>
                      <input
                        className="input text-sm text-muted-dark"
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder={t("manager:buildingsId.placeholder.buildingName")}
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.placeholder.address")}</span>
                      <input
                        className="input text-sm text-muted-dark"
                        type="text"
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        placeholder={t("manager:buildingsId.placeholder.address")}
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.label.yearBuilt")}</span>
                      <input
                        className="input text-sm text-muted-dark"
                        type="number"
                        min="1800"
                        max={new Date().getFullYear()}
                        value={editYearBuilt}
                        onChange={(e) => setEditYearBuilt(e.target.value)}
                        placeholder={t("manager:buildingsId.placeholder.eG1995")}
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.label.managedSince")}</span>
                      <input
                        className="input text-sm text-muted-dark"
                        type="date"
                        value={editManagedSince}
                        onChange={(e) => setEditManagedSince(e.target.value)}
                      />
                    </label>
                    <div className="flex items-end gap-6 pb-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editElevator}
                          onChange={(e) => setEditElevator(e.target.checked)}
                        />
                        <span className="text-sm text-muted-dark">{t("manager:buildingsId.label.elevator")}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editConcierge}
                          onChange={(e) => setEditConcierge(e.target.checked)}
                        />
                        <span className="text-sm text-muted-dark">{t("manager:buildingsId.label.concierge")}</span>
                      </label>
                    </div>
                  </div>
                </form>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.label.name")}</div>
                      <div className="text-sm text-muted-dark mt-1">{building?.name}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.placeholder.address")}</div>
                      <div className="text-sm text-muted-dark mt-1">{building?.address || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.label.yearBuilt")}</div>
                      <div className="text-sm text-muted-dark mt-1">{building?.yearBuilt ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.label.amenities")}</div>
                      <div className="text-sm text-muted-dark mt-1 flex gap-3">
                        {building?.hasElevator && <Badge variant="info" size="sm">{t("manager:buildingsId.label.elevator")}</Badge>}
                        {building?.hasConcierge && <Badge variant="info" size="sm">{t("manager:buildingsId.label.concierge")}</Badge>}
                        {!building?.hasElevator && !building?.hasConcierge && "—"}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Ownership & Management — always visible regardless of edit mode */}
              <div className="mt-6 pt-4 border-t border-surface-border">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-foreground">{t("manager:buildingsId.heading.ownershipManagement")}</h3>
                    </div>

                    {/* Managed Since — inline date input when editing */}
                    <div className="grid gap-4 sm:grid-cols-2 mb-3">
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.label.managedSince")}</div>
                        {editMode ? (
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="date"
                              className="input text-sm text-muted-dark"
                              value={editManagedSince}
                              onChange={(e) => setEditManagedSince(e.target.value)}
                            />
                            <button
                              type="button"
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                              disabled={loading}
                              onClick={async () => {
                                try {
                                  setLoading(true);
                                  await fetchJSON(`/buildings/${id}`, {
                                    method: "PATCH",
                                    body: JSON.stringify({
                                      managedSince: editManagedSince ? new Date(editManagedSince).toISOString() : null,
                                    }),
                                  });
                                  await loadBuilding();
                                  setOk("Managed since updated.");
                                } catch (err) {
                                  setErr(`Update failed: ${err.message}`);
                                } finally {
                                  setLoading(false);
                                }
                              }}
                            >
                              {t("manager:buildingsId.btn.save")}
                            </button>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-dark mt-1">
                            {building?.managedSince ? displayDate(building.managedSince) : "—"}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Owners list */}
                    {building?.owners && building.owners.length > 0 ? (
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim mb-2">{t("manager:buildingsId.label.owners")}</div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {building.owners.map((owner) => {
                            const profile = ownerStrategyProfiles[owner.id];
                            const archetype = profile?.primaryArchetype;
                            const copy = archetype ? ARCHETYPE_EXPLANATION_COPY[archetype] : null;
                            const label = archetype ? ARCHETYPE_LABELS[archetype] : null;
                            return (
                              <div key={owner.id} className="border border-surface-border rounded-lg p-3 bg-surface-subtle">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="font-semibold text-sm text-foreground">{owner.name}</div>
                                    {owner.email && <div className="text-xs text-muted mt-0.5">{owner.email}</div>}
                                  </div>
                                  {editMode && (
                                    <button
                                      type="button"
                                      className="text-xs text-red-500 hover:text-red-700 font-medium ml-2 flex-shrink-0"
                                      disabled={ownerLoading}
                                      onClick={() => onRemoveOwner(owner.id)}
                                    >
                                      {t("manager:buildingsId.btn.remove")}
                                    </button>
                                  )}
                                </div>
                                {profile && (
                                  <div className="mt-2.5 pt-2.5 border-t border-surface-border">
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <span className="text-xs font-semibold text-muted-dark">{t("manager:buildingsId.label.strategy")}</span>
                                      {label && (
                                        <Badge variant="brand" size="sm">{label}</Badge>
                                      )}
                                      {profile.secondaryArchetype && ARCHETYPE_LABELS[profile.secondaryArchetype] && (
                                        <Badge variant="info" size="sm">{ARCHETYPE_LABELS[profile.secondaryArchetype]}</Badge>
                                      )}
                                    </div>
                                    {profile.userFacingGoalLabel && (
                                      <p className="text-xs text-muted italic mb-1.5">"{profile.userFacingGoalLabel}"</p>
                                    )}
                                    {copy && (
                                      <ul className="space-y-0.5">
                                        {copy.bullets.map((b, i) => (
                                          <li key={i} className="text-xs text-muted-text flex gap-1.5">
                                            <span className="text-foreground-dim flex-shrink-0">·</span>
                                            <span>{b}</span>
                                          </li>
                                        ))}
                                        <li className="text-xs text-foreground-dim flex gap-1.5 mt-1">
                                          <span className="flex-shrink-0">↓</span>
                                          <span>{copy.deprioritize}</span>
                                        </li>
                                      </ul>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted italic">{t("manager:buildingsId.label.noOwnersAssigned")}</div>
                    )}

                    {/* Add owner picker (visible when editing) */}
                    {editMode && (
                      <div className="mt-3 flex items-end gap-2">
                        <div className="flex-1">
                          <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim mb-1">{t("manager:buildingsId.label.owners")}</div>
                          <select
                            className="input text-sm text-muted-dark w-full"
                            value={selectedCandidateId}
                            onChange={(e) => setSelectedCandidateId(e.target.value)}
                          >
                            <option value="">{t("manager:buildingsId.select.selectOwner")}</option>
                            {ownerCandidates
                              .filter((c) => !(building?.owners || []).some((o) => o.id === c.id))
                              .map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}{c.email ? ` (${c.email})` : ""}
                                </option>
                              ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          className="button-primary text-sm"
                          disabled={!selectedCandidateId || ownerLoading}
                          onClick={onAddOwner}
                        >
                          {t("manager:buildingsId.btn.add")}
                        </button>
                      </div>
                    )}
                  </div>

              {/* Building Strategy Profile */}
              {buildingStrategyProfile && (() => {
                const bp = buildingStrategyProfile;
                const archLabel = bp.primaryArchetype ? ARCHETYPE_LABELS[bp.primaryArchetype] : null;
                const copy = bp.primaryArchetype ? ARCHETYPE_EXPLANATION_COPY[bp.primaryArchetype] : null;
                const secLabel = bp.secondaryArchetype ? ARCHETYPE_LABELS[bp.secondaryArchetype] : null;
                return (
                  <div className="mt-6 pt-4 border-t border-surface-border">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-foreground">{t("manager:buildingsId.heading.managementGuidelines")}</h3>
                      <div className="flex items-center gap-1.5">
                        {archLabel && <Badge variant="brand" size="sm">{archLabel}</Badge>}
                        {secLabel && <Badge variant="info" size="sm">{secLabel}</Badge>}
                      </div>
                    </div>
                    <KpiInlineGrid
                      items={[
                        { label: t("manager:buildingsId.label.roleIntent"), value: bp.roleIntent ? bp.roleIntent.replace(/_/g, " ") : "—" },
                        { label: t("manager:buildingsId.label.buildingType"), value: bp.buildingType ? bp.buildingType.replace(/_/g, " ") : "—" },
                        { label: t("manager:buildingsId.label.condition"), value: bp.conditionRating != null ? `${bp.conditionRating}/10` : "—" },
                        { label: t("manager:buildingsId.label.approxUnits"), value: bp.approxUnits != null ? String(bp.approxUnits) : "—" },
                      ]}
                    />
                    {copy && (
                      <div className="mt-3">
                        <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim mb-1.5">{t("manager:buildingsId.label.guidelines")}</div>
                        <ul className="space-y-1">
                          {copy.bullets.map((b, i) => (
                            <li key={i} className="text-xs text-muted-text flex gap-1.5">
                              <span className="text-foreground-dim flex-shrink-0">·</span>
                              <span>{b}</span>
                            </li>
                          ))}
                          {copy.deprioritize && (
                            <li className="text-xs text-foreground-dim flex gap-1.5 mt-1">
                              <span className="flex-shrink-0">↓ {t("manager:buildingsId.label.guidelines")}:</span>
                              <span>{copy.deprioritize}</span>
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })()}
            </Panel>
            </>
          )}

          {/* Units tab */}
          {activeTab === "Units" && (
            <Panel
              title={t("manager:buildingsId.title.units")}
              actions={(
                <button
                  type="button"
                  className="button-primary text-sm"
                  onClick={() => setUnitAction(unitAction ? null : "create")}
                >
                  {unitAction ? t("manager:buildingsId.btn.cancel") : t("manager:buildingsId.btn.addUnit")}
                </button>
              )}
            >
              {unitAction === "create" && (
                <form onSubmit={onCreateUnit} className="bg-surface-subtle border border-surface-border rounded-lg p-4 mb-4">
                  <div className="grid gap-4 sm:grid-cols-2 mb-4">
                    <label className="grid gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">Unit number/label</span>
                      <input
                        className="input text-sm text-muted-dark"
                        value={createUnitName}
                        onChange={(e) => setCreateUnitName(e.target.value)}
                        placeholder={t("manager:buildingsId.placeholder.eG1013bCommonArea1")}
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.label.type")}</span>
                      <select
                        className="input text-sm text-muted-dark"
                        value={createUnitType}
                        onChange={(e) => setCreateUnitType(e.target.value)}
                      >
                        <option value="RESIDENTIAL">{t("manager:buildingsId.select.residential")}</option>
                        <option value="COMMON_AREA">{t("manager:buildingsId.select.commonArea")}</option>
                      </select>
                    </label>
                  </div>
                  <button type="submit" className="button-primary" disabled={loading}>
                    {loading ? t("manager:buildingsId.btn.creating") : t("manager:buildingsId.btn.createUnit")}
                  </button>
                </form>
              )}

              {residentialUnits.length > 0 && (
                <>
                  {/* ─── Occupancy summary row ─── */}
                  <div className="text-sm text-muted-text mt-4 mb-2">
                    {units.length} {units.length !== 1 ? t("manager:buildingsId.text.units") : t("manager:buildingsId.text.unit")} — {occupiedCount} {t("manager:buildingsId.text.occupied").toLowerCase()}, {vacantCount} {t("manager:buildingsId.text.vacant").toLowerCase()}, {listedCount} {t("manager:buildingsId.text.listed").toLowerCase()}
                  </div>

                  {/* ─── Filter tabs ─── */}
                  <div className="flex gap-1 mb-4">
                    {[
                      { key: "ALL",      label: t("manager:buildingsId.text.all") },
                      { key: "OCCUPIED", label: t("manager:buildingsId.text.occupied") },
                      { key: "VACANT",   label: t("manager:buildingsId.text.vacant") },
                      { key: "LISTED",   label: t("manager:buildingsId.text.listed") },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setUnitFilter(tab.key)}
                        className={cn("px-3 py-1 text-xs font-medium rounded-full border transition", unitFilter === tab.key
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-surface text-muted-text border-muted-ring hover:bg-surface-subtle")}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {filteredResidential.length > 0 && (
                <>
                  <h3 className="font-semibold text-foreground mt-4 mb-3">{t("manager:buildingsId.heading.residentialUnits")}</h3>
                  <div className="space-y-2 mb-4">
                    {filteredResidential.map((u) => (
                      <Link key={u.id} href={`/admin-inventory/units/${u.id}${isOwner ? "?role=owner" : ""}`} className="block border border-surface-border rounded-lg p-3 hover:bg-surface-subtle transition">
                        <div className="flex justify-between items-center">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-foreground">{u.unitNumber || u.name || "Unit"}</span>
                              {u.floor && <span className="text-xs text-foreground-dim">Floor {u.floor}</span>}
                              {u.rooms != null && <span className="text-xs text-foreground-dim">{u.rooms} rooms</span>}
                              {u.livingAreaSqm != null && <span className="text-xs text-foreground-dim">{u.livingAreaSqm} m²</span>}
                              {/* ─── Occupancy badge ─── */}
                              {u.occupancyStatus === "OCCUPIED" && (
                                <Badge variant="success" size="sm">{t("manager:buildingsId.text.occupied")}</Badge>
                              )}
                              {u.occupancyStatus === "VACANT" && (
                                <Badge variant="destructive" size="sm">{t("manager:buildingsId.text.vacant")}</Badge>
                              )}
                              {u.occupancyStatus === "LISTED" && (
                                <Badge variant="warning" size="sm">{t("manager:buildingsId.text.listed")}</Badge>
                              )}
                            </div>
                            {/* ─── Tenant info for occupied units ─── */}
                            {u.occupancyStatus === "OCCUPIED" && u.tenantName && (
                              <div className="text-xs text-muted mt-1">
                                <span className="text-muted-dark">{u.tenantName}</span>
                                {u.moveInDate && (
                                  <span className="ml-2 text-foreground-dim">
                                    {t("manager:buildingsId.text.since")}{formatDate(u.moveInDate)}
                                  </span>
                                )}
                              </div>
                            )}
                            {/* ─── Listed note ─── */}
                            {u.occupancyStatus === "LISTED" && (
                              <div className="text-xs text-yellow-600 mt-1">{t("manager:buildingsId.text.acceptingApplications")}</div>
                            )}
                            {(u.monthlyRentChf != null || u.monthlyChargesChf != null) && (
                              <div className="text-xs text-muted mt-1">
                                {u.monthlyRentChf != null && <span className="font-medium text-muted-dark">CHF {u.monthlyRentChf}.-</span>}
                                {u.monthlyChargesChf != null && <span className="ml-1 text-foreground-dim">+ {u.monthlyChargesChf} charges</span>}
                                {(u.monthlyRentChf != null || u.monthlyChargesChf != null) && (
                                  <span className="ml-1 text-muted-text font-medium">= CHF {(u.monthlyRentChf || 0) + (u.monthlyChargesChf || 0)}.- total</span>
                                )}
                              </div>
                            )}
                          </div>
                          <span className="text-blue-600 ml-2 flex-shrink-0">→</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              )}

              {filteredCommon.length > 0 && (
                <>
                  <h3 className="font-semibold text-foreground mt-4 mb-3">{t("manager:buildingsId.heading.commonAreas")}</h3>
                  <div className="space-y-2 mb-4">
                    {filteredCommon.map((u) => (
                      <Link key={u.id} href={`/admin-inventory/units/${u.id}${isOwner ? "?role=owner" : ""}`} className="block border border-surface-border rounded-lg p-3 hover:bg-surface-subtle transition">
                        <div className="flex justify-between items-center">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-foreground">{u.unitNumber || u.name || t("manager:buildingsId.text.commonArea")}</span>
                              {u.floor && <span className="text-xs text-foreground-dim">{u.floor}</span>}
                              {u.livingAreaSqm != null && <span className="text-xs text-foreground-dim">{u.livingAreaSqm} m²</span>}
                              {/* ─── Occupancy badge ─── */}
                              {u.occupancyStatus === "OCCUPIED" && (
                                <Badge variant="success" size="sm">{t("manager:buildingsId.text.occupied")}</Badge>
                              )}
                              {u.occupancyStatus === "VACANT" && (
                                <Badge variant="destructive" size="sm">{t("manager:buildingsId.text.vacant")}</Badge>
                              )}
                              {u.occupancyStatus === "LISTED" && (
                                <Badge variant="warning" size="sm">{t("manager:buildingsId.text.listed")}</Badge>
                              )}
                            </div>
                          </div>
                          <span className="text-blue-600 ml-2 flex-shrink-0">→</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              )}

              {units.length === 0 && <div className="text-center text-muted italic text-sm py-6">{t("manager:buildingsId.text.noUnitsYet")}</div>}
            </Panel>
          )}

          {/* Tenants tab */}
          {activeTab === "Tenants" && (
            <Panel title={t("manager:buildingsId.title.tenants")}>
              {building?.tenants && building.tenants.length > 0 ? (
                <>
                {/* Mobile: card list */}
                <div className="sm:hidden space-y-2">
                  {sortedBuildingTenants.map((ten, idx) => (
                    <div key={ten.tenantId || idx} className="rounded-lg border border-surface-border bg-surface-subtle px-3 py-2.5">
                      <p className="text-sm font-medium text-foreground">{ten.name}</p>
                      <p className="text-xs text-muted mt-0.5">Unit {ten.unitNumber}{ten.phone ? ` · ${ten.phone}` : ""}</p>
                    </div>
                  ))}
                </div>
                {/* Desktop: table */}
                <table className="hidden sm:table data-table">
                  <thead>
                    <tr>
                      <SortableHeader label={t("manager:buildingsId.col.name")} field="name" sortField={tenSF} sortDir={tenSD} onSort={handleTenSort} />
                      <SortableHeader label={t("manager:buildingsId.col.unit")} field="unit" sortField={tenSF} sortDir={tenSD} onSort={handleTenSort} />
                      <SortableHeader label={t("manager:buildingsId.col.phone")} field="phone" sortField={tenSF} sortDir={tenSD} onSort={handleTenSort} />
                      <SortableHeader label={t("manager:buildingsId.col.email")} field="email" sortField={tenSF} sortDir={tenSD} onSort={handleTenSort} />
                      <SortableHeader label={t("manager:buildingsId.col.moveIn")} field="moveIn" sortField={tenSF} sortDir={tenSD} onSort={handleTenSort} />
                      <SortableHeader label={t("manager:buildingsId.col.source")} field="source" sortField={tenSF} sortDir={tenSD} onSort={handleTenSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedBuildingTenants.map((ten, idx) => {
                      const badgeVariant =
                        ten.source === "BOTH"
                          ? "success"
                          : ten.source === "LEASE"
                          ? "info"
                          : "muted";
                      return (
                        <tr key={ten.tenantId || idx} className="border-b border-surface-divider">
                          <td className="text-foreground font-medium">{ten.name}</td>
                          <td className="text-muted-dark">{ten.unitNumber}</td>
                          <td className="text-muted-dark">{ten.phone || "—"}</td>
                          <td className="text-muted-dark">{ten.email || "—"}</td>
                          <td className="text-muted-dark">{ten.moveInDate ? displayDate(ten.moveInDate) : "—"}</td>
                          <td>
                            <Badge variant={badgeVariant} size="sm">
                              {ten.source === "BOTH" ? t("manager:buildingsId.text.both") : ten.source === "LEASE" ? t("manager:buildingsId.text.lease") : t("manager:buildingsId.text.directory")}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </>
              ) : (
                <div className="text-center text-muted italic text-sm py-6">{t("manager:buildingsId.text.noTenantsYet")}</div>
              )}
            </Panel>
          )}

          {/* Assets tab */}
          {activeTab === "Assets" && (
            <Panel
              title={t("manager:buildingsId.title.assetInventoryDepreciation")}
              actions={!assetInventoryLoading && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="button-secondary text-sm"
                    onClick={seedDefaultAssets}
                    disabled={assetSeeding}
                  >
                    {assetSeeding ? "Seeding…" : "Populate defaults"}
                  </button>
                  <button
                    type="button"
                    className={assetAddMode ? "button-cancel text-sm" : "button-primary text-sm"}
                    onClick={() => setAssetAddMode((v) => !v)}
                  >
                    {assetAddMode ? t("manager:buildingsId.btn.cancel") : t("manager:buildingsId.btn.addAsset")}
                  </button>
                </div>
              )}
            >
              {assetInventoryLoading ? (
                <p className="text-center text-muted py-6">Loading assets…</p>
              ) : (
                <AssetInventoryPanel
                  assets={assetInventory}
                  onRefresh={loadAssetInventory}
                  scope="building"
                  parentId={id}
                  units={units.map((u) => ({ id: u.id, unitNumber: u.unitNumber }))}
                  showAddForm={assetAddMode}
                  setShowAddForm={setAssetAddMode}
                />
              )}
            </Panel>
          )}

          {/* Documents tab */}
          {activeTab === "Documents" && (
            <>
            <Panel title={t("manager:buildingsId.title.documents")}>
              <h3 className="font-semibold text-foreground mb-3">{t("manager:buildingsId.heading.leaseTemplate")}</h3>
              {leaseTemplates.length > 0 ? (
                <div className="space-y-2">
                  {leaseTemplates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="border border-surface-border rounded-lg p-4 hover:bg-surface-subtle transition"
                    >
                      <div className="flex justify-between items-center">
                        <Link href={`/manager/leases/${tpl.id}`} className="flex-1 min-w-0">
                          <span className="font-semibold text-foreground">{tpl.templateName || "Lease Template"}</span>
                          <Badge variant="brand" size="sm" className="ml-2">{t("manager:buildingsId.text.template")}</Badge>
                          {tpl.landlordName && (
                            <p className="text-xs text-muted mt-1">{t("manager:buildingsId.text.landlordPrefix")}{tpl.landlordName}</p>
                          )}
                          {tpl.netRentChf != null && (
                            <p className="text-xs text-muted">{t("manager:buildingsId.text.defaultRentPrefix")}{tpl.netRentChf}{t("manager:buildingsId.text.defaultRentSuffix")}</p>
                          )}
                        </Link>
                        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                          <Link href={`/manager/leases/${tpl.id}`} className="text-blue-600">→</Link>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const r = await fetch(`/api/lease-templates/${tpl.id}`, { method: "DELETE", headers: authHeaders() });
                                if (!r.ok) throw new Error("Delete failed");
                                await loadLeaseTemplates();
                                toast.show(`Template "${tpl.templateName || "Unnamed"}" deleted`, async () => {
                                  await fetch(`/api/lease-templates/${tpl.id}/restore`, { method: "POST", headers: authHeaders() });
                                  await loadLeaseTemplates();
                                });
                              } catch (e) {
                                setErr(`Failed to delete template: ${e.message}`);
                              }
                            }}
                            className="text-red-500 hover:text-red-700 text-sm font-medium"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm text-amber-700 font-medium mb-1">No lease template found for this building</p>
                  <p className="text-xs text-amber-600 mb-3">
                    {t("manager:buildingsId.text.leaseTemplateDesc")}
                  </p>
                  <Link
                    href="/manager/leases?tab=templates"
                    className="inline-flex items-center rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"
                  >
                    {t("manager:buildingsId.text.goToLeaseTemplates")}
                  </Link>
                </div>
              )}
            </Panel>

            {/* House Rules panel */}
            <Panel
              title="House Rules"
              actions={
                <div className="flex items-center gap-2">
                  {building?.houseRulesText && !houseRulesEditing && (
                    <>
                      <button type="button" onClick={onPreviewHouseRulesPdf} className="button-secondary text-sm">
                        {houseRulesPreviewUrl ? "Close Preview" : "Preview PDF"}
                      </button>
                      <button type="button" onClick={onDownloadHouseRulesPdf} className="button-secondary text-sm">
                        Download PDF
                      </button>
                    </>
                  )}
                  {houseRulesEditing ? (
                    <>
                      <button type="button" onClick={() => { setHouseRulesEditing(false); setHouseRulesText(building?.houseRulesText || ""); }} className="button-cancel text-sm">Cancel</button>
                      <button type="button" onClick={onSaveHouseRules} disabled={houseRulesSaving} className="button-primary text-sm">{houseRulesSaving ? "Saving…" : "Save"}</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setHouseRulesEditing(true)} className="button-secondary text-sm">{building?.houseRulesText ? "Edit" : "+ Add House Rules"}</button>
                  )}
                </div>
              }
            >
              {houseRulesEditing ? (
                <textarea
                  value={houseRulesText}
                  onChange={(e) => setHouseRulesText(e.target.value)}
                  rows={16}
                  className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand/40 resize-y"
                  placeholder="Enter house rules text. This will be attached to lease PDFs when 'Include house rules' is checked, and made available to tenants via the chatbot."
                />
              ) : building?.houseRulesText ? (
                <div className="space-y-2">
                  <pre className="whitespace-pre-wrap text-sm text-muted-dark font-sans leading-relaxed bg-surface-subtle rounded-lg border border-surface-border p-4 max-h-80 overflow-y-auto">{building.houseRulesText}</pre>
                  {houseRulesPreviewUrl && (
                    <div className="mt-3 rounded-lg overflow-hidden border border-surface-border h-[600px]">
                      <iframe src={houseRulesPreviewUrl} className="w-full h-full" title="House Rules PDF Preview" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-muted-ring bg-surface-subtle p-6 text-center">
                  <p className="text-sm text-muted mb-1">No house rules defined yet.</p>
                  <p className="text-xs text-foreground-dim">House rules will be attached to lease PDFs and accessible to tenants via the chatbot.</p>
                </div>
              )}
            </Panel>

            {/* Legal Reference Documents */}
            <Panel title="Legal Reference Documents">
              <p className="text-xs text-muted mb-4">
                Federal and canton-scoped legal sources applicable to this building. These documents are used by the tenant AI chatbot to answer questions about rights, obligations, and procedures.
                {building?.canton ? ` Canton: ${building.canton}.` : ""}
              </p>
              {legalSourcesLoading ? (
                <p className="text-sm text-muted">{t("common:loading")}</p>
              ) : legalSources.length === 0 ? (
                <div className="rounded-lg border border-dashed border-muted-ring bg-surface-subtle p-4 text-center">
                  <p className="text-sm text-muted">No legal sources configured.</p>
                  <p className="text-xs text-foreground-dim mt-1">Add sources in Settings → Legal to make them available here.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {legalSources.map((src) => (
                    <div key={src.id} className="flex items-start justify-between gap-3 rounded-lg border border-surface-border bg-surface p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-foreground">{src.name}</span>
                          <span className={src.scope === "FEDERAL" ? "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-brand-light text-brand-dark" : "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-info-light text-info-dark"}>
                            {src.scope === "FEDERAL" ? "Federal CH" : "Canton " + src.scope}
                          </span>
                          {src.fetcherType && (
                            <span className="inline-flex items-center rounded-full bg-surface-subtle border border-surface-border px-2 py-0.5 text-xs text-muted font-mono">
                              {src.fetcherType}
                            </span>
                          )}
                        </div>
                        {src.url && (
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 block truncate text-xs text-blue-600 hover:underline"
                          >
                            {src.url}
                          </a>
                        )}
                        {src.lastSuccessAt && (
                          <p className="mt-1 text-xs text-foreground-dim">
                            Last synced: {new Date(src.lastSuccessAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            </>
          )}

          {/* Policies tab */}
          {activeTab === "Policies" && (
            <>
              <Panel
                title={t("manager:buildingsId.title.policies")}
                actions={configMode === "edit" ? (
                  <button
                    type="button"
                    className="button-cancel text-sm"
                    onClick={() => setConfigMode(null)}
                  >
                    {t("manager:buildingsId.btn.cancelPolicies")}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="button-primary text-sm"
                    onClick={() => setConfigMode("edit")}
                  >
                    {t("manager:buildingsId.btn.editPolicies")}
                  </button>
                )}
              >
                <div className="text-sm text-muted-text mb-4">{t("manager:buildingsId.text.autoApproveDesc")}</div>
                {configMode === "edit" ? (
                  <form onSubmit={onSaveBuildingConfig} className="mt-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-2">
                        <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.label.autoApproveLimit")}</span>
                        <input
                          type="number"
                          className="input text-sm text-muted-dark"
                          value={configAutoApprove}
                          onChange={(e) => setConfigAutoApprove(e.target.value)}
                          placeholder={t("manager:buildingsId.placeholder.leaveBlankForOrgDefault")}
                        />
                        <span className="text-xs text-muted">{t("manager:buildingsId.label.blankOrgDefault")}</span>
                      </label>
                      <label className="grid gap-2">
                        <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.label.ownerThreshold")}</span>
                        <input
                          type="number"
                          className="input text-sm text-muted-dark"
                          value={configOwnerThreshold}
                          onChange={(e) => setConfigOwnerThreshold(e.target.value)}
                          placeholder={t("manager:buildingsId.placeholder.leaveBlankForOrgDefault")}
                        />
                        <span className="text-xs text-muted">{t("manager:buildingsId.label.blankOrgDefault")}</span>
                      </label>
                    </div>
                    <label className="flex items-center gap-2 my-4 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={configEmergency}
                        onChange={(e) => setConfigEmergency(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm font-semibold text-muted-dark">{t("manager:buildingsId.label.emergencyAutoDispatch")}</span>
                    </label>
                    <button type="submit" className="button-primary" disabled={loading}>
                      {loading ? t("manager:buildingsId.btn.saving") : t("manager:buildingsId.btn.savePolicies")}
                    </button>
                  </form>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2 mt-4">
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.label.autoApproveLimitView")}</div>
                        <div className="text-sm text-muted-dark mt-1">
                          {buildingConfig?.autoApproveLimit != null ? `${buildingConfig.autoApproveLimit} CHF` : t("manager:buildingsId.label.usingOrgDefault")}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.label.ownerThresholdView")}</div>
                        <div className="text-sm text-muted-dark mt-1">
                          {buildingConfig?.requireOwnerApprovalAbove != null ? `${buildingConfig.requireOwnerApprovalAbove} CHF` : t("manager:buildingsId.label.usingOrgDefault")}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("manager:buildingsId.label.emergencyAutoDispatch")}</div>
                        <div className="text-sm text-muted-dark mt-1">
                          {buildingConfig?.emergencyAutoDispatch ? t("manager:buildingsId.label.enabled") : t("manager:buildingsId.label.disabled")}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </Panel>

              <Panel
                title={t("manager:buildingsId.title.overrides")}
                actions={createRuleMode ? (
                  <button
                    type="button"
                    className="button-cancel text-sm"
                    onClick={() => {
                      setCreateRuleMode(false);
                      setNewRuleName("");
                      setNewRulePriority("0");
                      setNewRuleConditions([{ field: "CATEGORY", operator: "EQUALS", value: "" }]);
                      setNewRuleAction("AUTO_APPROVE");
                    }}
                  >
                    {t("manager:buildingsId.btn.cancel")}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="button-primary text-sm"
                    onClick={() => setCreateRuleMode(true)}
                  >
                    {t("manager:buildingsId.btn.addOverride")}
                  </button>
                )}
              >
                <div className="text-sm text-muted-text mb-4">{t("manager:buildingsId.text.overrideDesc")}</div>

              {createRuleMode ? (
                <form onSubmit={onCreateRule} className="mt-4">
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-muted-dark mb-2">{t("manager:buildingsId.label.ruleName")}</label>
                    <input
                      className="input text-sm text-muted-dark w-full"
                      value={newRuleName}
                      onChange={(e) => setNewRuleName(e.target.value)}
                      placeholder={t("manager:buildingsId.placeholder.eGAutoApproveOvensChf500")}
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-muted-dark mb-2">{t("manager:buildingsId.label.priorityLabel")}</label>
                    <input
                      type="number"
                      className="input text-sm text-muted-dark"
                      value={newRulePriority}
                      onChange={(e) => setNewRulePriority(e.target.value)}
                      min="0"
                      max="100"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-muted-dark mb-2">{t("manager:buildingsId.label.conditions")}</label>
                    <div className="space-y-2 mb-3">
                      {newRuleConditions.map((cond, idx) => (
                        <div key={idx} className="flex gap-2 items-end">
                          <select
                            className="input text-sm text-muted-dark flex-1"
                            value={cond.field}
                            onChange={(e) => updateCondition(idx, "field", e.target.value)}
                          >
                            <option value="CATEGORY">{t("manager:buildingsId.select.category")}</option>
                            <option value="ESTIMATED_COST">{t("manager:buildingsId.select.estimatedCost")}</option>
                            <option value="UNIT_TYPE">{t("manager:buildingsId.select.unitType")}</option>
                            <option value="UNIT_NUMBER">Unit Number</option>
                          </select>
                          <select
                            className="input text-sm text-muted-dark flex-1"
                            value={cond.operator}
                            onChange={(e) => updateCondition(idx, "operator", e.target.value)}
                          >
                            <option value="EQUALS">{t("manager:buildingsId.select.equals")}</option>
                            <option value="NOT_EQUALS">{t("manager:buildingsId.select.notEquals")}</option>
                            {cond.field === "ESTIMATED_COST" && (
                              <>
                                <option value="LESS_THAN">{t("manager:buildingsId.select.lessThan")}</option>
                                <option value="LESS_THAN_OR_EQUAL">{t("manager:buildingsId.select.lessThanOrEqual")}</option>
                                <option value="GREATER_THAN">{t("manager:buildingsId.select.greaterThan")}</option>
                                <option value="GREATER_THAN_OR_EQUAL">{t("manager:buildingsId.select.greaterThanOrEqual")}</option>
                              </>
                            )}
                            {(cond.field === "CATEGORY" || cond.field === "UNIT_TYPE" || cond.field === "UNIT_NUMBER") && (
                              <>
                                <option value="CONTAINS">{t("manager:buildingsId.select.contains")}</option>
                                <option value="STARTS_WITH">{t("manager:buildingsId.select.startsWith")}</option>
                                <option value="ENDS_WITH">{t("manager:buildingsId.select.endsWith")}</option>
                              </>
                            )}
                          </select>
                          <input
                            className="input text-sm text-muted-dark flex-1"
                            type={cond.field === "ESTIMATED_COST" ? "number" : "text"}
                            value={cond.value}
                            onChange={(e) =>
                              updateCondition(idx, "value", cond.field === "ESTIMATED_COST" ? parseInt(e.target.value) || 0 : e.target.value)
                            }
                            placeholder={
                              cond.field === "CATEGORY"
                                ? "e.g., oven, stove"
                                : cond.field === "UNIT_TYPE"
                                ? "RESIDENTIAL or COMMON_AREA"
                                : cond.field === "UNIT_NUMBER"
                                ? "e.g., 101, 2xx, PH"
                                : "CHF amount"
                            }
                          />
                          {newRuleConditions.length > 1 && (
                            <button
                              type="button"
                              className="button-secondary px-2 py-1 text-xs"
                              onClick={() => removeCondition(idx)}
                            >
                              {t("manager:buildingsId.btn.remove")}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button type="button" className="button-secondary text-xs" onClick={addCondition}>
                      {t("manager:buildingsId.btn.addCondition")}
                    </button>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-muted-dark mb-2">{t("manager:buildingsId.label.action")}</label>
                    <select className="input text-sm text-muted-dark w-full" value={newRuleAction} onChange={(e) => setNewRuleAction(e.target.value)}>
                      <option value="AUTO_APPROVE">{t("manager:buildingsId.select.autoApprove")}</option>
                      <option value="REQUIRE_MANAGER_REVIEW">{t("manager:buildingsId.select.requireManagerReview")}</option>
                      <option value="REQUIRE_OWNER_APPROVAL">{t("manager:buildingsId.select.requireOwnerApproval")}</option>
                    </select>
                  </div>

                  <button type="submit" className="button-primary" disabled={loading}>
                    {loading ? t("manager:buildingsId.btn.creating") : t("manager:buildingsId.btn.createRule")}
                  </button>
                </form>
              ) : (
                <>
                  {rules.length > 0 && (
                    <div className="space-y-3 mt-4 mb-4">
                      {rules.map((rule) => (
                        <div key={rule.id} className="border border-surface-border rounded-lg p-3 bg-surface-subtle">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-semibold text-foreground">
                                {rule.name}
                                {!rule.isActive && <Badge variant="warning" size="sm" className="ml-2">{t("manager:buildingsId.label.inactive")}</Badge>}
                                <Badge variant="info" size="sm" className="ml-2">{t("manager:buildingsId.label.priorityPrefix")}{rule.priority}</Badge>
                              </div>
                              <div className="text-xs text-muted-text mt-1">
                                {rule.conditions.map((c, i) => (
                                  <span key={i}>
                                    {i > 0 && " AND "}
                                    <strong>{c.field}</strong> {c.operator.toLowerCase().replace(/_/g, " ")} <code>{c.value}</code>
                                  </span>
                                ))}
                                {" → "}
                                <strong>{rule.action.toLowerCase().replace(/_/g, " ")}</strong>
                              </div>
                            </div>
                            <div className="flex gap-2 ml-4">
                              <button
                                type="button"
                                className="button-secondary text-xs px-2 py-1"
                                onClick={() => onToggleRuleActive(rule.id, rule.isActive)}
                                disabled={loading}
                              >
                                {rule.isActive ? t("manager:buildingsId.btn.deactivate") : t("manager:buildingsId.btn.activate")}
                              </button>
                              <button
                                type="button"
                                className="button-danger text-xs px-2 py-1"
                                onClick={() => onDeleteRule(rule.id)}
                                disabled={loading}
                              >
                                {t("manager:buildingsId.btn.delete")}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {rules.length === 0 && <div className="text-center text-muted italic text-sm py-6">{t("manager:buildingsId.text.noApprovalRulesYet")}</div>}
                </>
              )}
              </Panel>
            </>
          )}

          {/* Requests tab */}
          {activeTab === "Requests" && (
            <Panel title={t("manager:buildingsId.title.requests")}>
              {requestsLoading ? (
                <p className="text-sm text-muted py-4">{t("manager:buildingsId.text.loadingRequests")}</p>
              ) : buildingRequests.length === 0 ? (
                <p className="text-sm text-muted italic py-4">{t("manager:buildingsId.text.noRequestsYet")}</p>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="sm:hidden divide-y divide-slate-100">
                    {sortedBuildingRequests.map((r) => (
                      <div
                        key={r.id}
                        className="py-3 flex flex-col gap-1 cursor-pointer hover:bg-surface-subtle"
                        onClick={() => router.push(`/manager/requests?id=${r.id}`)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-muted-dark">
                            #{r.requestNumber}{r.category ? ` · ${r.category}` : ""}
                          </span>
                          <Badge variant={
                            r.status === "COMPLETED" ? "success" :
                            r.status === "REJECTED" ? "destructive" :
                            r.status === "PENDING_REVIEW" || r.status === "PENDING_OWNER_APPROVAL" || r.status === "RFP_PENDING" ? "warning" :
                            r.status === "APPROVED" || r.status === "ASSIGNED" ? "info" : "default"
                          } size="sm">
                            {r.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted flex items-center gap-2">
                          {r.unit?.unitNumber && <span>Unit {r.unit.unitNumber}</span>}
                          {r.urgency && <span>· {r.urgency}</span>}
                          {r.assignedContractor?.name && <span>· {r.assignedContractor.name}</span>}
                        </div>
                        <span className="text-xs text-foreground-dim">
                          {r.createdAt ? new Date(r.createdAt).toLocaleDateString("de-CH") : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="data-table w-full">
                      <thead>
                        <tr>
                          <th>{t("manager:buildingsId.col.number")}</th>
                          <SortableHeader label={t("manager:buildingsId.col.status")} field="status" sortField={reqSF} sortDir={reqSD} onSort={handleReqSort} />
                          <SortableHeader label={t("manager:buildingsId.col.category")} field="category" sortField={reqSF} sortDir={reqSD} onSort={handleReqSort} />
                          <SortableHeader label={t("manager:buildingsId.col.unit")} field="unit" sortField={reqSF} sortDir={reqSD} onSort={handleReqSort} />
                          <SortableHeader label={t("manager:buildingsId.col.urgency")} field="urgency" sortField={reqSF} sortDir={reqSD} onSort={handleReqSort} />
                          <SortableHeader label={t("manager:buildingsId.col.contractor")} field="contractor" sortField={reqSF} sortDir={reqSD} onSort={handleReqSort} />
                          <SortableHeader label={t("manager:buildingsId.col.date")} field="createdAt" sortField={reqSF} sortDir={reqSD} onSort={handleReqSort} />
                        </tr>
                      </thead>
                      <tbody>
                        {sortedBuildingRequests.map((r) => (
                          <tr
                            key={r.id}
                            className="cursor-pointer hover:bg-surface-subtle"
                            onClick={() => router.push(`/manager/requests?id=${r.id}`)}
                          >
                            <td className="font-mono text-muted-text">#{r.requestNumber}</td>
                            <td>
                              <Badge variant={
                                r.status === "COMPLETED" ? "success" :
                                r.status === "REJECTED" ? "destructive" :
                                r.status === "PENDING_REVIEW" || r.status === "PENDING_OWNER_APPROVAL" || r.status === "RFP_PENDING" ? "warning" :
                                r.status === "APPROVED" || r.status === "ASSIGNED" ? "info" : "default"
                              } size="sm">
                                {r.status.replace(/_/g, " ")}
                              </Badge>
                            </td>
                            <td className="text-muted-dark">{r.category || "—"}</td>
                            <td className="text-muted-text">{r.unit?.unitNumber || "—"}</td>
                            <td className="text-muted-text">{r.urgency || "—"}</td>
                            <td className="text-muted-text">{r.assignedContractor?.name || "—"}</td>
                            <td className="text-foreground-dim">
                              {r.createdAt ? new Date(r.createdAt).toLocaleDateString("de-CH") : "—"}
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

          {/* Financials tab */}
          {activeTab === "Financials" && id && (
            <BuildingFinancialsView buildingId={id} variant="embedded" />
          )}

          {/* Correspondence tab — read-only view of letters sent to this building's tenants */}
          {activeTab === "Correspondence" && (
            <CorrespondenceTab buildingId={id} />
          )}
        </PageContent>
        <UndoToast {...toast} />
      </PageShell>
    </AppShell>
  );
}

export const getServerSideProps = withServerTranslations(["common","manager"]);
