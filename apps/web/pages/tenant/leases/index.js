import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";

const STATUS_LABELS = {
  DRAFT: "Draft",
  READY_TO_SIGN: "Ready to Sign",
  SIGNED: "Signed",
  CANCELLED: "Cancelled",
};

const STATUS_COLORS = {
  READY_TO_SIGN: "bg-yellow-100 text-yellow-800",
  SIGNED: "bg-green-100 text-green-800",
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
      router.push("/tenant");
      return;
    }
    try {
      setSession(JSON.parse(raw));
    } catch {
      router.push("/tenant");
    }
  }, [router]);

  const fetchLeases = useCallback(async () => {
    if (!session?.tenant?.id) return;
    setLoading(true);
    setError(null);
    try {
      const qs = `tenantId=${session.tenant.id}`;
      const res = await fetch(`/api/tenant-portal/leases?${qs}`);
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
  }, [fetchLeases]);

  function formatDate(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("de-CH");
  }

  function formatChf(amount) {
    if (amount == null) return "—";
    return `CHF ${amount.toLocaleString("de-CH")}`;
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
          <span className="text-sm text-gray-500">
            Unit {session.unit?.unitNumber}
            {session.building ? ` · ${session.building.address}` : ""}
          </span>
        </div>

        {error && (
          <div className="notice notice-err mb-4">{error}</div>
        )}

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading leases…</div>
        ) : leases.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-gray-500 text-lg mb-2">No leases found</p>
            <p className="text-gray-400 text-sm">
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
                    <div className="text-sm text-gray-500 mt-1">
                      {lease.objectType === "APPARTEMENT"
                        ? "Apartment"
                        : lease.objectType === "MAISON"
                        ? "House"
                        : lease.objectType}
                      {lease.roomsCount ? ` · ${lease.roomsCount} rooms` : ""}
                    </div>
                    <div className="text-sm text-gray-500">
                      From {formatDate(lease.startDate)}
                      {lease.endDate ? ` to ${formatDate(lease.endDate)}` : " (indefinite)"}
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        STATUS_COLORS[lease.status] || "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {STATUS_LABELS[lease.status] || lease.status}
                    </span>
                    <div className="text-sm font-medium mt-2">
                      {formatChf(lease.rentTotalChf)}<span className="text-gray-400">/mo</span>
                    </div>
                  </div>
                </div>

                {lease.status === "READY_TO_SIGN" && (
                  <div className="mt-3 pt-3 border-t border-yellow-200 bg-yellow-50 -mx-4 -mb-4 px-4 py-3 rounded-b">
                    <span className="text-yellow-800 text-sm font-medium">
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
