import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../components/AppShell";
import { formatDateTime } from "../../lib/format";

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
};

const EVENT_LINKS = {
  LEASE_READY_TO_SIGN: (n) => `/tenant/leases/${n.entityId}`,
  LEASE_SIGNED: (n) => `/tenant/leases/${n.entityId}`,
  INVOICE_CREATED: () => `/tenant/invoices`,
  INVOICE_PAID: () => `/tenant/invoices`,
};

export default function TenantInboxPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("tenantSession");
    if (!raw) { router.push("/tenant"); return; }
    try { setSession(JSON.parse(raw)); } catch { router.push("/tenant"); }
  }, [router]);

  const fetchNotifications = useCallback(async () => {
    if (!session?.tenant?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
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
      const res = await fetch(
        `/api/tenant-portal/notifications/unread-count?tenantId=${session.tenant.id}`
      );
      const data = await res.json();
      setUnreadCount(data.count || 0);
    } catch { /* silent */ }
  }, [session]);

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, [fetchNotifications, fetchUnreadCount]);

  async function markAsRead(id) {
    try {
      await fetch(`/api/tenant-portal/notifications/${id}/read`, {
        method: "POST",
      });
      fetchNotifications();
      fetchUnreadCount();
    } catch { /* silent */ }
  }

  async function markAllRead() {
    if (!session?.tenant?.id) return;
    try {
      await fetch(
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
      await fetch(`/api/tenant-portal/notifications/${id}`, {
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
