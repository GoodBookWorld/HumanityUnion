import { Router, type Request, type Response } from "express";

import type { MembershipApplicationInput } from "@hu/types";

import { createSuccessResponse } from "../../shared/http-response.js";
import { requireJwtAuthenticationMiddleware } from "../auth/auth.middleware.js";
import { getMemberById } from "../member/member-access.js";
import {
  MembershipAccessDeniedError,
  MembershipConflictError,
  MembershipNotFoundError,
  MembershipPersistenceUnavailableError,
  MembershipValidationError,
} from "./membership.errors.js";
import {
  getMembershipStatusForUser,
  getOrCreateMembershipForUser,
  upsertMembershipApplication,
} from "./membership.service.js";
import {
  createMembershipCheckoutSession,
  MembershipPaymentAccessDeniedError,
  MembershipPaymentConflictError,
  MembershipPaymentNotFoundError,
  MembershipPaymentUnavailableError,
  MembershipPaymentValidationError,
} from "../membership-payment/index.js";

const membershipRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

function resolveMembershipErrorStatus(error: unknown): number {
  if (error instanceof MembershipValidationError) {
    return 400;
  }

  if (error instanceof MembershipAccessDeniedError) {
    return 403;
  }

  if (error instanceof MembershipNotFoundError) {
    return 404;
  }

  if (error instanceof MembershipConflictError) {
    return 409;
  }

  if (error instanceof MembershipPersistenceUnavailableError) {
    return 503;
  }

  if (
    error instanceof MembershipPaymentValidationError ||
    error instanceof MembershipPaymentAccessDeniedError
  ) {
    return error instanceof MembershipPaymentValidationError ? 400 : 403;
  }

  if (error instanceof MembershipPaymentNotFoundError) {
    return 404;
  }

  if (error instanceof MembershipPaymentConflictError) {
    return 409;
  }

  if (error instanceof MembershipPaymentUnavailableError) {
    return 503;
  }

  return 500;
}

function handleMembershipError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Membership request failed.";
  res.status(resolveMembershipErrorStatus(error)).json(createFailureResponse(message));
}

function resolveAuthUserId(req: Request): string | null {
  return req.auth?.id ?? null;
}

async function resolveDisplayName(req: Request): Promise<string> {
  const member = req.auth?.memberId ? await getMemberById(req.auth.memberId) : null;
  return member?.profile.displayName ?? req.auth?.email.split("@")[0] ?? "Participant";
}

function parseApplicationBody(body: unknown): MembershipApplicationInput {
  const payload = body as Partial<MembershipApplicationInput>;

  return {
    countryCode: String(payload.countryCode ?? ""),
    displayNameConfirmed: String(payload.displayNameConfirmed ?? ""),
    understandMembershipMeaning: payload.understandMembershipMeaning === true,
    understandNoVoteWeightChange: payload.understandNoVoteWeightChange === true,
    understandDataPolicy: payload.understandDataPolicy === true,
    submit: payload.submit === true,
  };
}

membershipRouter.get("/me", requireJwtAuthenticationMiddleware, async (req, res) => {
  const userId = resolveAuthUserId(req);

  if (!userId) {
    res.status(401).json(createFailureResponse("Authentication required."));
    return;
  }

  try {
    const payload = await getOrCreateMembershipForUser({
      userId,
      displayName: await resolveDisplayName(req),
    });

    res.json(createSuccessResponse(payload, "Membership loaded."));
  } catch (error) {
    handleMembershipError(res, error);
  }
});

membershipRouter.get("/status", requireJwtAuthenticationMiddleware, async (req, res) => {
  const userId = resolveAuthUserId(req);

  if (!userId) {
    res.status(401).json(createFailureResponse("Authentication required."));
    return;
  }

  try {
    const payload = await getMembershipStatusForUser(userId);
    res.json(createSuccessResponse(payload, "Membership status loaded."));
  } catch (error) {
    handleMembershipError(res, error);
  }
});

membershipRouter.post("/application", requireJwtAuthenticationMiddleware, async (req, res) => {
  const userId = resolveAuthUserId(req);

  if (!userId) {
    res.status(401).json(createFailureResponse("Authentication required."));
    return;
  }

  try {
    const payload = await upsertMembershipApplication({
      userId,
      displayName: await resolveDisplayName(req),
      application: parseApplicationBody(req.body),
    });

    res.json(createSuccessResponse(payload, "Membership application saved."));
  } catch (error) {
    handleMembershipError(res, error);
  }
});

membershipRouter.patch("/application", requireJwtAuthenticationMiddleware, async (req, res) => {
  const userId = resolveAuthUserId(req);

  if (!userId) {
    res.status(401).json(createFailureResponse("Authentication required."));
    return;
  }

  try {
    const payload = await upsertMembershipApplication({
      userId,
      displayName: await resolveDisplayName(req),
      application: parseApplicationBody(req.body),
    });

    res.json(createSuccessResponse(payload, "Membership application updated."));
  } catch (error) {
    handleMembershipError(res, error);
  }
});

membershipRouter.post("/checkout", requireJwtAuthenticationMiddleware, async (req, res) => {
  const userId = resolveAuthUserId(req);

  if (!userId) {
    res.status(401).json(createFailureResponse("Authentication required."));
    return;
  }

  try {
    const payload = await createMembershipCheckoutSession({ userId });
    res.json(createSuccessResponse(payload, "Membership Checkout Session created."));
  } catch (error) {
    handleMembershipError(res, error);
  }
});

export { membershipRouter };
