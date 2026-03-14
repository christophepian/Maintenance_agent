import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import { formatDateTime } from "../lib/format";
import { authHeaders as getAuthHeaders } from "../lib/api";

export default function NotificationBell({ role }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

  const isTenant = role === "TENANT";

  // Get tenant session from localStorage
  const getTenantId = () => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("tenantSession");
      if (!raw) return null;
      return JSON.parse(raw)?.tenant?.id || null;
    } catch { return null; }
  };

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      let res;
      if (isTenant) {
        const tenantId = getTenantId();
        if (!tenantId) return;
        res = await fetch(`/api/tenant-portal/notifications/unread-count?tenantId=${tenantId}`);
      } else {
        const headers = getAuthHeaders();
        if (!headers.Authorization) return; // no token yet — skip fetch
        res = await fetch("/api/notifications/unread-count", { headers });
      }
      if (!res.ok) return;
      const data = await res.json();
      // Tenant API returns { count }, manager API returns { data: { count } }
      setUnreadCount(data.count ?? data.data?.count ?? 0);
    } catch (err) {
      console.error("Failed to fetch unread count:", err);
    }
  }, [isTenant]);

  // Fetch all notifications
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      if (isTenant) {
        const tenantId = getTenantId();
        if (!tenantId) { setLoading(false); return; }
        res = await fetch(`/api/tenant-portal/notifications?tenantId=${tenantId}`);
      } else {
        const headers = getAuthHeaders();
        if (!headers.Authorization) { setLoading(false); return; }
        res = await fetch("/api/notifications", { headers });
      }
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      setNotifications(data.data?.notifications || []);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [isTenant]);

  // Mark notification as read
  const markAsRead = async (id) => {
    try {
      if (isTenant) {
        await fetch(`/api/tenant-portal/notifications/${id}/read`, { method: "POST" });
      } else {
        await fetch(`/api/notifications/${id}/read`, { method: "POST", headers: getAuthHeaders() });
      }
      await fetchUnreadCount();
      await fetchNotifications();
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      if (isTenant) {
        const tenantId = getTenantId();
        if (!tenantId) return;
        await fetch(`/api/tenant-portal/notifications/mark-all-read?tenantId=${tenantId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId }),
        });
      } else {
        await fetch("/api/notifications/mark-all-read", { method: "POST", headers: getAuthHeaders() });
      }
      await fetchUnreadCount();
      await fetchNotifications();
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  // Delete notification
  const deleteNotification = async (id) => {
    try {
      if (isTenant) {
        await fetch(`/api/tenant-portal/notifications/${id}`, { method: "DELETE" });
      } else {
        await fetch(`/api/notifications/${id}`, { method: "DELETE", headers: getAuthHeaders() });
      }
      await fetchUnreadCount();
      await fetchNotifications();
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
      // Also poll the list while the dropdown is open
      const interval = setInterval(() => {
        fetchNotifications();
        fetchUnreadCount();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [isOpen, fetchNotifications, fetchUnreadCount]);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen]);

  const getTypeColor = (type) => {
    switch (type) {
      case "REQUEST_APPROVED": return "bg-green-100 text-green-800";
      case "INVOICE_PAID": return "bg-blue-100 text-blue-800";
      case "JOB_COMPLETED": return "bg-purple-100 text-purple-800";
      case "LEASE_SIGNED": return "bg-emerald-100 text-emerald-800";
      case "LEASE_READY_TO_SIGN": return "bg-sky-100 text-sky-800";
      case "TENANT_SELECTED": return "bg-indigo-100 text-indigo-800";
      case "APPLICATION_SUBMITTED": return "bg-amber-100 text-amber-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const router = useRouter();

  const getNotificationLink = (notif) => {
    const { entityType, entityId, eventType } = notif;

    // ── Tenant ──────────────────────────────────────────────
    if (isTenant) {
      if (entityType === "LEASE" && entityId) return `/tenant/leases/${entityId}`;
      if (entityType === "INVOICE" || eventType === "INVOICE_CREATED" || eventType === "INVOICE_PAID") return `/tenant/invoices`;
      return null;
    }

    // ── Contractor ──────────────────────────────────────────
    if (role === "CONTRACTOR") {
      if (entityType === "JOB" && entityId) return `/contractor/jobs/${entityId}`;
      if (entityType === "JOB") return `/contractor/jobs`;
      if (entityType === "INVOICE") return `/contractor/invoices`;
      return null;
    }

    // ── Owner ───────────────────────────────────────────────
    if (role === "OWNER") {
      if (entityType === "LEASE" && entityId) return `/manager/leases/${entityId}`;
      if (entityType === "REQUEST" || eventType === "REQUEST_PENDING_OWNER_APPROVAL" || eventType === "OWNER_REJECTED") return `/owner/approvals`;
      if (entityType === "JOB") return `/owner/jobs`;
      if (entityType === "INVOICE") return `/owner/invoices`;
      if (entityType === "SELECTION" || eventType === "TENANT_SELECTED") return `/owner/vacancies`;
      if (entityType === "APPLICATION" || eventType === "APPLICATION_SUBMITTED") return `/owner/vacancies`;
      return null;
    }

    // ── Manager (default) ───────────────────────────────────
    if (entityType === "LEASE" && entityId) return `/manager/leases/${entityId}`;
    if (entityType === "REQUEST" || eventType?.startsWith("REQUEST_") || eventType === "CONTRACTOR_ASSIGNED" || eventType === "CONTRACTOR_REJECTED" || eventType === "OWNER_REJECTED") return `/manager/work-requests`;
    if (entityType === "JOB") return `/manager/work-requests`;
    if (entityType === "INVOICE") return `/manager/finance/invoices`;
    if (entityType === "SELECTION" || eventType === "TENANT_SELECTED") return `/manager/vacancies`;
    if (entityType === "APPLICATION" || eventType === "APPLICATION_SUBMITTED") return `/manager/vacancies`;
    return null;
  };

  // Tenant API returns readAt, manager API returns isRead — normalize
  const isNotifRead = (notif) => notif.isRead || !!notif.readAt;

  const handleNotificationClick = async (notif) => {
    const link = getNotificationLink(notif);
    if (link) {
      if (!isNotifRead(notif)) {
        await markAsRead(notif.id);
      }
      router.push(link);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none rounded-full"
        aria-label="Notifications"
        style={{ position: "relative" }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        
        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span style={{
            position: "absolute",
            top: 2,
            right: 2,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 18,
            height: 18,
            padding: "0 5px",
            fontSize: 11,
            fontWeight: 700,
            lineHeight: 1,
            color: "#fff",
            backgroundColor: "#dc2626",
            borderRadius: 9999,
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
            {notifications.length > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-8 text-center text-gray-500">
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                No notifications
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`px-4 py-3 border-b border-gray-100 hover:bg-gray-50 ${
                    !isNotifRead(notif) ? "bg-blue-50" : ""
                  } ${getNotificationLink(notif) ? "cursor-pointer" : ""}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${getTypeColor(notif.eventType)}`}>
                          {(notif.eventType || notif.type || "").replace(/_/g, " ")}
                        </span>
                        {!isNotifRead(notif) && (
                          <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 mb-1">
                        {notif.message}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDateTime(notif.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 ml-2">
                      {!isNotifRead(notif) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }}
                          className="text-xs text-blue-600 hover:text-blue-800"
                          title="Mark as read"
                        >
                          ✓
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id); }}
                        className="text-xs text-red-600 hover:text-red-800"
                        title="Delete"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
