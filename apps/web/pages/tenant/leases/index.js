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

const STATUS_COLORS = {
  READY_TO_SIGN: "bg-yellow-100 text-yellow-700",
  SIGNED: "bg-green-100 text-green-700",
  ACTIVE: "bg-green-100 text-green-700",
  TERMINATED: "bg-orange-100 text-orange-700",
};

export default function TenantLeasesPage() {
  const router = useRouter();
  const [leases, setLeases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("tenantSession");
    if (!raw) {
      setLoading(false);
      router.push("/tenant");
      return;
    }
    try {
      setSession(JSON.parse(raw));
    } catch {
      setLoading(false);
      router.push("/tenant");
    }
  }, [router]);

  const fetchLeases = useCallback(async () => {
    if (!session?.tenant?.id) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const qs = `tenantId=${session.tenant.id}`;
      const res = await tenantFetch(`/api/tenant-portal/leases?${qs}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || data?.error || "Failed to load leases");
        setLeases([]);
        return;
      }
      setLeases(data.data || []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchLeases();
    // Poll every 15 seconds for new leases
    const interval = setInterval(fetchLeases, 15_000);
    // Also refresh when tab becomes visible again
    function handleVisibility() {
      if (document.visibilityState === "visible") fetchLeases();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchLeases]);

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
          <p className="subtle">Loading session…</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell role="TENANT">
      <div className="main-container">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">My Leases</h1>
          <span className="text-sm text-slate-500">
            Unit {session.unit?.unitNumber}
            {session.building ? ` · ${session.building.address}` : ""}
          </span>
        </div>

        {error && (
          <div className="notice notice-err mb-4">{error}</div>
        )}

        {loading ? (
          <div className="text-center py-8 text-slate-500">Loading leases…</div>
        ) : leases.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-slate-500 text-lg mb-2">No leases found</p>
            <p className="text-slate-400 text-sm">
              Your property manager has not yet assigned any leases to your unit.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
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
                    <span
                      className={cn("inline-block px-2 py-1 rounded text-xs font-medium", STATUS_COLORS[lease.status] || "bg-slate-100 text-slate-600")}
                    >
                      {STATUS_LABELS[lease.status] || lease.status}
                    </span>
                    <div className="text-sm font-medium mt-2">
                      {formatChf(lease.rentTotalChf)}<span className="text-slate-400">/mo</span>
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
      </div>
    </AppShell>
  );
}
