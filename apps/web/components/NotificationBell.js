import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import { formatDateTime } from "../lib/format";
import { getNotificationLink as resolveLink } from "../lib/notificationLinks";

import { cn } from "../lib/utils";
export default function NotificationBell({ role }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

  const isTenant = role === "TENANT";

  // Build auth headers from the role-specific localStorage key.
  // Manager pages use "authToken", owner pages use "ownerToken", etc.
  function getHeaders() {
    if (typeof window === "undefined") return {};
    const roleKey = role?.toLowerCase() || "manager";
    const key = roleKey === "manager" ? "authToken" : `${roleKey}Token`;
    const token = localStorage.getItem(key);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

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
        const headers = getHeaders();
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
        const headers = getHeaders();
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
        await fetch(`/api/notifications/${id}/read`, { method: "POST", headers: getHeaders() });
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
        await fetch("/api/notifications/mark-all-read", { method: "POST", headers: getHeaders() });
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
        await fetch(`/api/notifications/${id}`, { method: "DELETE", headers: getHeaders() });
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
      case "REQUEST_APPROVED": return "bg-green-100 text-green-700";
      case "INVOICE_PAID": return "bg-blue-100 text-blue-700";
      case "JOB_COMPLETED": return "bg-purple-100 text-purple-700";
      case "LEASE_SIGNED": return "bg-green-100 text-green-700";
      case "LEASE_READY_TO_SIGN": return "bg-sky-100 text-sky-700";
      case "TENANT_SELECTED": return "bg-indigo-100 text-indigo-700";
      case "APPLICATION_SUBMITTED": return "bg-amber-100 text-amber-700";
      case "QUOTE_SUBMITTED": return "bg-orange-100 text-orange-700";
      case "QUOTE_AWARDED": return "bg-green-100 text-green-700";
      case "QUOTE_REJECTED": return "bg-red-100 text-red-700";
      case "SLOT_PROPOSED": return "bg-cyan-100 text-cyan-700";
      case "SLOT_ACCEPTED": return "bg-green-100 text-green-700";
      case "SLOT_DECLINED": return "bg-red-100 text-red-700";
      case "SCHEDULING_ESCALATED": return "bg-yellow-100 text-yellow-700";
      case "RATING_SUBMITTED": return "bg-violet-100 text-violet-700";
      case "JOB_CONFIRMED": return "bg-teal-100 text-teal-700";
      case "INVOICE_OVERDUE": return "bg-red-100 text-red-700";
      default: return "bg-slate-100 text-slate-600";
    }
  };

  const router = useRouter();

  const getNotificationLink = (notif) => resolveLink(notif, role);

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
        className="relative p-2 text-slate-600 hover:text-slate-900 focus:outline-none rounded-full"
        aria-label="Notifications"
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
          <span className="absolute top-0.5 right-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[11px] font-bold leading-none text-white bg-red-600 rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-slate-200 z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">Notifications</h3>
            {notifications.length > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-blue-600 hover:text-blue-700"
                aria-label="Mark all notifications as read"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-8 text-center text-slate-500">
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-500">
                No notifications
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={cn("px-4 py-3 border-b border-slate-100 hover:bg-slate-50", !isNotifRead(notif) ? "bg-blue-50" : "", getNotificationLink(notif) ? "cursor-pointer" : "")}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("text-xs px-2 py-0.5 rounded", getTypeColor(notif.eventType))}>
                          {(notif.eventType || notif.type || "").replace(/_/g, " ")}
                        </span>
                        {!isNotifRead(notif) && (
                          <>
                            <span className="w-2 h-2 bg-blue-600 rounded-full" aria-hidden="true"></span>
                            <span className="sr-only">Unread</span>
                          </>
                        )}
                      </div>
                      <p className="text-sm text-slate-700 mb-1">
                        {notif.message}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatDateTime(notif.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 ml-2">
                      {!isNotifRead(notif) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }}
                          className="text-xs text-blue-600 hover:text-blue-700"
                          title="Mark as read"
                          aria-label="Mark as read"
                        >
                          ✓
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id); }}
                        className="text-xs text-red-600 hover:text-red-700"
                        title="Delete"
                        aria-label="Delete notification"
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
