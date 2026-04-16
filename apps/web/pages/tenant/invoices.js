import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import Badge from "../../components/ui/Badge";
import { invoiceVariant } from "../../lib/statusVariants";
import { formatDate, formatChf } from "../../lib/format";
import { tenantFetch } from "../../lib/api";
import TenantPicker from "../../components/TenantPicker";
import { cn } from "../../lib/utils";

export default function TenantInvoicesPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("tenantSession");
    if (!raw) { router.push("/tenant"); return; }
    try { setSession(JSON.parse(raw)); } catch { router.push("/tenant"); }
  }, [router]);

  const fetchInvoices = useCallback(async () => {
    if (!session?.tenant?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await tenantFetch(
        `/api/tenant-portal/invoices`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "Failed to load invoices");
        return;
      }
      setInvoices(data.data || []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Summary stats
  const totalDue = invoices
    .filter((i) => i.status === "ISSUED" || i.status === "APPROVED")
    .reduce((sum, i) => sum + (i.totalAmountChf || 0), 0);
  const totalPaid = invoices
    .filter((i) => i.status === "PAID")
    .reduce((sum, i) => sum + (i.totalAmountChf || 0), 0);

  if (!session) {
    return (
      <AppShell role="TENANT">
        <div className="main-container">
          <p className="subtle">Loading…</p>
        </div>
      </AppShell>
    );
  }

  function handleTenantSwitch() {
    const raw = localStorage.getItem("tenantSession");
    if (raw) {
      try { setSession(JSON.parse(raw)); } catch { /* ignore */ }
    }
  }

  return (
    <AppShell role="TENANT">
      <div className="main-container">
        <TenantPicker onSelect={handleTenantSwitch} />
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">My Invoices</h1>
          <span className="text-sm text-slate-500">
            Unit {session.unit?.unitNumber}
            {session.building ? ` \u00b7 ${session.building.address}` : ""}
          </span>
        </div>

        {error && <div className="notice notice-err mb-4">{error}</div>}

        {/* Summary cards */}
        {invoices.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="card p-4 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Total Invoices</p>
              <p className="text-2xl font-bold mt-1">{invoices.length}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Outstanding</p>
              <p className="text-2xl font-bold mt-1 text-blue-700">{formatChf(totalDue)}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Paid</p>
              <p className="text-2xl font-bold mt-1 text-green-700">{formatChf(totalPaid)}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-slate-500">Loading invoices…</div>
        ) : invoices.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-slate-400 text-lg mb-2">🧾</p>
            <p className="text-slate-500">No invoices yet</p>
            <p className="text-slate-400 text-sm mt-1">
              Invoices for rent and other charges will appear here once your lease is active.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((inv) => (
              <Link
                key={inv.id}
                href={`/tenant/invoices/${inv.id}`}
                className="card p-4 border hover:shadow-md transition-shadow block"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate">
                      {inv.description}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      {inv.unit?.building?.name || "Property"}
                      {inv.unit?.unitNumber ? ` — Unit ${inv.unit.unitNumber}` : ""}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      {inv.invoiceNumber && (
                        <span>#{inv.invoiceNumber}</span>
                      )}
                      <span>Created {formatDate(inv.createdAt)}</span>
                      {inv.dueDate && (
                        <span>Due {formatDate(inv.dueDate)}</span>
                      )}
                      {inv.paidAt && (
                        <span className="text-green-600">
                          Paid {formatDate(inv.paidAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <p className="text-lg font-bold">
                      {formatChf(inv.totalAmountChf)}
                    </p>
                    <Badge variant={invoiceVariant(inv.status)} className="mt-1">
                      {inv.status}
                    </Badge>
                  </div>
                </div>

                {/* Due/action banner for outstanding invoices */}
                {(inv.status === "ISSUED" || inv.status === "APPROVED") && (
                  <div className="mt-3 pt-3 border-t border-blue-100 bg-blue-50 -mx-4 -mb-4 px-4 py-3 rounded-b text-sm text-blue-700">
                    💳 Payment due
                    {inv.dueDate ? ` by ${formatDate(inv.dueDate)}` : ""} —{" "}
                    {formatChf(inv.totalAmountChf)}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
