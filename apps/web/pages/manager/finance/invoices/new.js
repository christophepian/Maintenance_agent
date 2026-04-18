import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../../components/AppShell";
import PageShell from "../../../../components/layout/PageShell";
import PageHeader from "../../../../components/layout/PageHeader";
import PageContent from "../../../../components/layout/PageContent";
import Panel from "../../../../components/layout/Panel";
import { authHeaders } from "../../../../lib/api";
import { formatChf } from "../../../../lib/format";

/* ─── Helpers ─────────────────────────────────────────────── */

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function in30DaysIso() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

function toDatetimeIso(dateStr) {
  if (!dateStr) return undefined;
  return new Date(dateStr + "T00:00:00.000Z").toISOString();
}

/* ─── Main Page ───────────────────────────────────────────── */

export default function NewInvoicePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Basic fields
  const [recipientName, setRecipientName] = useState("");
  const [recipientAddressLine1, setRecipientAddressLine1] = useState("");
  const [recipientAddressLine2, setRecipientAddressLine2] = useState("");
  const [recipientPostalCode, setRecipientPostalCode] = useState("");
  const [recipientCity, setRecipientCity] = useState("");
  const [recipientCountry, setRecipientCountry] = useState("CH");
  const [issueDate, setIssueDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState(in30DaysIso());
  const [description, setDescription] = useState("");
  const [vatRate, setVatRate] = useState("8.1");

  // Line items
  const [lineItems, setLineItems] = useState([
    { description: "", quantity: 1, unitPrice: "", vatRate: "8.1" },
  ]);

  // Jobs (for linking)
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState("");

  // Billing entities
  const [billingEntities, setBillingEntities] = useState([]);
  const [selectedBillingEntityId, setSelectedBillingEntityId] = useState("");

  // Load jobs and billing entities for dropdowns
  useEffect(() => {
    fetch("/api/jobs?limit=200", { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setJobs(d?.data || []))
      .catch(() => {});

    fetch("/api/billing-entities", { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setBillingEntities(d?.data || []))
      .catch(() => {});
  }, []);

  function addLineItem() {
    setLineItems((prev) => [...prev, { description: "", quantity: 1, unitPrice: "", vatRate: "8.1" }]);
  }

  function removeLineItem(index) {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateLineItem(index, field, value) {
    setLineItems((prev) => prev.map((li, i) => i === index ? { ...li, [field]: value } : li));
  }

  const computedTotal = lineItems.reduce((sum, li) => {
    const price = parseFloat(li.unitPrice) || 0;
    const qty = parseInt(li.quantity, 10) || 1;
    return sum + price * qty;
  }, 0);

  const computedVat = computedTotal * (parseFloat(vatRate) || 0) / 100;

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const validLineItems = lineItems
        .filter((li) => li.description.trim() && li.unitPrice)
        .map((li) => ({
          description: li.description.trim(),
          quantity: parseInt(li.quantity, 10) || 1,
          unitPrice: parseFloat(li.unitPrice) || 0,
          vatRate: parseFloat(li.vatRate) || 0,
        }));

      if (validLineItems.length === 0) {
        throw new Error("At least one line item with description and unit price is required.");
      }

      const body = {
        recipientName: recipientName.trim() || undefined,
        recipientAddressLine1: recipientAddressLine1.trim() || undefined,
        recipientAddressLine2: recipientAddressLine2.trim() || undefined,
        recipientPostalCode: recipientPostalCode.trim() || undefined,
        recipientCity: recipientCity.trim() || undefined,
        recipientCountry: recipientCountry.trim() || undefined,
        issueDate: toDatetimeIso(issueDate),
        dueDate: toDatetimeIso(dueDate),
        description: description.trim() || undefined,
        vatRate: parseFloat(vatRate) || 0,
        lineItems: validLineItems,
        direction: "OUTGOING",
        sourceChannel: "MANUAL",
        jobId: selectedJobId || undefined,
        issuerBillingEntityId: selectedBillingEntityId || undefined,
      };

      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message || "Failed to create invoice");
      }

      const data = await res.json();
      const newId = data?.data?.id;
      router.push(newId ? `/manager/finance/invoices/${newId}` : "/manager/finance/invoices");
    } catch (err) {
      setError(err.message || "Failed to create invoice");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader
          title="New Invoice"
          breadcrumbs={[
            { label: "Finance", href: "/manager/finance" },
            { label: "Invoices", href: "/manager/finance/invoices" },
          ]}
        />
        <PageContent>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 mb-4 flex items-center justify-between">
              <span className="text-sm text-red-700"><strong>Error:</strong> {error}</span>
              <button onClick={() => setError("")} className="text-xs text-red-500 hover:text-red-700 ml-4">Dismiss</button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Recipient */}
            <Panel title="Recipient">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Recipient Name *</label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Address Line 1 *</label>
                  <input
                    type="text"
                    value={recipientAddressLine1}
                    onChange={(e) => setRecipientAddressLine1(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Address Line 2</label>
                  <input
                    type="text"
                    value={recipientAddressLine2}
                    onChange={(e) => setRecipientAddressLine2(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Postal Code *</label>
                  <input
                    type="text"
                    value={recipientPostalCode}
                    onChange={(e) => setRecipientPostalCode(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">City *</label>
                  <input
                    type="text"
                    value={recipientCity}
                    onChange={(e) => setRecipientCity(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
                  <input
                    type="text"
                    value={recipientCountry}
                    onChange={(e) => setRecipientCountry(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </Panel>

            {/* Invoice details */}
            <Panel title="Invoice Details">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Issue Date</label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">VAT Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={vatRate}
                    onChange={(e) => setVatRate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                </div>
              </div>
            </Panel>

            {/* Linking */}
            <Panel title="Link to Record (optional)">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Job</label>
                  <select
                    value={selectedJobId}
                    onChange={(e) => setSelectedJobId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">— None —</option>
                    {jobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        #{j.id?.slice(0, 8)} — {j.description || j.request?.description || "Untitled"}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Billing Entity</label>
                  <select
                    value={selectedBillingEntityId}
                    onChange={(e) => setSelectedBillingEntityId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">— None —</option>
                    {billingEntities.map((be) => (
                      <option key={be.id} value={be.id}>
                        {be.name} ({be.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </Panel>

            {/* Line items */}
            <Panel title="Line Items">
              <div className="space-y-3">
                {lineItems.map((li, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      {idx === 0 && <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>}
                      <input
                        type="text"
                        placeholder="Item description"
                        value={li.description}
                        onChange={(e) => updateLineItem(idx, "description", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      {idx === 0 && <label className="block text-xs font-medium text-slate-500 mb-1">Qty</label>}
                      <input
                        type="number"
                        min="1"
                        value={li.quantity}
                        onChange={(e) => updateLineItem(idx, "quantity", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="col-span-3">
                      {idx === 0 && <label className="block text-xs font-medium text-slate-500 mb-1">Unit Price (CHF)</label>}
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={li.unitPrice}
                        onChange={(e) => updateLineItem(idx, "unitPrice", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div className="col-span-2 flex justify-end">
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLineItem(idx)}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 hover:bg-red-100 transition"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addLineItem}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
                >
                  + Add Line Item
                </button>
              </div>

              {/* Totals */}
              <div className="mt-4 border-t border-slate-200 pt-4">
                <div className="flex justify-end">
                  <div className="w-64 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Subtotal</span>
                      <span className="font-medium text-slate-900">{formatChf(computedTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">VAT ({vatRate || 0}%)</span>
                      <span className="font-medium text-slate-900">{formatChf(computedVat)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-1">
                      <span className="font-semibold text-slate-900">Total</span>
                      <span className="font-bold text-slate-900">{formatChf(computedTotal + computedVat)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Panel>

            {/* Submit */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => router.push("/manager/finance/invoices")}
                className="rounded-lg border border-slate-200 bg-white px-6 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-50"
              >
                {submitting ? "Creating…" : "Create Invoice"}
              </button>
            </div>
          </form>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
