import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../../components/AppShell";
import Badge from "../../../components/ui/Badge";
import { invoiceVariant } from "../../../lib/statusVariants";
import { formatDate, formatChf } from "../../../lib/format";
import { tenantFetch } from "../../../lib/api";
import { cn } from "../../../lib/utils";

export default function TenantInvoiceDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [session, setSession] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [qrBill, setQrBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qrLoading, setQrLoading] = useState(false);
  const [error, setError] = useState(null);
  const [qrError, setQrError] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("tenantSession");
    if (!raw) { router.push("/tenant"); return; }
    try { setSession(JSON.parse(raw)); } catch { router.push("/tenant"); }
  }, [router]);

  // Fetch invoice list and find matching one
  useEffect(() => {
    if (!session?.tenant?.id || !id) return;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await tenantFetch("/api/tenant-portal/invoices");
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error?.message || "Failed to load invoice");
          return;
        }
        const found = (data.data || []).find((inv) => inv.id === id);
        if (!found) {
          setError("Invoice not found");
          return;
        }
        setInvoice(found);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [session, id]);

  // Fetch QR-bill data
  useEffect(() => {
    if (!invoice?.id) return;
    setQrLoading(true);
    setQrError(null);
    (async () => {
      try {
        const res = await tenantFetch(
          `/api/tenant-portal/invoices/${invoice.id}/qr-bill`
        );
        const data = await res.json();
        if (!res.ok) {
          setQrError(data?.error?.message || "QR-bill not available");
          return;
        }
        setQrBill(data.data);
      } catch (e) {
        setQrError(String(e));
      } finally {
        setQrLoading(false);
      }
    })();
  }, [invoice?.id]);

  if (!session) {
    return (
      <AppShell role="TENANT">
        <div className="main-container">
          <p className="subtle">Loading…</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell role="TENANT">
      <div className="main-container max-w-2xl mx-auto">
        {/* Back link */}
        <Link
          href="/tenant/invoices"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          ← Back to invoices
        </Link>

        {error && <div className="notice notice-err mb-4">{error}</div>}

        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading invoice…</div>
        ) : !invoice ? null : (
          <>
            {/* Invoice header */}
            <div className="card p-6 mb-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">
                    {invoice.description}
                  </h1>
                  {invoice.invoiceNumber && (
                    <p className="text-sm text-slate-500 mt-1">
                      Invoice #{invoice.invoiceNumber}
                    </p>
                  )}
                </div>
                <Badge variant={invoiceVariant(invoice.status)}>
                  {invoice.status}
                </Badge>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Amount</p>
                  <p className="font-semibold text-lg">
                    {formatChf(invoice.totalAmountChf)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Currency</p>
                  <p className="font-medium">{invoice.currency || "CHF"}</p>
                </div>
                {invoice.issueDate && (
                  <div>
                    <p className="text-slate-500">Issue Date</p>
                    <p className="font-medium">{formatDate(invoice.issueDate)}</p>
                  </div>
                )}
                {invoice.dueDate && (
                  <div>
                    <p className="text-slate-500">Due Date</p>
                    <p className={cn(
                      "font-medium",
                      new Date(invoice.dueDate) < new Date() && invoice.status !== "PAID" && "text-red-600"
                    )}>
                      {formatDate(invoice.dueDate)}
                    </p>
                  </div>
                )}
                {invoice.paidAt && (
                  <div>
                    <p className="text-slate-500">Paid</p>
                    <p className="font-medium text-green-600">
                      {formatDate(invoice.paidAt)}
                    </p>
                  </div>
                )}
                {invoice.unit && (
                  <div>
                    <p className="text-slate-500">Property</p>
                    <p className="font-medium">
                      {invoice.unit.building?.name || "Property"}
                      {invoice.unit.unitNumber ? ` — Unit ${invoice.unit.unitNumber}` : ""}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* QR-Bill payment slip */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold mb-4">Payment QR Code</h2>

              {qrLoading ? (
                <div className="text-center py-8 text-slate-500">
                  Generating QR code…
                </div>
              ) : qrError ? (
                <div className="text-center py-8">
                  <p className="text-slate-400 text-3xl mb-2">📄</p>
                  <p className="text-sm text-slate-500">{qrError}</p>
                </div>
              ) : qrBill ? (
                <div className="space-y-4">
                  {/* QR Code */}
                  <div className="flex justify-center">
                    <div
                      className="border border-slate-200 rounded-lg p-4 bg-white"
                      dangerouslySetInnerHTML={{ __html: qrBill.qrCodeSVG }}
                    />
                  </div>

                  {/* Payment details */}
                  <div className="bg-slate-50 rounded-lg p-4 text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Payable to</span>
                      <span className="font-medium text-right">{qrBill.creditorName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">IBAN</span>
                      <span className="font-mono text-xs">
                        {qrBill.creditorIban?.replace(/(.{4})/g, "$1 ").trim()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Reference</span>
                      <span className="font-mono text-xs break-all">{qrBill.reference}</span>
                    </div>
                    {qrBill.referenceType && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Reference type</span>
                        <span className="font-medium">{qrBill.referenceType}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-500">Amount</span>
                      <span className="font-semibold">CHF {qrBill.amount}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 text-center">
                    Scan this QR code with your banking app to pay this invoice.
                  </p>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
