import { Router, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { requireJwtAuthenticationMiddleware } from "../auth/auth.middleware.js";
import {
  archiveNotification,
  clearArchivedNotificationsForUser,
  countUnreadNotifications,
  deleteArchivedNotification,
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notification.service.js";

const notificationRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

function resolveErrorStatus(message: string): number {
  if (message.includes("not found")) {
    return 404;
  }

  if (message.includes("do not have access")) {
    return 403;
  }

  return 400;
}

notificationRouter.use(requireJwtAuthenticationMiddleware);

notificationRouter.get("/mine", async (req, res: Response) => {
  try {
    const status =
      typeof req.query.status === "string" &&
      ["all", "unread", "read", "archived"].includes(req.query.status)
        ? (req.query.status as "all" | "unread" | "read" | "archived")
        : "all";

    const limit = typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : 50;
    const offset = typeof req.query.offset === "string" ? Number.parseInt(req.query.offset, 10) : 0;

    const notifications = await listMyNotifications({
      userId: req.auth!.id,
      status,
      limit: Number.isNaN(limit) ? 50 : limit,
      offset: Number.isNaN(offset) ? 0 : offset,
    });

    res.json(createSuccessResponse(notifications, "Notifications loaded."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notification request failed.";
    res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
  }
});

notificationRouter.get("/unread-count", async (req, res: Response) => {
  try {
    const unreadCount = await countUnreadNotifications(req.auth!.id);
    res.json(createSuccessResponse({ unreadCount }, "Unread notification count loaded."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unread count request failed.";
    res.status(400).json(createFailureResponse(message));
  }
});

notificationRouter.post("/read-all", async (req, res: Response) => {
  try {
    const result = await markAllNotificationsRead(req.auth!.id);
    res.json(createSuccessResponse(result, "All notifications marked as read."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mark all read failed.";
    res.status(400).json(createFailureResponse(message));
  }
});

notificationRouter.delete("/archive", async (req, res: Response) => {
  try {
    const result = await clearArchivedNotificationsForUser(req.auth!.id);
    res.json(createSuccessResponse(result, "Archived notifications cleared."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Clear archive failed.";
    res.status(400).json(createFailureResponse(message));
  }
});

notificationRouter.post("/:notificationId/read", async (req, res: Response) => {
  try {
    const notification = await markNotificationRead(req.params.notificationId, req.auth!.id);
    res.json(createSuccessResponse(notification, "Notification marked as read."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mark read failed.";
    res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
  }
});

notificationRouter.post("/:notificationId/archive", async (req, res: Response) => {
  try {
    const notification = await archiveNotification(req.params.notificationId, req.auth!.id);
    res.json(createSuccessResponse(notification, "Notification archived."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Archive notification failed.";
    res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
  }
});

notificationRouter.delete("/:notificationId", async (req, res: Response) => {
  try {
    await deleteArchivedNotification(req.params.notificationId, req.auth!.id);
    res.json(createSuccessResponse({ deleted: true }, "Notification deleted."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete notification failed.";
    res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
  }
});

export default notificationRouter;
