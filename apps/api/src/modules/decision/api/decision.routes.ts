import { Router } from "express";

import { createSuccessResponse } from "../../../shared/http-response.js";
import {
  requireJwtAuthenticationMiddleware,
} from "../../auth/auth.middleware.js";
import { requireVerifiedEmailForMutationsMiddleware } from "../../auth/auth-workspace-gate.js";
import { createDecision } from "../application/create-decision.service.js";
import { getDecisionByIdForMember } from "../application/decision-query.service.js";
import {
  DecisionAlreadyExistsError,
  DecisionCreationForbiddenError,
  DecisionForbiddenError,
  DecisionMemberNotRegisteredError,
  DecisionNotFoundError,
  DecisionPersistenceError,
  DecisionProposalNotFoundError,
  DecisionProposalNotSubmittedError,
  DecisionTransactionError,
  DecisionValidationError,
} from "../domain/decision.errors.js";
import {
  assertNoTrustedCreateDecisionFields,
  validateCreateDecisionInput,
} from "../domain/decision.validation.js";

const decisionRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

decisionRouter.post(
  "/",
  requireJwtAuthenticationMiddleware,
  requireVerifiedEmailForMutationsMiddleware,
  async (req, res) => {
    if (!req.auth?.memberId) {
      res.status(403).json(createFailureResponse("Registered Member is required to create a Decision."));
      return;
    }

    const body = req.body as Record<string, unknown>;

    try {
      assertNoTrustedCreateDecisionFields(body);
      const command = validateCreateDecisionInput(body);

      const result = await createDecision({
        memberId: req.auth.memberId,
        actorId: req.auth.id,
        command,
      });

      res.status(201).json(createSuccessResponse(result.decision, "Decision created."));
    } catch (error) {
      if (error instanceof DecisionValidationError) {
        res.status(400).json(createFailureResponse(error.message));
        return;
      }

      if (
        error instanceof DecisionMemberNotRegisteredError ||
        error instanceof DecisionCreationForbiddenError
      ) {
        res.status(403).json(createFailureResponse(error.message));
        return;
      }

      if (error instanceof DecisionProposalNotFoundError) {
        res.status(404).json(createFailureResponse(error.message));
        return;
      }

      if (
        error instanceof DecisionProposalNotSubmittedError ||
        error instanceof DecisionAlreadyExistsError
      ) {
        res.status(409).json(createFailureResponse(error.message));
        return;
      }

      if (error instanceof DecisionTransactionError || error instanceof DecisionPersistenceError) {
        res.status(500).json(createFailureResponse(error.message));
        return;
      }

      const message = error instanceof Error ? error.message : "Decision creation failed.";
      res.status(500).json(createFailureResponse(message));
    }
  },
);

decisionRouter.get("/:decisionId", requireJwtAuthenticationMiddleware, async (req, res) => {
  if (!req.auth?.memberId) {
    res.status(401).json(createFailureResponse("Authentication required."));
    return;
  }

  const decisionId = req.params.decisionId;

  if (!decisionId || Array.isArray(decisionId)) {
    res.status(400).json(createFailureResponse("Decision identifier is required."));
    return;
  }

  try {
    const decision = await getDecisionByIdForMember({
      decisionId,
      memberId: req.auth.memberId,
    });

    res.json(createSuccessResponse(decision, "Decision loaded."));
  } catch (error) {
    if (error instanceof DecisionNotFoundError) {
      res.status(404).json(createFailureResponse(error.message));
      return;
    }

    if (error instanceof DecisionForbiddenError) {
      res.status(403).json(createFailureResponse(error.message));
      return;
    }

    const message = error instanceof Error ? error.message : "Decision request failed.";
    res.status(500).json(createFailureResponse(message));
  }
});

export default decisionRouter;
