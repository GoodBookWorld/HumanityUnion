import { Router, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { requireJwtAuthenticationMiddleware } from "../auth/auth.middleware.js";
import { completeReminder, deleteArchivedReminder, listMyReminders } from "./reminder.service.js";

const reminderRouter = Router();

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

reminderRouter.use(requireJwtAuthenticationMiddleware);

reminderRouter.get("/mine", async (req, res: Response) => {
  try {
    const status =
      typeof req.query.status === "string" && ["all", "active", "archived"].includes(req.query.status)
        ? (req.query.status as "all" | "active" | "archived")
        : "active";

    const limit = typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : 50;
    const offset = typeof req.query.offset === "string" ? Number.parseInt(req.query.offset, 10) : 0;

    const reminders = await listMyReminders({
      userId: req.auth!.id,
      status,
      limit: Number.isNaN(limit) ? 50 : limit,
      offset: Number.isNaN(offset) ? 0 : offset,
    });

    res.json(createSuccessResponse(reminders, "Reminders loaded."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reminder request failed.";
    res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
  }
});

reminderRouter.post("/:reminderId/complete", async (req, res: Response) => {
  try {
    const reminder = await completeReminder(req.params.reminderId, req.auth!.id);
    res.json(createSuccessResponse(reminder, "Reminder completed."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Complete reminder failed.";
    res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
  }
});

reminderRouter.delete("/:reminderId", async (req, res: Response) => {
  try {
    await deleteArchivedReminder(req.params.reminderId, req.auth!.id);
    res.json(createSuccessResponse({ deleted: true }, "Reminder deleted."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete reminder failed.";
    res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
  }
});

export default reminderRouter;
