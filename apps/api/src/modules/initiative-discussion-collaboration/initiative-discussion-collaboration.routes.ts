import { Router, type Request, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  optionalAuthenticationMiddleware,
  requireJwtAuthenticationMiddleware,
} from "../auth/auth.middleware.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import {
  createProposalCandidateFromComment,
  expressCollaborationInterest,
  inviteCommentAuthorToAllies,
  listActiveAlliesForInitiative,
  listCollaborationParticipantsForInitiative,
  respondToAlliesInvitation,
  respondToCollaborationInterest,
} from "./initiative-discussion-collaboration.service.js";
import { getInitiativeActiveAlliesTeam } from "./initiative-active-allies.service.js";
import { postInitiativeCollaborationSystemEvent } from "../initiative-collaboration-channel/index.js";

export const initiativeDiscussionCollaborationRouter = Router();

function resolveParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

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
  if (message.includes("not found") || message.includes("could not be identified")) {
    return 404;
  }

  if (
    message.includes("do not have access") ||
    message.includes("cannot accept or decline your own") ||
    message.includes("cannot request collaboration on their own")
  ) {
    return 403;
  }

  if (
    message.includes("already have an active collaboration relationship") ||
    message.includes("already an Ally") ||
    message.includes("not awaiting review")
  ) {
    return 409;
  }

  return 400;
}

function handleServiceError(res: Response, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Initiative collaboration request failed.";
  res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
}

/**
 * Gate mirrors the existing comment/reaction posting gate in
 * initiative-comment.routes.ts: only active, email-verified accounts may
 * take collaboration actions. Returns null (after responding) when blocked.
 */
async function requireEligibleParticipant(req: Request, res: Response): Promise<boolean> {
  const userId = req.auth?.id;

  if (!userId) {
    res.status(401).json(createFailureResponse("Authentication required."));
    return false;
  }

  const authUser = await findAuthUserById(userId);

  if (!authUser || authUser.status !== "active") {
    res
      .status(403)
      .json(createFailureResponse("Your account is restricted and cannot take this action."));
    return false;
  }

  if (authUser.emailVerificationStatus !== "verified") {
    res
      .status(403)
      .json(createFailureResponse("Confirm your email address before taking this action."));
    return false;
  }

  return true;
}

