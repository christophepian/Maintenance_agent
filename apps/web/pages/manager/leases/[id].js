import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import { formatDate as fmtD } from "../../../lib/format";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Section from "../../../components/layout/Section";

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

  const isDraft = lease?.status === "DRAFT";
  const isSigned = lease?.status === "SIGNED";
  const isActive = lease?.status === "ACTIVE";
  const isTemplate = lease?.isTemplate === true;

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
              {(isDraft || isTemplate) && (
                <button onClick={handleSave} disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "Saving..." : "Save"}
                </button>
              )}
              <button onClick={handleGeneratePDF} disabled={pdfGenerating}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50">
                {pdfGenerating ? "Generating..." : "📄 Generate PDF"}
              </button>
              {isDraft && !isTemplate && (
                <button onClick={() => setShowSignModal(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                  ✍️ Ready to Sign
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
          {/* §1 — Parties */}
          <AccordionSection title="§1 — Parties (Bailleur & Locataire)" open={openSections.parties} onToggle={() => toggle("parties")}>
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">§1.1 Bailleresse / Bailleur</h4>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nom / Raison sociale"><Input value={lease.landlordName} onChange={v => updateField("landlordName", v)} disabled={!isDraft} /></Field>
                <Field label="Adresse"><Input value={lease.landlordAddress} onChange={v => updateField("landlordAddress", v)} disabled={!isDraft} /></Field>
                <Field label="NPA / Localité"><Input value={lease.landlordZipCity} onChange={v => updateField("landlordZipCity", v)} disabled={!isDraft} /></Field>
                <Field label="Téléphone"><Input value={lease.landlordPhone} onChange={v => updateField("landlordPhone", v)} disabled={!isDraft} /></Field>
                <Field label="E-mail"><Input value={lease.landlordEmail} onChange={v => updateField("landlordEmail", v)} disabled={!isDraft} /></Field>
                <Field label="Représenté(e) par"><Input value={lease.landlordRepresentedBy} onChange={v => updateField("landlordRepresentedBy", v)} disabled={!isDraft} /></Field>
              </div>

              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-6">§1.2 Locataire</h4>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nom *"><Input value={lease.tenantName} onChange={v => updateField("tenantName", v)} disabled={!isDraft} /></Field>
                <Field label="Adresse"><Input value={lease.tenantAddress} onChange={v => updateField("tenantAddress", v)} disabled={!isDraft} /></Field>
                <Field label="NPA / Localité"><Input value={lease.tenantZipCity} onChange={v => updateField("tenantZipCity", v)} disabled={!isDraft} /></Field>
                <Field label="Téléphone"><Input value={lease.tenantPhone} onChange={v => updateField("tenantPhone", v)} disabled={!isDraft} /></Field>
                <Field label="E-mail"><Input value={lease.tenantEmail} onChange={v => updateField("tenantEmail", v)} disabled={!isDraft} /></Field>
                <Field label="Co-locataire"><Input value={lease.coTenantName} onChange={v => updateField("coTenantName", v)} disabled={!isDraft} /></Field>
              </div>
            </div>
          </AccordionSection>

          {/* §2 — Object */}
          <AccordionSection title="§2 — Objet du bail" open={openSections.object} onToggle={() => toggle("object")}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type d'objet">
                <select value={lease.objectType || "APPARTEMENT"} onChange={e => updateField("objectType", e.target.value)} disabled={!isDraft}
                  className="w-full border rounded-md px-3 py-1.5 text-sm disabled:bg-slate-100">
                  <option value="APPARTEMENT">Appartement</option>
                  <option value="MAISON">Maison</option>
                  <option value="CHAMBRE_MEUBLEE">Chambre meublée</option>
                </select>
              </Field>
              <Field label="Nombre de pièces"><Input value={lease.roomsCount} onChange={v => updateField("roomsCount", v)} placeholder="3.5" disabled={!isDraft} /></Field>
              <Field label="Étage"><Input value={lease.floor} onChange={v => updateField("floor", v)} disabled={!isDraft} /></Field>
              <Field label="Adresse immeuble">
                <Input value={lease.buildingAddressLines?.join(", ")} disabled={true} />
              </Field>
            </div>
          </AccordionSection>

          {/* §3–4 — Dates & Termination */}
          <AccordionSection title="§3–4 — Durée & Résiliation" open={openSections.dates} onToggle={() => toggle("dates")}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Début du bail *"><Input type="date" value={lease.startDate?.split("T")[0]} onChange={v => updateField("startDate", v)} disabled={!isDraft} /></Field>
              <Field label="Durée déterminée">
                <select value={lease.isFixedTerm ? "true" : "false"} onChange={e => updateField("isFixedTerm", e.target.value === "true")} disabled={!isDraft}
                  className="w-full border rounded-md px-3 py-1.5 text-sm disabled:bg-slate-100">
                  <option value="false">Indéterminée</option>
                  <option value="true">Déterminée</option>
                </select>
              </Field>
              {lease.isFixedTerm && (
                <Field label="Fin du bail"><Input type="date" value={lease.endDate?.split("T")[0]} onChange={v => updateField("endDate", v)} disabled={!isDraft} /></Field>
              )}
              <Field label="Premier terme de résiliation"><Input type="date" value={lease.firstTerminationDate?.split("T")[0]} onChange={v => updateField("firstTerminationDate", v)} disabled={!isDraft} /></Field>
              <Field label="Délai de résiliation">
                <select value={lease.noticeRule || "3_MONTHS"} onChange={e => updateField("noticeRule", e.target.value)} disabled={!isDraft}
                  className="w-full border rounded-md px-3 py-1.5 text-sm disabled:bg-slate-100">
                  <option value="3_MONTHS">3 mois</option>
                  <option value="EXTENDED">Prolongé</option>
                  <option value="2_WEEKS">2 semaines</option>
                </select>
              </Field>
              <Field label="Termes de résiliation">
                <select value={lease.terminationDatesRule || "END_OF_MONTH_EXCEPT_31_12"} onChange={e => updateField("terminationDatesRule", e.target.value)} disabled={!isDraft}
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
              <Field label="Loyer net (CHF/mois) *"><Input type="number" value={lease.netRentChf} onChange={v => updateField("netRentChf", v)} disabled={!isDraft} /></Field>
              <Field label="Loyer garage (CHF/mois)"><Input type="number" value={lease.garageRentChf} onChange={v => updateField("garageRentChf", v)} disabled={!isDraft} /></Field>
              <Field label="Autres prestations (CHF/mois)"><Input type="number" value={lease.otherServiceRentChf} onChange={v => updateField("otherServiceRentChf", v)} disabled={!isDraft} /></Field>
              <Field label="Total charges (CHF/mois)"><Input type="number" value={lease.chargesTotalChf} onChange={v => updateField("chargesTotalChf", v)} disabled={!isDraft} /></Field>
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
              <Field label="Jour d'échéance"><Input type="number" value={lease.paymentDueDayOfMonth} onChange={v => updateField("paymentDueDayOfMonth", v)} placeholder="1" disabled={!isDraft} /></Field>
              <Field label="Bénéficiaire"><Input value={lease.paymentRecipient} onChange={v => updateField("paymentRecipient", v)} disabled={!isDraft} /></Field>
              <Field label="Institut financier"><Input value={lease.paymentInstitution} onChange={v => updateField("paymentInstitution", v)} disabled={!isDraft} /></Field>
              <Field label="N° de compte"><Input value={lease.paymentAccountNumber} onChange={v => updateField("paymentAccountNumber", v)} disabled={!isDraft} /></Field>
              <Field label="IBAN"><Input value={lease.paymentIban} onChange={v => updateField("paymentIban", v)} placeholder="CH..." disabled={!isDraft} /></Field>
              <Field label="Taux de référence"><Input value={lease.referenceRatePercent} onChange={v => updateField("referenceRatePercent", v)} placeholder="1.75" disabled={!isDraft} /></Field>
            </div>
          </AccordionSection>

          {/* §7 — Deposit */}
          <AccordionSection title="§7 — Garantie" open={openSections.deposit} onToggle={() => toggle("deposit")}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Montant de la garantie (CHF)"><Input type="number" value={lease.depositChf} onChange={v => updateField("depositChf", v)} disabled={!isDraft} /></Field>
              <Field label="Exigibilité">
                <select value={lease.depositDueRule || "AT_SIGNATURE"} onChange={e => updateField("depositDueRule", e.target.value)} disabled={!isDraft}
                  className="w-full border rounded-md px-3 py-1.5 text-sm disabled:bg-slate-100">
                  <option value="AT_SIGNATURE">À la signature</option>
                  <option value="BY_START">Au début du bail</option>
                  <option value="BY_DATE">À une date précise</option>
                </select>
              </Field>
              {lease.depositDueRule === "BY_DATE" && (
                <Field label="Date d'échéance"><Input type="date" value={lease.depositDueDate?.split("T")[0]} onChange={v => updateField("depositDueDate", v)} disabled={!isDraft} /></Field>
              )}
            </div>
          </AccordionSection>

          {/* §15 — Stipulations */}
          <AccordionSection title="§15 — Dispositions particulières & Annexes" open={openSections.stipulations} onToggle={() => toggle("stipulations")}>
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={lease.includesHouseRules || false} onChange={e => updateField("includesHouseRules", e.target.checked)} disabled={!isDraft} />
                Règlement de la maison joint en annexe
              </label>
              <Field label="Autres annexes" span={2}>
                <Input value={lease.otherAnnexesText} onChange={v => updateField("otherAnnexesText", v)} disabled={!isDraft} />
              </Field>
              <Field label="Dispositions particulières" span={2}>
                <textarea
                  value={lease.otherStipulations ?? ""}
                  onChange={e => updateField("otherStipulations", e.target.value)}
                  disabled={!isDraft}
                  rows={4}
                  className="w-full border rounded-md px-3 py-1.5 text-sm disabled:bg-slate-100"
                />
              </Field>
            </div>
          </AccordionSection>

          {/* Signature Requests */}
          {sigRequests.length > 0 && (
            <Section title="Signature Requests">
              <div className="bg-white rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Provider</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Level</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Signers</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sigRequests.map(sr => (
                      <tr key={sr.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">{sr.provider}</td>
                        <td className="px-4 py-3">{sr.level}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            sr.status === "SIGNED" ? "bg-green-100 text-green-800" :
                            sr.status === "SENT" ? "bg-blue-100 text-blue-800" :
                            "bg-slate-100 text-slate-700"
                          }`}>{sr.status}</span>
                        </td>
                        <td className="px-4 py-3">{sr.signers?.map(s => s.name).join(", ") || "—"}</td>
                        <td className="px-4 py-3">{fmtD(sr.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* PDF Artifact */}
          {(lease.draftPdfStorageKey || lease.signedPdfStorageKey) && (
            <Section title="PDF Artifacts">
              <div className="bg-white rounded-lg border p-4 space-y-3">
                {lease.draftPdfStorageKey && (
                  <div>
                    <p className="text-sm font-medium text-slate-700">📄 Draft PDF</p>
                    <p className="text-xs text-slate-500 font-mono">{lease.draftPdfStorageKey}</p>
                    <p className="text-xs text-slate-400">SHA-256: {lease.draftPdfSha256 || "—"}</p>
                  </div>
                )}
                {lease.signedPdfStorageKey && (
                  <div>
                    <p className="text-sm font-medium text-green-700">✅ Signed PDF</p>
                    <p className="text-xs text-slate-500 font-mono">{lease.signedPdfStorageKey}</p>
                    <p className="text-xs text-slate-400">SHA-256: {lease.signedPdfSha256 || "—"}</p>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Deposit Tracking */}
          {lease.depositChf > 0 && (
            <Section title="💰 Deposit Tracking">
              <div className="bg-white rounded-lg border p-4">
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
              </div>
            </Section>
          )}

          {/* Lifecycle Info */}
          {(lease.activatedAt || lease.terminatedAt || lease.archivedAt) && (
            <Section title="📋 Lifecycle">
              <div className="bg-white rounded-lg border p-4 space-y-2">
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
            </Section>
          )}

          {/* Invoices */}
          {(invoices.length > 0 || lease.status !== "DRAFT") && (
            <Section title={`💰 Invoices (${invoices.length})`}>
              {invoices.length === 0 ? (
                <p className="text-sm text-slate-500 bg-white rounded-lg border p-4">No invoices linked to this lease yet.</p>
              ) : (
                <div className="bg-white rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Description</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Amount</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {invoices.map(inv => (
                        <tr key={inv.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">{inv.description || "—"}</td>
                          <td className="px-4 py-3 font-medium">CHF {inv.totalAmountChf?.toFixed(2) || "—"}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                              inv.status === "PAID" ? "bg-green-100 text-green-800" :
                              inv.status === "APPROVED" ? "bg-blue-100 text-blue-800" :
                              "bg-slate-100 text-slate-700"
                            }`}>{inv.status}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-500">{fmtD(inv.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          )}
        </PageContent>

        {/* Ready to Sign Modal */}
        {showSignModal && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold mb-4">Mark Ready to Sign</h3>
              <p className="text-sm text-slate-600 mb-4">
                This will mark the lease as READY_TO_SIGN and create a signature request.
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
