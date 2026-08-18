import assert from "node:assert/strict";
import { afterEach, before, beforeEach, describe, it } from "node:test";

import {
  attachCollaborationStateToComments,
  createProposalCandidateFromComment,
  drainInitiativeCollaborationNotificationsForTests,
  emitInitiativeCollaborationNotification,
  expressCollaborationInterest,
  inviteCommentAuthorToAllies,
  listActiveAlliesForInitiative,
  listCollaborationParticipantsForInitiative,
  respondToAlliesInvitation,
  respondToCollaborationInterest,
  type AllyStore,
  type AuthorIdentityResolver,
  type InitiativeAccessResolver,
  type InitiativeDiscussionCollaborationDependencies,
  type ParticipantIdentityResolver,
  type ProposalCandidateStore,
} from "../../../src/modules/initiative-discussion-collaboration/index.js";
import {
  createInitiativeComment as createMemoryComment,
  resetInitiativeCommentRateLimitsMemoryForTests,
  resetInitiativeCommentStoreForTests,
} from "../../../src/modules/initiative-comments/initiative-comment.memory.store.js";
import type {
  InitiativeAlly,
  InitiativeComment,
  InitiativeDiscussionProposalCandidate,
  PublicInitiativeDiscussionComment,
} from "@hu/types";

/**
 * UX Evolution Pack 02.1 — Recover Durable Persistence swapped the
 * production `AllyStore`/`ProposalCandidateStore` implementations from an
 * in-memory Map to Mongo-backed repositories (see
 * `initiative-discussion-collaboration.service.ts` module doc). This suite
 * substitutes fakes implementing the exact same contracts so the
 * state-machine logic under test here (interest/invite/accept/decline/
 * candidate rules, and the collaboration-indicator projection) stays fully
 * MongoDB-free — it is independent of *where* the one row per key lives.
 * Real Mongo persistence itself (durability, uniqueness, replay) is
 * covered separately in
 * initiative-discussion-collaboration-mongo-persistence.test.ts.
 */
function createFakeAllyStore(): AllyStore {
  const allies = new Map<string, InitiativeAlly>();
  const key = (initiativeId: string, participantId: string) => `${initiativeId}::${participantId}`;

  return {
    async findAlly(initiativeId, participantId) {
      const ally = allies.get(key(initiativeId, participantId));
      return ally ? structuredClone(ally) : null;
    },
    async upsertAlly(ally) {
      allies.set(key(ally.initiativeId, ally.participantId), structuredClone(ally));
      return structuredClone(ally);
    },
    async listAlliesByInitiative(initiativeId) {
      return Array.from(allies.values())
        .filter((ally) => ally.initiativeId === initiativeId)
        .map((ally) => structuredClone(ally));
    },
    async listActiveAlliesByInitiative(initiativeId) {
      return Array.from(allies.values())
        .filter((ally) => ally.initiativeId === initiativeId && ally.status === "active")
        .map((ally) => structuredClone(ally));
    },
    // Profile UX Pack 01 Part 13 — mirrors the real Mongo
    // `findOneAndUpdate({ ..., status: fromStatus })` compare-and-swap: only
    // transitions (and reports `transitioned: true`) when the row is still
    // in `fromStatus` at the moment of the call.
    async transitionAllyStatus({ initiativeId, participantId, fromStatus, toStatus, updatedAt }) {
      const existingKey = key(initiativeId, participantId);
      const existing = allies.get(existingKey);

      if (!existing) {
        throw new Error(
          `No Initiative Ally row found for "${initiativeId}:${participantId}" to transition.`,
        );
      }

      if (existing.status !== fromStatus) {
        return { ally: structuredClone(existing), transitioned: false };
      }

      const updated: InitiativeAlly = { ...existing, status: toStatus, updatedAt };
      allies.set(existingKey, structuredClone(updated));
      return { ally: structuredClone(updated), transitioned: true };
    },
  };
}

function createFakeProposalCandidateStore(): ProposalCandidateStore {
  const candidatesByCommentId = new Map<string, InitiativeDiscussionProposalCandidate>();

  return {
    async findProposalCandidateByCommentId(commentId) {
      const candidate = candidatesByCommentId.get(commentId);
      return candidate ? structuredClone(candidate) : null;
    },
    async createProposalCandidate(candidate) {
      const existing = candidatesByCommentId.get(candidate.sourceCommentId);

      if (existing) {
        return structuredClone(existing);
      }

      candidatesByCommentId.set(candidate.sourceCommentId, structuredClone(candidate));
      return structuredClone(candidate);
    },
    async listProposalCandidatesByCommentIds(commentIds) {
      const result = new Map<string, InitiativeDiscussionProposalCandidate>();

      for (const commentId of commentIds) {
        const candidate = candidatesByCommentId.get(commentId);

        if (candidate) {
          result.set(commentId, structuredClone(candidate));
        }
      }

      return result;
    },
  };
}

/**
 * `mapCommentsToPublicDiscussionComments` (the real projection used by the
 * routes) unconditionally resolves author profiles through MongoDB, just
 * like comment creation's name-snapshot resolution documented in
 * initiative-comment-ancestry.test.ts. To keep this suite MongoDB-free, a
 * minimal fake projection is used here instead — `attachCollaborationState
 * ToComments` only needs `commentId` to line records up with `rawComments`.
 */
function toFakeProjectedComment(comment: InitiativeComment): PublicInitiativeDiscussionComment {
  return {
    commentId: comment.commentId,
    author: { displayName: comment.authorDisplayName },
    authorDisplayName: comment.authorDisplayName,
    body: comment.body,
    createdAt: comment.createdAt,
    replyCount: 0,
    likes: 0,
    dislikes: 0,
    currentUserReaction: "none",
  };
}

/**
 * UX Evolution Pack 02 — Discussion Collaboration Foundation (Part 16 tests).
 *
 * Both Initiative existence/ownership and author-user -> participant
 * identity resolution are injected with fakes here, matching this module's
 * dependency-injection design (see initiative-discussion-collaboration.
 * service.ts module doc). This keeps the state-machine logic in this file
 * fully testable without MongoDB and without writing to the real
 * file-persisted Initiative store. Comments are seeded directly through the
 * in-memory comment store (bypassing the Mongo-dependent author-name
 * resolution used by the real creation path) — the same technique already
 * used by initiative-comment-ancestry.test.ts for MongoDB-free coverage.
 */

