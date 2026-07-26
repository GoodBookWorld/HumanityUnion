import { Router, type Request, type Response } from "express";

import { MembershipWebhookSignatureError } from "./membership-payment.errors.js";
import { verifyAndProcessMembershipStripeWebhook } from "./membership-payment.service.js";

const membershipStripeWebhookRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

membershipStripeWebhookRouter.post("/", async (req: Request, res: Response) => {
  const rawBody = req.body;

  if (!Buffer.isBuffer(rawBody)) {
    res.status(400).json(createFailureResponse("Invalid webhook payload."));
    return;
  }

  try {
    const result = await verifyAndProcessMembershipStripeWebhook({
      rawBody,
      signatureHeader:
        typeof req.headers["stripe-signature"] === "string"
          ? req.headers["stripe-signature"]
          : undefined,
    });

    res.status(200).json({
      success: true,
      data: result,
      meta: {},
      links: {},
      message: "Webhook received.",
    });
  } catch (error) {
    if (error instanceof MembershipWebhookSignatureError) {
      res.status(400).json(createFailureResponse("Invalid webhook signature."));
      return;
    }

    console.error("Membership Stripe webhook processing failed.");
    res.status(500).json(createFailureResponse("Webhook processing failed."));
  }
});

export { membershipStripeWebhookRouter };
