import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import { tenantFetch } from "../../../lib/api";

import { cn } from "../../../lib/utils";
const STATUS_LABELS = {
  DRAFT: "Draft",
  READY_TO_SIGN: "Ready to Sign",
  SIGNED: "Signed",
  ACTIVE: "Active",
  TERMINATED: "Terminated",
  CANCELLED: "Cancelled",
};

const NOTICE_RULES = {
  "3_MONTHS": "3 months",
  EXTENDED: "Extended notice period",
  "2_WEEKS": "2 weeks",
};

export default function TenantLeaseDetailPage() {
  const router = useRouter();
  const { id: leaseId } = router.query;

  const [lease, setLease] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptConfirm, setAcceptConfirm] = useState(false);
  const [acceptResult, setAcceptResult] = useState(null);

  // Load tenant session
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("tenantSession");
    if (!raw) {
      router.push("/tenant");
      return;
    }
    try {
      setSession(JSON.parse(raw));
    } catch {
      router.push("/tenant");
    }
  }, [router]);

  // Fetch lease detail
  const fetchLease = useCallback(async () => {
    if (!session?.tenant?.id || !leaseId) return;
    setLoading(true);
    setError(null);
    try {
      const qs = `tenantId=${session.tenant.id}`;
      const res = await tenantFetch(`/api/tenant-portal/leases/${leaseId}?${qs}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || data?.error || "Failed to load lease");
        return;
      }
      setLease(data.data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [session, leaseId]);

  useEffect(() => {
    fetchLease();
  }, [fetchLease]);

  // Accept/sign handler
  async function handleAccept() {
    if (!session?.tenant?.id) return;
    setAccepting(true);
    setError(null);
    try {
      const res = await tenantFetch(`/api/tenant-portal/leases/${leaseId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: session.tenant.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || data?.error || "Failed to accept lease");
        return;
      }
      setAcceptResult(data.data);
      setLease(data.data.lease);
      setAcceptConfirm(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setAccepting(false);
    }
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  }

  function formatChf(amount) {
    if (amount == null) return "—";
    const str = Number(amount).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
    return `CHF ${str}`;
  }

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
      <div className="main-container max-w-3xl">
        {/* Back link */}
        <button
          onClick={() => router.push("/tenant/leases")}
          className="text-sm text-blue-600 hover:underline mb-4 inline-block"
        >
          ← Back to My Leases
        </button>

        {error && <div className="notice notice-err mb-4">{error}</div>}

        {acceptResult && (
          <div className="notice notice-ok mb-4">
            ✅ Lease signed and activated! Your first rent invoice has been generated.
            <div className="mt-2 flex gap-3">
              <button
                onClick={() => router.push("/tenant/leases")}
                className="text-sm text-blue-600 hover:underline"
              >
                View My Leases →
              </button>
              <button
                onClick={() => router.push("/tenant/invoices")}
                className="text-sm text-blue-600 hover:underline"
              >
                View My Invoices →
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-slate-500">Loading lease details…</div>
        ) : !lease ? (
          <div className="card p-8 text-center">
            <p className="text-slate-500">Lease not found or not accessible.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold">Lease Agreement</h1>
                <p className="text-slate-500 text-sm mt-1">
                  {lease.unit?.building?.name} — Unit {lease.unit?.unitNumber}
                </p>
              </div>
              <span
                className={cn("px-3 py-1 rounded-full text-sm font-medium", lease.status === "ACTIVE"
                    ? "bg-green-100 text-green-700"
                    : lease.status === "SIGNED"
                    ? "bg-green-100 text-green-700"
                    : lease.status === "READY_TO_SIGN"
                    ? "bg-yellow-100 text-yellow-700"
                    : lease.status === "TERMINATED"
                    ? "bg-orange-100 text-orange-700"
                    : lease.status === "CANCELLED"
                    ? "bg-red-100 text-red-700"
                    : "bg-slate-100 text-slate-600")}
              >
                {STATUS_LABELS[lease.status] || lease.status}
              </span>
            </div>

            {/* Accept Banner */}
            {lease.status === "READY_TO_SIGN" && !acceptResult && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📝</span>
                  <div className="flex-1">
                    <p className="font-semibold text-yellow-700">
                      This lease is awaiting your signature
                    </p>
                    <p className="text-sm text-yellow-700 mt-1">
                      Please review all details below before accepting.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Parties */}
            <section className="card p-5 mb-4">
              <h2 className="text-lg font-semibold mb-3 border-b pb-2">§ 1 — Parties</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 uppercase tracking-wide">Landlord</label>
                  <p className="font-medium">{lease.landlordName}</p>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 uppercase tracking-wide">Tenant</label>
                  <p className="font-medium">{lease.tenantName}</p>
                  {lease.coTenantName && (
                    <p className="text-sm text-slate-500">Co-tenant: {lease.coTenantName}</p>
                  )}
                </div>
              </div>
            </section>

            {/* Object */}
            <section className="card p-5 mb-4">
              <h2 className="text-lg font-semibold mb-3 border-b pb-2">§ 2 — Object</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 uppercase tracking-wide">Type</label>
                  <p>
                    {lease.objectType === "APPARTEMENT"
                      ? "Apartment"
                      : lease.objectType === "MAISON"
                      ? "House"
                      : lease.objectType}
                  </p>
                </div>
                {lease.roomsCount && (
                  <div>
                    <label className="block text-xs text-slate-500 uppercase tracking-wide">Rooms</label>
                    <p>{lease.roomsCount}</p>
                  </div>
                )}
                {lease.floor && (
                  <div>
                    <label className="block text-xs text-slate-500 uppercase tracking-wide">Floor</label>
                    <p>{lease.floor}</p>
                  </div>
                )}
              </div>
              {lease.unit?.building?.address && (
                <div className="mt-3">
                  <label className="block text-xs text-slate-500 uppercase tracking-wide">Address</label>
                  <p>{lease.unit.building.address}</p>
                </div>
              )}
            </section>

            {/* Dates & termination */}
            <section className="card p-5 mb-4">
              <h2 className="text-lg font-semibold mb-3 border-b pb-2">§ 3–4 — Duration & Termination</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 uppercase tracking-wide">Start Date</label>
                  <p>{formatDate(lease.startDate)}</p>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 uppercase tracking-wide">Term</label>
                  <p>{lease.isFixedTerm ? "Fixed term" : "Indefinite"}</p>
                </div>
                {lease.endDate && (
                  <div>
                    <label className="block text-xs text-slate-500 uppercase tracking-wide">End Date</label>
                    <p>{formatDate(lease.endDate)}</p>
                  </div>
                )}
                <div>
                  <label className="block text-xs text-slate-500 uppercase tracking-wide">Notice Period</label>
                  <p>{NOTICE_RULES[lease.noticeRule] || lease.noticeRule}</p>
                </div>
              </div>
            </section>

            {/* Rent & Charges */}
            <section className="card p-5 mb-4">
              <h2 className="text-lg font-semibold mb-3 border-b pb-2">§ 5–6 — Rent & Charges</h2>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">Net rent</span>
                  <span className="font-medium">{formatChf(lease.netRentChf)}</span>
                </div>
                {lease.garageRentChf != null && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Garage / parking</span>
                    <span>{formatChf(lease.garageRentChf)}</span>
                  </div>
                )}
                {lease.otherServiceRentChf != null && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Other services</span>
                    <span>{formatChf(lease.otherServiceRentChf)}</span>
                  </div>
                )}
                {lease.chargesTotalChf != null && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Charges (acompte)</span>
                    <span>{formatChf(lease.chargesTotalChf)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2 font-semibold text-lg">
                  <span>Total monthly</span>
                  <span>{formatChf(lease.rentTotalChf)}</span>
                </div>
              </div>
            </section>

            {/* Deposit */}
            {lease.depositChf != null && (
              <section className="card p-5 mb-4">
                <h2 className="text-lg font-semibold mb-3 border-b pb-2">§ 7 — Deposit</h2>
                <div className="flex justify-between">
                  <span className="text-slate-600">Security deposit</span>
                  <span className="font-medium">{formatChf(lease.depositChf)}</span>
                </div>
                <div className="text-sm text-slate-500 mt-1">
                  Due:{" "}
                  {lease.depositDueRule === "AT_SIGNATURE"
                    ? "At signature"
                    : lease.depositDueRule === "BY_START"
                    ? "By lease start"
                    : `By ${formatDate(lease.depositDueDate)}`}
                </div>
                {lease.depositPaidAt && (
                  <div className="mt-3 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <span className="text-green-600">✅</span>
                    <span className="text-sm text-green-700 font-medium">Deposit paid on {formatDate(lease.depositPaidAt)}</span>
                  </div>
                )}
              </section>
            )}

            {/* Other stipulations */}
            {lease.otherStipulations && (
              <section className="card p-5 mb-4">
                <h2 className="text-lg font-semibold mb-3 border-b pb-2">§ 15 — Other Stipulations</h2>
                <p className="whitespace-pre-wrap text-slate-700">{lease.otherStipulations}</p>
              </section>
            )}

            {/* House rules */}
            {lease.includesHouseRules && (
              <div className="text-sm text-slate-500 mb-4">
                📋 House rules are included as an annex to this lease.
              </div>
            )}

            {/* Signature Status */}
            {lease.signatureStatus && (
              <section className="card p-5 mb-4">
                <h2 className="text-lg font-semibold mb-3 border-b pb-2">Signature Status</h2>
                <div className="flex items-center gap-2">
                  <span
                    className={cn("w-3 h-3 rounded-full", lease.signatureStatus === "SIGNED"
                        ? "bg-green-500"
                        : lease.signatureStatus === "SENT"
                        ? "bg-blue-500"
                        : "bg-slate-400")}
                  />
                  <span className="capitalize">
                    {lease.signatureStatus.toLowerCase().replace(/_/g, " ")}
                  </span>
                  {lease.tenantAcceptedAt && (
                    <span className="text-sm text-slate-500 ml-2">
                      · Signed on {formatDate(lease.tenantAcceptedAt)}
                    </span>
                  )}
                </div>
              </section>
            )}

            {/* Accept / Sign Button */}
            {lease.status === "READY_TO_SIGN" && !acceptResult && (
              <div className="mt-6">
                {!acceptConfirm ? (
                  <button
                    className="button-primary w-full text-center py-3 text-lg"
                    onClick={() => setAcceptConfirm(true)}
                  >
                    ✍️ Accept & Sign Lease
                  </button>
                ) : (
                  <div className="card p-5 border-2 border-yellow-400 bg-yellow-50">
                    <p className="font-semibold text-yellow-700 mb-3">
                      Are you sure you want to sign this lease?
                    </p>
                    <p className="text-sm text-slate-600 mb-4">
                      By clicking "Confirm", you agree to the terms of this lease agreement.
                      This is a binding action.
                    </p>
                    <div className="flex gap-3">
                      <button
                        className="button-primary flex-1 py-2"
                        onClick={handleAccept}
                        disabled={accepting}
                      >
                        {accepting ? "Signing…" : "✅ Confirm Signature"}
                      </button>
                      <button
                        className="border border-slate-300 rounded px-4 py-2 text-slate-600 hover:bg-slate-50"
                        onClick={() => setAcceptConfirm(false)}
                        disabled={accepting}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Lifecycle Status */}
            {lease.status === "ACTIVE" && (
              <div className="mt-6 text-center p-4 bg-green-50 border border-green-200 rounded-lg">
                <span className="text-green-700 font-medium">
                  ⚡ This lease is active{lease.activatedAt ? ` since ${formatDate(lease.activatedAt)}` : ""}.
                </span>
              </div>
            )}

            {lease.status === "SIGNED" && (
              <div className="mt-6 text-center p-4 bg-green-50 border border-green-200 rounded-lg">
                <span className="text-green-700 font-medium">
                  ✅ This lease has been signed.
                </span>
              </div>
            )}

            {lease.status === "TERMINATED" && (
              <section className="card p-5 mb-4 mt-6 border-orange-200 bg-orange-50">
                <h2 className="text-lg font-semibold mb-3 text-orange-700">📋 Lease Terminated</h2>
                <div className="space-y-1 text-sm">
                  <p><span className="text-slate-600">Terminated on:</span> {formatDate(lease.terminatedAt)}</p>
                  {lease.terminationReason && <p><span className="text-slate-600">Reason:</span> {lease.terminationReason}</p>}
                  {lease.terminationNotice && <p><span className="text-slate-600">Notice:</span> {lease.terminationNotice}</p>}
                </div>
              </section>
            )}

            {lease.archivedAt && (
              <div className="text-xs text-slate-400 mt-2">
                📦 Archived on {formatDate(lease.archivedAt)}
              </div>
            )}

            {/* Metadata */}
            <div className="text-xs text-slate-400 mt-6">
              Lease ID: {lease.id} · Created {formatDate(lease.createdAt)}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