const INITIATIVE_ID = "collab-fixture-initiative-1";
const OTHER_INITIATIVE_ID = "collab-fixture-initiative-2";
const STEWARD_PARTICIPANT_ID = "participant-steward-1";
const OTHER_STEWARD_PARTICIPANT_ID = "participant-steward-2";
const AUTHOR_USER_ID = "auth-user-comment-author-1";
const AUTHOR_PARTICIPANT_ID = "participant-comment-author-1";
const SECOND_AUTHOR_USER_ID = "auth-user-comment-author-2";
const SECOND_AUTHOR_PARTICIPANT_ID = "participant-comment-author-2";
const STEWARD_USER_ID = "auth-user-steward-1";
const UNKNOWN_AUTHOR_USER_ID = "auth-user-unresolvable";

const authorIdentityResolver: AuthorIdentityResolver = {
  async resolveParticipantIdForAuthUser(authorUserId) {
    if (authorUserId === AUTHOR_USER_ID) {
      return AUTHOR_PARTICIPANT_ID;
    }

    if (authorUserId === SECOND_AUTHOR_USER_ID) {
      return SECOND_AUTHOR_PARTICIPANT_ID;
    }

    if (authorUserId === STEWARD_USER_ID) {
      return STEWARD_PARTICIPANT_ID;
    }

    return null;
  },
};

const initiativeAccessResolver: InitiativeAccessResolver = {
  getInitiative(initiativeId) {
    if (initiativeId === INITIATIVE_ID) {
      return { initiativeId: INITIATIVE_ID, stewardId: STEWARD_PARTICIPANT_ID };
    }

    if (initiativeId === OTHER_INITIATIVE_ID) {
      return { initiativeId: OTHER_INITIATIVE_ID, stewardId: OTHER_STEWARD_PARTICIPANT_ID };
    }

    return null;
  },
};

// Reassigned fresh in `beforeEach` below so every test gets its own,
// empty fake Ally/Proposal Candidate state — the equivalent of the old
// in-memory Map's per-test `.clear()`, but as a fresh instance rather than
// a shared mutable reset.
let deps: InitiativeDiscussionCollaborationDependencies;

const fakeParticipantIdentityResolver: ParticipantIdentityResolver = {
  async resolveAuthorsForParticipantIds(participantIds) {
    return new Map(
      participantIds.map((participantId) => [
        participantId,
        { displayName: `Participant ${participantId}`, profileUrl: `/member/${participantId}` },
      ]),
    );
  },
};

function buildDeps(): InitiativeDiscussionCollaborationDependencies {
  return {
    authorIdentityResolver,
    initiativeAccessResolver,
    allyStore: createFakeAllyStore(),
    proposalCandidateStore: createFakeProposalCandidateStore(),
    participantIdentityResolver: fakeParticipantIdentityResolver,
    // A no-op notifier keeps this suite MongoDB- and network-free: real
    // notification recipient resolution is exercised separately (it is a
    // thin, already-tested wrapper around the existing notification module).
    notifier: () => {},
  };
}

const stewardIdentity = { participantId: STEWARD_PARTICIPANT_ID };
const otherStewardIdentity = { participantId: OTHER_STEWARD_PARTICIPANT_ID };
const authorIdentity = { participantId: AUTHOR_PARTICIPANT_ID };
const thirdPartyIdentity = { participantId: "participant-third-party-1" };

function seedComment(input: {
  initiativeId?: string;
  authorUserId?: string;
  body?: string;
}) {
  return createMemoryComment({
    initiativeId: input.initiativeId ?? INITIATIVE_ID,
    authorUserId: input.authorUserId ?? AUTHOR_USER_ID,
    authorDisplayName: "Fixture Participant",
    body: input.body ?? "A thoughtful comment about this initiative.",
  });
}

