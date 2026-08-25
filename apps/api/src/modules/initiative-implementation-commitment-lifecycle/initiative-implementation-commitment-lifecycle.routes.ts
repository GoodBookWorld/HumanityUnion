import { Router, type Request, type Response } from "express";

import { authenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import {
  acceptInitiativeImplementationCommitment,
  declineInitiativeImplementationCommitment,
  generateInitiativeImplementationCommitmentDraft,
  getInitiativeImplementationCommitmentWorkspaceContext,
  initiateImplementationCommitmentTransfer,
  listMyProposedInitiativeImplementationCommitments,
  publishInitiativeImplementationCommitmentStage,
  reproposeInitiativeImplementationCommitment,
  saveInitiativeImplementationCommitmentDraft,
  takeInitiativeImplementationCommitment,
} from "./initiative-implementation-commitment-lifecycle.service.js";
import { validateSaveInitiativeImplementationCommitmentLifecycleDraftInput } from "./initiative-implementation-commitment-lifecycle.validators.js";

const initiativeImplementationCommitmentLifecycleRouter = Router();

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

  if (
    message.includes("is required") ||
    message.includes("already been published") ||
    message.includes("no longer current") ||
    message.includes("must be") ||
    message.includes("Only a proposed commitment") ||
    message.includes("already been accepted") ||
    message.includes("already been declined") ||
    message.includes("cannot be accepted") ||
    message.includes("cannot be declined") ||
    message.includes("Proposed Participant ID is unknown") ||
    message.includes("already been taken") ||
    message.includes("Only an unassigned") ||
    message.includes("Only a published Implementation Commitment can be taken") ||
    message.includes("can no longer be re-proposed") ||
    message.includes("can no longer be transferred") ||
    message.includes("Only a declined") ||
    message.includes("Only an accepted Implementation Commitment can be transferred") ||
    message.includes("transfer is already pending") ||
    message.includes("Cannot transfer responsibility") ||
    message.includes("transfer is no longer available")
  ) {
    return 409;
  }

  return 400;
}

function handleServiceError(res: Response, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Initiative Implementation Commitment request failed.";
  res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
}

function getInitiativeId(req: Request): string {
  const initiativeId = req.params.initiativeId;
  return Array.isArray(initiativeId) ? (initiativeId[0] ?? "") : (initiativeId ?? "");
}

function getCommitmentId(req: Request): string {
  const commitmentId = req.params.commitmentId;
  return Array.isArray(commitmentId) ? (commitmentId[0] ?? "") : (commitmentId ?? "");
}

initiativeImplementationCommitmentLifecycleRouter.get(
  "/initiative/:initiativeId/workspace",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const context = await getInitiativeImplementationCommitmentWorkspaceContext(
        identity,
        getInitiativeId(req),
      );

      res.json(createSuccessResponse(context, "Implementation Commitment workspace loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeImplementationCommitmentLifecycleRouter.post(
  "/initiative/:initiativeId/draft/generate",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const draft = await generateInitiativeImplementationCommitmentDraft(
        identity,
        getInitiativeId(req),
      );

      res.json(createSuccessResponse(draft, "Implementation Commitment draft generated."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeImplementationCommitmentLifecycleRouter.patch(
  "/initiative/:initiativeId/draft",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const input = validateSaveInitiativeImplementationCommitmentLifecycleDraftInput(req.body);
      const draft = saveInitiativeImplementationCommitmentDraft(identity, getInitiativeId(req), input);

      res.json(createSuccessResponse(draft, "Implementation Commitment draft saved."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeImplementationCommitmentLifecycleRouter.post(
  "/initiative/:initiativeId/publish",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const pkg = await publishInitiativeImplementationCommitmentStage(
        identity,
        getInitiativeId(req),
      );

      res.json(createSuccessResponse(pkg, "Implementation Commitments published."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeImplementationCommitmentLifecycleRouter.post(
  "/commitments/:commitmentId/accept",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const commitment = await acceptInitiativeImplementationCommitment(
        identity,
        getCommitmentId(req),
      );

      res.json(createSuccessResponse(commitment, "Implementation commitment accepted."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeImplementationCommitmentLifecycleRouter.post(
  "/commitments/:commitmentId/take",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const commitment = await takeInitiativeImplementationCommitment(
        identity,
        getCommitmentId(req),
      );

      res.json(createSuccessResponse(commitment, "Implementation commitment taken."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeImplementationCommitmentLifecycleRouter.post(
  "/commitments/:commitmentId/decline",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const commitment = await declineInitiativeImplementationCommitment(
        identity,
        getCommitmentId(req),
      );

      res.json(createSuccessResponse(commitment, "Implementation commitment declined."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeImplementationCommitmentLifecycleRouter.post(
  "/commitments/:commitmentId/repropose",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const nextParticipantId =
        typeof req.body?.participantId === "string" ? req.body.participantId : "";
      const commitment = await reproposeInitiativeImplementationCommitment(
        identity,
        getCommitmentId(req),
        nextParticipantId,
      );

      res.json(createSuccessResponse(commitment, "Implementation commitment re-proposed."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeImplementationCommitmentLifecycleRouter.post(
  "/commitments/:commitmentId/transfer",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const nextParticipantId =
        typeof req.body?.participantId === "string" ? req.body.participantId : "";
      const commitment = await initiateImplementationCommitmentTransfer(
        identity,
        getCommitmentId(req),
        nextParticipantId,
      );

      res.json(createSuccessResponse(commitment, "Implementation commitment transfer initiated."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeImplementationCommitmentLifecycleRouter.get(
  "/mine/proposed",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const commitments = listMyProposedInitiativeImplementationCommitments(identity);

      res.json(createSuccessResponse(commitments, "My proposed implementation commitments loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

export default initiativeImplementationCommitmentLifecycleRouter;