initiativeDiscussionCollaborationRouter.post(
  "/:initiativeId/collaboration-interest",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    if (!(await requireEligibleParticipant(req, res))) {
      return;
    }

    try {
      const identity = await resolveRequestIdentity(req);
      const ally = await expressCollaborationInterest(identity, resolveParam(req.params.initiativeId));

      res.json(createSuccessResponse(ally, "Collaboration interest recorded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeDiscussionCollaborationRouter.post(
  "/:initiativeId/comments/:commentId/proposal-candidate",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    if (!(await requireEligibleParticipant(req, res))) {
      return;
    }

    try {
      const identity = await resolveRequestIdentity(req);
      const candidate = await createProposalCandidateFromComment(
        identity,
        resolveParam(req.params.initiativeId),
        resolveParam(req.params.commentId),
      );

      res.status(201).json(createSuccessResponse(candidate, "Comment marked as a Proposal candidate."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeDiscussionCollaborationRouter.post(
  "/:initiativeId/comments/:commentId/allies-invitation",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    if (!(await requireEligibleParticipant(req, res))) {
      return;
    }

    try {
      const identity = await resolveRequestIdentity(req);
      const ally = await inviteCommentAuthorToAllies(
        identity,
        resolveParam(req.params.initiativeId),
        resolveParam(req.params.commentId),
      );

      res.status(201).json(createSuccessResponse(ally, "Allies invitation sent."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeDiscussionCollaborationRouter.post(
  "/:initiativeId/allies-invitation/respond",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    const response = req.body?.response;

    if (response !== "accept" && response !== "decline") {
      res.status(400).json(createFailureResponse("response must be accept or decline."));
      return;
    }

    try {
      const identity = await resolveRequestIdentity(req);
      const initiativeId = resolveParam(req.params.initiativeId);
      const ally = await respondToAlliesInvitation(identity, initiativeId, response);

      if (response === "accept") {
        // Communication UX Pack 03.5 Part 12 — one real System Event
        // producer: the invitee IS the new Ally here, so they are both the
        // `subject` (the event is about them) and the `actor` (they
        // performed the accept), which correctly excludes them from their
        // own "Ally joined" notification fan-out.
        void postInitiativeCollaborationSystemEvent({
          initiativeId,
          kind: "ally_joined",
          subjectParticipantId: identity.participantId,
          actorParticipantId: identity.participantId,
        }).catch(() => {
          // Swallow: the Collaboration Channel system event must never fail the Allies workflow itself.
        });
      }

      res.json(
        createSuccessResponse(
          ally,
          response === "accept" ? "Allies invitation accepted." : "Allies invitation declined.",
        ),
      );
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

/**
 * Profile UX Pack 01 Parts 5/6 — Initiative Author review of a
 * Participant's own "Ready to Collaborate" request. Mirrors the
 * `/allies-invitation/respond` route's shape (body-driven `response`,
 * `requireJwtAuthenticationMiddleware` only — authorization itself is the
 * steward check inside `respondToCollaborationInterest`, not an extra
 * eligibility gate) but targets a specific `:participantId`, since here the
 * actor (the steward) and the request's owner are different people.
 */
initiativeDiscussionCollaborationRouter.post(
  "/:initiativeId/collaboration-interest/:participantId/respond",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    const response = req.body?.response;

    if (response !== "accept" && response !== "decline") {
      res.status(400).json(createFailureResponse("response must be accept or decline."));
      return;
    }

    try {
      const identity = await resolveRequestIdentity(req);
      const initiativeId = resolveParam(req.params.initiativeId);
      const participantId = resolveParam(req.params.participantId);
      const ally = await respondToCollaborationInterest(identity, initiativeId, participantId, response);

      if (response === "accept") {
        // Communication UX Pack 03.5 Part 12 — here the steward is the
        // `actor` (they performed the accept) and the requester is the
        // `subject` (the event is about them), so the steward is excluded
        // from the notification fan-out but the new Ally is notified.
        void postInitiativeCollaborationSystemEvent({
          initiativeId,
          kind: "ally_joined",
          subjectParticipantId: participantId,
          actorParticipantId: identity.participantId,
        }).catch(() => {
          // Swallow: the Collaboration Channel system event must never fail the Allies workflow itself.
        });
      }

      res.json(
        createSuccessResponse(
          ally,
          response === "accept" ? "Collaboration request accepted." : "Collaboration request declined.",
        ),
      );
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

/**
 * Profile UX Pack 01 Parts 2/8 — compact Collaboration working list for the
 * Discussion → Collaboration tab. Public read (mirrors `GET .../allies`),
 * with `optionalAuthenticationMiddleware` only to resolve
 * `isViewerInitiativeSteward` (which entries render Accept/Decline)
 * without requiring sign-in to view the list itself.
 */
initiativeDiscussionCollaborationRouter.get(
  "/:initiativeId/collaboration-participants",
  optionalAuthenticationMiddleware,
  async (req, res) => {
    try {
      const result = await listCollaborationParticipantsForInitiative(
        resolveParam(req.params.initiativeId),
        req.auth?.memberId ?? null,
      );

      res.json(createSuccessResponse(result, "Collaboration participants loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeDiscussionCollaborationRouter.get("/:initiativeId/allies", async (req, res) => {
  const allies = await listActiveAlliesForInitiative(resolveParam(req.params.initiativeId));

  res.json(createSuccessResponse({ allies }, "Active Allies loaded."));
});

/**
 * Communication UX Pack 03.3 — the Initiative Active Allies widget's one
 * read. Public (mirrors `.../allies` and `.../collaboration-participants`);
 * `optionalAuthenticationMiddleware` only resolves the viewer-scoped
 * `participantId`/`canMessage`/`hasUnreadMessages` fields (Part 20) — a
 * guest request never fails, it simply omits those fields.
 */
initiativeDiscussionCollaborationRouter.get(
  "/:initiativeId/active-allies-team",
  optionalAuthenticationMiddleware,
  async (req, res) => {
    try {
      const team = await getInitiativeActiveAlliesTeam(
        resolveParam(req.params.initiativeId),
        req.auth?.memberId ?? null,
      );

      res.json(createSuccessResponse(team, "Active Allies team loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

export default initiativeDiscussionCollaborationRouter;