describe("Initiative Discussion Collaboration (UX Evolution Pack 02)", () => {
  let previousPersistenceMode: string | undefined;

  before(() => {
    previousPersistenceMode = process.env.INITIATIVE_COMMENT_PERSISTENCE;
    process.env.INITIATIVE_COMMENT_PERSISTENCE = "memory";
  });

  beforeEach(() => {
    deps = buildDeps();
  });

  afterEach(() => {
    resetInitiativeCommentStoreForTests();

    if (previousPersistenceMode === undefined) {
      delete process.env.INITIATIVE_COMMENT_PERSISTENCE;
    } else {
      process.env.INITIATIVE_COMMENT_PERSISTENCE = previousPersistenceMode;
    }

    process.env.INITIATIVE_COMMENT_PERSISTENCE = "memory";
  });

  describe("Ready to Collaborate (Part 8)", () => {
    it("records Initiative-scoped interest for a participant", async () => {
      const ally = await expressCollaborationInterest(thirdPartyIdentity, INITIATIVE_ID, deps);

      assert.equal(ally.status, "interest_pending");
      assert.equal(ally.participantId, thirdPartyIdentity.participantId);
      assert.equal(ally.requestedByParticipantId, thirdPartyIdentity.participantId);
    });

    it("is idempotent when interest is already pending", async () => {
      const first = await expressCollaborationInterest(thirdPartyIdentity, INITIATIVE_ID, deps);
      const second = await expressCollaborationInterest(thirdPartyIdentity, INITIATIVE_ID, deps);

      assert.equal(second.status, "interest_pending");
      assert.equal(first.createdAt, second.createdAt);
    });

    it("rejects a duplicate interest once already an active Ally", async () => {
      const comment = seedComment({});
      await inviteCommentAuthorToAllies(stewardIdentity, INITIATIVE_ID, comment.commentId, deps);
      await respondToAlliesInvitation(authorIdentity, INITIATIVE_ID, "accept", deps);

      await assert.rejects(
        () => expressCollaborationInterest(authorIdentity, INITIATIVE_ID, deps),
        /already have an active collaboration relationship/,
      );
    });

    it("keeps interest Initiative-scoped: no effect on a different initiative", async () => {
      await expressCollaborationInterest(thirdPartyIdentity, INITIATIVE_ID, deps);
      const alliesOnOtherInitiative = await listActiveAlliesForInitiative(OTHER_INITIATIVE_ID, deps);

      assert.equal(alliesOnOtherInitiative.length, 0);
    });
  });

  describe("Invite to Allies (Part 9)", () => {
    it("lets the steward invite the comment author", async () => {
      const comment = seedComment({});
      const ally = await inviteCommentAuthorToAllies(
        stewardIdentity,
        INITIATIVE_ID,
        comment.commentId,
        deps,
      );

      assert.equal(ally.status, "invitation_pending");
      assert.equal(ally.participantId, AUTHOR_PARTICIPANT_ID);
      assert.equal(ally.requestedByParticipantId, STEWARD_PARTICIPANT_ID);
    });

    it("does not create an Ally before acceptance", async () => {
      const comment = seedComment({});
      await inviteCommentAuthorToAllies(stewardIdentity, INITIATIVE_ID, comment.commentId, deps);

      const activeAllies = await listActiveAlliesForInitiative(INITIATIVE_ID, deps);
      assert.equal(activeAllies.length, 0);
    });

    it("rejects invitations from a non-steward", async () => {
      const comment = seedComment({});

      await assert.rejects(
        () =>
          inviteCommentAuthorToAllies(thirdPartyIdentity, INITIATIVE_ID, comment.commentId, deps),
        /do not have access/,
      );
    });

    it("rejects self-invitation", async () => {
      const comment = seedComment({ authorUserId: STEWARD_USER_ID });

      await assert.rejects(
        () => inviteCommentAuthorToAllies(stewardIdentity, INITIATIVE_ID, comment.commentId, deps),
        /cannot invite yourself/,
      );
    });

    it("treats a duplicate active invitation as idempotent", async () => {
      const comment = seedComment({});
      const first = await inviteCommentAuthorToAllies(
        stewardIdentity,
        INITIATIVE_ID,
        comment.commentId,
        deps,
      );
      const second = await inviteCommentAuthorToAllies(
        stewardIdentity,
        INITIATIVE_ID,
        comment.commentId,
        deps,
      );

      assert.equal(second.status, "invitation_pending");
      assert.equal(first.createdAt, second.createdAt);
    });

    it("rejects inviting a participant who is already an active Ally", async () => {
      const comment = seedComment({});
      await inviteCommentAuthorToAllies(stewardIdentity, INITIATIVE_ID, comment.commentId, deps);
      await respondToAlliesInvitation(authorIdentity, INITIATIVE_ID, "accept", deps);

      await assert.rejects(
        () =>
          inviteCommentAuthorToAllies(stewardIdentity, INITIATIVE_ID, comment.commentId, deps),
        /already an Ally/,
      );
    });

    it("fails safely when the comment author cannot be identified", async () => {
      const comment = seedComment({ authorUserId: UNKNOWN_AUTHOR_USER_ID });

      await assert.rejects(
        () => inviteCommentAuthorToAllies(stewardIdentity, INITIATIVE_ID, comment.commentId, deps),
        /could not be identified/,
      );
    });

    it("rejects acting on a comment that does not belong to the given initiative", async () => {
      const comment = seedComment({ initiativeId: OTHER_INITIATIVE_ID, authorUserId: AUTHOR_USER_ID });

      await assert.rejects(
        () => inviteCommentAuthorToAllies(stewardIdentity, INITIATIVE_ID, comment.commentId, deps),
        /Comment not found/,
      );
    });
  });

  describe("Accept / Decline (Part 9)", () => {
    it("acceptance creates exactly one active Ally", async () => {
      const comment = seedComment({});
      await inviteCommentAuthorToAllies(stewardIdentity, INITIATIVE_ID, comment.commentId, deps);

      const accepted = await respondToAlliesInvitation(
        authorIdentity,
        INITIATIVE_ID,
        "accept",
        deps,
      );

      assert.equal(accepted.status, "active");
      const activeAllies = await listActiveAlliesForInitiative(INITIATIVE_ID, deps);
      assert.equal(activeAllies.length, 1);
      assert.equal(activeAllies[0]?.participantId, AUTHOR_PARTICIPANT_ID);
    });

    it("decline creates no active Ally", async () => {
      const comment = seedComment({});
      await inviteCommentAuthorToAllies(stewardIdentity, INITIATIVE_ID, comment.commentId, deps);

      const declined = await respondToAlliesInvitation(
        authorIdentity,
        INITIATIVE_ID,
        "decline",
        deps,
      );

      assert.equal(declined.status, "declined");
      assert.equal((await listActiveAlliesForInitiative(INITIATIVE_ID, deps)).length, 0);
    });

    it("rejects responding with no pending invitation", async () => {
      await assert.rejects(
        () => respondToAlliesInvitation(authorIdentity, INITIATIVE_ID, "accept", deps),
        /No pending Allies invitation/,
      );
    });

    it("produces an Ally record with no friendship, chat, or file fields", async () => {
      const comment = seedComment({});
      await inviteCommentAuthorToAllies(stewardIdentity, INITIATIVE_ID, comment.commentId, deps);
      const accepted = await respondToAlliesInvitation(
        authorIdentity,
        INITIATIVE_ID,
        "accept",
        deps,
      );

      assert.deepEqual(Object.keys(accepted).sort(), [
        "createdAt",
        "initiativeId",
        "participantId",
        "requestedByParticipantId",
        "status",
        "updatedAt",
      ]);
    });
  });

  describe("Author reviews Ready to Collaborate — Accept / Decline (Profile UX Pack 01 Parts 2/5/6/7/12/13)", () => {
    it("Accept transitions a pending request to active Ally (test 10)", async () => {
      await expressCollaborationInterest(thirdPartyIdentity, INITIATIVE_ID, deps);

      const accepted = await respondToCollaborationInterest(
        stewardIdentity,
        INITIATIVE_ID,
        thirdPartyIdentity.participantId,
        "accept",
        deps,
      );

      assert.equal(accepted.status, "active");
      const activeAllies = await listActiveAlliesForInitiative(INITIATIVE_ID, deps);
      assert.equal(activeAllies.length, 1);
      assert.equal(activeAllies[0]?.participantId, thirdPartyIdentity.participantId);
    });

    it("Decline transitions a pending request to declined (test 14)", async () => {
      await expressCollaborationInterest(thirdPartyIdentity, INITIATIVE_ID, deps);

      const declined = await respondToCollaborationInterest(
        stewardIdentity,
        INITIATIVE_ID,
        thirdPartyIdentity.participantId,
        "decline",
        deps,
      );

      assert.equal(declined.status, "declined");
      assert.equal((await listActiveAlliesForInitiative(INITIATIVE_ID, deps)).length, 0);
    });

    it("rejects Accept from a non-author/non-steward (test 6)", async () => {
      await expressCollaborationInterest(thirdPartyIdentity, INITIATIVE_ID, deps);

      await assert.rejects(
        () =>
          respondToCollaborationInterest(
            otherStewardIdentity,
            INITIATIVE_ID,
            thirdPartyIdentity.participantId,
            "accept",
            deps,
          ),
        /do not have access/,
      );
    });

    it("rejects Decline from a non-author/non-steward (test 7)", async () => {
      await expressCollaborationInterest(thirdPartyIdentity, INITIATIVE_ID, deps);

      await assert.rejects(
        () =>
          respondToCollaborationInterest(
            otherStewardIdentity,
            INITIATIVE_ID,
            thirdPartyIdentity.participantId,
            "decline",
            deps,
          ),
        /do not have access/,
      );
    });

    it("the Initiative Author cannot accept their own collaboration request (test 8)", async () => {
      await assert.rejects(
        () =>
          respondToCollaborationInterest(
            stewardIdentity,
            INITIATIVE_ID,
            stewardIdentity.participantId,
            "accept",
            deps,
          ),
        /cannot accept or decline your own/,
      );
    });

    it("the Initiative Author cannot decline their own collaboration request (test 9)", async () => {
      await assert.rejects(
        () =>
          respondToCollaborationInterest(
            stewardIdentity,
            INITIATIVE_ID,
            stewardIdentity.participantId,
            "decline",
            deps,
          ),
        /cannot accept or decline your own/,
      );
    });

    it("rejects reviewing a request that does not exist for that participant (Part 15 — 404-mapped)", async () => {
      await assert.rejects(
        () =>
          respondToCollaborationInterest(
            stewardIdentity,
            INITIATIVE_ID,
            thirdPartyIdentity.participantId,
            "accept",
            deps,
          ),
        /not found/,
      );
    });

    it("repeated Accept is idempotent — leaves exactly one active Ally and fires exactly one notification (tests 12, 36)", async () => {
      await expressCollaborationInterest(thirdPartyIdentity, INITIATIVE_ID, deps);

      const notifications: string[] = [];
      const spyDeps: InitiativeDiscussionCollaborationDependencies = {
        ...deps,
        notifier: (input) => notifications.push(input.eventType),
      };

      const first = await respondToCollaborationInterest(
        stewardIdentity,
        INITIATIVE_ID,
        thirdPartyIdentity.participantId,
        "accept",
        spyDeps,
      );
      const second = await respondToCollaborationInterest(
        stewardIdentity,
        INITIATIVE_ID,
        thirdPartyIdentity.participantId,
        "accept",
        spyDeps,
      );

      assert.equal(first.status, "active");
      assert.equal(second.status, "active");
      assert.equal((await listActiveAlliesForInitiative(INITIATIVE_ID, spyDeps)).length, 1);
      assert.deepEqual(notifications, ["initiative_collaboration_interest_accepted"]);
    });

    it("Accept then Decline race settles on exactly one committed final state, notifying only once (tests 13, 18, 37)", async () => {
      await expressCollaborationInterest(thirdPartyIdentity, INITIATIVE_ID, deps);

      const notifications: string[] = [];
      const spyDeps: InitiativeDiscussionCollaborationDependencies = {
        ...deps,
        notifier: (input) => notifications.push(input.eventType),
      };

      // Simulates two concurrent requests racing against the same pending
      // row: both call the service, but only the one whose atomic
      // findOneAndUpdate-style CAS matches `fromStatus: interest_pending`
      // actually transitions (see the fake store's transitionAllyStatus).
      const [acceptResult, declineResult] = await Promise.all([
        respondToCollaborationInterest(
          stewardIdentity,
          INITIATIVE_ID,
          thirdPartyIdentity.participantId,
          "accept",
          spyDeps,
        ),
        respondToCollaborationInterest(
          stewardIdentity,
          INITIATIVE_ID,
          thirdPartyIdentity.participantId,
          "decline",
          spyDeps,
        ),
      ]);

      // Both calls return the SAME final, already-committed state.
      assert.equal(acceptResult.status, declineResult.status);
      assert.ok(acceptResult.status === "active" || acceptResult.status === "declined");
      assert.equal(notifications.length, 1);
    });
  });

  describe("Notifications (Part 11)", () => {
    it("notifies the steward, target, and inviter at each step, never the actor themselves", async () => {
      const notifications: Array<{ eventType: string; recipientParticipantId: string }> = [];
      const spyDeps: InitiativeDiscussionCollaborationDependencies = {
        ...deps,
        notifier: (input) =>
          notifications.push({
            eventType: input.eventType,
            recipientParticipantId: input.recipientParticipantId,
          }),
      };

      await expressCollaborationInterest(thirdPartyIdentity, INITIATIVE_ID, spyDeps);
      const comment = seedComment({});
      await inviteCommentAuthorToAllies(stewardIdentity, INITIATIVE_ID, comment.commentId, spyDeps);
      await respondToAlliesInvitation(authorIdentity, INITIATIVE_ID, "accept", spyDeps);

      assert.deepEqual(notifications, [
        {
          eventType: "initiative_collaboration_interest_expressed",
          recipientParticipantId: STEWARD_PARTICIPANT_ID,
        },
        {
          eventType: "initiative_allies_invitation_received",
          recipientParticipantId: AUTHOR_PARTICIPANT_ID,
        },
        {
          eventType: "initiative_allies_invitation_accepted",
          recipientParticipantId: STEWARD_PARTICIPANT_ID,
        },
      ]);
    });

    it("rejects Ready to Collaborate from the Initiative's own steward, so a self-notification can never be reached (Profile UX Pack 01 Part 3)", async () => {
      // Profile UX Pack 01 Part 3 added this validation ahead of persistence
      // and notification, which makes the self-notification case this test
      // used to exercise unreachable through this pathway. Self-notification
      // suppression is still covered independently below, at the real
      // notifier layer.
      const notifications: Array<{ recipientParticipantId: string; actorParticipantId: string }> = [];
      const spyDeps: InitiativeDiscussionCollaborationDependencies = {
        ...deps,
        notifier: (input) =>
          notifications.push({
            recipientParticipantId: input.recipientParticipantId,
            actorParticipantId: input.actorParticipantId,
          }),
      };

      await assert.rejects(
        () => expressCollaborationInterest(stewardIdentity, INITIATIVE_ID, spyDeps),
        /cannot request collaboration on their own initiative/,
      );
      assert.equal(notifications.length, 0);
    });

    it("the real notifier suppresses self-notification before any recipient lookup", async () => {
      // Self-equality is checked first in notify(), before resolveRecipientIdentity
      // is ever called, so this stays MongoDB-free and settles synchronously.
      emitInitiativeCollaborationNotification({
        recipientParticipantId: "participant-x",
        actorParticipantId: "participant-x",
        eventType: "initiative_collaboration_interest_expressed",
        initiativeId: INITIATIVE_ID,
      });

      await drainInitiativeCollaborationNotificationsForTests();
      // No assertion beyond "this resolves without throwing / without an
      // unhandled rejection" — the self-check short-circuits before any I/O.
    });
  });

  describe("Requester result notifications for Accept / Decline (Profile UX Pack 01 Part 14)", () => {
    it("notifies the requester (not the acting steward) on Accept, with the correct event type and Initiative reference", async () => {
      await expressCollaborationInterest(thirdPartyIdentity, INITIATIVE_ID, deps);

      const notifications: Array<{
        eventType: string;
        recipientParticipantId: string;
        initiativeId: string;
      }> = [];
      const spyDeps: InitiativeDiscussionCollaborationDependencies = {
        ...deps,
        notifier: (input) =>
          notifications.push({
            eventType: input.eventType,
            recipientParticipantId: input.recipientParticipantId,
            initiativeId: input.initiativeId,
          }),
      };

      await respondToCollaborationInterest(
        stewardIdentity,
        INITIATIVE_ID,
        thirdPartyIdentity.participantId,
        "accept",
        spyDeps,
      );

      assert.deepEqual(notifications, [
        {
          eventType: "initiative_collaboration_interest_accepted",
          recipientParticipantId: thirdPartyIdentity.participantId,
          initiativeId: INITIATIVE_ID,
        },
      ]);
    });

    it("notifies the requester with neutral wording's event type on Decline", async () => {
      await expressCollaborationInterest(thirdPartyIdentity, INITIATIVE_ID, deps);

      const notifications: Array<{ eventType: string; recipientParticipantId: string }> = [];
      const spyDeps: InitiativeDiscussionCollaborationDependencies = {
        ...deps,
        notifier: (input) =>
          notifications.push({
            eventType: input.eventType,
            recipientParticipantId: input.recipientParticipantId,
          }),
      };

      await respondToCollaborationInterest(
        stewardIdentity,
        INITIATIVE_ID,
        thirdPartyIdentity.participantId,
        "decline",
        spyDeps,
      );

      assert.deepEqual(notifications, [
        {
          eventType: "initiative_collaboration_interest_declined",
          recipientParticipantId: thirdPartyIdentity.participantId,
        },
      ]);
    });

    it("never fires a notification for an idempotent Accept/Decline replay after the request is already resolved", async () => {
      await expressCollaborationInterest(thirdPartyIdentity, INITIATIVE_ID, deps);

      const notifications: string[] = [];
      const spyDeps: InitiativeDiscussionCollaborationDependencies = {
        ...deps,
        notifier: (input) => notifications.push(input.eventType),
      };

      await respondToCollaborationInterest(
        stewardIdentity,
        INITIATIVE_ID,
        thirdPartyIdentity.participantId,
        "decline",
        spyDeps,
      );
      // A second Decline (or an Accept) after the request is already
      // resolved is a no-op — no error, no second notification.
      await respondToCollaborationInterest(
        stewardIdentity,
        INITIATIVE_ID,
        thirdPartyIdentity.participantId,
        "decline",
        spyDeps,
      );

      assert.equal(notifications.length, 1);
    });
  });

  describe("Collaboration working list — Discussion → Collaboration tab (Profile UX Pack 01 Parts 2/8/16)", () => {
    it("includes interest_pending and active, in one entry per participant (tests 17, 18)", async () => {
      await expressCollaborationInterest(thirdPartyIdentity, INITIATIVE_ID, deps);
      const secondRequester = { participantId: "participant-second-requester" };
      await expressCollaborationInterest(secondRequester, INITIATIVE_ID, deps);
      await respondToCollaborationInterest(
        stewardIdentity,
        INITIATIVE_ID,
        secondRequester.participantId,
        "accept",
        deps,
      );

      const result = await listCollaborationParticipantsForInitiative(
        INITIATIVE_ID,
        stewardIdentity.participantId,
        deps,
      );

      assert.equal(result.participants.length, 2);
      const statuses = result.participants.map((entry) => entry.status).sort();
      assert.deepEqual(statuses, ["active", "interest_pending"]);
    });

    it("excludes declined requests from the working list (test 16)", async () => {
      await expressCollaborationInterest(thirdPartyIdentity, INITIATIVE_ID, deps);
      await respondToCollaborationInterest(
        stewardIdentity,
        INITIATIVE_ID,
        thirdPartyIdentity.participantId,
        "decline",
        deps,
      );

      const result = await listCollaborationParticipantsForInitiative(
        INITIATIVE_ID,
        stewardIdentity.participantId,
        deps,
      );

      assert.equal(result.participants.length, 0);
    });

    it("deduplicates by (initiativeId, participantId) — one entry even if the same participant would otherwise appear twice (test 21)", async () => {
      await expressCollaborationInterest(thirdPartyIdentity, INITIATIVE_ID, deps);
      // A second, redundant "Ready to Collaborate" click is itself
      // idempotent (see the Ready to Collaborate suite above); this
      // confirms the working list still surfaces exactly one row.
      await expressCollaborationInterest(thirdPartyIdentity, INITIATIVE_ID, deps);

      const result = await listCollaborationParticipantsForInitiative(
        INITIATIVE_ID,
        stewardIdentity.participantId,
        deps,
      );

      assert.equal(result.participants.length, 1);
    });

    it("projects a public profile URL for each participant (test 22)", async () => {
      await expressCollaborationInterest(thirdPartyIdentity, INITIATIVE_ID, deps);

      const result = await listCollaborationParticipantsForInitiative(
        INITIATIVE_ID,
        stewardIdentity.participantId,
        deps,
      );

      assert.equal(result.participants[0]?.author.profileUrl, `/member/${thirdPartyIdentity.participantId}`);
    });

    it("falls back to a safe display name (no broken link) when the identity resolver has nothing for a participant (test 23)", async () => {
      await expressCollaborationInterest(thirdPartyIdentity, INITIATIVE_ID, deps);

      const emptyIdentityDeps: InitiativeDiscussionCollaborationDependencies = {
        ...deps,
        participantIdentityResolver: { async resolveAuthorsForParticipantIds() {
          return new Map();
        } },
      };

      const result = await listCollaborationParticipantsForInitiative(
        INITIATIVE_ID,
        stewardIdentity.participantId,
        emptyIdentityDeps,
      );

      assert.equal(result.participants[0]?.author.displayName, "Participant");
      assert.equal(result.participants[0]?.author.profileUrl, undefined);
    });

    it("marks isViewerInitiativeSteward true only for the Initiative's own steward viewer", async () => {
      await expressCollaborationInterest(thirdPartyIdentity, INITIATIVE_ID, deps);

      const asSteward = await listCollaborationParticipantsForInitiative(
        INITIATIVE_ID,
        stewardIdentity.participantId,
        deps,
      );
      const asGuest = await listCollaborationParticipantsForInitiative(INITIATIVE_ID, null, deps);

      assert.equal(asSteward.isViewerInitiativeSteward, true);
      assert.equal(asGuest.isViewerInitiativeSteward, false);
    });

    it("Communication UX Pack 03.8 Part 11 — never surfaces the Initiative Author's own row, even if a malformed self-Ally record exists in the store", async () => {
      await expressCollaborationInterest(thirdPartyIdentity, INITIATIVE_ID, deps);

      // Simulates a pre-existing malformed legacy record (bypasses the
      // guarded `expressCollaborationInterest`/`inviteToAllies` write
      // paths entirely, exactly as real invalid legacy data would have
      // been written before those guards existed) — the read path must
      // still never surface it, so Accept/Decline can never render beside
      // the Initiative Author (the underlying bug this test reproduces).
      await deps.allyStore.upsertAlly({
        initiativeId: INITIATIVE_ID,
        participantId: stewardIdentity.participantId,
        status: "interest_pending",
        requestedByParticipantId: stewardIdentity.participantId,
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      });

      const result = await listCollaborationParticipantsForInitiative(
        INITIATIVE_ID,
        stewardIdentity.participantId,
        deps,
      );

      assert.equal(result.participants.length, 1);
      assert.equal(
        result.participants.some((entry) => entry.participantId === stewardIdentity.participantId),
        false,
      );
    });
  });

  describe("Allies remain Initiative-scoped (Part 7 / 22 / 23)", () => {
    it("one participant may be active in one initiative without being an Ally in another", async () => {
      const commentOnFirst = seedComment({ initiativeId: INITIATIVE_ID });
      await inviteCommentAuthorToAllies(
        stewardIdentity,
        INITIATIVE_ID,
        commentOnFirst.commentId,
        deps,
      );
      await respondToAlliesInvitation(authorIdentity, INITIATIVE_ID, "accept", deps);

      assert.equal((await listActiveAlliesForInitiative(INITIATIVE_ID, deps)).length, 1);
      assert.equal((await listActiveAlliesForInitiative(OTHER_INITIATIVE_ID, deps)).length, 0);

      const commentOnSecond = seedComment({
        initiativeId: OTHER_INITIATIVE_ID,
        authorUserId: SECOND_AUTHOR_USER_ID,
      });
      await inviteCommentAuthorToAllies(
        otherStewardIdentity,
        OTHER_INITIATIVE_ID,
        commentOnSecond.commentId,
        deps,
      );

      // Still invitation_pending on the second initiative — not auto-active.
      assert.equal((await listActiveAlliesForInitiative(OTHER_INITIATIVE_ID, deps)).length, 0);
    });
  });

  describe("Proposal Candidate (Part 6)", () => {
    it("preserves the source comment's provenance", async () => {
      const comment = seedComment({ body: "This section needs a clearer rationale." });
      const candidate = await createProposalCandidateFromComment(
        thirdPartyIdentity,
        INITIATIVE_ID,
        comment.commentId,
        deps,
      );

      assert.equal(candidate.initiativeId, INITIATIVE_ID);
      assert.equal(candidate.sourceCommentId, comment.commentId);
      assert.equal(candidate.sourceParticipantId, AUTHOR_PARTICIPANT_ID);
      assert.equal(candidate.creatorParticipantId, thirdPartyIdentity.participantId);
      assert.equal(candidate.commentText, "This section needs a clearer rationale.");
      assert.equal(candidate.status, "candidate");
    });

    it("does not create a duplicate candidate for the same comment", async () => {
      const comment = seedComment({});
      const first = await createProposalCandidateFromComment(
        thirdPartyIdentity,
        INITIATIVE_ID,
        comment.commentId,
        deps,
      );
      const second = await createProposalCandidateFromComment(
        authorIdentity,
        INITIATIVE_ID,
        comment.commentId,
        deps,
      );

      assert.equal(first.candidateId, second.candidateId);
      assert.equal(second.creatorParticipantId, thirdPartyIdentity.participantId);
    });

    it("rejects candidates from a comment outside the given initiative (no invalid ancestry persists)", async () => {
      const comment = seedComment({ initiativeId: OTHER_INITIATIVE_ID });

      await assert.rejects(
        () =>
          createProposalCandidateFromComment(thirdPartyIdentity, INITIATIVE_ID, comment.commentId, deps),
        /Comment not found/,
      );
    });

    it("leaves the original comment body untouched", async () => {
      const comment = seedComment({ body: "Original wording." });
      await createProposalCandidateFromComment(
        thirdPartyIdentity,
        INITIATIVE_ID,
        comment.commentId,
        deps,
      );

      assert.equal(comment.body, "Original wording.");
    });
  });

  describe("Comment collaboration state / indicators (Part 13 / 17)", () => {
    it("reflects proposal-candidate and Ally indicators per comment", async () => {
      const authorComment = seedComment({ body: "First." });
      const thirdPartyRawComment = seedComment({
        authorUserId: STEWARD_USER_ID,
        body: "Second.",
      });

      await createProposalCandidateFromComment(
        thirdPartyIdentity,
        INITIATIVE_ID,
        authorComment.commentId,
        deps,
      );
      await expressCollaborationInterest(thirdPartyIdentity, INITIATIVE_ID, deps);

      const rawComments = [authorComment, thirdPartyRawComment];
      const projected = rawComments.map(toFakeProjectedComment);
      const withCollaboration = await attachCollaborationStateToComments({
        initiativeId: INITIATIVE_ID,
        rawComments,
        projectedComments: projected,
        viewerParticipantId: STEWARD_PARTICIPANT_ID,
        deps,
      });

      const authorEntry = withCollaboration.find((c) => c.commentId === authorComment.commentId);
      assert.equal(authorEntry?.collaboration?.proposalCandidateStatus, "candidate");
      assert.equal(authorEntry?.collaboration?.canMarkProposal, false);
      // Steward viewer inviting the comment author (not themselves): allowed.
      assert.equal(authorEntry?.collaboration?.canInviteToAllies, true);

      const stewardCommentEntry = withCollaboration.find(
        (c) => c.commentId === thirdPartyRawComment.commentId,
      );
      // The steward is inviting themselves here (their own comment) -> disallowed.
      assert.equal(stewardCommentEntry?.collaboration?.canInviteToAllies, false);
    });

    it("hides Invite to Allies once the author already has a pending invitation", async () => {
      const comment = seedComment({});
      await inviteCommentAuthorToAllies(stewardIdentity, INITIATIVE_ID, comment.commentId, deps);

      const projected = [toFakeProjectedComment(comment)];
      const withCollaboration = await attachCollaborationStateToComments({
        initiativeId: INITIATIVE_ID,
        rawComments: [comment],
        projectedComments: projected,
        viewerParticipantId: STEWARD_PARTICIPANT_ID,
        deps,
      });

      assert.equal(withCollaboration[0]?.collaboration?.authorAllyStatus, "invitation_pending");
      assert.equal(withCollaboration[0]?.collaboration?.canInviteToAllies, false);
    });

    it("does not expose collaboration actions to an unauthenticated viewer", async () => {
      const comment = seedComment({});
      const projected = [toFakeProjectedComment(comment)];
      const withCollaboration = await attachCollaborationStateToComments({
        initiativeId: INITIATIVE_ID,
        rawComments: [comment],
        projectedComments: projected,
        viewerParticipantId: null,
        deps,
      });

      assert.equal(withCollaboration[0]?.collaboration?.canMarkProposal, false);
      assert.equal(withCollaboration[0]?.collaboration?.canReadyToCollaborate, false);
      assert.equal(withCollaboration[0]?.collaboration?.canInviteToAllies, false);
      // UX Evolution Pack 02.3 — an unauthenticated viewer still has a
      // deterministic (never-active) collaboration status, and comment
      // authorship/stewardship facts are computed independent of the
      // viewer's own identity.
      assert.equal(withCollaboration[0]?.collaboration?.viewerAllyStatus, "none");
      assert.equal(withCollaboration[0]?.collaboration?.isViewerAuthor, false);
      assert.equal(withCollaboration[0]?.collaboration?.isViewerInitiativeSteward, false);
    });

    it("hides Ready to Collaborate for the Initiative Author/steward (eligibility not inverted)", async () => {
      const comment = seedComment({});
      const projected = [toFakeProjectedComment(comment)];
      const withCollaboration = await attachCollaborationStateToComments({
        initiativeId: INITIATIVE_ID,
        rawComments: [comment],
        projectedComments: projected,
        viewerParticipantId: STEWARD_PARTICIPANT_ID,
        deps,
      });

      assert.equal(withCollaboration[0]?.collaboration?.isViewerInitiativeSteward, true);
      assert.equal(withCollaboration[0]?.collaboration?.canReadyToCollaborate, false);
    });

    it("exposes Ready to Collaborate for an eligible authenticated Participant", async () => {
      const comment = seedComment({});
      const projected = [toFakeProjectedComment(comment)];
      const withCollaboration = await attachCollaborationStateToComments({
        initiativeId: INITIATIVE_ID,
        rawComments: [comment],
        projectedComments: projected,
        viewerParticipantId: thirdPartyIdentity.participantId,
        deps,
      });

      assert.equal(withCollaboration[0]?.collaboration?.isViewerInitiativeSteward, false);
      assert.equal(withCollaboration[0]?.collaboration?.canReadyToCollaborate, true);
      assert.equal(withCollaboration[0]?.collaboration?.viewerAllyStatus, "none");
    });

    it("expressCollaborationInterest updates canonical Ally to interest_pending", async () => {
      const ally = await expressCollaborationInterest(thirdPartyIdentity, INITIATIVE_ID, deps);
      assert.equal(ally.status, "interest_pending");
      assert.equal(ally.participantId, thirdPartyIdentity.participantId);

      const comment = seedComment({});
      const projected = [toFakeProjectedComment(comment)];
      const withCollaboration = await attachCollaborationStateToComments({
        initiativeId: INITIATIVE_ID,
        rawComments: [comment],
        projectedComments: projected,
        viewerParticipantId: thirdPartyIdentity.participantId,
        deps,
      });

      assert.equal(withCollaboration[0]?.collaboration?.viewerAllyStatus, "interest_pending");
      assert.equal(withCollaboration[0]?.collaboration?.canReadyToCollaborate, false);
    });
  });

  describe("Comment collaboration state — badges and completed-state fields (Pack 02.3)", () => {
    it("marks a comment authored by the Initiative steward with isAuthorInitiativeSteward", async () => {
      const stewardComment = seedComment({ authorUserId: STEWARD_USER_ID, body: "From the steward." });
      const projected = [toFakeProjectedComment(stewardComment)];
      const withCollaboration = await attachCollaborationStateToComments({
        initiativeId: INITIATIVE_ID,
        rawComments: [stewardComment],
        projectedComments: projected,
        viewerParticipantId: thirdPartyIdentity.participantId,
        deps,
      });

      assert.equal(withCollaboration[0]?.collaboration?.isAuthorInitiativeSteward, true);
    });

    it("does not mark a non-steward comment author as the Initiative steward", async () => {
      const comment = seedComment({});
      const projected = [toFakeProjectedComment(comment)];
      const withCollaboration = await attachCollaborationStateToComments({
        initiativeId: INITIATIVE_ID,
        rawComments: [comment],
        projectedComments: projected,
        viewerParticipantId: STEWARD_PARTICIPANT_ID,
        deps,
      });

      assert.equal(withCollaboration[0]?.collaboration?.isAuthorInitiativeSteward, false);
    });

    it("marks isViewerAuthor true only when the viewer is that comment's author", async () => {
      const comment = seedComment({});
      const projected = [toFakeProjectedComment(comment)];

      const viewerIsAuthor = await attachCollaborationStateToComments({
        initiativeId: INITIATIVE_ID,
        rawComments: [comment],
        projectedComments: projected,
        viewerParticipantId: AUTHOR_PARTICIPANT_ID,
        deps,
      });
      assert.equal(viewerIsAuthor[0]?.collaboration?.isViewerAuthor, true);

      const viewerIsNotAuthor = await attachCollaborationStateToComments({
        initiativeId: INITIATIVE_ID,
        rawComments: [comment],
        projectedComments: projected,
        viewerParticipantId: thirdPartyIdentity.participantId,
        deps,
      });
      assert.equal(viewerIsNotAuthor[0]?.collaboration?.isViewerAuthor, false);
    });

    it("marks isViewerInitiativeSteward true only for the Initiative's own steward", async () => {
      const comment = seedComment({});
      const projected = [toFakeProjectedComment(comment)];

      const asSteward = await attachCollaborationStateToComments({
        initiativeId: INITIATIVE_ID,
        rawComments: [comment],
        projectedComments: projected,
        viewerParticipantId: STEWARD_PARTICIPANT_ID,
        deps,
      });
      assert.equal(asSteward[0]?.collaboration?.isViewerInitiativeSteward, true);

      const asOtherStewardElsewhere = await attachCollaborationStateToComments({
        initiativeId: INITIATIVE_ID,
        rawComments: [comment],
        projectedComments: projected,
        viewerParticipantId: OTHER_STEWARD_PARTICIPANT_ID,
        deps,
      });
      assert.equal(asOtherStewardElsewhere[0]?.collaboration?.isViewerInitiativeSteward, false);
    });

    it("exposes authorParticipantId so the frontend Collaboration filter can deduplicate one entry per Participant (Pack 02.4 Part 7)", async () => {
      const comment = seedComment({});
      const projected = [toFakeProjectedComment(comment)];
      const withCollaboration = await attachCollaborationStateToComments({
        initiativeId: INITIATIVE_ID,
        rawComments: [comment],
        projectedComments: projected,
        viewerParticipantId: STEWARD_PARTICIPANT_ID,
        deps,
      });

      assert.equal(withCollaboration[0]?.collaboration?.authorParticipantId, AUTHOR_PARTICIPANT_ID);
    });

    it("reflects the viewer's OWN Ally status via viewerAllyStatus, independent of the comment author's", async () => {
      const comment = seedComment({ authorUserId: SECOND_AUTHOR_USER_ID });
      await expressCollaborationInterest(thirdPartyIdentity, INITIATIVE_ID, deps);

      const projected = [toFakeProjectedComment(comment)];
      const withCollaboration = await attachCollaborationStateToComments({
        initiativeId: INITIATIVE_ID,
        rawComments: [comment],
        projectedComments: projected,
        viewerParticipantId: thirdPartyIdentity.participantId,
        deps,
      });

      // Viewer has expressed interest, but did not author this comment.
      assert.equal(withCollaboration[0]?.collaboration?.viewerAllyStatus, "interest_pending");
      assert.equal(withCollaboration[0]?.collaboration?.authorAllyStatus, "none");
    });
  });

  describe("Batch author resolution (Performance Recovery Task Part 6/9)", () => {
    /**
     * `attachCollaborationStateToComments` previously resolved each unique
     * comment author with its own `Promise.all`-parallel call to
     * `resolveParticipantIdForAuthUser` (N Mongo round trips for N unique
     * authors). It now prefers a single batched
     * `resolveParticipantIdsForAuthUsers` call when the resolver provides
     * one. This spy counts invocations of both methods to prove the batch
     * path is actually used, and is never called per-comment.
     */
    function createSpyBatchResolver() {
      let batchCalls = 0;
      let singleCalls = 0;
      let lastBatchInput: readonly string[] = [];

      const resolver: AuthorIdentityResolver = {
        async resolveParticipantIdForAuthUser(authorUserId) {
          singleCalls += 1;
          return authorIdentityResolver.resolveParticipantIdForAuthUser(authorUserId);
        },
        async resolveParticipantIdsForAuthUsers(authorUserIds) {
          batchCalls += 1;
          lastBatchInput = authorUserIds;
          const resolved = new Map<string, string | null>();

          for (const authorUserId of authorUserIds) {
            resolved.set(
              authorUserId,
              await authorIdentityResolver.resolveParticipantIdForAuthUser(authorUserId),
            );
          }

          return resolved;
        },
      };

      return {
        resolver,
        get batchCalls() {
          return batchCalls;
        },
        get singleCalls() {
          return singleCalls;
        },
        get lastBatchInput() {
          return lastBatchInput;
        },
      };
    }

    it("resolves multiple unique comment authors with exactly one batched call, never per-comment", async () => {
      const spy = createSpyBatchResolver();
      const spyDeps: InitiativeDiscussionCollaborationDependencies = {
        ...deps,
        authorIdentityResolver: spy.resolver,
      };

      const firstAuthorComment = seedComment({ authorUserId: AUTHOR_USER_ID, body: "First." });
      const secondAuthorComment = seedComment({
        authorUserId: SECOND_AUTHOR_USER_ID,
        body: "Second.",
      });
      // The memory comment store rate-limits repeated posts by the same
      // author; reset it here purely so this fixture can seed two comments
      // from the SAME author in the same test (to prove de-duplication),
      // without asserting anything about rate limiting itself.
      resetInitiativeCommentRateLimitsMemoryForTests();
      const thirdCommentBySameAuthor = seedComment({
        authorUserId: AUTHOR_USER_ID,
        body: "Third, same author as first.",
      });

      const rawComments = [firstAuthorComment, secondAuthorComment, thirdCommentBySameAuthor];
      const projected = rawComments.map(toFakeProjectedComment);

      const withCollaboration = await attachCollaborationStateToComments({
        initiativeId: INITIATIVE_ID,
        rawComments,
        projectedComments: projected,
        viewerParticipantId: STEWARD_PARTICIPANT_ID,
        deps: spyDeps,
      });

      assert.equal(spy.batchCalls, 1, "expected exactly one batched resolution call");
      assert.equal(spy.singleCalls, 0, "expected the per-author fallback to never run");
      assert.deepEqual(
        [...spy.lastBatchInput].sort(),
        [AUTHOR_USER_ID, SECOND_AUTHOR_USER_ID].sort(),
        "expected the batch call to receive de-duplicated unique author ids",
      );

      const first = withCollaboration.find((c) => c.commentId === firstAuthorComment.commentId);
      const second = withCollaboration.find((c) => c.commentId === secondAuthorComment.commentId);
      const third = withCollaboration.find(
        (c) => c.commentId === thirdCommentBySameAuthor.commentId,
      );

      assert.equal(first?.collaboration?.authorParticipantId, AUTHOR_PARTICIPANT_ID);
      assert.equal(second?.collaboration?.authorParticipantId, SECOND_AUTHOR_PARTICIPANT_ID);
      assert.equal(third?.collaboration?.authorParticipantId, AUTHOR_PARTICIPANT_ID);
    });

    it("falls back to the per-author resolver when no batch method is provided (existing fakes keep working)", async () => {
      const comment = seedComment({ authorUserId: AUTHOR_USER_ID });
      const projected = [toFakeProjectedComment(comment)];

      // `deps.authorIdentityResolver` here is the module-level
      // `authorIdentityResolver` fixture, which only implements the
      // single-id method — this is the same fake every other test in this
      // file already relies on.
      const withCollaboration = await attachCollaborationStateToComments({
        initiativeId: INITIATIVE_ID,
        rawComments: [comment],
        projectedComments: projected,
        viewerParticipantId: STEWARD_PARTICIPANT_ID,
        deps,
      });

      assert.equal(withCollaboration[0]?.collaboration?.authorParticipantId, AUTHOR_PARTICIPANT_ID);
    });
  });
});
