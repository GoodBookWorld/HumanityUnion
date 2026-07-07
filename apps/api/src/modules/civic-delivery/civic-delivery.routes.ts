import { Router, type Request, type Response } from "express";

import { authenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import {
  addCivicDeliveryRecipient,
  createCivicDeliveryDraft,
  getMyCivicDelivery,
  listMyCivicDeliveries,
  listRecommendedCivicDeliveryRecipients,
  removeCivicDeliveryRecipient,
  sendCivicDelivery,
} from "./civic-delivery.service.js";

const civicDeliveryRouter = Router();

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

  if (message.includes("Only draft") || message.includes("already selected")) {
    return 409;
  }

  return 400;
}

function handleServiceError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Civic delivery request failed.";
  res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
}

function getDeliveryId(req: Request): string {
  const deliveryId = req.params.deliveryId;
  return Array.isArray(deliveryId) ? (deliveryId[0] ?? "") : (deliveryId ?? "");
}

function getRecipientId(req: Request): string {
  const recipientId = req.params.recipientId;
  return Array.isArray(recipientId) ? (recipientId[0] ?? "") : (recipientId ?? "");
}

function getCapId(req: Request): string {
  const capId = req.params.capId;
  return Array.isArray(capId) ? (capId[0] ?? "") : (capId ?? "");
}

civicDeliveryRouter.get("/mine", authenticationMiddleware, (req, res) => {
  const identity = resolveRequestIdentity(req);
  const deliveries = listMyCivicDeliveries(identity);

  res.json(createSuccessResponse(deliveries, "Civic deliveries loaded."));
});

civicDeliveryRouter.post("/draft", authenticationMiddleware, (req, res) => {
  try {
    const identity = resolveRequestIdentity(req);
    const capId = typeof req.body?.capId === "string" ? req.body.capId : "";

    if (!capId) {
      res.status(400).json(createFailureResponse("capId is required."));
      return;
    }

    const delivery = createCivicDeliveryDraft(identity, { capId });

    res.status(201).json(createSuccessResponse(delivery, "Civic delivery draft created."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

civicDeliveryRouter.get("/recommended/:capId", authenticationMiddleware, (req, res) => {
  try {
    const capId = getCapId(req);
    const recommendations = listRecommendedCivicDeliveryRecipients(capId);

    res.json(createSuccessResponse(recommendations, "Recommended recipients loaded."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

civicDeliveryRouter.get("/:deliveryId", authenticationMiddleware, (req, res) => {
  const identity = resolveRequestIdentity(req);
  const detail = getMyCivicDelivery(identity, getDeliveryId(req));

  if (!detail) {
    res.status(404).json(createFailureResponse("Delivery record not found."));
    return;
  }

  res.json(createSuccessResponse(detail, "Civic delivery loaded."));
});

civicDeliveryRouter.post("/:deliveryId/recipients", authenticationMiddleware, (req, res) => {
  try {
    const identity = resolveRequestIdentity(req);
    const body = req.body as {
      name?: string;
      organization?: string;
      recipientType?: string;
      email?: string;
      reason?: string;
      source?: "recommended" | "user_added";
    };

    if (!body.name || !body.recipientType || !body.email || !body.reason || !body.source) {
      res.status(400).json(createFailureResponse("Recipient fields are incomplete."));
      return;
    }

    const recipient = addCivicDeliveryRecipient(identity, getDeliveryId(req), {
      name: body.name,
      organization: body.organization,
      recipientType: body.recipientType as never,
      email: body.email,
      reason: body.reason,
      source: body.source,
    });

    res.status(201).json(createSuccessResponse(recipient, "Recipient added."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

civicDeliveryRouter.delete(
  "/:deliveryId/recipients/:recipientId",
  authenticationMiddleware,
  (req, res) => {
    try {
      const identity = resolveRequestIdentity(req);
      removeCivicDeliveryRecipient(identity, getDeliveryId(req), getRecipientId(req));

      res.json(createSuccessResponse({ removed: true }, "Recipient removed."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

civicDeliveryRouter.post("/:deliveryId/send", authenticationMiddleware, async (req, res) => {
  try {
    const identity = resolveRequestIdentity(req);
    const detail = await sendCivicDelivery(identity, getDeliveryId(req));

    res.json(createSuccessResponse(detail, "Civic delivery sent."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

export default civicDeliveryRouter;
