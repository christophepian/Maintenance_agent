import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { first, getIntParam } from "../http/query";
import { getAuthUser, maybeRequireManager } from "../authz";
import { safeSendError } from "./helpers";
import {
  getUserNotifications,
  markNotificationAsRead,
  deleteNotification,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
} from "../services/notifications";
import { ListNotificationsSchema } from "../validation/notifications";

export function registerNotificationRoutes(router: Router) {
  // GET /notifications
  router.get("/notifications", async ({ req, res, query, orgId }) => {
    if (!maybeRequireManager(req, res)) return;
    try {
      const user = getAuthUser(req);
      if (!user || !user.userId) {
        sendError(res, 401, "UNAUTHORIZED", "Not authenticated");
        return;
      }

      const unreadOnly = first(query, "unreadOnly") === "true";
      const limit = getIntParam(query, "limit", { defaultValue: 20, min: 1, max: 100 });
      const offset = getIntParam(query, "offset", { defaultValue: 0, min: 0 });

      const schema = ListNotificationsSchema.parse({
        orgId,
        userId: user.userId,
        unreadOnly,
        limit,
        offset,
      });

      const { notifications, total } = await getUserNotifications(schema);
      sendJson(res, 200, { data: { notifications, total } });
    } catch (e) {
      safeSendError(res, 500, "DB_ERROR", "Failed to fetch notifications", String(e));
    }
  });

  // GET /notifications/unread-count
  router.get("/notifications/unread-count", async ({ req, res, orgId }) => {
    if (!maybeRequireManager(req, res)) return;
    try {
      const user = getAuthUser(req);
      if (!user || !user.userId) {
        sendError(res, 401, "UNAUTHORIZED", "Not authenticated");
        return;
      }
      const count = await getUnreadNotificationCount(orgId, user.userId);
      sendJson(res, 200, { data: { count } });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to fetch unread count", String(e));
    }
  });

  // POST /notifications/:id/read
  router.post("/notifications/:id/read", async ({ req, res, orgId, params }) => {
    if (!maybeRequireManager(req, res)) return;
    try {
      const user = getAuthUser(req);
      if (!user || !user.userId) {
        sendError(res, 401, "UNAUTHORIZED", "Not authenticated");
        return;
      }
      const notification = await markNotificationAsRead(params.id, orgId);
      sendJson(res, 200, { data: notification });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to mark notification as read", String(e));
    }
  });

  // POST /notifications/mark-all-read
  router.post("/notifications/mark-all-read", async ({ req, res, orgId }) => {
    if (!maybeRequireManager(req, res)) return;
    try {
      const user = getAuthUser(req);
      if (!user || !user.userId) {
        sendError(res, 401, "UNAUTHORIZED", "Not authenticated");
        return;
      }
      const count = await markAllNotificationsAsRead(orgId, user.userId);
      sendJson(res, 200, { data: { count } });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to mark all notifications as read", String(e));
    }
  });

  // DELETE /notifications/:id
  router.delete("/notifications/:id", async ({ req, res, orgId, params }) => {
    if (!maybeRequireManager(req, res)) return;
    try {
      const user = getAuthUser(req);
      if (!user || !user.userId) {
        sendError(res, 401, "UNAUTHORIZED", "Not authenticated");
        return;
      }
      await deleteNotification(params.id, orgId);
      sendJson(res, 200, { message: "Notification deleted" });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to delete notification", String(e));
    }
  });
}
