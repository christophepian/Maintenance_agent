import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { first, getIntParam } from "../http/query";
import { requireStaffAuth } from "../authz";
import { safeSendError } from "./helpers";
import { parseBody } from "../http/body";
import {
  getUserNotifications,
  markNotificationAsRead,
  deleteNotification,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  getPreferences,
  bulkUpsertPreferences,
} from "../services/notifications";
import { ListNotificationsSchema, BulkUpsertPreferencesSchema } from "../validation/notifications";

export function registerNotificationRoutes(router: Router) {
  // GET /notifications
  router.get("/notifications", async ({ req, res, query, orgId }) => {
    const user = requireStaffAuth(req, res);
    if (!user) return;
    try {

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
    const user = requireStaffAuth(req, res);
    if (!user) return;
    try {
      const count = await getUnreadNotificationCount(orgId, user.userId);
      sendJson(res, 200, { data: { count } });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to fetch unread count", String(e));
    }
  });

  // POST /notifications/:id/read
  router.post("/notifications/:id/read", async ({ req, res, orgId, params }) => {
    const user = requireStaffAuth(req, res);
    if (!user) return;
    try {
      const notification = await markNotificationAsRead(params.id, orgId);
      sendJson(res, 200, { data: notification });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to mark notification as read", String(e));
    }
  });

  // POST /notifications/mark-all-read
  router.post("/notifications/mark-all-read", async ({ req, res, orgId }) => {
    const user = requireStaffAuth(req, res);
    if (!user) return;
    try {
      const count = await markAllNotificationsAsRead(orgId, user.userId);
      sendJson(res, 200, { data: { count } });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to mark all notifications as read", String(e));
    }
  });

  // DELETE /notifications/:id
  router.delete("/notifications/:id", async ({ req, res, orgId, params }) => {
    const user = requireStaffAuth(req, res);
    if (!user) return;
    try {
      await deleteNotification(params.id, orgId);
      sendJson(res, 200, { message: "Notification deleted" });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to delete notification", String(e));
    }
  });

  // GET /notifications/preferences
  router.get("/notifications/preferences", async ({ req, res, orgId }) => {
    const user = requireStaffAuth(req, res);
    if (!user) return;
    try {
      const prefs = await getPreferences(orgId, user.userId);
      sendJson(res, 200, { data: prefs });
    } catch (e) {
      safeSendError(res, 500, "DB_ERROR", "Failed to fetch preferences", String(e));
    }
  });

  // PUT /notifications/preferences
  router.put("/notifications/preferences", async ({ req, res, orgId }) => {
    const user = requireStaffAuth(req, res);
    if (!user) return;
    try {
      const rawBody = await parseBody(req, BulkUpsertPreferencesSchema.omit({ orgId: true, userId: true }));
      const input = { orgId, userId: user.userId, prefs: rawBody.prefs };
      const prefs = await bulkUpsertPreferences(input);
      sendJson(res, 200, { data: prefs });
    } catch (e: any) {
      if (e?.name === "ZodError" || e?.constructor?.name === "ValidationError") {
        sendError(res, 400, "VALIDATION_ERROR", "Invalid preferences payload", String(e));
        return;
      }
      safeSendError(res, 500, "DB_ERROR", "Failed to save preferences", String(e));
    }
  });
}
