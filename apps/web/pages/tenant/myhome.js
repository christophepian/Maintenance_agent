import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import Badge from "../../components/ui/Badge";
import { leaseVariant, invoiceVariant } from "../../lib/statusVariants";
import { formatDate, formatChf } from "../../lib/format";
import { tenantFetch } from "../../lib/api";
import TenantPicker from "../../components/TenantPicker";
import { withTranslations } from "../../lib/i18n";
import { useTranslation } from "next-i18next";

const LEASE_STATUS_LABELS = {
  DRAFT: "Draft",
  READY_TO_SIGN: "Ready to Sign",
  SIGNED: "Signed",
  ACTIVE: "Active",
  TERMINATED: "Terminated",
  CANCELLED: "Cancelled",
};

export default function MyHomePage() {
  const { t } = useTranslation("tenant");
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [leases, setLeases] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [leasesLoading, setLeasesLoading] = useState(true);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [leasesError, setLeasesError] = useState(null);
  const [invoicesError, setInvoicesError] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("tenantSession");
    if (raw) {
      try { setSession(JSON.parse(raw)); return; } catch { /* fall through */ }
    }
    if (localStorage.getItem("authToken") || sessionStorage.getItem("authToken")) {
      setSession({ tenant: {}, unit: null, building: null });
      return;
    }
    router.push("/tenant");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchLeases = useCallback(async () => {
    if (!session) { setLeasesLoading(false); return; }
    setLeasesLoading(true);
    setLeasesError(null);
    try {
      const res = await tenantFetch("/api/tenant-portal/leases");
      const data = await res.json();
      if (!res.ok) { setLeasesError(data?.error?.message || "Failed to load leases"); return; }
      setLeases(data.data || []);
    } catch (e) {
      setLeasesError(String(e));
    } finally {
      setLeasesLoading(false);
    }
  }, [session]);

  const fetchInvoices = useCallback(async () => {
    if (!session) { setInvoicesLoading(false); return; }
    setInvoicesLoading(true);
    setInvoicesError(null);
    try {
      const res = await tenantFetch("/api/tenant-portal/invoices");
      const data = await res.json();
      if (!res.ok) { setInvoicesError(data?.error?.message || "Failed to load invoices"); return; }
      setInvoices(data.data || []);
    } catch (e) {
      setInvoicesError(String(e));
    } finally {
      setInvoicesLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchLeases();
    fetchInvoices();
    const interval = setInterval(fetchLeases, 15_000);
    function handleVisibility() {
      if (document.visibilityState === "visible") { fetchLeases(); fetchInvoices(); }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchLeases, fetchInvoices]);

  function handleTenantSwitch() {
    const raw = localStorage.getItem("tenantSession");
    if (raw) {
      try { setSession(JSON.parse(raw)); } catch { /* ignore */ }
    }
  }

  // Invoice summary stats
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
          <p className="subtle">{t("tenant:leasesIndex.text.loadingSession")}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell role="TENANT">
      <div className="main-container">
        <TenantPicker onSelect={handleTenantSwitch} />

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">{t("tenant:nav.myHome")}</h1>
          <span className="text-sm text-slate-500">
            {session.unit?.unitNumber ? `Unit ${session.unit.unitNumber}` : ""}
            {session.building?.address ? ` · ${session.building.address}` : ""}
          </span>
        </div>

        {/* ── Lease section ── */}
        <div className="mb-2 flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            {t("tenant:nav.leases")}
          </span>
          <div className="flex-1 border-t border-slate-200" />
        </div>

        {leasesError && <div className="notice notice-err mb-4">{leasesError}</div>}

        {leasesLoading ? (
          <div className="text-center py-6 text-slate-500 mb-6">{t("tenant:leasesIndex.text.loadingLeases")}</div>
        ) : leases.length === 0 ? (
          <div className="card p-8 text-center mb-6">
            <p className="text-slate-500">{t("tenant:leasesIndex.text.noLeasesFound")}</p>
            <p className="text-slate-400 text-sm mt-1">
              Your property manager has not yet assigned any leases to your unit.
            </p>
          </div>
        ) : (
          <div className="space-y-4 mb-6">
            {leases.map((lease) => (
              <div
                key={lease.id}
                className="card p-4 hover:shadow-md transition-shadow cursor-pointer border"
                onClick={() => router.push(`/tenant/leases/${lease.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-lg">
                      {lease.unit?.building?.name || "Property"} — Unit{" "}
                      {lease.unit?.unitNumber || "?"}
                    </div>
                    <div className="text-sm text-slate-500 mt-1">
                      {lease.objectType === "APPARTEMENT"
                        ? "Apartment"
                        : lease.objectType === "MAISON"
                        ? "House"
                        : lease.objectType}
                      {lease.roomsCount ? ` · ${lease.roomsCount} rooms` : ""}
                    </div>
                    <div className="text-sm text-slate-500">
                      From {formatDate(lease.startDate)}
                      {lease.endDate ? ` to ${formatDate(lease.endDate)}` : " (indefinite)"}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={leaseVariant(lease.status)}>
                      {LEASE_STATUS_LABELS[lease.status] || lease.status}
                    </Badge>
                    <div className="text-sm font-medium mt-2">
                      {formatChf(lease.rentTotalChf)}<span className="text-slate-400">{t("tenant:leasesIndex.text.mo")}</span>
                    </div>
                  </div>
                </div>

                {lease.status === "READY_TO_SIGN" && (
                  <div className="mt-3 pt-3 border-t border-yellow-200 bg-yellow-50 -mx-4 -mb-4 px-4 py-3 rounded-b">
                    <span className="text-yellow-700 text-sm font-medium">
                      ⚡ Action required — Please review and sign this lease
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Invoices section ── */}
        <div className="mb-2 flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            {t("tenant:nav.invoices")}
          </span>
          <div className="flex-1 border-t border-slate-200" />
        </div>

        {invoicesError && <div className="notice notice-err mb-4">{invoicesError}</div>}

        {invoices.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <div className="card p-4 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wide">{t("tenant:invoices.text.totalInvoices")}</p>
              <p className="text-2xl font-bold mt-1">{invoices.length}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wide">{t("tenant:invoices.text.outstanding")}</p>
              <p className="text-2xl font-bold mt-1 text-blue-700">{formatChf(totalDue)}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wide">{t("tenant:invoices.text.paid")}</p>
              <p className="text-2xl font-bold mt-1 text-green-700">{formatChf(totalPaid)}</p>
            </div>
          </div>
        )}

        {invoicesLoading ? (
          <div className="text-center py-6 text-slate-500">{t("tenant:invoices.text.loadingInvoices")}</div>
        ) : invoices.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-slate-400 text-lg mb-2">🧾</p>
            <p className="text-slate-500">{t("tenant:invoices.text.noInvoicesYet")}</p>
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
                      {inv.invoiceNumber && <span>#{inv.invoiceNumber}</span>}
                      <span>Created {formatDate(inv.createdAt)}</span>
                      {inv.dueDate && <span>Due {formatDate(inv.dueDate)}</span>}
                      {inv.paidAt && (
                        <span className="text-green-600">Paid {formatDate(inv.paidAt)}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <p className="text-lg font-bold">{formatChf(inv.totalAmountChf)}</p>
                    <Badge variant={invoiceVariant(inv.status)} className="mt-1">
                      {inv.status}
                    </Badge>
                  </div>
                </div>

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

export const getStaticProps = withTranslations(["common", "tenant"]);
