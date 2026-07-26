import { Router } from "express";

import { createSuccessResponse } from "../../../shared/http-response.js";
import {
  requireJwtAuthenticationMiddleware,
} from "../../auth/auth.middleware.js";
import { requireVerifiedEmailForMutationsMiddleware } from "../../auth/auth-workspace-gate.js";
import { createProposal } from "../application/create-proposal.service.js";
import { getProposalByIdForMember } from "../application/proposal-query.service.js";
import { submitProposal } from "../application/submit-proposal.service.js";
import {
  InvalidProposalStateTransitionError,
  ProposalActivityNotFoundError,
  ProposalAlreadySubmittedError,
  ProposalConcurrencyConflictError,
  ProposalDiscussionActivityMismatchError,
  ProposalDiscussionNotFoundError,
  ProposalForbiddenError,
  ProposalMemberNotRegisteredError,
  ProposalNotFoundError,
  ProposalPersistenceError,
  ProposalSubmissionForbiddenError,
  ProposalSubmissionValidationError,
  ProposalTransactionError,
  ProposalValidationError,
} from "../domain/proposal.errors.js";
import {
  assertNoTrustedCreateProposalFields,
  assertNoTrustedSubmitProposalFields,
  validateCreateProposalInput,
  validateSubmitProposalCommand,
} from "../domain/proposal.validation.js";

const proposalRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

proposalRouter.post(
  "/",
  requireJwtAuthenticationMiddleware,
  requireVerifiedEmailForMutationsMiddleware,
  async (req, res) => {
    if (!req.auth?.memberId) {
      res.status(403).json(createFailureResponse("Registered Member is required to create a Proposal."));
      return;
    }

    const body = req.body as Record<string, unknown>;

    try {
      assertNoTrustedCreateProposalFields(body);
      const command = validateCreateProposalInput(body);

      const result = await createProposal({
        creatorMemberId: req.auth.memberId,
        actorId: req.auth.id,
        command,
      });

      res.status(201).json(createSuccessResponse(result.proposal, "Proposal created."));
    } catch (error) {
      if (error instanceof ProposalValidationError) {
        res.status(400).json(createFailureResponse(error.message));
        return;
      }

      if (error instanceof ProposalMemberNotRegisteredError) {
        res.status(403).json(createFailureResponse(error.message));
        return;
      }

      if (error instanceof ProposalActivityNotFoundError || error instanceof ProposalDiscussionNotFoundError) {
        res.status(404).json(createFailureResponse(error.message));
        return;
      }

      if (error instanceof ProposalDiscussionActivityMismatchError) {
        res.status(400).json(createFailureResponse(error.message));
        return;
      }

      if (error instanceof ProposalTransactionError || error instanceof ProposalPersistenceError) {
        res.status(500).json(createFailureResponse(error.message));
        return;
      }

      const message = error instanceof Error ? error.message : "Proposal creation failed.";
      res.status(500).json(createFailureResponse(message));
    }
  },
);

proposalRouter.post(
  "/:proposalId/submit",
  requireJwtAuthenticationMiddleware,
  requireVerifiedEmailForMutationsMiddleware,
  async (req, res) => {
    if (!req.auth?.memberId) {
      res.status(403).json(createFailureResponse("Registered Member is required to submit a Proposal."));
      return;
    }

    const proposalId = req.params.proposalId;

    if (!proposalId || Array.isArray(proposalId)) {
      res.status(400).json(createFailureResponse("Proposal identifier is required."));
      return;
    }

    const body = req.body as Record<string, unknown>;

    try {
      assertNoTrustedSubmitProposalFields(body);
      const command = validateSubmitProposalCommand(proposalId);

      const result = await submitProposal({
        memberId: req.auth.memberId,
        actorId: req.auth.id,
        command,
      });

      res.json(createSuccessResponse(result.proposal, "Proposal submitted."));
    } catch (error) {
      if (error instanceof ProposalValidationError || error instanceof ProposalSubmissionValidationError) {
        res.status(400).json(createFailureResponse(error.message));
        return;
      }

      if (
        error instanceof ProposalMemberNotRegisteredError ||
        error instanceof ProposalSubmissionForbiddenError
      ) {
        res.status(403).json(createFailureResponse(error.message));
        return;
      }

      if (
        error instanceof ProposalNotFoundError ||
        error instanceof ProposalActivityNotFoundError ||
        error instanceof ProposalDiscussionNotFoundError
      ) {
        res.status(404).json(createFailureResponse(error.message));
        return;
      }

      if (error instanceof ProposalDiscussionActivityMismatchError) {
        res.status(400).json(createFailureResponse(error.message));
        return;
      }

      if (
        error instanceof ProposalAlreadySubmittedError ||
        error instanceof InvalidProposalStateTransitionError ||
        error instanceof ProposalConcurrencyConflictError
      ) {
        res.status(409).json(createFailureResponse(error.message));
        return;
      }

      if (error instanceof ProposalTransactionError || error instanceof ProposalPersistenceError) {
        res.status(500).json(createFailureResponse(error.message));
        return;
      }

      const message = error instanceof Error ? error.message : "Proposal submission failed.";
      res.status(500).json(createFailureResponse(message));
    }
  },
);

proposalRouter.get("/:proposalId", requireJwtAuthenticationMiddleware, async (req, res) => {
  if (!req.auth?.memberId) {
    res.status(401).json(createFailureResponse("Authentication required."));
    return;
  }

  const proposalId = req.params.proposalId;

  if (!proposalId || Array.isArray(proposalId)) {
    res.status(400).json(createFailureResponse("Proposal identifier is required."));
    return;
  }

  try {
    const proposal = await getProposalByIdForMember({
      proposalId,
      memberId: req.auth.memberId,
    });

    res.json(createSuccessResponse(proposal, "Proposal loaded."));
  } catch (error) {
    if (error instanceof ProposalNotFoundError) {
      res.status(404).json(createFailureResponse(error.message));
      return;
    }

    if (error instanceof ProposalForbiddenError) {
      res.status(403).json(createFailureResponse(error.message));
      return;
    }

    const message = error instanceof Error ? error.message : "Proposal request failed.";
    res.status(500).json(createFailureResponse(message));
  }
});

export default proposalRouter;
