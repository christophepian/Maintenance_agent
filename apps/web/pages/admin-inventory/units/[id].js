import { useRouter } from "next/router";
import { useEffect, useState, useMemo, useCallback } from "react";
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
import Button from "../../../components/ui/Button";
import ScrollableTabs from "../../../components/mobile/ScrollableTabs";
import SortableHeader from "../../../components/SortableHeader";
import { useLocalSort, clientSort } from "../../../lib/tableUtils";
import { withServerTranslations } from "../../../lib/i18n";
import { useTranslation } from "next-i18next";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  MONTH_HERO_GRADIENTS, fmtChf, fmtPct,
  TrendArrow, KpiRow, KpiTable, MonthlyTrendChart,
} from "../../../components/reporting/ReportingShared";

// ── Unit Period Analysis component ─────────────────────────────────────────

function delta(curr, prev, invert = false) {
  if (prev == null || prev === 0) return null;
  const pct = (curr - prev) / Math.abs(prev);
  const up = invert ? pct < 0 : pct > 0;
  return { pct, tone: up ? "text-green-600" : "text-red-500" };
}

function UnitPeriodAnalysis({ unitId }) {
  const { t, i18n } = useTranslation("manager");
  const locale = i18n.language || "en";
  const monthsShort = useMemo(() => Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(2024, i, 1))), [locale]);
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [ytd,  setYtd]    = useState(true);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [kpiOpen, setKpiOpen] = useState(false);
  const [report, setReport]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");

  const heroGradient = MONTH_HERO_GRADIENTS[(month - 1) % 12];

  const { from, to } = useMemo(() => {
    if (ytd) {
      return { from: `${year}-01-01`, to: `${year}-12-31` };
    }
    const last = new Date(year, month, 0).getDate();
    return { from: `${year}-${String(month).padStart(2,"0")}-01`, to: `${year}-${String(month).padStart(2,"0")}-${String(last).padStart(2,"0")}` };
  }, [year, ytd, month]);

  const load = useCallback(async () => {
    if (!unitId) return;
    setLoading(true); setErr("");
    try {
      const qs = new URLSearchParams({ from, to, includeMonthly: ytd ? "true" : "false" });
      const res = await fetch(`/api/units/${unitId}/period-report?${qs}`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || t("unitsId.reporting.failed"));
      setReport(json.data);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, [unitId, from, to, ytd, t]);

  useEffect(() => { load(); }, [load]);

  const c = report?.current;
  const p = report?.prev;
  const cl = report?.currentLease;
  const cond = report?.assetConditionSummary;

  const headline = useMemo(() => {
    if (!c) return "";
    if (c.netIncomeCents > 0 && c.collectionRate >= 0.95) return t("unitsId.reporting.headline.strong");
    if (c.collectionRate < 0.8) return t("unitsId.reporting.headline.collectionAttention");
    if (c.netIncomeCents < 0) return t("unitsId.reporting.headline.loss");
    return t("unitsId.reporting.headline.withinRange");
  }, [c, t]);

  const periodBadge = ytd ? `YTD ${year}` : `${monthsShort[month-1]} ${year}`;

  return (
    <div className="space-y-6">
      {/* Date nav */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => setYear(y => y - 1)} className="rounded border border-surface-border px-2 py-1 text-xs hover:bg-surface-hover">‹</button>
          <span className="px-2 text-sm font-medium tabular-nums">{year}</span>
          <button onClick={() => setYear(y => y + 1)} disabled={year >= now.getFullYear()} className="rounded border border-surface-border px-2 py-1 text-xs hover:bg-surface-hover disabled:opacity-40">›</button>
        </div>
        <button
          onClick={() => setYtd(v => !v)}
          className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", ytd ? "bg-brand border-brand text-white" : "border-surface-border text-foreground-dim hover:bg-surface-hover")}
        >YTD</button>
        {!ytd && (
          <div className="flex gap-1 flex-wrap">
            {monthsShort.map((m, i) => (
              <button key={m} onClick={() => setMonth(i+1)}
                className={cn("rounded border px-2 py-0.5 text-xs transition-colors", month === i+1 ? "bg-brand border-brand text-white" : "border-surface-border text-foreground-dim hover:bg-surface-hover")}>
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      {err && <p className="text-sm text-destructive-text">{err}</p>}

      {/* Hero */}
      <div>
        <header
          className={cn(
            "border border-surface-border bg-gradient-to-br p-6 shadow-sm",
            "dark:from-brand-light dark:via-info-light dark:to-transparent",
            heroGradient,
            kpiOpen ? "rounded-t-3xl" : "rounded-3xl",
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <span className="rounded-full border border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/10 px-3 py-1 text-xs font-medium text-foreground/70 backdrop-blur-sm">{periodBadge}</span>
                {cl && <span className="text-xs text-foreground-dim">{cl.tenantName} · {t("unitsId.reporting.perMonth", { amount: cl.netRentChf })}</span>}
              </div>
              <h3 className="text-xl font-bold text-foreground tracking-tight">{loading ? "—" : headline}</h3>
              {c && !loading && (
                <p className="mt-1 text-sm text-foreground-dim">
                  {t("unitsId.reporting.noiCollection", { noi: fmtChf(c.netIncomeCents), rate: fmtPct(c.collectionRate) })}
                  {cl?.endDate && <span> · {t("unitsId.reporting.leaseEnds", { date: cl.endDate })}{cl.remainingMonths != null ? ` (${t("unitsId.reporting.months", { count: cl.remainingMonths })})` : ""}</span>}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="text-right">
                <p className={cn("text-3xl font-bold tabular-nums", loading ? "opacity-30" : "", c?.netIncomeCents >= 0 ? "text-foreground" : "text-red-600")}>
                  {loading ? "—" : fmtChf(c?.netIncomeCents ?? 0)}
                </p>
                <p className="text-xs text-foreground-dim mt-0.5">{t("unitsId.reporting.netOperatingIncome")}</p>
              </div>
              <button onClick={() => setKpiOpen(v => !v)} className="flex items-center gap-1 text-xs text-foreground-dim hover:text-foreground transition-colors">
                {kpiOpen ? <><ChevronUp className="h-3 w-3"/>{t("unitsId.reporting.hideKpis")}</> : <><ChevronDown className="h-3 w-3"/>{t("unitsId.reporting.showKpis")}</>}
              </button>
            </div>
          </div>
        </header>
        {kpiOpen && (
          <KpiTable
            attached
            isLoading={loading}
            left={[
              { label: t("unitsId.reporting.kpi.cashReceived"),  value: fmtChf(c?.collectedIncomeCents ?? 0),    delta: delta(c?.collectedIncomeCents, p?.collectedIncomeCents) },
              { label: t("unitsId.reporting.kpi.accruedIncome"),  value: fmtChf(c?.accruedIncomeCents ?? 0), delta: null },
              { label: t("unitsId.reporting.kpi.expenses"),       value: fmtChf(c?.expensesCents ?? 0),         delta: delta(c?.expensesCents, p?.expensesCents, true) },
              { label: t("unitsId.reporting.kpi.netIncome"),      value: fmtChf(c?.netIncomeCents ?? 0),        delta: delta(c?.netIncomeCents, p?.netIncomeCents) },
            ]}
            right={[
              { label: t("unitsId.reporting.kpi.onTimeCollection"), value: fmtPct(c?.collectionRate ?? 0),      delta: delta(c?.collectionRate, p?.collectionRate) },
              { label: t("unitsId.reporting.kpi.monthlyRent"),     value: cl ? `CHF ${cl.netRentChf}` : "—",     delta: null },
              { label: t("unitsId.reporting.kpi.leaseRemaining"),  value: cl?.remainingMonths != null ? t("unitsId.reporting.months", { count: cl.remainingMonths }) : cl ? t("unitsId.reporting.openEnded") : t("unitsId.reporting.vacant"), delta: null },
              { label: t("unitsId.reporting.kpi.arrears"),         value: fmtChf(report?.arrearsCents ?? 0),     delta: null },
            ]}
          />
        )}
      </div>

      {/* Monthly NOI trendline (YTD only) */}
      {ytd && report?.monthlyData?.length > 0 && (
        <div className="rounded-2xl border border-surface-border bg-surface p-4 shadow-sm">
          <p className="text-xs font-medium text-foreground-dim uppercase tracking-wide mb-3">{t("unitsId.reporting.monthlyNoi", { year })}</p>
          <MonthlyTrendChart data={report.monthlyData} />
        </div>
      )}

      {/* Arrears alert */}
      {(report?.arrearsCents ?? 0) > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-warning-ring bg-warning-light p-4">
          <span className="mt-0.5 text-warning-text text-lg leading-none">⚠</span>
          <div>
            <p className="text-sm font-semibold text-warning-text">{t("unitsId.reporting.outstandingReceivables")}</p>
            <p className="text-sm text-warning-text/80">{t("unitsId.reporting.unpaidForUnit", { amount: fmtChf(report.arrearsCents) })}</p>
          </div>
        </div>
      )}

      {/* Asset condition summary */}
      {cond && cond.total > 0 && (
        <div className="rounded-2xl border border-surface-border bg-surface p-5 shadow-sm">
          <p className="text-xs font-medium text-foreground-dim uppercase tracking-wide mb-4">{t("unitsId.reporting.assetCondition")}</p>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: t("unitsId.reporting.condition.good"),    count: cond.good,    bg: "bg-success-light",     text: "text-success-text" },
              { label: t("unitsId.reporting.condition.fair"),    count: cond.fair,    bg: "bg-warning-light",     text: "text-warning-text" },
              { label: t("unitsId.reporting.condition.poor"),    count: cond.poor,    bg: "bg-orange-light",      text: "text-orange-text" },
              { label: t("unitsId.reporting.condition.damaged"), count: cond.damaged, bg: "bg-destructive-light", text: "text-destructive-text" },
            ].map(({ label, count, bg, text }) => (
              <div key={label} className={cn("rounded-xl p-3 text-center", bg)}>
                <p className={cn("text-2xl font-bold", text)}>{count}</p>
                <p className={cn("text-xs font-medium mt-0.5", text)}>{label}</p>
              </div>
            ))}
          </div>
          {(cond.poor > 0 || cond.damaged > 0) && (
            <p className="mt-3 text-xs text-orange-text">
              {t("unitsId.reporting.poorDamaged", { count: cond.poor + cond.damaged })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
export default function UnitDetail() {
  const { t } = useTranslation("manager");
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
  const [conditionReports, setConditionReports] = useState([]);
  const [conditionReportsLoading, setConditionReportsLoading] = useState(false);
  const [showCreateReport, setShowCreateReport] = useState(false);
  const [newReportType, setNewReportType] = useState("MOVE_IN");
  const [newReportTenantId, setNewReportTenantId] = useState("");
  const [newReportLeaseId, setNewReportLeaseId] = useState("");
  const [newReportDays, setNewReportDays] = useState("7");
  const [newReportLeases, setNewReportLeases] = useState([]);
  const [creatingReport, setCreatingReport] = useState(false);
  const [createReportErr, setCreateReportErr] = useState("");
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
  const [assetSeeding, setAssetSeeding] = useState(false);

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

  const { sortField: reconSF, sortDir: reconSD, handleSort: handleReconSort } = useLocalSort("year", "desc");
  const { sortField: tReconSF, sortDir: tReconSD, handleSort: handleTReconSort } = useLocalSort("year", "desc");
  const { sortField: invSF, sortDir: invSD, handleSort: handleInvSort } = useLocalSort("createdAt", "desc");
  const { sortField: lsSF, sortDir: lsSD, handleSort: handleLsSort } = useLocalSort("startDate", "desc");
  const { sortField: reqSF, sortDir: reqSD, handleSort: handleReqSort } = useLocalSort("createdAt", "desc");

  const sortedUnitReconciliations = useMemo(() => clientSort(unitReconciliations, reconSF, reconSD, (r, f) => {
    if (f === "year") return r.fiscalYear ?? r.year ?? 0;
    if (f === "status") return (r.status || "").toLowerCase();
    return "";
  }), [unitReconciliations, reconSF, reconSD]);

  const sortedUnitInvoices = useMemo(() => {
    const all = [...(unitInvoices || []), ...(incomingInvoices || []), ...(outgoingInvoices || [])];
    const unique = all.filter((v, i, a) => a.findIndex(x => x.id === v.id) === i);
    return clientSort(unique, invSF, invSD, (inv, f) => {
      if (f === "status") return (inv.status || "").toLowerCase();
      if (f === "description") return (inv.description || "").toLowerCase();
      if (f === "amount") return inv.totalAmountChf ?? inv.amountCents ?? 0;
      if (f === "period") return inv.periodStart || "";
      if (f === "dueDate") return inv.dueDate || "";
      if (f === "createdAt") return inv.createdAt || "";
      return "";
    });
  }, [unitInvoices, incomingInvoices, outgoingInvoices, invSF, invSD]);

  const sortedUnitLeases = useMemo(() => clientSort(unitLeases, lsSF, lsSD, (l, f) => {
    if (f === "status") return (l.status || "").toLowerCase();
    if (f === "tenant") return (l.tenantName || "").toLowerCase();
    if (f === "startDate") return l.startDate || "";
    if (f === "endDate") return l.endDate || "";
    if (f === "notice") return l.noticeDate || "";
    if (f === "createdAt") return l.createdAt || "";
    return "";
  }), [unitLeases, lsSF, lsSD]);

  const sortedUnitRequests = useMemo(() => clientSort(unitRequests, reqSF, reqSD, (r, f) => {
    if (f === "requestNumber") return r.requestNumber ?? 0;
    if (f === "status") return (r.status || "").toLowerCase();
    if (f === "category") return (r.category || "").toLowerCase();
    if (f === "description") return (r.description || "").toLowerCase();
    if (f === "urgency") return ({ LOW: 1, MEDIUM: 2, HIGH: 3, EMERGENCY: 4 }[r.urgency] || 0);
    if (f === "contractor") return (r.assignedContractor?.name || "").toLowerCase();
    if (f === "createdAt") return r.createdAt || "";
    return "";
  }), [unitRequests, reqSF, reqSD]);

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
      headers: { "Content-Type": "application/json", ...authHeaders(), ...(options.headers || {}) },
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

  async function seedDefaultAssets() {
    if (!id || assetSeeding) return;
    setAssetSeeding(true);
    try {
      await fetchJSON(`/units/${id}/seed-default-assets`, { method: "POST" });
      await loadAssetInventory();
    } catch (e) {
      setErr(`Failed to populate default assets: ${e.message}`);
    } finally {
      setAssetSeeding(false);
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

  async function refreshRecons() {
    const res = await fetch(`/api/charge-reconciliations`, { headers: authHeaders() });
    const j = await res.json();
    const all = Array.isArray(j) ? j : j?.data || [];
    setUnitReconciliations(all.filter((r) => r.lease?.unitId === id));
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
    if (id && activeTab === "Condition Reports") {
      setConditionReportsLoading(true);
      fetch(`/api/units/${id}/condition-reports`, { headers: authHeaders() })
        .then((r) => r.json())
        .then((d) => setConditionReports(d?.data ?? []))
        .catch(() => {})
        .finally(() => setConditionReportsLoading(false));
      // Pre-load leases for the create form
      fetch(`/api/leases?unitId=${id}`, { headers: authHeaders() })
        .then((r) => r.json())
        .then((d) => setNewReportLeases(Array.isArray(d) ? d : d?.data ?? []))
        .catch(() => {});
    }
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

  const assignedTenantIds = new Set(tenants.map((tenant) => tenant.id));
  const hasActiveLease = (unit?.leases ?? []).length > 0;
  const occupancyStatus = hasActiveLease ? "OCCUPIED" : unit?.isVacant ? "LISTED" : "VACANT";
  const occupancyLabel = occupancyStatus === "OCCUPIED" ? "Occupied" : occupancyStatus === "LISTED" ? "Listed" : "Vacant";
  const occupancyVariant = occupancyStatus === "OCCUPIED" ? "success" : occupancyStatus === "LISTED" ? "info" : "destructive";
  const orgModels = assetModels.filter((m) => m.orgId);

  if (loading) {
    return (
      <AppShell role={isOwner ? "OWNER" : "MANAGER"}>
        <PageShell variant="embedded">
          <PageHeader title={t("manager:unitsId.title.unit")} />
          <PageContent><p className="loading-text">Loading unit…</p></PageContent>
        </PageShell>
      </AppShell>
    );
  }

  return (
    <AppShell role={isOwner ? "OWNER" : "MANAGER"}>
      <PageShell variant="embedded">
        <div className="mb-3">
          <Link href={unit?.building?.id ? `/admin-inventory/buildings/${unit.building.id}${isOwner ? "?role=owner" : ""}` : (isOwner ? "/owner/properties" : "/admin-inventory")} className="text-sm font-medium text-muted-text hover:text-foreground">
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

          <ScrollableTabs activeIndex={["Details", "Tenants", "Assets", "Rent Estimate", "Documents", "Financials", "Contracts", "Requests", "Condition Reports", "Reporting"].indexOf(activeTab)}>
            {["Details", "Tenants", "Assets", "Rent Estimate", "Documents", "Financials", "Contracts", "Requests", "Condition Reports", "Reporting"].map((tab) => (
              <button key={tab} type="button"
                className={activeTab === tab ? "tab-btn-active" : "tab-btn"}
                onClick={() => setActiveTab(tab)}>
                {tab}
              </button>
            ))}
          </ScrollableTabs>

          {activeTab === "Details" && (
          <Panel title={t("manager:unitsId.title.unitDetails")} actions={editMode ? (
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
                <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">Unit number</span>
                <input className="filter-input w-full" value={editNumber} onChange={(e) => setEditNumber(e.target.value)} placeholder={t("manager:unitsId.placeholder.eGApt3b")} />
              </div>
              <div className="grid gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">Floor</span>
                <input className="filter-input w-full" value={editFloor} onChange={(e) => setEditFloor(e.target.value)} placeholder={t("manager:unitsId.placeholder.eG3")} />
              </div>
              <div className="grid gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">Type</span>
                <select className="filter-input w-full" value={editType} onChange={(e) => setEditType(e.target.value)}>
                  <option value="">— Select type —</option>
                  <option value="RESIDENTIAL">Residential</option>
                  <option value="COMMON_AREA">Common area</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">Living area (m²)</span>
                <input className="filter-input w-full" type="number" step="0.1" min="0" value={editLivingArea} onChange={(e) => setEditLivingArea(e.target.value)} placeholder={t("manager:unitsId.placeholder.eG75")} />
              </div>
              <div className="grid gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">Rooms</span>
                <input className="filter-input w-full" type="number" step="0.5" min="0" value={editRooms} onChange={(e) => setEditRooms(e.target.value)} placeholder={t("manager:unitsId.placeholder.eG35")} />
              </div>
              <div className="grid gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">Location segment</span>
                <select className="filter-input w-full" value={editLocationSegment} onChange={(e) => setEditLocationSegment(e.target.value)}>
                  <option value="">— Select —</option>
                  <option value="PRIME">Prime</option>
                  <option value="STANDARD">Standard</option>
                  <option value="PERIPHERY">Periphery</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">Last renovation year</span>
                <input className="filter-input w-full" type="number" min="1900" max="2099" value={editLastRenovation} onChange={(e) => setEditLastRenovation(e.target.value)} placeholder={t("manager:unitsId.placeholder.eG2015")} />
              </div>
              <div className="grid gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">Energy label</span>
                <select className="filter-input w-full" value={editEnergyLabel} onChange={(e) => setEditEnergyLabel(e.target.value)}>
                  <option value="">— Select —</option>
                  {["A","B","C","D","E","F","G"].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="grid gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">Heating type</span>
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
                <span className="text-xs font-medium uppercase tracking-wide text-foreground-dim">Insulation quality</span>
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 p-4 bg-surface-subtle rounded-lg border border-surface-border">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">Net rent</div>
                <div className="text-lg font-bold text-foreground mt-1">{unit?.monthlyRentChf != null ? `CHF ${unit.monthlyRentChf}.-` : "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">Charges</div>
                <div className="text-lg font-bold text-foreground mt-1">{unit?.monthlyChargesChf != null ? `CHF ${unit.monthlyChargesChf}.-` : "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">Total incl. charges</div>
                <div className="text-lg font-bold text-foreground mt-1">{unit?.monthlyRentChf != null || unit?.monthlyChargesChf != null ? `CHF ${(unit?.monthlyRentChf || 0) + (unit?.monthlyChargesChf || 0)}.-` : "—"}</div>
              </div>
            </div>
            {/* ── Unit details grid ── */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">Unit number</div>
                <div className="text-sm text-muted-dark mt-1">{unit?.unitNumber || unit?.name || "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">Floor</div>
                <div className="text-sm text-muted-dark mt-1">{unit?.floor || "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">Type</div>
                <div className="text-sm text-muted-dark mt-1">{unit?.type || "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">Living area</div>
                <div className="text-sm text-muted-dark mt-1">{unit?.livingAreaSqm != null ? `${unit.livingAreaSqm} m²` : "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">Rooms</div>
                <div className="text-sm text-muted-dark mt-1">{unit?.rooms ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">Location</div>
                <div className="text-sm text-muted-dark mt-1">{unit?.locationSegment || "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">Last renovation</div>
                <div className="text-sm text-muted-dark mt-1">{unit?.lastRenovationYear || "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">Energy label</div>
                <div className="text-sm text-muted-dark mt-1">{unit?.energyLabel || "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">Heating</div>
                <div className="text-sm text-muted-dark mt-1">{unit?.heatingType ? unit.heatingType.replace(/_/g, " ").toLowerCase() : "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">Insulation</div>
                <div className="text-sm text-muted-dark mt-1">{unit?.insulationQuality ? unit.insulationQuality.toLowerCase() : "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">Status</div>
                <div className="text-sm text-muted-dark mt-1"><Badge variant={occupancyVariant} size="sm">{occupancyLabel}</Badge></div>
              </div>
              <div className="col-span-full">
                <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">Features</div>
                <div className="text-sm text-muted-dark mt-1 flex gap-2">
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
        <Panel title={t("manager:unitsId.title.assetInventoryDepreciation")} actions={
            showAssetAddForm ? (
              <button type="button" className="button-cancel text-sm" onClick={() => setShowAssetAddForm(false)}>Cancel</button>
            ) : (
              <div className="flex gap-2">
                <button type="button" className="button-secondary text-sm" onClick={seedDefaultAssets} disabled={assetSeeding}>
                  {assetSeeding ? "Seeding…" : "Populate defaults"}
                </button>
                <button type="button" className="button-primary text-sm" onClick={() => setShowAssetAddForm(true)}>Add asset</button>
              </div>
            )
          }>
          {assetInventoryLoading ? (
            <p className="text-center text-foreground-dim">Loading assets…</p>
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
        <Panel title={t("manager:unitsId.title.tenants")} actions={
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
                <div key={t.id} className="flex justify-between items-center p-3 border border-surface-border rounded-lg bg-surface-subtle">
                  <div>
                    <div className="font-semibold text-sm">
                      {isOwner ? (
                        <span>{t.name || "Tenant"}</span>
                      ) : (
                        <Link href={`/manager/people/tenants/${t.id}`} className="text-blue-600 hover:underline">
                          {t.name || "Tenant"}
                        </Link>
                      )}
                      {idx === 0 && <span className="ml-2 text-xs text-foreground-dim font-normal">(primary)</span>}
                    </div>
                    <div className="text-sm text-muted mt-1">Phone: {t.phone || "—"}</div>
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
          <div className="bg-surface-subtle border border-surface-border rounded-lg p-3.5 flex flex-col gap-4 mt-4">
            {tenantAction === "no-lease" && (
              <div className="text-sm text-muted-text">
                <div className="font-semibold text-foreground mb-2">Lease required</div>
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
                <div className="text-sm text-muted-text mb-1">
                  <span className="font-semibold text-foreground">Add additional occupant</span> — choose how to add this person:
                </div>
                <button type="button" className="button-secondary text-left" onClick={() => setTenantAction("lease-amendment")}>
                  Add to lease (amendment)
                  <div className="text-sm text-muted mt-1">This person has contractual authority and should appear on the lease.</div>
                </button>
                <button type="button" className="button-secondary text-left" onClick={() => setTenantAction("menu")}>
                  Add as occupant only
                  <div className="text-sm text-muted mt-1">No lease change needed (e.g. children, dependants without contractual authority).</div>
                </button>
              </div>
            )}

            {tenantAction === "lease-amendment" && (
              <div className="text-sm text-muted-text">
                <div className="font-semibold text-foreground mb-2">Lease amendment required</div>
                <p className="mb-3">
                  Adding a co-tenant to the lease requires an amendment to the existing contract. This will be available as a workflow in a future update.
                </p>
                <p className="text-xs text-foreground-dim">
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
                  <div className="text-xs text-foreground-dim mb-1">Adding as occupant only — no lease change.</div>
                )}
                <button type="button" className="button-secondary text-left" onClick={() => setTenantAction("assign")}>
                  Assign tenant
                  <div className="text-sm text-muted mt-1">Pick from existing tenants.</div>
                </button>
                <button type="button" className="button-secondary text-left" onClick={() => setTenantAction("create")}>
                  Create new tenant + assign
                  <div className="text-sm text-muted mt-1">Enter name, phone, and email.</div>
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
                      {allTenants.map((tenant) => (
                        <option key={tenant.id} value={tenant.id} disabled={assignedTenantIds.has(tenant.id)}>
                          {tenant.name || "Tenant"} • {tenant.phone || "no phone"}
                          {assignedTenantIds.has(tenant.id) ? " (assigned)" : ""}
                        </option>
                      ))}
                    </select>
                    {allTenants.length === 0 && (
                      <div className="text-sm text-muted mt-1">No tenants found in the system.</div>
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
                      placeholder={t("manager:unitsId.placeholder.eGJaneDoe")}
                    />
                  </div>
                  <div className="min-w-[240px]">
                    <label className="filter-label">Phone</label>
                    <input
                      className="filter-input w-full"
                      value={createTenantPhone}
                      onChange={(e) => setCreateTenantPhone(e.target.value)}
                      placeholder={t("manager:unitsId.placeholder.41791234567")}
                    />
                  </div>
                  <div className="min-w-[240px]">
                    <label className="filter-label">Email (optional)</label>
                    <input
                      className="filter-input w-full"
                      value={createTenantEmail}
                      onChange={(e) => setCreateTenantEmail(e.target.value)}
                      placeholder={t("manager:unitsId.placeholder.tenantExampleCom")}
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
        <Panel title={t("manager:unitsId.title.rentEstimate")} actions={unit?.livingAreaSqm ? (
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
                      <div className="text-xs font-semibold uppercase text-green-700">{t("manager:unitsId.col.netRent")}</div>
                      <div className="text-2xl font-bold text-green-800">CHF {rentEstimate.netRentChfMonthly}</div>
                      <div className="text-sm text-muted">per month</div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                      <div className="text-xs font-semibold uppercase text-blue-700">Total (optimistic)</div>
                      <div className="text-2xl font-bold text-blue-800">CHF {rentEstimate.totalOptimisticChfMonthly}</div>
                      <div className="text-sm text-muted">incl. charges CHF {rentEstimate.chargesOptimisticChfMonthly}</div>
                    </div>
                    <div className="bg-amber-100 border border-amber-300 rounded-lg p-4 text-center">
                      <div className="text-xs font-semibold uppercase text-amber-800">Total (pessimistic)</div>
                      <div className="text-2xl font-bold text-amber-900">CHF {rentEstimate.totalPessimisticChfMonthly}</div>
                      <div className="text-sm text-muted">incl. charges CHF {rentEstimate.chargesPessimisticChfMonthly}</div>
                    </div>
                  </div>

                  {/* Coefficients breakdown */}
                  <details className="mb-3">
                    <summary className="cursor-pointer font-semibold text-[0.95rem] text-muted-dark">Applied Coefficients</summary>
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
                    <summary className="cursor-pointer font-semibold text-[0.95rem] text-muted-dark">Inputs Used</summary>
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
        <Panel title={t("manager:unitsId.title.corroborativeDocuments")}>
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
          <div className="inline-flex rounded-lg border border-surface-border bg-surface-hover p-0.5 gap-0.5 mt-4 mb-6 flex-wrap">
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
                  ? "rounded-md bg-surface shadow-sm px-4 py-1.5 text-sm font-medium text-foreground transition"
                  : "rounded-md px-4 py-1.5 text-sm font-medium text-muted hover:text-muted-dark transition"}
              >
                {label}
              </button>
            ))}
          </div>

          {financialsLoading ? (
            <div className="py-6 text-center text-sm text-muted">Loading financials…</div>
          ) : (
            <>
              {financialsSubTab === "overview" && (() => {
                const totalIncome = incomingInvoices.reduce((s, inv) => s + (inv.totalAmount ?? 0), 0);
                const totalExpenses = outgoingInvoices.reduce((s, inv) => s + (inv.totalAmount ?? 0), 0);
                const net = totalIncome - totalExpenses;
                return (
                  <div className="space-y-6">
                    <Panel title={t("manager:unitsId.title.incomeVsExpenses")}>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <div className="text-xs font-medium uppercase tracking-wide text-green-700">Income (tenant invoices)</div>
                          <div className="text-2xl font-bold text-green-800 mt-1">{formatChf(totalIncome)}</div>
                          <div className="text-xs text-muted mt-0.5">{incomingInvoices.length} invoice{incomingInvoices.length !== 1 ? "s" : ""}</div>
                        </div>
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                          <div className="text-xs font-medium uppercase tracking-wide text-red-700">Expenses (maintenance)</div>
                          <div className="text-2xl font-bold text-red-800 mt-1">{formatChf(totalExpenses)}</div>
                          <div className="text-xs text-muted mt-0.5">{outgoingInvoices.length} invoice{outgoingInvoices.length !== 1 ? "s" : ""}</div>
                        </div>
                        <div className={cn("p-4 border rounded-lg", net >= 0 ? "bg-blue-50 border-blue-200" : "bg-amber-50 border-amber-200")}>
                          <div className={cn("text-xs font-medium uppercase tracking-wide", net >= 0 ? "text-blue-700" : "text-amber-700")}>Net</div>
                          <div className={cn("text-2xl font-bold mt-1", net >= 0 ? "text-blue-800" : "text-amber-800")}>{formatChf(net)}</div>
                        </div>
                      </div>
                    </Panel>
                    {unitReconciliations.length > 0 && (
                      <Panel title={t("manager:unitsId.title.nebenkostenSummary")}>
                        <div className="overflow-x-auto">
                          <table className="data-table w-full">
                            <thead>
                              <tr>
                                <SortableHeader label="Year" field="year" sortField={reconSF} sortDir={reconSD} onSort={handleReconSort} />
                                <SortableHeader label="Status" field="status" sortField={reconSF} sortDir={reconSD} onSort={handleReconSort} />
                                <th className="text-right">{t("manager:unitsId.col.acomptePaid")}</th>
                                <th className="text-right">{t("manager:unitsId.col.actualCosts")}</th>
                                <th className="text-right">{t("manager:unitsId.col.balance")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sortedUnitReconciliations.map((r) => (
                                <tr key={r.id} className="border-t border-surface-divider hover:bg-surface-subtle cursor-pointer" onClick={() => router.push(`/manager/charge-reconciliations/${r.id}`)}>
                                  <td className="tabular-nums">{r.fiscalYear}</td>
                                  <td><Badge variant={reconciliationVariant(r.status)} size="sm">{r.status}</Badge></td>
                                  <td className="text-right tabular-nums">{formatChfCents(r.totalAcomptePaidCents)}</td>
                                  <td className="text-right tabular-nums">{formatChfCents(r.totalActualCostsCents)}</td>
                                  <td className={cn("text-right tabular-nums", r.balanceCents > 0 ? "text-red-600" : r.balanceCents < 0 ? "text-green-600" : "")}>
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
                <UnitChargesReconciliation unit={unit} onSettled={refreshRecons} />
              )}
              {financialsSubTab === "reconciliations" && (
                <Panel title={t("manager:unitsId.title.chargeReconciliationsNebenkosten")} className="mt-6">
                  {unitReconciliations.length === 0 ? (
                    <div className="empty-state-text py-6 text-center italic">No charge reconciliations for this unit.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="data-table w-full">
                        <thead>
                          <tr>
                            <SortableHeader label="Tenant" field="tenant" sortField={tReconSF} sortDir={tReconSD} onSort={handleTReconSort} />
                            <SortableHeader label="Year" field="year" sortField={tReconSF} sortDir={tReconSD} onSort={handleTReconSort} />
                            <SortableHeader label="Status" field="status" sortField={tReconSF} sortDir={tReconSD} onSort={handleTReconSort} />
                            <th className="text-right">{t("manager:unitsId.col.acomptePaid")}</th>
                            <th className="text-right">{t("manager:unitsId.col.actualCosts")}</th>
                            <th className="text-right">{t("manager:unitsId.col.balance")}</th>
                            <th className="text-right">{t("manager:unitsId.col.action")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedUnitReconciliations.map((r) => (
                            <tr key={r.id} className="border-t border-surface-divider hover:bg-surface-subtle">
                              <td>
                                <Link href={`/manager/charge-reconciliations/${r.id}`} className="cell-link">
                                  {r.lease?.tenantName || "—"}
                                </Link>
                              </td>
                              <td className="tabular-nums">{r.fiscalYear}</td>
                              <td><Badge variant={reconciliationVariant(r.status)} size="sm">{r.status}</Badge></td>
                              <td className="text-right tabular-nums">{formatChfCents(r.totalAcomptePaidCents)}</td>
                              <td className="text-right tabular-nums">{formatChfCents(r.totalActualCostsCents)}</td>
                              <td className={cn("text-right tabular-nums", r.balanceCents > 0 ? "text-red-600" : r.balanceCents < 0 ? "text-green-600" : "")}>
                                {r.balanceCents > 0 ? "+" : ""}{formatChfCents(r.balanceCents)}
                              </td>
                              <td className="text-right">
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
                <Panel title={t("manager:unitsId.title.invoices")}>
                  {unitInvoices.length === 0 ? (
                    <div className="empty-state-text py-6 text-center italic">No invoices linked to this unit.</div>
                  ) : (
                    <>
                      <div className="sm:hidden space-y-2">
                        {sortedUnitInvoices.map((inv) => (
                          <div key={inv.id} className="rounded-lg border border-surface-border bg-surface-subtle px-3 py-2.5 flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground truncate">{inv.invoiceNumber || "Draft"}</p>
                              <p className="text-xs text-muted mt-0.5">{formatChf(inv.totalAmount)}</p>
                            </div>
                            <Badge variant={invoiceVariant(inv.status)}>{inv.status}</Badge>
                          </div>
                        ))}
                      </div>
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="data-table w-full">
                          <thead>
                            <tr>
                              <SortableHeader label="Status" field="status" sortField={invSF} sortDir={invSD} onSort={handleInvSort} />
                              <th>{t("manager:unitsId.col.invoice")}</th>
                              <SortableHeader label="Description" field="description" sortField={invSF} sortDir={invSD} onSort={handleInvSort} />
                              <SortableHeader label="Amount" field="amount" sortField={invSF} sortDir={invSD} onSort={handleInvSort} className="text-right" />
                              <SortableHeader label="Period" field="period" sortField={invSF} sortDir={invSD} onSort={handleInvSort} />
                              <SortableHeader label="Due Date" field="dueDate" sortField={invSF} sortDir={invSD} onSort={handleInvSort} />
                              <SortableHeader label="Created" field="createdAt" sortField={invSF} sortDir={invSD} onSort={handleInvSort} />
                            </tr>
                          </thead>
                          <tbody>
                            {sortedUnitInvoices.map((inv) => (
                              <tr key={inv.id} className="border-t border-surface-divider hover:bg-surface-subtle">
                                <td><Badge variant={invoiceVariant(inv.status)}>{inv.status}</Badge></td>
                                <td>
                                  {isOwner ? (
                                    <span>{inv.invoiceNumber || "—"}</span>
                                  ) : (
                                    <Link href={`/manager/finance/invoices/${inv.id}`} className="text-blue-600 hover:underline">
                                      {inv.invoiceNumber || "—"}
                                    </Link>
                                  )}
                                </td>
                                <td className="max-w-[200px] truncate">{inv.description || "—"}</td>
                                <td className="text-right font-medium">{formatChf(inv.totalAmount)}</td>
                                <td className="whitespace-nowrap">
                                  {inv.billingPeriodStart && inv.billingPeriodEnd
                                    ? `${formatDate(inv.billingPeriodStart)} – ${formatDate(inv.billingPeriodEnd)}`
                                    : "—"}
                                </td>
                                <td className="whitespace-nowrap">{inv.dueDate ? formatDate(inv.dueDate) : "—"}</td>
                                <td className="whitespace-nowrap">{formatDate(inv.createdAt)}</td>
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
        <Panel title={t("manager:unitsId.title.contracts")}>
          {leasesLoading ? (
            <div className="py-6 text-center text-sm text-muted">Loading leases…</div>
          ) : unitLeases.length === 0 ? (
            <div className="empty-state-text py-6 text-center italic">No leases found for this unit.</div>
          ) : (
            <>
              {/* Mobile: card list */}
              <div className="sm:hidden space-y-2">
                {sortedUnitLeases.map((lease) => (
                  <div key={lease.id} className="rounded-lg border border-surface-border bg-surface-subtle px-3 py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{lease.tenantName || "—"}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {formatDate(lease.startDate)} · {formatChf(lease.netRentChf)}/mo
                      </p>
                    </div>
                    <Badge variant={leaseVariant(lease.status)}>{lease.status}</Badge>
                  </div>
                ))}
              </div>
              {/* Desktop: table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="data-table w-full">
                  <thead>
                    <tr>
                      <SortableHeader label="Status" field="status" sortField={lsSF} sortDir={lsSD} onSort={handleLsSort} />
                      <SortableHeader label="Tenant" field="tenant" sortField={lsSF} sortDir={lsSD} onSort={handleLsSort} />
                      <th className="text-right">{t("manager:unitsId.col.netRent")}</th>
                      <th className="text-right">{t("manager:unitsId.col.total")}</th>
                      <SortableHeader label="Start" field="startDate" sortField={lsSF} sortDir={lsSD} onSort={handleLsSort} />
                      <SortableHeader label="End" field="endDate" sortField={lsSF} sortDir={lsSD} onSort={handleLsSort} />
                      <th>{t("manager:unitsId.col.notice")}</th>
                      <SortableHeader label="Created" field="createdAt" sortField={lsSF} sortDir={lsSD} onSort={handleLsSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedUnitLeases.map((lease) => (
                      <tr key={lease.id} className="border-t border-surface-divider hover:bg-surface-subtle">
                        <td>
                          <Badge variant={leaseVariant(lease.status)}>{lease.status}</Badge>
                        </td>
                        <td>
                          {isOwner ? (
                            <span>{lease.tenantName || "—"}</span>
                          ) : (
                            <Link href={`/manager/leases/${lease.id}`} className="text-blue-600 hover:underline">
                              {lease.tenantName || "—"}
                            </Link>
                          )}
                        </td>
                        <td className="text-right font-medium">{formatChf(lease.netRentChf)}</td>
                        <td className="text-right">{lease.rentTotalChf != null ? formatChf(lease.rentTotalChf) : "—"}</td>
                        <td className="whitespace-nowrap">{formatDate(lease.startDate)}</td>
                        <td className="whitespace-nowrap">{lease.endDate ? formatDate(lease.endDate) : "Open-ended"}</td>
                        <td className="whitespace-nowrap">{lease.noticeRule || "—"}</td>
                        <td className="whitespace-nowrap">{formatDate(lease.createdAt)}</td>
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
        <Panel title={t("manager:unitsId.title.openRequests")}>
          {requestsLoading ? (
            <div className="py-6 text-center text-sm text-muted">Loading requests…</div>
          ) : unitRequests.length === 0 ? (
            <div className="empty-state-text py-6 text-center italic">No open requests for this unit.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <SortableHeader label="#" field="requestNumber" sortField={reqSF} sortDir={reqSD} onSort={handleReqSort} />
                    <SortableHeader label="Status" field="status" sortField={reqSF} sortDir={reqSD} onSort={handleReqSort} />
                    <SortableHeader label="Category" field="category" sortField={reqSF} sortDir={reqSD} onSort={handleReqSort} />
                    <SortableHeader label="Description" field="description" sortField={reqSF} sortDir={reqSD} onSort={handleReqSort} />
                    <SortableHeader label="Urgency" field="urgency" sortField={reqSF} sortDir={reqSD} onSort={handleReqSort} />
                    <SortableHeader label="Contractor" field="contractor" sortField={reqSF} sortDir={reqSD} onSort={handleReqSort} />
                    <SortableHeader label="Date" field="createdAt" sortField={reqSF} sortDir={reqSD} onSort={handleReqSort} />
                  </tr>
                </thead>
                <tbody>
                  {sortedUnitRequests.map((r) => (
                    <tr
                      key={r.id}
                      className="border-t border-surface-divider hover:bg-surface-subtle cursor-pointer"
                      onClick={() => router.push(`/manager/requests/${r.id}?from=/admin-inventory/units/${id}`)}
                    >
                      <td className="tabular-nums font-medium">#{r.requestNumber}</td>
                      <td><Badge variant="muted" size="sm">{r.status?.replace(/_/g, " ")}</Badge></td>
                      <td>{r.category || "—"}</td>
                      <td className="max-w-[200px] truncate">{r.description || "—"}</td>
                      <td>{r.urgency || "—"}</td>
                      <td>{r.assignedContractor?.name || "—"}</td>
                      <td className="whitespace-nowrap">{formatDate(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
          )}

          {activeTab === "Condition Reports" && (
            <div className="space-y-4 py-4">
              {/* Header row with create button */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Inspections</p>
                <button
                  onClick={() => {
                    setShowCreateReport(!showCreateReport);
                    setCreateReportErr("");
                  }}
                  className="rounded-lg border border-brand px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand hover:text-white transition-colors"
                >
                  {showCreateReport ? "Cancel" : "+ Start inspection"}
                </button>
              </div>

              {/* Inline create form */}
              {showCreateReport && (
                <div className="card border p-4 space-y-3">
                  <p className="text-sm font-semibold text-foreground">New condition report</p>
                  {createReportErr && <p className="text-xs text-destructive-text">{createReportErr}</p>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-muted-dark mb-1">Type</label>
                      <select value={newReportType} onChange={(e) => setNewReportType(e.target.value)} className="input mb-0">
                        <option value="MOVE_IN">Move-in (entrée)</option>
                        <option value="MOVE_OUT">Move-out (sortie)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-dark mb-1">Deadline (days from today)</label>
                      <input type="number" value={newReportDays} onChange={(e) => setNewReportDays(e.target.value)}
                        min="1" max="90" className="input mb-0" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-dark mb-1">Lease</label>
                      <select value={newReportLeaseId} onChange={(e) => {
                        setNewReportLeaseId(e.target.value);
                        // Auto-fill tenant from lease occupancy if available
                        const lease = newReportLeases.find((l) => l.id === e.target.value);
                        if (lease?.tenants?.[0]?.id) setNewReportTenantId(lease.tenants[0].id);
                      }} className="input mb-0">
                        <option value="">— Select lease —</option>
                        {newReportLeases.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.status} · {l.tenantName || l.id.slice(0, 8)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-dark mb-1">Tenant</label>
                      <select value={newReportTenantId} onChange={(e) => setNewReportTenantId(e.target.value)} className="input mb-0">
                        <option value="">— Select tenant —</option>
                        {tenants.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name || t.phone || t.id.slice(0, 8)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    disabled={creatingReport || !newReportLeaseId || !newReportTenantId}
                    onClick={async () => {
                      setCreatingReport(true);
                      setCreateReportErr("");
                      try {
                        const res = await fetch(`/api/units/${id}/condition-reports`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json", ...authHeaders() },
                          body: JSON.stringify({
                            type: newReportType,
                            leaseId: newReportLeaseId,
                            tenantId: newReportTenantId,
                            dueAtDays: parseInt(newReportDays, 10) || 7,
                          }),
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data?.error?.message || "Failed");
                        setShowCreateReport(false);
                        setNewReportLeaseId(""); setNewReportTenantId("");
                        // Reload the list
                        setConditionReportsLoading(true);
                        const listRes = await fetch(`/api/units/${id}/condition-reports`, { headers: authHeaders() });
                        const listData = await listRes.json();
                        setConditionReports(listData?.data ?? []);
                        setConditionReportsLoading(false);
                      } catch (e) {
                        setCreateReportErr(e.message || "Failed to create report");
                      } finally {
                        setCreatingReport(false);
                      }
                    }}
                    className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50 transition-colors"
                  >
                    {creatingReport ? "Creating…" : "Create report"}
                  </button>
                </div>
              )}

              {/* Report list */}
              {conditionReportsLoading ? (
                <p className="text-sm text-muted py-6 text-center">Loading…</p>
              ) : conditionReports.length === 0 ? (
                <p className="text-sm text-foreground-dim italic py-6 text-center">No condition reports for this unit yet.</p>
              ) : (
                conditionReports.map((r) => {
                  const statusVariant = { PENDING: "warning", SUBMITTED: "info", APPROVED: "success" };
                  const typeLabel = r.type === "MOVE_IN" ? "Move-in" : "Move-out";
                  return (
                    <div
                      key={r.id}
                      onClick={() => router.push(`/manager/condition-reports/${r.id}?from=/admin-inventory/units/${id}`)}
                      className="card border px-4 py-3 cursor-pointer hover:bg-surface-subtle transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <Badge variant={statusVariant[r.status] || "neutral"} size="sm">{r.status}</Badge>
                          <span className="text-sm font-medium text-foreground">{typeLabel}</span>
                          {r.tenant?.name && <span className="text-xs text-foreground-dim">— {r.tenant.name}</span>}
                          <span className="text-xs text-foreground-dim">{r.itemCount} items</span>
                        </div>
                        <span className="text-xs text-foreground-dim shrink-0">{formatDate(r.createdAt)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "Reporting" && (
            <UnitPeriodAnalysis unitId={id} />
          )}

      </PageContent>
    </PageShell>
    </AppShell>
  );
}

// v2 C4 — per-unit charges reconciliation: advances paid vs apportioned actual
// for a building cost-pool period, settle to a credit note / extra invoice.
function UnitChargesReconciliation({ unit, onSettled }) {
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState("");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [settling, setSettling] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!unit?.buildingId) return;
    fetch(`/api/billing-periods?buildingId=${unit.buildingId}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        const ps = j.data || [];
        setPeriods(ps);
        // Passively show the latest period's ventilation without forcing a pick.
        setPeriodId((cur) => cur || ps[0]?.id || "");
      })
      .catch(() => {});
  }, [unit?.buildingId]);

  useEffect(() => {
    if (!periodId || !unit?.id) { setPreview(null); return; }
    setLoading(true); setErr(""); setMsg("");
    fetch(`/api/unit-reconciliation?unitId=${unit.id}&billingPeriodId=${periodId}`, { headers: authHeaders() })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error?.message || "Failed"); setPreview(j.data); })
      .catch((e) => { setErr(e.message); setPreview(null); })
      .finally(() => setLoading(false));
  }, [periodId, unit?.id]);

  async function settle() {
    setSettling(true); setErr(""); setMsg("");
    try {
      const res = await fetch(`/api/unit-reconciliation/settle`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ unitId: unit.id, billingPeriodId: periodId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message || "Failed");
      setMsg(j.data?.settlementCreditNoteId ? "Refund credit note issued." : "Settlement invoice issued.");
      setPreview(null); setPeriodId("");
      onSettled && onSettled();
    } catch (e) { setErr(e.message); } finally { setSettling(false); }
  }

  return (
    <Panel title="Charges ventilation & reconciliation">
      <p className="text-sm text-muted-text mb-3">The unit&apos;s apportioned share of the building&apos;s actual charges for the selected period, shown against what the tenant paid in advance. Settling is an explicit action.</p>
      {err && <p className="error-banner mb-2">{err}</p>}
      {msg && <p className="text-sm text-green-700 mb-2">{msg}</p>}
      <div className="flex items-center gap-2 mb-4">
        <label className="text-sm font-medium text-muted-text">Period</label>
        <select className="border border-surface-border rounded-lg px-3 py-1.5 text-sm bg-surface" value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
          <option value="">Select a period…</option>
          {periods.map((p) => (
            <option key={p.id} value={p.id}>{p.startDate?.slice(0, 10)} – {p.endDate?.slice(0, 10)}</option>
          ))}
        </select>
      </div>
      {loading && <p className="text-sm text-muted-text">Loading…</p>}
      {preview && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="p-3 rounded-lg bg-surface-subtle">
              <div className="text-xs text-muted-text">Charges paid (advance)</div>
              <div className="text-lg font-semibold tabular-nums">{formatChfCents(preview.advancesPaidCents)}</div>
            </div>
            <div className="p-3 rounded-lg bg-surface-subtle">
              <div className="text-xs text-muted-text">Apportioned actual</div>
              <div className="text-lg font-semibold tabular-nums">{formatChfCents(preview.actualCostsCents)}</div>
            </div>
            <div className={cn("p-3 rounded-lg", preview.deltaCents > 0 ? "bg-red-50" : preview.deltaCents < 0 ? "bg-green-50" : "bg-surface-subtle")}>
              <div className="text-xs text-muted-text">Delta {preview.deltaCents > 0 ? "(tenant owes)" : preview.deltaCents < 0 ? "(refund)" : ""}</div>
              <div className={cn("text-lg font-semibold tabular-nums", preview.deltaCents > 0 ? "text-red-700" : preview.deltaCents < 0 ? "text-green-700" : "")}>
                {preview.deltaCents > 0 ? "+" : ""}{formatChfCents(preview.deltaCents)}
              </div>
            </div>
          </div>
          {preview.lines?.length > 0 && (
            <div className="overflow-x-auto mb-4">
              <table className="data-table w-full">
                <thead>
                  <tr><th>Category</th><th>Method</th><th className="text-right">Building cost</th><th className="text-right">Unit share</th></tr>
                </thead>
                <tbody>
                  {preview.lines.map((l, i) => (
                    <tr key={i} className="border-t border-surface-divider">
                      <td>{l.categoryName}</td>
                      <td className="text-xs text-muted-text">{l.distributionKey}{l.usedConsumptionFallback ? " (metered → surface)" : ""}{l.requiresManual ? " (manual)" : ""}</td>
                      <td className="text-right tabular-nums">{formatChfCents(l.buildingActualCents)}</td>
                      <td className="text-right tabular-nums">{l.actualShareCents != null ? formatChfCents(l.actualShareCents) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Button variant="primary" size="sm" onClick={settle} disabled={settling}>
            {settling ? "Generating…" : preview.deltaCents < 0 ? "Issue refund (credit note)" : "Issue settlement invoice"}
          </Button>
        </>
      )}
    </Panel>
  );
}

export const getServerSideProps = withServerTranslations(["common","manager"]);
