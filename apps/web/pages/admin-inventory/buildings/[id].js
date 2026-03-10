import { useRouter } from "next/router";
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import UndoToast, { useUndoToast } from "../../../components/ui/UndoToast";
import AssetInventoryPanel from "../../../components/AssetInventoryPanel";
import { authHeaders } from "../../../lib/api";
import { formatChfCents, formatPercent } from "../../../lib/format";

/* ─── Financials helpers ─── */
function displayDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

function defaultRange() {
  const now = new Date();
  const from = `${now.getFullYear()}-01-01`;
  const to = now.toISOString().slice(0, 10);
  return { from, to };
}

const CATEGORY_LABELS = {
  MAINTENANCE: "Maintenance",
  UTILITIES: "Utilities",
  CLEANING: "Cleaning",
  INSURANCE: "Insurance",
  TAX: "Tax",
  ADMIN: "Administration",
  CAPEX: "Capital Expenditure",
  OTHER: "Other",
};

/* ─── Financials UI components ─── */
function HealthBullet({ icon, text, color }) {
  const bg = { green: "bg-emerald-50", amber: "bg-amber-50", red: "bg-red-50" }[color] || "bg-gray-50";
  const border = { green: "border-emerald-200", amber: "border-amber-200", red: "border-red-200" }[color] || "border-gray-200";
  return (
    <div className={`flex items-start gap-2.5 px-4 py-3 rounded-lg border ${bg} ${border}`}>
      <span className="text-lg leading-none mt-0.5">{icon}</span>
      <span className="text-sm text-gray-800">{text}</span>
    </div>
  );
}

function HeroKpi({ label, value, color }) {
  const textColor = color === "green" ? "text-emerald-700" : color === "red" ? "text-red-700" : "text-gray-900";
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 flex flex-col items-center gap-1 text-center">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      <span className={`text-2xl font-bold ${textColor}`}>{value}</span>
    </div>
  );
}

function DetailSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-sm font-semibold text-gray-700">{title}</span>
        <span className="text-gray-400 text-xs">{open ? "▲ Hide" : "▼ Show"}</span>
      </button>
      {open && <div className="p-4 bg-white">{children}</div>}
    </div>
  );
}

