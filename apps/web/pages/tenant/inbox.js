import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../components/AppShell";
import { formatDateTime } from "../../lib/format";
import { tenantFetch } from "../../lib/api";

const EVENT_ICONS = {
  LEASE_READY_TO_SIGN: "📝",
  LEASE_SIGNED: "✅",
  INVOICE_CREATED: "🧾",
  INVOICE_APPROVED: "✅",
  INVOICE_PAID: "💰",
  REQUEST_APPROVED: "🔧",
  JOB_CREATED: "🛠️",
  JOB_COMPLETED: "✅",
  TENANT_SELECTED: "🏠",
  OWNER_REJECTED: "❌",
  TENANT_SELF_PAY_ACCEPTED: "💳",
};

const EVENT_LINKS = {
  LEASE_READY_TO_SIGN: (n) => `/tenant/leases/${n.entityId}`,
  LEASE_SIGNED: (n) => `/tenant/leases/${n.entityId}`,
  INVOICE_CREATED: () => `/tenant/invoices`,
  INVOICE_APPROVED: () => `/tenant/invoices`,
  INVOICE_PAID: () => `/tenant/invoices`,
  JOB_STARTED: () => `/tenant/inbox`,
  JOB_COMPLETED: () => `/tenant/inbox`,
  CONTRACTOR_REJECTED: () => `/tenant/inbox`,
  OWNER_REJECTED: () => `/tenant/requests`,
  TENANT_SELF_PAY_ACCEPTED: () => `/tenant/requests`,
};

export default function TenantInboxPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selfPayLoading, setSelfPayLoading] = useState(null); // requestId being processed

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("tenantSession");
    if (!raw) { setLoading(false); router.push("/tenant"); return; }
    try { setSession(JSON.parse(raw)); } catch { setLoading(false); router.push("/tenant"); }
  }, [router]);

  const fetchNotifications = useCallback(async () => {
    if (!session?.tenant?.id) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await tenantFetch(
        `/api/tenant-portal/notifications?tenantId=${session.tenant.id}`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "Failed to load notifications");
        return;
      }
      setNotifications(data.data?.notifications || []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [session]);

  const fetchUnreadCount = useCallback(async () => {
    if (!session?.tenant?.id) return;
    try {
      const res = await tenantFetch(
        `/api/tenant-portal/notifications/unread-count?tenantId=${session.tenant.id}`
      );
      const data = await res.json();
      setUnreadCount(data.count || 0);
    } catch { /* silent */ }
  }, [session]);

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
    // Poll every 15 seconds for new notifications
    const interval = setInterval(() => {
      fetchNotifications();
      fetchUnreadCount();
    }, 15_000);
    // Also refresh when the tab becomes visible again
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        fetchNotifications();
        fetchUnreadCount();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchNotifications, fetchUnreadCount]);

  async function markAsRead(id) {
    try {
      await tenantFetch(`/api/tenant-portal/notifications/${id}/read`, {
        method: "POST",
      });
      fetchNotifications();
      fetchUnreadCount();
    } catch { /* silent */ }
  }

  async function markAllRead() {
    if (!session?.tenant?.id) return;
    try {
      await tenantFetch(
        `/api/tenant-portal/notifications/mark-all-read?tenantId=${session.tenant.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId: session.tenant.id }),
        }
      );
      fetchNotifications();
      fetchUnreadCount();
    } catch { /* silent */ }
  }

  async function dismissNotification(id) {
    try {
      await tenantFetch(`/api/tenant-portal/notifications/${id}`, {
        method: "DELETE",
      });
      fetchNotifications();
      fetchUnreadCount();
    } catch { /* silent */ }
  }

  function handleClick(notif) {
    if (!notif.readAt) markAsRead(notif.id);
    const linkFn = EVENT_LINKS[notif.eventType];
    if (linkFn) router.push(linkFn(notif));
  }

  async function handleSelfPay(e, requestId) {
    e.stopPropagation();
    setSelfPayLoading(requestId);
    try {
      const res = await tenantFetch(`/api/tenant-portal/requests/${requestId}/self-pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error?.message || "Failed to accept self-pay");
        return;
      }
      // Refresh notifications — the OWNER_REJECTED notification is replaced by TENANT_SELF_PAY_ACCEPTED
      fetchNotifications();
      fetchUnreadCount();
    } catch (err) {
      setError(String(err));
    } finally {
      setSelfPayLoading(null);
    }
  }

  if (!session) {
    return (
      <AppShell role="TENANT">
        <div className="main-container max-w-2xl">
          <h1 className="text-2xl font-bold mb-6">Inbox</h1>
          <div className="card p-8 text-center">
            <p className="text-gray-500">Please sign in to view your notifications.</p>
            <button
              onClick={() => router.push("/tenant")}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
            >
              Sign in
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell role="TENANT">
      <div className="main-container max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Inbox</h1>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-sm text-blue-600 hover:underline"
            >
              Mark all as read
            </button>
          )}
        </div>

        {error && <div className="notice notice-err mb-4">{error}</div>}

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading…</div>
        ) : notifications.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-gray-400 text-lg mb-2">📭</p>
            <p className="text-gray-500">No notifications yet</p>
            <p className="text-gray-400 text-sm mt-1">
              You will be notified here when your lease is ready to sign, invoices are created, and more.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                className={
                  "card p-4 flex items-start gap-3 cursor-pointer transition-colors border " +
                  (n.readAt
                    ? "bg-white hover:bg-gray-50"
                    : "bg-blue-50 border-blue-200 hover:bg-blue-100")
                }
              >
                <span className="text-xl flex-shrink-0 mt-0.5">
                  {EVENT_ICONS[n.eventType] || "🔔"}
                </span>
                <div className="flex-1 min-w-0">
                  <p
                    className={
                      "text-sm " +
                      (n.readAt ? "text-gray-600" : "text-gray-900 font-medium")
                    }
                  >
                    {n.message || n.eventType.replace(/_/g, " ").toLowerCase()}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDateTime(n.createdAt)}
                  </p>
                  {n.eventType === "OWNER_REJECTED" && (
                    <button
                      onClick={(e) => handleSelfPay(e, n.entityId)}
                      disabled={selfPayLoading === n.entityId}
                      className="mt-2 px-3 py-1 bg-orange-500 text-white text-xs font-medium rounded hover:bg-orange-600 disabled:opacity-50"
                    >
                      {selfPayLoading === n.entityId ? "Processing…" : "Proceed at my own expense"}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!n.readAt && (
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" title="Unread" />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      dismissNotification(n.id);
                    }}
                    className="text-gray-300 hover:text-gray-500 ml-1"
                    title="Dismiss"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
