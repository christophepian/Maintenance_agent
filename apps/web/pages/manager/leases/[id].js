import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import { formatDate as fmtD } from "../../../lib/format";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import { authHeaders } from "../../../lib/api";

const STATUS_COLORS = {
  DRAFT: "bg-yellow-100 text-yellow-800",
  READY_TO_SIGN: "bg-blue-100 text-blue-800",
  SIGNED: "bg-green-100 text-green-800",
  ACTIVE: "bg-emerald-100 text-emerald-800",
  TERMINATED: "bg-orange-100 text-orange-800",
  CANCELLED: "bg-red-100 text-red-800",
};

function Field({ label, children, span }) {
  return (
    <div className={span === 2 ? "col-span-2" : ""}>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, type = "text", placeholder, disabled }) {
  return (
    <input
      type={type}
      value={value ?? ""}
      onChange={e => onChange(type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full border rounded-md px-3 py-1.5 text-sm disabled:bg-slate-100 disabled:text-slate-500"
    />
  );
}

function AccordionSection({ title, open, onToggle, children }) {
  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <span className="text-slate-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="px-5 pb-5 pt-2 border-t">{children}</div>}
    </div>
  );
}

export default function LeaseEditorPage() {
  const router = useRouter();
  const { id } = router.query;

  const [lease, setLease] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Accordion state
  const [openSections, setOpenSections] = useState({
    parties: true, object: false, dates: false,
    rent: false, payment: false, deposit: false,
    usage: false, stipulations: false,
  });

  const toggle = (key) => setOpenSections(s => ({ ...s, [key]: !s[key] }));

  // Signature modal
  const [showSignModal, setShowSignModal] = useState(false);
  const [signLevel, setSignLevel] = useState("SES");
  const [sigRequests, setSigRequests] = useState([]);
  const [sendingSigReqId, setSendingSigReqId] = useState(null);
  const [resendingForSignature, setResendingForSignature] = useState(false);

  // Phase 5 state
  const [invoices, setInvoices] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);
  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [terminateReason, setTerminateReason] = useState("MUTUAL");
  const [terminateNotice, setTerminateNotice] = useState("");
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceType, setInvoiceType] = useState("DEPOSIT");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceDesc, setInvoiceDesc] = useState("");

  // Billing schedule state
  const [billingSchedule, setBillingSchedule] = useState(null);
  const [billingScheduleLoading, setBillingScheduleLoading] = useState(false);
  const [billingAction, setBillingAction] = useState(null);

  // Charge reconciliation state
  const [reconciliations, setReconciliations] = useState([]);
  const [reconLoading, setReconLoading] = useState(false);
  const [showCreateRecon, setShowCreateRecon] = useState(false);
  const [reconYear, setReconYear] = useState(new Date().getFullYear() - 1);
  const [reconCreating, setReconCreating] = useState(false);

  // Rent adjustment state
  const [rentAdjustments, setRentAdjustments] = useState([]);
  const [showComputeAdj, setShowComputeAdj] = useState(false);
  const [adjCpiNew, setAdjCpiNew] = useState("");
  const [adjEffective, setAdjEffective] = useState("");
  const [adjComputing, setAdjComputing] = useState(false);

  const isDraft = lease?.status === "DRAFT";
  const isReadyToSign = lease?.status === "READY_TO_SIGN";
  const isSigned = lease?.status === "SIGNED";
  const isActive = lease?.status === "ACTIVE";
  const isTemplate = lease?.isTemplate === true;
  // True when the READY_TO_SIGN lease has no canonical sent timestamp yet
  // (legacy leases created before the lifecycle fix, or a failed send).
  const needsResend = isReadyToSign && !sigRequests.some(sr => sr.status === "SENT" || sr.status === "SIGNED");

  const fetchLease = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/leases/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Not found");
      setLease(json.data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchSignatureRequests = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/signature-requests?entityType=LEASE&entityId=${id}`);
      const json = await res.json();
      setSigRequests(json.data || []);
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => { fetchLease(); }, [fetchLease]);
  useEffect(() => { fetchSignatureRequests(); }, [fetchSignatureRequests]);

  // Phase 5: fetch invoices
  const fetchInvoices = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/leases/${id}/invoices`);
      const json = await res.json();
      setInvoices(json.data || []);
    } catch { /* ignore */ }
  }, [id]);
  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  // Billing schedule fetch
  const fetchBillingSchedule = useCallback(async () => {
    if (!id) return;
    setBillingScheduleLoading(true);
    try {
      const res = await fetch(`/api/billing-schedules?leaseId=${id}`);
      const json = await res.json();
      const schedules = json.data || [];
      // Show the most relevant schedule (ACTIVE > PAUSED > most recent COMPLETED)
      const active = schedules.find(s => s.status === "ACTIVE");
      const paused = schedules.find(s => s.status === "PAUSED");
      setBillingSchedule(active || paused || schedules[0] || null);
    } catch { /* ignore */ }
    finally { setBillingScheduleLoading(false); }
  }, [id]);
  useEffect(() => { fetchBillingSchedule(); }, [fetchBillingSchedule]);

  // Charge reconciliation fetch
  const fetchReconciliations = useCallback(async () => {
    if (!id) return;
    setReconLoading(true);
    try {
      const res = await fetch(`/api/charge-reconciliations?leaseId=${id}`, { headers: authHeaders() });
      const json = await res.json();
      setReconciliations(json.data || []);
    } catch { /* ignore */ }
    finally { setReconLoading(false); }
  }, [id]);
  useEffect(() => { fetchReconciliations(); }, [fetchReconciliations]);

  async function handleCreateRecon() {
    setReconCreating(true);
    try {
      const res = await fetch("/api/charge-reconciliations", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ leaseId: id, fiscalYear: reconYear }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to create");
      setShowCreateRecon(false);
      router.push(`/manager/charge-reconciliations/${json.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setReconCreating(false);
    }
  }

  // Rent adjustment fetch
  const fetchRentAdjustments = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/rent-adjustments?leaseId=${id}`, { headers: authHeaders() });
      const json = await res.json();
      setRentAdjustments(json.data || []);
    } catch { /* ignore */ }
  }, [id]);
  useEffect(() => { fetchRentAdjustments(); }, [fetchRentAdjustments]);

  async function handleComputeIndexation() {
    setAdjComputing(true);
    try {
      const res = await fetch("/api/rent-adjustments/compute", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          leaseId: id,
          cpiNewIndex: parseFloat(adjCpiNew),
          effectiveDate: adjEffective,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to compute");
      setShowComputeAdj(false);
      router.push(`/manager/rent-adjustments/${json.data?.id || json.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setAdjComputing(false);
    }
  }

  async function handleBillingAction(action) {
    if (!billingSchedule) return;
    setBillingAction(action);
    try {
      const res = await fetch(`/api/billing-schedules/${billingSchedule.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message || `Failed to ${action}`);
      }
      await fetchBillingSchedule();
    } catch (err) {
      setError(err.message);
    } finally {
      setBillingAction(null);
    }
  }

  function updateField(field, value) {
    setLease(prev => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const body = { ...lease };
      // Remove read-only fields
      delete body.id; delete body.orgId; delete body.status;
      delete body.createdAt; delete body.updatedAt;
      delete body.draftPdfStorageKey; delete body.draftPdfSha256;
      delete body.unit; delete body.applicationId; delete body.unitId;
      delete body.isTemplate; delete body.templateName; delete body.templateBuildingId;
      delete body.signedPdfStorageKey; delete body.signedPdfSha256;
      delete body.depositPaidAt; delete body.depositConfirmedBy; delete body.depositBankRef;
      delete body.activatedAt; delete body.terminatedAt; delete body.terminationReason;
      delete body.terminationNotice; delete body.archivedAt;

      // Convert empty strings to null for optional numeric fields
      for (const f of ["garageRentChf", "otherServiceRentChf", "chargesTotalChf", "depositChf", "paymentDueDayOfMonth"]) {
        if (body[f] === "" || body[f] === undefined) body[f] = null;
      }
      // Convert empty strings to null for optional string fields
      for (const f of ["tenantAddress", "tenantZipCity", "tenantPhone", "tenantEmail", "coTenantName",
        "landlordPhone", "landlordEmail", "landlordRepresentedBy",
        "roomsCount", "floor", "extendedNoticeText", "terminationDatesCustomText",
        "chargesSettlementDate", "paymentRecipient", "paymentInstitution", "paymentAccountNumber", "paymentIban",
        "referenceRatePercent", "referenceRateDate", "otherStipulations", "otherAnnexesText"]) {
        if (body[f] === "" || body[f] === undefined) body[f] = null;
      }
      // Remove date fields that are empty
      if (!body.endDate) delete body.endDate;
      if (!body.firstTerminationDate) delete body.firstTerminationDate;
      if (!body.depositDueDate) delete body.depositDueDate;
      // Remove rentTotalChf (computed on backend)
      delete body.rentTotalChf;

      const res = await fetch(`/api/leases/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Save failed");
      setLease(json.data);
      setSuccess("Saved successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleGeneratePDF() {
    setPdfGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/leases/${id}/generate-pdf`, { method: "POST" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message || "PDF generation failed");
      }
      // Download the PDF
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lease-${id.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      // Refresh lease to get updated PDF reference
      await fetchLease();
      setSuccess("PDF generated and downloaded");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setPdfGenerating(false);
    }
  }

  async function handleReadyToSign() {
    setError(null);
    try {
      const res = await fetch(`/api/leases/${id}/ready-to-sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: signLevel }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed");
      setLease(json.data.lease);
      setSigRequests(prev => [json.data.signatureRequest, ...prev]);
      setShowSignModal(false);
      setSuccess("Lease marked ready to sign. Signature request created.");
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err.message);
    }
  }

  // Send a DRAFT signature request (remediation for legacy submitted leases)
  async function handleSendSigReq(srId) {
    setSendingSigReqId(srId);
    setError(null);
    try {
      const res = await fetch(`/api/signature-requests/${srId}/send`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to send");
      setSigRequests(prev => prev.map(sr => sr.id === srId ? json.data : sr));
      setSuccess("Signature request sent. Submitted tab will now show the sent date.");
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingSigReqId(null);
    }
  }

  // Re-send for signature (remediation for READY_TO_SIGN leases with no sent sig req)
  async function handleResendForSignature() {
    if (!confirm("Create and send a new signature request for this lease?")) return;
    setResendingForSignature(true);
    setError(null);
    try {
      const res = await fetch(`/api/leases/${id}/resend-for-signature`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed");
      setSigRequests(prev => [json.data, ...prev]);
      setSuccess("New signature request created and sent.");
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setResendingForSignature(false);
    }
  }

  async function handleCancel() {
    if (!confirm("Cancel this lease? This cannot be undone for signed leases.")) return;
    try {
      const res = await fetch(`/api/leases/${id}/cancel`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed");
      setLease(json.data);
    } catch (err) {
      setError(err.message);
    }
  }

  // Phase 5 handlers
  async function handleAction(action, body = {}) {
    setActionLoading(action);
    setError(null);
    try {
      const res = await fetch(`/api/leases/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed");
      if (json.data?.id) setLease(json.data);
      else await fetchLease();
      await fetchInvoices();
      setSuccess(`Action "${action}" completed.`);
      setTimeout(() => setSuccess(null), 3000);
      return json;
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleConfirmDeposit() {
    await handleAction("confirm-deposit", { confirmedBy: "Manager" });
  }

  async function handleActivate() {
    if (!confirm("Activate this lease? This will set the status to ACTIVE.")) return;
    await handleAction("activate");
  }

  async function handleTerminate() {
    await handleAction("terminate", { reason: terminateReason, notice: terminateNotice || undefined });
    setShowTerminateModal(false);
  }

  async function handleArchive() {
    if (!confirm("Archive this lease?")) return;
    await handleAction("archive");
  }

  async function handleCreateInvoice() {
    const amount = parseFloat(invoiceAmount);
    if (!amount || amount <= 0) { setError("Invoice amount must be > 0"); return; }
    await handleAction("invoices", {
      type: invoiceType,
      amountChf: amount,
      description: invoiceDesc || undefined,
    });
    setShowInvoiceModal(false);
    setInvoiceAmount("");
    setInvoiceDesc("");
  }

  if (loading) {
    return (
      <AppShell role="MANAGER">
        <PageShell><p className="text-sm text-slate-500 p-6">Loading lease...</p></PageShell>
      </AppShell>
    );
  }

  if (error && !lease) {
    return (
      <AppShell role="MANAGER">
        <PageShell>
          <p className="text-sm text-red-600 p-6">{error}</p>
          <Link href="/manager/leases" className="text-blue-600 text-sm ml-6">← Back to leases</Link>
        </PageShell>
      </AppShell>
    );
  }

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader
          title={isTemplate ? `Template — ${lease.templateName || lease.landlordName}` : `Lease — ${lease.tenantName}`}
          subtitle={
            <span className="flex items-center gap-2">
              <Link href={isTemplate ? "/manager/leases/templates" : "/manager/leases"} className="text-blue-600 hover:underline">{isTemplate ? "← Templates" : "← Leases"}</Link>
              <span>·</span>
              {isTemplate && (
                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">TEMPLATE</span>
              )}
              {!isTemplate && (
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[lease.status] || "bg-slate-100"}`}>
                  {lease.status.replace(/_/g, " ")}
                </span>
              )}
              {lease.unit && (
                <>
                  <span>·</span>
                  <span className="text-slate-500">{lease.unit.building?.name} — Unit {lease.unit.unitNumber}</span>
                </>
              )}
            </span>
          }
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              {(isDraft || isTemplate) && !editMode && (
                <button onClick={() => setEditMode(true)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
                  ✏️ Edit
                </button>
              )}
              {(isDraft || isTemplate) && editMode && (
                <>
                  <button onClick={() => { handleSave(); setEditMode(false); }} disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button onClick={() => { setEditMode(false); fetchLease(); }}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
                    Cancel
                  </button>
                </>
              )}
              <button onClick={handleGeneratePDF} disabled={pdfGenerating}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50">
                {pdfGenerating ? "Generating..." : "📄 Generate PDF"}
              </button>
              {isDraft && !isTemplate && (
                <button onClick={() => setShowSignModal(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                  ✍️ Send for Signature
                </button>
              )}
              {needsResend && (
                <button onClick={handleResendForSignature} disabled={resendingForSignature}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
                  title="This submitted lease has no sent signature request. Click to create and send one now.">
                  {resendingForSignature ? "Sending…" : "↩️ Re-send for Signature"}
                </button>
              )}
              {isSigned && !isTemplate && (
                <button onClick={handleActivate} disabled={!!actionLoading}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                  {actionLoading === "activate" ? "Activating..." : "⚡ Activate"}
                </button>
              )}
              {isActive && !isTemplate && (
                <button onClick={() => setShowTerminateModal(true)}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700">
                  📋 Terminate
                </button>
              )}
              {!isTemplate && !lease.archivedAt && ["SIGNED", "ACTIVE", "TERMINATED", "CANCELLED"].includes(lease.status) && (
                <button onClick={handleArchive} disabled={!!actionLoading}
                  className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 disabled:opacity-50">
                  📦 Archive
                </button>
              )}
              {!isTemplate && (
                <button onClick={() => setShowInvoiceModal(true)}
                  className="px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-100">
                  💰 Invoice
                </button>
              )}
              {!isTemplate && lease.status !== "SIGNED" && lease.status !== "ACTIVE" && lease.status !== "TERMINATED" && lease.status !== "CANCELLED" && (
                <button onClick={handleCancel}
                  className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100">
                  Cancel
                </button>
              )}
            </div>
          }
        />

        {error && <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>}
        {success && <p className="mt-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">{success}</p>}

        <PageContent>
          <Panel title="Lease Contract" bodyClassName="space-y-3">
          {/* §1 — Parties */}
          <AccordionSection title="§1 — Parties (Bailleur & Locataire)" open={openSections.parties} onToggle={() => toggle("parties")}>
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">§1.1 Bailleresse / Bailleur</h4>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nom / Raison sociale"><Input value={lease.landlordName} onChange={v => updateField("landlordName", v)} disabled={!editMode} /></Field>
                <Field label="Adresse"><Input value={lease.landlordAddress} onChange={v => updateField("landlordAddress", v)} disabled={!editMode} /></Field>
                <Field label="NPA / Localité"><Input value={lease.landlordZipCity} onChange={v => updateField("landlordZipCity", v)} disabled={!editMode} /></Field>
                <Field label="Téléphone"><Input value={lease.landlordPhone} onChange={v => updateField("landlordPhone", v)} disabled={!editMode} /></Field>
                <Field label="E-mail"><Input value={lease.landlordEmail} onChange={v => updateField("landlordEmail", v)} disabled={!editMode} /></Field>
                <Field label="Représenté(e) par"><Input value={lease.landlordRepresentedBy} onChange={v => updateField("landlordRepresentedBy", v)} disabled={!editMode} /></Field>
              </div>

              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-6">§1.2 Locataire</h4>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nom *"><Input value={lease.tenantName} onChange={v => updateField("tenantName", v)} disabled={!editMode} /></Field>
                <Field label="Adresse"><Input value={lease.tenantAddress} onChange={v => updateField("tenantAddress", v)} disabled={!editMode} /></Field>
                <Field label="NPA / Localité"><Input value={lease.tenantZipCity} onChange={v => updateField("tenantZipCity", v)} disabled={!editMode} /></Field>
                <Field label="Téléphone"><Input value={lease.tenantPhone} onChange={v => updateField("tenantPhone", v)} disabled={!editMode} /></Field>
                <Field label="E-mail"><Input value={lease.tenantEmail} onChange={v => updateField("tenantEmail", v)} disabled={!editMode} /></Field>
                <Field label="Co-locataire"><Input value={lease.coTenantName} onChange={v => updateField("coTenantName", v)} disabled={!editMode} /></Field>
              </div>
            </div>
          </AccordionSection>

          {/* §2 — Object */}
          <AccordionSection title="§2 — Objet du bail" open={openSections.object} onToggle={() => toggle("object")}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type d'objet">
                <select value={lease.objectType || "APPARTEMENT"} onChange={e => updateField("objectType", e.target.value)} disabled={!editMode}
                  className="w-full border rounded-md px-3 py-1.5 text-sm disabled:bg-slate-100">
                  <option value="APPARTEMENT">Appartement</option>
                  <option value="MAISON">Maison</option>
                  <option value="CHAMBRE_MEUBLEE">Chambre meublée</option>
                </select>
              </Field>
              <Field label="Nombre de pièces"><Input value={lease.roomsCount} onChange={v => updateField("roomsCount", v)} placeholder="3.5" disabled={!editMode} /></Field>
              <Field label="Étage"><Input value={lease.floor} onChange={v => updateField("floor", v)} disabled={!editMode} /></Field>
              <Field label="Adresse immeuble">
                <Input value={lease.buildingAddressLines?.join(", ")} disabled={true} />
              </Field>
            </div>
          </AccordionSection>

          {/* §3–4 — Dates & Termination */}
          <AccordionSection title="§3–4 — Durée & Résiliation" open={openSections.dates} onToggle={() => toggle("dates")}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Début du bail *"><Input type="date" value={lease.startDate?.split("T")[0]} onChange={v => updateField("startDate", v)} disabled={!editMode} /></Field>
              <Field label="Durée déterminée">
                <select value={lease.isFixedTerm ? "true" : "false"} onChange={e => updateField("isFixedTerm", e.target.value === "true")} disabled={!editMode}
                  className="w-full border rounded-md px-3 py-1.5 text-sm disabled:bg-slate-100">
                  <option value="false">Indéterminée</option>
                  <option value="true">Déterminée</option>
                </select>
              </Field>
              {lease.isFixedTerm && (
                <Field label="Fin du bail"><Input type="date" value={lease.endDate?.split("T")[0]} onChange={v => updateField("endDate", v)} disabled={!editMode} /></Field>
              )}
              <Field label="Premier terme de résiliation"><Input type="date" value={lease.firstTerminationDate?.split("T")[0]} onChange={v => updateField("firstTerminationDate", v)} disabled={!editMode} /></Field>
              <Field label="Délai de résiliation">
                <select value={lease.noticeRule || "3_MONTHS"} onChange={e => updateField("noticeRule", e.target.value)} disabled={!editMode}
                  className="w-full border rounded-md px-3 py-1.5 text-sm disabled:bg-slate-100">
                  <option value="3_MONTHS">3 mois</option>
                  <option value="EXTENDED">Prolongé</option>
                  <option value="2_WEEKS">2 semaines</option>
                </select>
              </Field>
              <Field label="Termes de résiliation">
                <select value={lease.terminationDatesRule || "END_OF_MONTH_EXCEPT_31_12"} onChange={e => updateField("terminationDatesRule", e.target.value)} disabled={!editMode}
                  className="w-full border rounded-md px-3 py-1.5 text-sm disabled:bg-slate-100">
                  <option value="END_OF_MONTH_EXCEPT_31_12">Fin de mois, sauf 31.12</option>
                  <option value="CUSTOM">Dates locales</option>
                </select>
              </Field>
            </div>
          </AccordionSection>

          {/* §5 — Rent & Charges */}
          <AccordionSection title="§5 — Loyer & Charges" open={openSections.rent} onToggle={() => toggle("rent")}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Loyer net (CHF/mois) *"><Input type="number" value={lease.netRentChf} onChange={v => updateField("netRentChf", v)} disabled={!editMode} /></Field>
              <Field label="Loyer garage (CHF/mois)"><Input type="number" value={lease.garageRentChf} onChange={v => updateField("garageRentChf", v)} disabled={!editMode} /></Field>
              <Field label="Autres prestations (CHF/mois)"><Input type="number" value={lease.otherServiceRentChf} onChange={v => updateField("otherServiceRentChf", v)} disabled={!editMode} /></Field>
              <Field label="Total charges (CHF/mois)"><Input type="number" value={lease.chargesTotalChf} onChange={v => updateField("chargesTotalChf", v)} disabled={!editMode} /></Field>
            </div>
            <div className="mt-3 p-3 bg-slate-50 rounded-md">
              <p className="text-sm font-medium text-slate-700">
                Loyer total : <span className="text-lg font-bold">CHF {lease.rentTotalChf ?? "—"}.-/mois</span>
              </p>
            </div>
          </AccordionSection>

          {/* §6 — Payment */}
          <AccordionSection title="§6 — Paiement" open={openSections.payment} onToggle={() => toggle("payment")}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Jour d'échéance"><Input type="number" value={lease.paymentDueDayOfMonth} onChange={v => updateField("paymentDueDayOfMonth", v)} placeholder="1" disabled={!editMode} /></Field>
              <Field label="Bénéficiaire"><Input value={lease.paymentRecipient} onChange={v => updateField("paymentRecipient", v)} disabled={!editMode} /></Field>
              <Field label="Institut financier"><Input value={lease.paymentInstitution} onChange={v => updateField("paymentInstitution", v)} disabled={!editMode} /></Field>
              <Field label="N° de compte"><Input value={lease.paymentAccountNumber} onChange={v => updateField("paymentAccountNumber", v)} disabled={!editMode} /></Field>
              <Field label="IBAN"><Input value={lease.paymentIban} onChange={v => updateField("paymentIban", v)} placeholder="CH..." disabled={!editMode} /></Field>
              <Field label="Taux de référence"><Input value={lease.referenceRatePercent} onChange={v => updateField("referenceRatePercent", v)} placeholder="1.75" disabled={!editMode} /></Field>
            </div>
          </AccordionSection>

          {/* §7 — Deposit */}
          <AccordionSection title="§7 — Garantie" open={openSections.deposit} onToggle={() => toggle("deposit")}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Montant de la garantie (CHF)"><Input type="number" value={lease.depositChf} onChange={v => updateField("depositChf", v)} disabled={!editMode} /></Field>
              <Field label="Exigibilité">
                <select value={lease.depositDueRule || "AT_SIGNATURE"} onChange={e => updateField("depositDueRule", e.target.value)} disabled={!editMode}
                  className="w-full border rounded-md px-3 py-1.5 text-sm disabled:bg-slate-100">
                  <option value="AT_SIGNATURE">À la signature</option>
                  <option value="BY_START">Au début du bail</option>
                  <option value="BY_DATE">À une date précise</option>
                </select>
              </Field>
              {lease.depositDueRule === "BY_DATE" && (
                <Field label="Date d'échéance"><Input type="date" value={lease.depositDueDate?.split("T")[0]} onChange={v => updateField("depositDueDate", v)} disabled={!editMode} /></Field>
              )}
            </div>
          </AccordionSection>

          {/* §15 — Stipulations */}
          <AccordionSection title="§15 — Dispositions particulières & Annexes" open={openSections.stipulations} onToggle={() => toggle("stipulations")}>
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={lease.includesHouseRules || false} onChange={e => updateField("includesHouseRules", e.target.checked)} disabled={!editMode} />
                Règlement de la maison joint en annexe
              </label>
              <Field label="Autres annexes" span={2}>
                <Input value={lease.otherAnnexesText} onChange={v => updateField("otherAnnexesText", v)} disabled={!editMode} />
              </Field>
              <Field label="Dispositions particulières" span={2}>
                <textarea
                  value={lease.otherStipulations ?? ""}
                  onChange={e => updateField("otherStipulations", e.target.value)}
                  disabled={!editMode}
                  rows={4}
                  className="w-full border rounded-md px-3 py-1.5 text-sm disabled:bg-slate-100"
                />
              </Field>
            </div>
          </AccordionSection>
          </Panel>

          {/* Signature Requests */}
          {sigRequests.length > 0 && (
            <Panel title="Signature Requests" bodyClassName="p-0">
                <table className="inline-table">
                  <thead>
                    <tr>
                      <th>Provider</th>
                      <th>Level</th>
                      <th>Status</th>
                      <th>Signers</th>
                      <th>Sent</th>
                      <th>Created</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sigRequests.map(sr => (
                      <tr key={sr.id}>
                        <td>{sr.provider}</td>
                        <td>{sr.level}</td>
                        <td>
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            sr.status === "SIGNED" ? "bg-green-100 text-green-800" :
                            sr.status === "SENT" ? "bg-blue-100 text-blue-800" :
                            "bg-slate-100 text-slate-700"
                          }`}>{sr.status}</span>
                        </td>
                        <td>{sr.signers?.map(s => s.name).join(", ") || "—"}</td>
                        <td>{sr.sentAt ? fmtD(sr.sentAt) : "—"}</td>
                        <td>{fmtD(sr.createdAt)}</td>
                        <td>
                          {sr.status === "DRAFT" && (
                            <button
                              onClick={() => handleSendSigReq(sr.id)}
                              disabled={sendingSigReqId === sr.id}
                              className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50 font-medium"
                            >
                              {sendingSigReqId === sr.id ? "Sending…" : "Send"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            </Panel>
          )}

          {/* PDF Artifact */}
          {(lease.draftPdfStorageKey || lease.signedPdfStorageKey) && (
            <Panel title="PDF Artifacts">
              <div className="space-y-3">
                {lease.draftPdfStorageKey && (
                  <div>
                    <p className="text-sm font-medium text-slate-700">📄 Draft PDF</p>
                    <a
                      href={`/api/leases/${id}/generate-pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      Download draft PDF
                    </a>
                    <p className="text-xs text-slate-400">SHA-256: {lease.draftPdfSha256 || "—"}</p>
                  </div>
                )}
                {lease.signedPdfStorageKey && (
                  <div>
                    <p className="text-sm font-medium text-green-700">✅ Signed PDF</p>
                    <a
                      href={`/api/leases/${id}/generate-pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      Download signed PDF
                    </a>
                    <p className="text-xs text-slate-400">SHA-256: {lease.signedPdfSha256 || "—"}</p>
                  </div>
                )}
              </div>
            </Panel>
          )}

          {/* Deposit Tracking */}
          {lease.depositChf > 0 && (
            <Panel title="💰 Deposit Tracking">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Deposit: <span className="font-semibold">CHF {lease.depositChf}.-</span></p>
                    <p className="text-xs text-slate-400">Due: {lease.depositDueRule === "AT_SIGNATURE" ? "At signature" : lease.depositDueRule === "BY_START" ? "By lease start" : lease.depositDueDate?.split("T")[0] || "—"}</p>
                  </div>
                  {lease.depositPaidAt ? (
                    <div className="text-right">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">✅ PAID</span>
                      <p className="text-xs text-slate-400 mt-1">{fmtD(lease.depositPaidAt)}</p>
                      {lease.depositConfirmedBy && <p className="text-xs text-slate-400">By: {lease.depositConfirmedBy}</p>}
                      {lease.depositBankRef && <p className="text-xs text-slate-400">Ref: {lease.depositBankRef}</p>}
                    </div>
                  ) : (
                    <button onClick={handleConfirmDeposit} disabled={!!actionLoading}
                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                      {actionLoading === "confirm-deposit" ? "..." : "Confirm Payment"}
                    </button>
                  )}
                </div>
            </Panel>
          )}

          {/* Lifecycle Info */}
          {(lease.activatedAt || lease.terminatedAt || lease.archivedAt) && (
            <Panel title="📋 Lifecycle">
              <div className="space-y-2">
                {lease.activatedAt && (
                  <p className="text-sm"><span className="text-emerald-600 font-medium">⚡ Activated:</span> {fmtD(lease.activatedAt)}</p>
                )}
                {lease.terminatedAt && (
                  <div>
                    <p className="text-sm"><span className="text-orange-600 font-medium">📋 Terminated:</span> {fmtD(lease.terminatedAt)}</p>
                    {lease.terminationReason && <p className="text-xs text-slate-500 ml-6">Reason: {lease.terminationReason}</p>}
                    {lease.terminationNotice && <p className="text-xs text-slate-500 ml-6">Notice: {lease.terminationNotice}</p>}
                  </div>
                )}
                {lease.archivedAt && (
                  <p className="text-sm"><span className="text-slate-600 font-medium">📦 Archived:</span> {fmtD(lease.archivedAt)}</p>
                )}
              </div>
            </Panel>
          )}

          {/* Billing Schedule */}
          {(billingSchedule || (isActive && !billingScheduleLoading)) && (
            <Panel title="🔄 Recurring Billing">
              {billingScheduleLoading ? (
                <p className="text-sm text-slate-500">Loading…</p>
              ) : !billingSchedule ? (
                <p className="text-sm text-slate-500">No recurring billing schedule for this lease.</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        billingSchedule.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" :
                        billingSchedule.status === "PAUSED" ? "bg-yellow-100 text-yellow-800" :
                        "bg-slate-100 text-slate-700"
                      }`}>{billingSchedule.status}</span>
                      <span className="text-sm text-slate-600">Anchor day: {billingSchedule.anchorDay}</span>
                    </div>
                    <div className="flex gap-2">
                      {billingSchedule.status === "ACTIVE" && (
                        <button onClick={() => handleBillingAction("pause")} disabled={!!billingAction}
                          className="px-3 py-1 text-xs font-medium rounded border border-yellow-300 text-yellow-700 hover:bg-yellow-50 disabled:opacity-50">
                          {billingAction === "pause" ? "…" : "Pause"}
                        </button>
                      )}
                      {billingSchedule.status === "PAUSED" && (
                        <button onClick={() => handleBillingAction("resume")} disabled={!!billingAction}
                          className="px-3 py-1 text-xs font-medium rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
                          {billingAction === "resume" ? "…" : "Resume"}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Base rent</p>
                      <p className="font-medium">CHF {(billingSchedule.baseRentCents / 100).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Charges</p>
                      <p className="font-medium">CHF {(billingSchedule.totalChargesCents / 100).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Next period</p>
                      <p className="font-medium">{billingSchedule.nextPeriodStart ? new Date(billingSchedule.nextPeriodStart).toLocaleDateString("de-CH") : "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Last generated</p>
                      <p className="font-medium">{billingSchedule.lastGeneratedPeriod ? new Date(billingSchedule.lastGeneratedPeriod).toLocaleDateString("de-CH") : "—"}</p>
                    </div>
                  </div>
                  {billingSchedule.completedAt && (
                    <p className="text-xs text-slate-500">
                      Completed: {fmtD(billingSchedule.completedAt)}
                      {billingSchedule.completionReason ? ` (${billingSchedule.completionReason})` : ""}
                    </p>
                  )}
                </div>
              )}
            </Panel>
          )}

          {/* Charge Reconciliations */}
          {(lease.status === "ACTIVE" || lease.status === "TERMINATED" || reconciliations.length > 0) && (
            <Panel title="📊 Charge Reconciliations">
              {reconLoading ? (
                <p className="text-sm text-slate-500">Loading…</p>
              ) : (
                <div>
                  {reconciliations.length > 0 && (
                    <div className="overflow-x-auto mb-4">
                      <table className="w-full text-sm">
                        <thead className="text-left text-xs text-muted-foreground uppercase border-b">
                          <tr>
                            <th className="py-2 pr-4">Year</th>
                            <th className="py-2 pr-4">Status</th>
                            <th className="py-2 pr-4 text-right">ACOMPTE</th>
                            <th className="py-2 pr-4 text-right">Actual</th>
                            <th className="py-2 pr-4 text-right">Balance</th>
                            <th className="py-2 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reconciliations.map((r) => (
                            <tr key={r.id} className="border-b last:border-0">
                              <td className="py-2 pr-4 font-medium">{r.fiscalYear}</td>
                              <td className="py-2 pr-4">
                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                  r.status === "DRAFT" ? "bg-blue-100 text-blue-800" :
                                  r.status === "FINALIZED" ? "bg-amber-100 text-amber-800" :
                                  "bg-emerald-100 text-emerald-800"
                                }`}>{r.status}</span>
                              </td>
                              <td className="py-2 pr-4 text-right tabular-nums">{(r.totalAcomptePaidCents / 100).toFixed(2)}</td>
                              <td className="py-2 pr-4 text-right tabular-nums">{(r.totalActualCostsCents / 100).toFixed(2)}</td>
                              <td className={`py-2 pr-4 text-right tabular-nums ${
                                r.balanceCents > 0 ? "text-red-600" : r.balanceCents < 0 ? "text-emerald-600" : ""
                              }`}>{r.balanceCents > 0 ? "+" : ""}{(r.balanceCents / 100).toFixed(2)}</td>
                              <td className="py-2 text-right">
                                <a href={`/manager/charge-reconciliations/${r.id}`}
                                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">
                                  {r.status === "DRAFT" ? "Edit" : "View"}
                                </a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {reconciliations.length === 0 && !showCreateRecon && (
                    <p className="text-sm text-slate-500 mb-3">No charge reconciliations for this lease yet.</p>
                  )}
                  {showCreateRecon ? (
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium">Fiscal year:</label>
                      <input
                        type="number"
                        className="w-24 border rounded px-2 py-1 text-sm"
                        value={reconYear}
                        onChange={(e) => setReconYear(parseInt(e.target.value, 10) || new Date().getFullYear() - 1)}
                      />
                      <button
                        onClick={handleCreateRecon}
                        disabled={reconCreating}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >{reconCreating ? "Creating…" : "Create"}</button>
                      <button
                        onClick={() => setShowCreateRecon(false)}
                        className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                      >Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowCreateRecon(true)}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >+ New Reconciliation</button>
                  )}
                </div>
              )}
            </Panel>
          )}

          {/* Rent Adjustments */}
          {(lease.status === "ACTIVE" || rentAdjustments.length > 0) && (
            <Panel title="📈 Rent Adjustments">
              <div className="space-y-3">
                {rentAdjustments.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Type</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Effective</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Status</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500">Old</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500">New</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500">Change</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {rentAdjustments.map((a) => {
                          const fmtC = (c) => (c / 100).toLocaleString("de-CH", { style: "currency", currency: "CHF" });
                          return (
                            <tr key={a.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2">{a.adjustmentType === "CPI_INDEXATION" ? "CPI" : a.adjustmentType === "MANUAL" ? "Manual" : a.adjustmentType}</td>
                              <td className="px-3 py-2">{new Date(a.effectiveDate).toLocaleDateString("de-CH")}</td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${a.status === "DRAFT" ? "bg-yellow-100 text-yellow-800" : a.status === "APPROVED" ? "bg-blue-100 text-blue-800" : a.status === "APPLIED" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                                  {a.status}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right">{fmtC(a.previousRentCents)}</td>
                              <td className="px-3 py-2 text-right font-semibold">{fmtC(a.newRentCents)}</td>
                              <td className={`px-3 py-2 text-right ${a.adjustmentCents > 0 ? "text-red-600" : a.adjustmentCents < 0 ? "text-green-600" : ""}`}>
                                {a.adjustmentCents > 0 ? "+" : ""}{fmtC(a.adjustmentCents)}
                              </td>
                              <td className="px-3 py-2">
                                <a href={`/manager/rent-adjustments/${a.id}`} className="text-indigo-600 hover:underline text-sm">
                                  {a.status === "DRAFT" ? "Edit" : "View"}
                                </a>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {rentAdjustments.length === 0 && !showComputeAdj && (
                  <p className="text-sm text-slate-500 mb-3">No rent adjustments for this lease yet.</p>
                )}

                {/* Compute CPI Indexation form */}
                {lease.indexClauseType && lease.indexClauseType !== "NONE" ? (
                  showComputeAdj ? (
                    <div className="flex gap-2 items-end flex-wrap">
                      <div>
                        <label className="text-xs text-gray-500 block">Current CPI</label>
                        <input
                          type="number"
                          step="0.1"
                          value={adjCpiNew}
                          onChange={(e) => setAdjCpiNew(e.target.value)}
                          className="w-28 border rounded px-2 py-1 text-sm"
                          placeholder="e.g. 108.5"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block">Effective Date</label>
                        <input
                          type="date"
                          value={adjEffective}
                          onChange={(e) => setAdjEffective(e.target.value)}
                          className="border rounded px-2 py-1 text-sm"
                        />
                      </div>
                      <button
                        onClick={handleComputeIndexation}
                        disabled={adjComputing || !adjCpiNew || !adjEffective}
                        className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {adjComputing ? "Computing…" : "Compute Indexation"}
                      </button>
                      <button
                        onClick={() => setShowComputeAdj(false)}
                        className="px-3 py-1 text-sm bg-gray-200 text-gray-600 rounded"
                      >Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowComputeAdj(true)}
                      className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
                    >+ Compute CPI Indexation</button>
                  )
                ) : (
                  <p className="text-xs text-slate-400">
                    Index clause: NONE — set the lease index clause type and CPI base to enable automatic indexation.
                  </p>
                )}
              </div>
            </Panel>
          )}

          {/* Invoices */}
          {(invoices.length > 0 || lease.status !== "DRAFT") && (
            <Panel title={`💰 Invoices (${invoices.length})`} bodyClassName={invoices.length > 0 ? "p-0" : undefined}>
              {invoices.length === 0 ? (
                <p className="text-sm text-slate-500">No invoices linked to this lease yet.</p>
              ) : (
                  <table className="inline-table">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map(inv => (
                        <tr key={inv.id}>
                          <td>
                            <Link href={`/manager/finance/invoices/${inv.id}`} className="text-indigo-600 hover:underline">
                              {inv.description || "—"}
                            </Link>
                          </td>
                          <td className="cell-bold">CHF {inv.totalAmountChf?.toFixed(2) || "—"}</td>
                          <td>
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                              inv.status === "PAID" ? "bg-green-100 text-green-800" :
                              inv.status === "APPROVED" ? "bg-blue-100 text-blue-800" :
                              "bg-slate-100 text-slate-700"
                            }`}>{inv.status}</span>
                          </td>
                          <td>{fmtD(inv.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              )}
            </Panel>
          )}
        </PageContent>

        {/* Ready to Sign Modal */}
        {showSignModal && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold mb-4">Send for Signature</h3>
              <p className="text-sm text-slate-600 mb-4">
                This will send the lease for signature and create a signature request.
                The lease will no longer be editable.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Signature Level</label>
                <select value={signLevel} onChange={e => setSignLevel(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm">
                  <option value="SES">SES — Simple Electronic Signature</option>
                  <option value="AES">AES — Advanced Electronic Signature</option>
                  <option value="QES">QES — Qualified Electronic Signature</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowSignModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
                <button onClick={handleReadyToSign}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Terminate Lease Modal */}
        {showTerminateModal && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold mb-4">Terminate Lease</h3>
              <p className="text-sm text-slate-600 mb-4">
                This will terminate the active lease. Please provide a reason.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
                <select value={terminateReason} onChange={e => setTerminateReason(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm">
                  <option value="MUTUAL">Mutual agreement</option>
                  <option value="TENANT_NOTICE">Tenant notice</option>
                  <option value="LANDLORD_NOTICE">Landlord notice</option>
                  <option value="END_OF_TERM">End of fixed term</option>
                  <option value="BREACH">Breach of contract</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Notice period / notes (optional)</label>
                <textarea value={terminateNotice} onChange={e => setTerminateNotice(e.target.value)}
                  rows={3} placeholder="e.g. 3 months notice from 01.04.2026"
                  className="w-full border rounded-md px-3 py-2 text-sm" />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowTerminateModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
                <button onClick={handleTerminate} disabled={!!actionLoading}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
                  {actionLoading === "terminate" ? "Terminating..." : "Confirm Termination"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Invoice Modal */}
        {showInvoiceModal && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold mb-4">Create Lease Invoice</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Type</label>
                <select value={invoiceType} onChange={e => setInvoiceType(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm">
                  <option value="DEPOSIT">Deposit</option>
                  <option value="RENT">Rent</option>
                  <option value="CHARGES">Charges</option>
                  <option value="REPAIR">Repair</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount (CHF) *</label>
                <input type="number" value={invoiceAmount} onChange={e => setInvoiceAmount(e.target.value)}
                  min="0.01" step="0.01" placeholder="0.00"
                  className="w-full border rounded-md px-3 py-2 text-sm" />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
                <input type="text" value={invoiceDesc} onChange={e => setInvoiceDesc(e.target.value)}
                  placeholder="e.g. Deposit for lease starting 01.04.2026"
                  className="w-full border rounded-md px-3 py-2 text-sm" />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowInvoiceModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
                <button onClick={handleCreateInvoice} disabled={!!actionLoading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {actionLoading === "invoices" ? "Creating..." : "Create Invoice"}
                </button>
              </div>
            </div>
          </div>
        )}
      </PageShell>
    </AppShell>
  );
}