export default function BuildingDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [activeTab, setActiveTab] = useState("Building information");

  const ui = {
    page: { maxWidth: "1100px", margin: "40px auto", padding: "24px", fontFamily: "system-ui" },
    headerRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" },
    h1: { fontSize: "2.2rem", fontWeight: 700, margin: 0 },
    h2: { fontSize: "1.5rem", fontWeight: 600, margin: "0 0 16px 0" },
    subtle: { color: "#888", fontSize: "0.95rem" },
    code: { background: "#f5f5f5", padding: "2px 6px", borderRadius: "4px", fontSize: "0.95em", fontFamily: "monospace" },
    codeSmall: { background: "#f5f5f5", padding: "2px 4px", borderRadius: "3px", fontSize: "0.85em", fontFamily: "monospace" },
    card: { background: "#fff", border: "1px solid #e5e5e5", borderRadius: "8px", padding: "20px", marginBottom: "20px" },
    label: { display: "block", fontWeight: 600, marginBottom: "6px", fontSize: "0.95rem" },
    input: { padding: "10px 12px", borderRadius: "6px", border: "1px solid #ddd", width: "100%", maxWidth: "380px", fontSize: "0.95rem", boxSizing: "border-box" },
    primaryBtn: { padding: "10px 20px", borderRadius: "6px", border: "none", background: "#111", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "0.95rem" },
    secondaryBtn: { padding: "10px 20px", borderRadius: "6px", border: "1px solid #ddd", background: "#fafafa", color: "#111", cursor: "pointer", fontWeight: 500, fontSize: "0.95rem" },
    dangerBtn: { padding: "10px 20px", borderRadius: "6px", border: "none", background: "#dc3545", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "0.95rem" },
    formRow: { display: "flex", gap: "16px", alignItems: "flex-end", marginBottom: "20px" },
    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" },
    list: { display: "flex", flexDirection: "column", gap: "12px" },
    listRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px", border: "1px solid #e5e5e5", borderRadius: "6px", background: "#fafafa" },
    rowTitle: { fontWeight: 600, fontSize: "1rem", marginBottom: "4px" },
    help: { fontSize: "0.85rem", color: "#666", marginTop: "4px" },
    empty: { padding: "20px", textAlign: "center", color: "#888", fontStyle: "italic" },
    notice: { padding: "12px 16px", borderRadius: "6px", marginBottom: "16px", fontSize: "0.95rem" },
    noticeOk: { background: "#e8f5e9", border: "1px solid #81c784", color: "#2e7d32" },
    noticeErr: { background: "#ffebee", border: "1px solid #ef5350", color: "#c62828" },
    pill: { display: "inline-block", background: "#e0e0e0", color: "#333", padding: "2px 8px", borderRadius: "12px", fontSize: "0.8rem", marginLeft: "6px" },
    actionPanel: { background: "#fafafa", border: "1px solid #e5e5e5", borderRadius: "6px", padding: "14px", display: "flex", flexDirection: "column", gap: "16px" },
    actionHeader: { display: "flex", alignItems: "center", justifyContent: "space-between" },
    actionOptions: { display: "grid", gap: "10px" },
    actionOptionBtn: { padding: "10px 14px", borderRadius: "6px", border: "1px solid #ddd", background: "#fafafa", textAlign: "left", cursor: "pointer", fontWeight: 600 },
    actionHint: { color: "#666", fontSize: "0.85rem", marginTop: "4px" },
    backLink: { color: "#0066cc", textDecoration: "none", fontWeight: 500, marginBottom: "20px", display: "inline-block" },
  };

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

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
  const [editingOwnership, setEditingOwnership] = useState(false);
  const [ownerCandidates, setOwnerCandidates] = useState([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [ownerLoading, setOwnerLoading] = useState(false);

  // ─── Financials state ───
  const [finLoading, setFinLoading] = useState(false);
  const [finError, setFinError] = useState("");
  const [finData, setFinData] = useState(null);
  const [finRange, setFinRange] = useState(defaultRange);

  // ─── Asset inventory state ───
  const [assetInventory, setAssetInventory] = useState([]);
  const [assetInventoryLoading, setAssetInventoryLoading] = useState(false);

  const fetchFinancials = useCallback(
    async (forceRefresh = false) => {
      if (!id) return;
      setFinLoading(true);
      setFinError("");
      try {
        const params = new URLSearchParams({ from: finRange.from, to: finRange.to });
        if (forceRefresh) params.set("forceRefresh", "true");
        const res = await fetch(`/api/buildings/${id}/financials?${params}`, {
          headers: authHeaders(),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message || "Failed to load financials");
        setFinData(json.data);
      } catch (e) {
        setFinError(String(e?.message || e));
      } finally {
        setFinLoading(false);
      }
    },
    [id, finRange],
  );

  // Load financials when the tab is activated
  useEffect(() => {
    if (activeTab === "Financials" && !finData && !finLoading) {
      fetchFinancials();
    }
  }, [activeTab, finData, finLoading, fetchFinancials]);

  useEffect(() => {
    if (activeTab === "Assets" && assetInventory.length === 0 && !assetInventoryLoading) {
      loadAssetInventory();
    }
  }, [activeTab]);

  const healthBullets = useMemo(() => {
    if (!finData) return [];
    const bullets = [];
    // 1. Profitability
    const net = finData.netIncomeCents;
    if (net > 0) {
      bullets.push({ icon: "🟢", color: "green", text: `This building is profitable — net income of ${formatChfCents(net)} for the period.` });
    } else if (net === 0) {
      bullets.push({ icon: "🟡", color: "amber", text: "Income and expenses are exactly balanced — no profit or loss this period." });
    } else {
      bullets.push({ icon: "🔴", color: "red", text: `Expenses exceed income by ${formatChfCents(Math.abs(net))} — review the breakdown below.` });
    }
    // 2. Collection
    const cr = finData.collectionRate;
    if (cr >= 0.95) {
      bullets.push({ icon: "🟢", color: "green", text: `Collection rate is ${formatPercent(cr)} — rent is being paid on time.` });
    } else if (cr >= 0.80) {
      bullets.push({ icon: "🟡", color: "amber", text: `Collection rate is ${formatPercent(cr)} — some rent payments are outstanding.` });
    } else if (finData.projectedIncomeCents > 0) {
      bullets.push({ icon: "🔴", color: "red", text: `Collection rate is only ${formatPercent(cr)} — significant rent is overdue.` });
    } else {
      bullets.push({ icon: "🟡", color: "amber", text: "No projected income — collection rate cannot be assessed." });
    }
    // 3. Maintenance burden
    const mr = finData.maintenanceRatio;
    if (finData.earnedIncomeCents === 0 && finData.maintenanceTotalCents === 0) {
      bullets.push({ icon: "🟡", color: "amber", text: "No maintenance spend and no income recorded this period." });
    } else if (mr <= 0.15) {
      bullets.push({ icon: "🟢", color: "green", text: `Maintenance is ${formatPercent(mr)} of income — well within healthy range.` });
    } else if (mr <= 0.30) {
      bullets.push({ icon: "🟡", color: "amber", text: `Maintenance is ${formatPercent(mr)} of income — monitor for rising costs.` });
    } else {
      bullets.push({ icon: "🔴", color: "red", text: `Maintenance is ${formatPercent(mr)} of income — unusually high, investigate major repairs.` });
    }
    return bullets;
  }, [finData]);

  function setOk(message) {
    setNotice({ type: "ok", message });
    setTimeout(() => setNotice(null), 4000);
  }
  function setErr(message) {
    setNotice({ type: "err", message });
  }

  async function fetchJSON(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {}
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || `Request failed (${res.status})`;
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
      await loadUnits();
      await loadBuildingConfig();
      await loadApprovalRules();
      await loadLeaseTemplates();
    } catch (e) {
      setErr(`Failed to load building: ${e.message}`);
    } finally {
      setLoading(false);
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

  function startEditingOwnership() {
    setEditingOwnership(true);
    loadOwnerCandidates();
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
          yearBuilt: editYearBuilt ? Number(editYearBuilt) : null,
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
      setTimeout(() => router.push("/admin-inventory"), 1500);
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
      <AppShell role="MANAGER">
        <PageShell variant="embedded">
          <PageContent>
            <Panel>
              <p className="text-sm text-slate-600">Loading building...</p>
            </Panel>
          </PageContent>
        </PageShell>
      </AppShell>
    );
  }

  if (!building) {
    return (
      <AppShell role="MANAGER">
        <PageShell variant="embedded">
          <PageContent>
            <Panel>
              <p className="text-sm text-slate-600">Building not found.</p>
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
    <AppShell role="MANAGER">
      <PageShell variant="embedded">
        <div className="mb-3">
          <Link href="/admin-inventory" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            ← Back to Inventory
          </Link>
        </div>
        <PageHeader
          title={building?.name || "Building"}
          subtitle={building?.address || "Building details and configuration."}
          actions={(
            <div className="flex items-center gap-2">
              {activeTab === "Building information" && !editMode && (
                <button
                  type="button"
                  className="button-primary"
                  onClick={() => setEditMode(true)}
                  disabled={loading}
                >
                  Edit
                </button>
              )}
            </div>
          )}
        />
        <PageContent>
          {notice && (
            <Panel>
              <div className={`text-sm ${notice.type === "ok" ? "text-green-600" : "text-red-600"}`}>
                {notice.message}
              </div>
            </Panel>
          )}

          {/* Tabs Navigation */}
          <div className="flex flex-wrap gap-2 mb-4">
            {["Building information", "Units", "Tenants", "Assets", "Documents", "Policies", "Financials"].map((tab) => (
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

          {/* Building information tab */}
          {activeTab === "Building information" && (
            <Panel title="Building information">
              {editMode ? (
                <form onSubmit={onUpdateBuilding}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</span>
                      <input
                        className="input text-sm text-slate-700"
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Building name"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Address</span>
                      <input
                        className="input text-sm text-slate-700"
                        type="text"
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        placeholder="Address"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Year Built</span>
                      <input
                        className="input text-sm text-slate-700"
                        type="number"
                        min="1800"
                        max={new Date().getFullYear()}
                        value={editYearBuilt}
                        onChange={(e) => setEditYearBuilt(e.target.value)}
                        placeholder="e.g. 1995"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Managed Since</span>
                      <input
                        className="input text-sm text-slate-700"
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
                        <span className="text-sm text-slate-700">Elevator</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editConcierge}
                          onChange={(e) => setEditConcierge(e.target.checked)}
                        />
                        <span className="text-sm text-slate-700">Concierge</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      type="submit"
                      className="button-primary"
                      disabled={loading}
                    >
                      {loading ? "Saving…" : "Save changes"}
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
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
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="button-danger"
                      onClick={onDeactivateBuilding}
                      disabled={loading}
                    >
                      Deactivate
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</div>
                      <div className="text-sm text-slate-700 mt-1">{building?.name}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Address</div>
                      <div className="text-sm text-slate-700 mt-1">{building?.address || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Year Built</div>
                      <div className="text-sm text-slate-700 mt-1">{building?.yearBuilt ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Amenities</div>
                      <div className="text-sm text-slate-700 mt-1 flex gap-3">
                        {building?.hasElevator && <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">Elevator</span>}
                        {building?.hasConcierge && <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">Concierge</span>}
                        {!building?.hasElevator && !building?.hasConcierge && "—"}
                      </div>
                    </div>
                  </div>

                  {/* Ownership & Management */}
                  <div className="mt-6 pt-4 border-t border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-slate-900">Ownership & Management</h3>
                      {!editingOwnership ? (
                        <button
                          type="button"
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          onClick={startEditingOwnership}
                        >
                          Edit
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="text-xs text-slate-500 hover:text-slate-700 font-medium"
                          onClick={() => setEditingOwnership(false)}
                        >
                          Done
                        </button>
                      )}
                    </div>

                    {/* Managed Since — inline date input when editing */}
                    <div className="grid gap-4 sm:grid-cols-2 mb-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Managed Since</div>
                        {editingOwnership ? (
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="date"
                              className="input text-sm text-slate-700"
                              value={editManagedSince}
                              onChange={(e) => setEditManagedSince(e.target.value)}
                            />
                            <button
                              type="button"
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
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
                              Save
                            </button>
                          </div>
                        ) : (
                          <div className="text-sm text-slate-700 mt-1">
                            {building?.managedSince ? displayDate(building.managedSince) : "—"}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Owners list */}
                    {building?.owners && building.owners.length > 0 ? (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Owners</div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {building.owners.map((owner) => (
                            <div key={owner.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50 flex items-center justify-between">
                              <div>
                                <div className="font-semibold text-sm text-slate-900">{owner.name}</div>
                                {owner.email && <div className="text-xs text-slate-500 mt-0.5">{owner.email}</div>}
                              </div>
                              {editingOwnership && (
                                <button
                                  type="button"
                                  className="text-xs text-red-500 hover:text-red-700 font-medium ml-2"
                                  disabled={ownerLoading}
                                  onClick={() => onRemoveOwner(owner.id)}
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500 italic">No owners assigned to this building.</div>
                    )}

                    {/* Add owner picker (visible when editing) */}
                    {editingOwnership && (
                      <div className="mt-3 flex items-end gap-2">
                        <div className="flex-1">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Add Owner</div>
                          <select
                            className="input text-sm text-slate-700 w-full"
                            value={selectedCandidateId}
                            onChange={(e) => setSelectedCandidateId(e.target.value)}
                          >
                            <option value="">Select an owner…</option>
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
                          Add
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </Panel>
          )}

          {/* Units tab */}
          {activeTab === "Units" && (
            <Panel title="Units">
              <div className="mb-4">
                {!unitAction ? (
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() => setUnitAction("create")}
                  >
                    Add unit
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => setUnitAction(null)}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>

              {unitAction === "create" && (
                <form onSubmit={onCreateUnit} className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                  <div className="grid gap-4 sm:grid-cols-2 mb-4">
                    <label className="grid gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unit number/label</span>
                      <input
                        className="input text-sm text-slate-700"
                        value={createUnitName}
                        onChange={(e) => setCreateUnitName(e.target.value)}
                        placeholder="e.g. 101, 3B, Common Area 1"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Type</span>
                      <select
                        className="input text-sm text-slate-700"
                        value={createUnitType}
                        onChange={(e) => setCreateUnitType(e.target.value)}
                      >
                        <option value="RESIDENTIAL">Residential</option>
                        <option value="COMMON_AREA">Common Area</option>
                      </select>
                    </label>
                  </div>
                  <button type="submit" className="button-primary" disabled={loading}>
                    {loading ? "Creating…" : "Create unit"}
                  </button>
                </form>
              )}

              {residentialUnits.length > 0 && (
                <>
                  {/* ─── Occupancy summary row ─── */}
                  <div className="text-sm text-slate-600 mt-4 mb-2">
                    {units.length} unit{units.length !== 1 ? "s" : ""} — {occupiedCount} occupied, {vacantCount} vacant, {listedCount} listed
                  </div>

                  {/* ─── Filter tabs ─── */}
                  <div className="flex gap-1 mb-4">
                    {[
                      { key: "ALL", label: "All" },
                      { key: "OCCUPIED", label: "Occupied" },
                      { key: "VACANT", label: "Vacant" },
                      { key: "LISTED", label: "Listed" },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setUnitFilter(tab.key)}
                        className={`px-3 py-1 text-xs font-medium rounded-full border transition ${
                          unitFilter === tab.key
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {filteredResidential.length > 0 && (
                <>
                  <h3 className="font-semibold text-slate-900 mt-4 mb-3">Residential Units</h3>
                  <div className="space-y-2 mb-4">
                    {filteredResidential.map((u) => (
                      <Link key={u.id} href={`/admin-inventory/units/${u.id}`} className="block border border-slate-200 rounded-lg p-3 hover:bg-slate-50 transition">
                        <div className="flex justify-between items-center">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-slate-900">{u.unitNumber || u.name || "Unit"}</span>
                              {u.floor && <span className="text-xs text-slate-400">Floor {u.floor}</span>}
                              {u.rooms != null && <span className="text-xs text-slate-400">{u.rooms} rooms</span>}
                              {u.livingAreaSqm != null && <span className="text-xs text-slate-400">{u.livingAreaSqm} m²</span>}
                              {/* ─── Occupancy badge ─── */}
                              {u.occupancyStatus === "OCCUPIED" && (
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">Occupied</span>
                              )}
                              {u.occupancyStatus === "VACANT" && (
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">Vacant</span>
                              )}
                              {u.occupancyStatus === "LISTED" && (
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">Listed</span>
                              )}
                            </div>
                            {/* ─── Tenant info for occupied units ─── */}
                            {u.occupancyStatus === "OCCUPIED" && u.tenantName && (
                              <div className="text-xs text-slate-500 mt-1">
                                <span className="text-slate-700">{u.tenantName}</span>
                                {u.moveInDate && (
                                  <span className="ml-2 text-slate-400">
                                    Since {new Date(u.moveInDate).toLocaleDateString("de-CH")}
                                  </span>
                                )}
                              </div>
                            )}
                            {/* ─── Listed note ─── */}
                            {u.occupancyStatus === "LISTED" && (
                              <div className="text-xs text-yellow-600 mt-1">Accepting applications</div>
                            )}
                            {(u.monthlyRentChf != null || u.monthlyChargesChf != null) && (
                              <div className="text-xs text-slate-500 mt-1">
                                {u.monthlyRentChf != null && <span className="font-medium text-slate-700">CHF {u.monthlyRentChf}.-</span>}
                                {u.monthlyChargesChf != null && <span className="ml-1 text-slate-400">+ {u.monthlyChargesChf} charges</span>}
                                {(u.monthlyRentChf != null || u.monthlyChargesChf != null) && (
                                  <span className="ml-1 text-slate-600 font-medium">= CHF {(u.monthlyRentChf || 0) + (u.monthlyChargesChf || 0)}.- total</span>
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
                  <h3 className="font-semibold text-slate-900 mt-4 mb-3">Common Areas</h3>
                  <div className="space-y-2 mb-4">
                    {filteredCommon.map((u) => (
                      <Link key={u.id} href={`/admin-inventory/units/${u.id}`} className="block border border-slate-200 rounded-lg p-3 hover:bg-slate-50 transition">
                        <div className="flex justify-between items-center">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-slate-900">{u.unitNumber || u.name || "Common Area"}</span>
                              {u.floor && <span className="text-xs text-slate-400">Floor {u.floor}</span>}
                              {u.livingAreaSqm != null && <span className="text-xs text-slate-400">{u.livingAreaSqm} m²</span>}
                              {/* ─── Occupancy badge ─── */}
                              {u.occupancyStatus === "OCCUPIED" && (
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">Occupied</span>
                              )}
                              {u.occupancyStatus === "VACANT" && (
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">Vacant</span>
                              )}
                              {u.occupancyStatus === "LISTED" && (
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">Listed</span>
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

              {units.length === 0 && <div className="text-center text-slate-500 italic text-sm py-6">No units yet.</div>}
            </Panel>
          )}

          {/* Tenants tab */}
          {activeTab === "Tenants" && (
            <Panel title="Tenants">
              {building?.tenants && building.tenants.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left">
                        <th className="py-2 font-medium text-slate-600">Name</th>
                        <th className="py-2 font-medium text-slate-600">Unit</th>
                        <th className="py-2 font-medium text-slate-600">Phone</th>
                        <th className="py-2 font-medium text-slate-600">Email</th>
                        <th className="py-2 font-medium text-slate-600">Move-in</th>
                        <th className="py-2 font-medium text-slate-600">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {building.tenants.map((t, idx) => {
                        const badgeColor =
                          t.source === "BOTH"
                            ? "bg-emerald-50 text-emerald-700"
                            : t.source === "LEASE"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-slate-100 text-slate-600";
                        return (
                          <tr key={t.tenantId || idx} className="border-b border-slate-100">
                            <td className="py-2 text-slate-900 font-medium">{t.name}</td>
                            <td className="py-2 text-slate-700">{t.unitNumber}</td>
                            <td className="py-2 text-slate-700">{t.phone || "—"}</td>
                            <td className="py-2 text-slate-700">{t.email || "—"}</td>
                            <td className="py-2 text-slate-700">{t.moveInDate ? displayDate(t.moveInDate) : "—"}</td>
                            <td className="py-2">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeColor}`}>
                                {t.source === "BOTH" ? "Both" : t.source === "LEASE" ? "Lease" : "Directory"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center text-slate-500 italic text-sm py-6">No tenants found for this building.</div>
              )}
            </Panel>
          )}

          {/* Assets tab */}
          {activeTab === "Assets" && (
            <Panel title="Asset Inventory & Depreciation">
              {assetInventoryLoading ? (
                <p className="text-center text-slate-500 py-6">Loading assets…</p>
              ) : (
                <AssetInventoryPanel
                  assets={assetInventory}
                  onRefresh={loadAssetInventory}
                  scope="building"
                  parentId={id}
                  units={units.map((u) => ({ id: u.id, unitNumber: u.unitNumber }))}
                />
              )}
            </Panel>
          )}

          {/* Documents tab */}
          {activeTab === "Documents" && (
            <Panel title="Documents">
              <h3 className="font-semibold text-slate-900 mb-3">Lease Template</h3>
              {leaseTemplates.length > 0 ? (
                <div className="space-y-2">
                  {leaseTemplates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition"
                    >
                      <div className="flex justify-between items-center">
                        <Link href={`/manager/leases/${tpl.id}`} className="flex-1 min-w-0">
                          <span className="font-semibold text-slate-900">{tpl.templateName || "Lease Template"}</span>
                          <span className="ml-2 inline-block px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">TEMPLATE</span>
                          {tpl.landlordName && (
                            <p className="text-xs text-slate-500 mt-1">Landlord: {tpl.landlordName}</p>
                          )}
                          {tpl.netRentChf != null && (
                            <p className="text-xs text-slate-500">Default rent: CHF {tpl.netRentChf}.-/month</p>
                          )}
                        </Link>
                        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                          <Link href={`/manager/leases/${tpl.id}`} className="text-blue-600">→</Link>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const r = await fetch(`${API_BASE}/lease-templates/${tpl.id}`, { method: "DELETE" });
                                if (!r.ok) throw new Error("Delete failed");
                                await loadLeaseTemplates();
                                toast.show(`Template "${tpl.templateName || "Unnamed"}" deleted`, async () => {
                                  await fetch(`${API_BASE}/lease-templates/${tpl.id}/restore`, { method: "POST" });
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
                  <p className="text-sm text-amber-800 font-medium mb-1">No lease template found for this building</p>
                  <p className="text-xs text-amber-600 mb-3">
                    A lease template defines the default contract terms (landlord info, notice rules, payment details, deposit) 
                    that are automatically applied when a new tenant is selected. Without a template, leases must be created manually.
                  </p>
                  <Link
                    href="/manager/leases/templates"
                    className="inline-flex items-center rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"
                  >
                    Go to Lease Templates →
                  </Link>
                </div>
              )}
            </Panel>
          )}

          {/* Policies tab */}
          {activeTab === "Policies" && (
            <>
              <Panel title="Policies">
                <div className="text-sm text-slate-600 mb-4">Building-level thresholds for auto-approval and emergency dispatch. Leave blank to use org defaults.</div>
                {configMode === "edit" ? (
                  <form onSubmit={onSaveBuildingConfig} className="mt-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Auto-approve limit (CHF)</span>
                        <input
                          type="number"
                          className="input text-sm text-slate-700"
                          value={configAutoApprove}
                          onChange={(e) => setConfigAutoApprove(e.target.value)}
                          placeholder="Leave blank for org default"
                        />
                        <span className="text-xs text-slate-500">(blank = use org default)</span>
                      </label>
                      <label className="grid gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Owner threshold (CHF)</span>
                        <input
                          type="number"
                          className="input text-sm text-slate-700"
                          value={configOwnerThreshold}
                          onChange={(e) => setConfigOwnerThreshold(e.target.value)}
                          placeholder="Leave blank for org default"
                        />
                        <span className="text-xs text-slate-500">(blank = use org default)</span>
                      </label>
                    </div>
                    <label className="flex items-center gap-2 my-4 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={configEmergency}
                        onChange={(e) => setConfigEmergency(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm font-semibold text-slate-700">Emergency auto-dispatch</span>
                    </label>
                    <div className="flex gap-2">
                      <button type="submit" className="button-primary" disabled={loading}>
                        {loading ? "Saving…" : "Save policies"}
                      </button>
                      <button type="button" className="button-secondary" onClick={() => setConfigMode(null)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2 mt-4">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Auto-approve limit</div>
                        <div className="text-sm text-slate-700 mt-1">
                          {buildingConfig?.autoApproveLimit != null ? `${buildingConfig.autoApproveLimit} CHF` : "(using org default)"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Owner threshold</div>
                        <div className="text-sm text-slate-700 mt-1">
                          {buildingConfig?.requireOwnerApprovalAbove != null ? `${buildingConfig.requireOwnerApprovalAbove} CHF` : "(using org default)"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Emergency auto-dispatch</div>
                        <div className="text-sm text-slate-700 mt-1">
                          {buildingConfig?.emergencyAutoDispatch ? "Enabled" : "Disabled"}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="button-secondary mt-4"
                      onClick={() => setConfigMode("edit")}
                    >
                      Edit policies
                    </button>
                  </>
                )}
              </Panel>

              <Panel title="Overrides">
                <div className="text-sm text-slate-600 mb-4">Define context-specific approval overrides for this building (e.g., "auto-approve ovens &lt; CHF 500").</div>

              {createRuleMode ? (
                <form onSubmit={onCreateRule} className="mt-4">
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Rule name</label>
                    <input
                      className="input text-sm text-slate-700 w-full"
                      value={newRuleName}
                      onChange={(e) => setNewRuleName(e.target.value)}
                      placeholder="e.g., Auto-approve ovens < CHF 500"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Priority (higher = evaluated first)</label>
                    <input
                      type="number"
                      className="input text-sm text-slate-700"
                      value={newRulePriority}
                      onChange={(e) => setNewRulePriority(e.target.value)}
                      min="0"
                      max="100"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Conditions (all must match)</label>
                    <div className="space-y-2 mb-3">
                      {newRuleConditions.map((cond, idx) => (
                        <div key={idx} className="flex gap-2 items-end">
                          <select
                            className="input text-sm text-slate-700 flex-1"
                            value={cond.field}
                            onChange={(e) => updateCondition(idx, "field", e.target.value)}
                          >
                            <option value="CATEGORY">Category</option>
                            <option value="ESTIMATED_COST">Estimated Cost</option>
                            <option value="UNIT_TYPE">Unit Type</option>
                            <option value="UNIT_NUMBER">Unit Number</option>
                          </select>
                          <select
                            className="input text-sm text-slate-700 flex-1"
                            value={cond.operator}
                            onChange={(e) => updateCondition(idx, "operator", e.target.value)}
                          >
                            <option value="EQUALS">Equals</option>
                            <option value="NOT_EQUALS">Not Equals</option>
                            {cond.field === "ESTIMATED_COST" && (
                              <>
                                <option value="LESS_THAN">Less Than</option>
                                <option value="LESS_THAN_OR_EQUAL">Less Than or Equal</option>
                                <option value="GREATER_THAN">Greater Than</option>
                                <option value="GREATER_THAN_OR_EQUAL">Greater Than or Equal</option>
                              </>
                            )}
                            {(cond.field === "CATEGORY" || cond.field === "UNIT_TYPE" || cond.field === "UNIT_NUMBER") && (
                              <>
                                <option value="CONTAINS">Contains</option>
                                <option value="STARTS_WITH">Starts With</option>
                                <option value="ENDS_WITH">Ends With</option>
                              </>
                            )}
                          </select>
                          <input
                            className="input text-sm text-slate-700 flex-1"
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
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button type="button" className="button-secondary text-xs" onClick={addCondition}>
                      + Add condition
                    </button>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Action</label>
                    <select className="input text-sm text-slate-700 w-full" value={newRuleAction} onChange={(e) => setNewRuleAction(e.target.value)}>
                      <option value="AUTO_APPROVE">Auto-approve</option>
                      <option value="REQUIRE_MANAGER_REVIEW">Require manager review</option>
                      <option value="REQUIRE_OWNER_APPROVAL">Require owner approval</option>
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <button type="submit" className="button-primary" disabled={loading}>
                      {loading ? "Creating…" : "Create rule"}
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => {
                        setCreateRuleMode(false);
                        setNewRuleName("");
                        setNewRulePriority("0");
                        setNewRuleConditions([{ field: "CATEGORY", operator: "EQUALS", value: "" }]);
                        setNewRuleAction("AUTO_APPROVE");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {rules.length > 0 && (
                    <div className="space-y-3 mt-4 mb-4">
                      {rules.map((rule) => (
                        <div key={rule.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-semibold text-slate-900">
                                {rule.name}
                                {!rule.isActive && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full ml-2">Inactive</span>}
                                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full ml-2">Priority: {rule.priority}</span>
                              </div>
                              <div className="text-xs text-slate-600 mt-1">
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
                                {rule.isActive ? "Deactivate" : "Activate"}
                              </button>
                              <button
                                type="button"
                                className="button-danger text-xs px-2 py-1"
                                onClick={() => onDeleteRule(rule.id)}
                                disabled={loading}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {rules.length === 0 && <div className="text-center text-slate-500 italic text-sm py-6">No approval rules yet.</div>}
                  <button type="button" className="button-primary" onClick={() => setCreateRuleMode(true)}>
                    Create rule
                  </button>
                </>
              )}
              </Panel>
            </>
          )}

          {/* Financials tab */}
          {activeTab === "Financials" && (
            <>
              {/* Date range controls */}
              <Panel>
                <div className="flex flex-wrap items-end gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600">From</label>
                    <input
                      type="date"
                      value={finRange.from}
                      onChange={(e) => setFinRange((r) => ({ ...r, from: e.target.value }))}
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600">To</label>
                    <input
                      type="date"
                      value={finRange.to}
                      onChange={(e) => setFinRange((r) => ({ ...r, to: e.target.value }))}
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <button
                    onClick={() => fetchFinancials(false)}
                    className="bg-blue-600 text-white text-sm font-medium px-4 py-1.5 rounded hover:bg-blue-700 transition-colors"
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => fetchFinancials(true)}
                    className="bg-gray-100 text-gray-700 text-sm font-medium px-4 py-1.5 rounded border border-gray-300 hover:bg-gray-200 transition-colors"
                    title="Re-compute snapshots from source data"
                  >
                    ↻ Refresh
                  </button>
                </div>
                {finData && (
                  <p className="text-xs text-gray-400 mt-2">
                    Period: {displayDate(finData.from)} – {displayDate(finData.to)} · {finData.activeUnitsCount} active unit{finData.activeUnitsCount !== 1 ? "s" : ""}
                  </p>
                )}
              </Panel>

              {finError && (
                <Panel><p className="text-red-600 font-medium">Error: {finError}</p></Panel>
              )}

              {finLoading && !finData && <p className="text-gray-500 mt-4">Loading financials…</p>}

              {finData && (
                <>
                  {/* ── Layer 1: Health Summary ── */}
                  <div className="mt-4 flex flex-col gap-2">
                    {healthBullets.map((b, i) => (
                      <HealthBullet key={i} icon={b.icon} text={b.text} color={b.color} />
                    ))}
                  </div>

                  {/* ── Layer 2: Hero KPIs ── */}
                  <div className="grid grid-cols-3 gap-4 mt-5">
                    <HeroKpi label="Income" value={formatChfCents(finData.earnedIncomeCents)} color="green" />
                    <HeroKpi label="Expenses" value={formatChfCents(finData.expensesTotalCents)} color="red" />
                    <HeroKpi
                      label="Net Result"
                      value={formatChfCents(finData.netIncomeCents)}
                      color={finData.netIncomeCents >= 0 ? "green" : "red"}
                    />
                  </div>

                  {/* ── Layer 3: Detailed Breakdown (collapsed) ── */}
                  <div className="mt-5 flex flex-col gap-3">
                    <DetailSection title="Income Details">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Earned (paid)</span>
                          <p className="font-semibold text-gray-900">{formatChfCents(finData.earnedIncomeCents)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Projected (full period)</span>
                          <p className="font-semibold text-gray-900">{formatChfCents(finData.projectedIncomeCents)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Collection Rate</span>
                          <p className="font-semibold text-gray-900">{formatPercent(finData.collectionRate)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Active Units</span>
                          <p className="font-semibold text-gray-900">{finData.activeUnitsCount}</p>
                        </div>
                      </div>
                    </DetailSection>

                    <DetailSection title="Expense Breakdown">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Maintenance</span>
                          <p className="font-semibold text-gray-900">{formatChfCents(finData.maintenanceTotalCents)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Operating</span>
                          <p className="font-semibold text-gray-900">{formatChfCents(finData.operatingTotalCents)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Capital Expenditure</span>
                          <p className="font-semibold text-gray-900">{formatChfCents(finData.capexTotalCents)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Cost per Unit</span>
                          <p className="font-semibold text-gray-900">{formatChfCents(finData.costPerUnitCents)}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                        <div>
                          <span className="text-gray-500">Net Operating Income</span>
                          <p className="font-semibold text-gray-900">{formatChfCents(finData.netOperatingIncomeCents)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Maintenance Ratio</span>
                          <p className="font-semibold text-gray-900">{formatPercent(finData.maintenanceRatio)}</p>
                        </div>
                      </div>
                    </DetailSection>
                  </div>

                  {/* ── Tables ── */}
                  <div className="mt-6 mb-2">
                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Expenses by Category</h3>
                  </div>
                  <Panel>
                    {finData.expensesByCategory.length === 0 ? (
                      <p className="text-gray-400 text-sm">No categorised expenses in this period.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 text-left">
                            <th className="py-2 font-medium text-gray-600">Category</th>
                            <th className="py-2 font-medium text-gray-600 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {finData.expensesByCategory.map((row) => (
                            <tr key={row.category} className="border-b border-gray-100">
                              <td className="py-2 text-gray-800">
                                {CATEGORY_LABELS[row.category] || row.category}
                              </td>
                              <td className="py-2 text-gray-800 text-right font-mono">
                                {formatChfCents(row.totalCents)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </Panel>

                  <div className="mt-6 mb-2">
                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Top Contractors by Spend</h3>
                  </div>
                  <Panel>
                    {finData.topContractorsBySpend.length === 0 ? (
                      <p className="text-gray-400 text-sm">No contractor expenses in this period.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 text-left">
                            <th className="py-2 font-medium text-gray-600">Contractor</th>
                            <th className="py-2 font-medium text-gray-600 text-right">Total Spend</th>
                          </tr>
                        </thead>
                        <tbody>
                          {finData.topContractorsBySpend.map((row) => (
                            <tr key={row.contractorId} className="border-b border-gray-100">
                              <td className="py-2 text-gray-800">{row.contractorName}</td>
                              <td className="py-2 text-gray-800 text-right font-mono">
                                {formatChfCents(row.totalCents)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </Panel>
                </>
              )}
            </>
          )}
        </PageContent>
        <UndoToast {...toast} />
      </PageShell>
    </AppShell>
  );
}
