import { randomUUID } from "node:crypto";

import type {
  InitiativeAlly,
  InitiativeAllyStatus,
  InitiativeComment,
  InitiativeDiscussionProposalCandidate,
  PublicCommentAuthor,
  PublicCommentCollaborationState,
  PublicInitiativeCollaborationParticipant,
  PublicInitiativeCollaborationParticipantsResult,
  PublicInitiativeDiscussionComment,
} from "@hu/types";

import { findAuthUserById, findAuthUsersByIds } from "../auth/auth-user.repository.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { getInitiativeCommentById } from "../initiative-comments/initiative-comment.service.js";
import {
  findAlly,
  listActiveAlliesByInitiative,
  listAlliesByInitiative,
  transitionAllyStatus,
  upsertAlly,
} from "./initiative-ally.store.js";
import {
  createProposalCandidate,
  findProposalCandidateByCommentId,
  listProposalCandidatesByCommentIds,
} from "./initiative-proposal-candidate.store.js";
import {
  emitInitiativeCollaborationNotification,
  type CollaborationNotificationInput,
} from "./initiative-discussion-collaboration-notifications.js";
import { resolvePublicAuthorsForParticipantIds } from "./public-participant-identity.projection.js";
import type { AllyStatusTransitionResult } from "./persistence/initiative-ally.repository.js";

/**
 * UX Evolution Pack 02 — Discussion Collaboration Foundation.
 * UX Evolution Pack 02.1 — Recover Durable Persistence.
 *
 * Several boundaries are injectable so this module's core state-machine
 * logic can be unit-tested without MongoDB and without touching the real
 * (file-persisted) Initiative store:
 *
 * - `AuthorIdentityResolver` bridges comment `authorUserId` (an auth account
 *   id) to `participantId` (the auth account's `memberId`), which is what
 *   Initiative ownership and Allies are keyed by. Resolving it for real
 *   requires MongoDB (auth-user lookups are unconditionally Mongo-backed).
 * - `InitiativeAccessResolver` looks up an Initiative's id/steward for
 *   existence + ownership checks, mirroring the existing
 *   `InitiativeCommentAncestryDependencies` pattern in
 *   initiative-comment.service.ts.
 * - `AllyStore` / `ProposalCandidateStore` are the persistence boundaries
 *   for the two durable Mongo-backed entities this module owns (Pack
 *   02.1). Defaulting to the real Mongo-backed stores keeps this module's
 *   own persistence swap (in-memory Map -> Mongo) fully transparent to
 *   callers, while still letting the regression suite substitute a fake,
 *   in-process implementation of the exact same contract — the state
 *   machine under test (interest/invite/accept/decline/candidate rules) is
 *   independent of *where* the one row per key is stored.
 *
 * All default to the real implementations; only tests substitute fakes.
 */
export interface AuthorIdentityResolver {
  resolveParticipantIdForAuthUser(authorUserId: string): Promise<string | null>;
  /**
   * Performance Recovery Task — optional batch counterpart to
   * `resolveParticipantIdForAuthUser`. When present, `attachCollaborationStateToComments`
   * uses it to resolve every unique comment author with a single call
   * instead of one call per unique author (previously N parallel Mongo
   * round trips for N unique authors). Optional so existing test fakes
   * that only implement the single-id method keep working unchanged via
   * the per-id fallback in `attachCollaborationStateToComments`.
   */
  resolveParticipantIdsForAuthUsers?(
    authorUserIds: readonly string[],
  ): Promise<Map<string, string | null>>;
}

const defaultAuthorIdentityResolver: AuthorIdentityResolver = {
  async resolveParticipantIdForAuthUser(authorUserId) {
    const authUser = await findAuthUserById(authorUserId);
    return authUser?.memberId ?? null;
  },
  async resolveParticipantIdsForAuthUsers(authorUserIds) {
    const authUsersById = await findAuthUsersByIds(authorUserIds);
    return new Map(
      authorUserIds.map((authorUserId) => [
        authorUserId,
        authUsersById.get(authorUserId)?.memberId ?? null,
      ]),
    );
  },
};

export interface InitiativeAccessSummary {
  initiativeId: string;
  stewardId: string;
}

export interface InitiativeAccessResolver {
  getInitiative(initiativeId: string): InitiativeAccessSummary | null;
}

const defaultInitiativeAccessResolver: InitiativeAccessResolver = {
  getInitiative(initiativeId) {
    const initiative = getInitiativeById(initiativeId);
    return initiative
      ? { initiativeId: initiative.initiativeId, stewardId: initiative.stewardId }
      : null;
  },
};

/** Persistence boundary for Initiative-scoped Ally relationships (Pack 02.1). */
export interface AllyStore {
  findAlly(initiativeId: string, participantId: string): Promise<InitiativeAlly | null>;
  upsertAlly(ally: InitiativeAlly): Promise<InitiativeAlly>;
  listAlliesByInitiative(initiativeId: string): Promise<InitiativeAlly[]>;
  listActiveAlliesByInitiative(initiativeId: string): Promise<InitiativeAlly[]>;
  /**
   * Profile UX Pack 01 Part 5/6/13 — atomic Accept/Decline
   * compare-and-swap; see `transitionInitiativeAllyStatus` in the
   * persistence layer for why a blind upsert cannot safely express this.
   */
  transitionAllyStatus(input: {
    initiativeId: string;
    participantId: string;
    fromStatus: InitiativeAllyStatus;
    toStatus: InitiativeAllyStatus;
    updatedAt: string;
  }): Promise<AllyStatusTransitionResult>;
}

const defaultAllyStore: AllyStore = {
  findAlly,
  upsertAlly,
  listAlliesByInitiative,
  listActiveAlliesByInitiative,
  transitionAllyStatus,
};

/**
 * Profile UX Pack 01 — resolves public-safe author identity (avatar,
 * display name, profile link) for a batch of Ally `participantId`s. Kept
 * injectable so the Collaboration review list / Workspace Allies logic in
 * this module stay MongoDB-free under test, mirroring
 * `AuthorIdentityResolver`.
 */
export interface ParticipantIdentityResolver {
  resolveAuthorsForParticipantIds(
    participantIds: readonly string[],
  ): Promise<Map<string, PublicCommentAuthor>>;
}

const defaultParticipantIdentityResolver: ParticipantIdentityResolver = {
  resolveAuthorsForParticipantIds: resolvePublicAuthorsForParticipantIds,
};

/** Persistence boundary for Discussion -> Proposal Candidates (Pack 02.1). */
export interface ProposalCandidateStore {
  findProposalCandidateByCommentId(
    commentId: string,
  ): Promise<InitiativeDiscussionProposalCandidate | null>;
  createProposalCandidate(
    candidate: InitiativeDiscussionProposalCandidate,
  ): Promise<InitiativeDiscussionProposalCandidate>;
  listProposalCandidatesByCommentIds(
    commentIds: readonly string[],
  ): Promise<Map<string, InitiativeDiscussionProposalCandidate>>;
}

const defaultProposalCandidateStore: ProposalCandidateStore = {
  findProposalCandidateByCommentId,
  createProposalCandidate,
  listProposalCandidatesByCommentIds,
};

export interface InitiativeDiscussionCollaborationDependencies {
  authorIdentityResolver: AuthorIdentityResolver;
  initiativeAccessResolver: InitiativeAccessResolver;
  allyStore: AllyStore;
  proposalCandidateStore: ProposalCandidateStore;
  participantIdentityResolver: ParticipantIdentityResolver;
  /**
   * Injectable so unit tests never trigger real (Mongo-backed) notification
   * recipient resolution. Defaults to the real fire-and-forget emitter.
   */
  notifier: (input: CollaborationNotificationInput) => void;
}

const defaultDependencies: InitiativeDiscussionCollaborationDependencies = {
  authorIdentityResolver: defaultAuthorIdentityResolver,
  initiativeAccessResolver: defaultInitiativeAccessResolver,
  allyStore: defaultAllyStore,
  proposalCandidateStore: defaultProposalCandidateStore,
  participantIdentityResolver: defaultParticipantIdentityResolver,
  notifier: emitInitiativeCollaborationNotification,
};

function nowIso(): string {
  return new Date().toISOString();
}

function requireInitiative(
  initiativeId: string,
  resolver: InitiativeAccessResolver,
): InitiativeAccessSummary {
  const initiative = resolver.getInitiative(initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  return initiative;
}

async function requireApprovedComment(
  initiativeId: string,
  commentId: string,
): Promise<InitiativeComment> {
  const comment = await getInitiativeCommentById(commentId);

  if (!comment || comment.initiativeId !== initiativeId) {
    throw new Error("Comment not found.");
  }

  return comment;
}

/**
 * Part 8 — Ready to Collaborate. Initiative-scoped, not comment-scoped: the
 * button may be rendered under any comment, but always acts on
 * (initiativeId, viewer), never on the comment's author.
 */
export async function expressCollaborationInterest(
  identity: RequestIdentity,
  initiativeId: string,
  deps: InitiativeDiscussionCollaborationDependencies = defaultDependencies,
): Promise<InitiativeAlly> {
  const initiative = requireInitiative(initiativeId, deps.initiativeAccessResolver);

  if (initiative.stewardId === identity.participantId) {
    throw new Error("Initiative Authors cannot request collaboration on their own initiative.");
  }

  const existing = await deps.allyStore.findAlly(initiativeId, identity.participantId);

  if (existing?.status === "interest_pending") {
    return existing;
  }

  if (existing?.status === "active" || existing?.status === "invitation_pending") {
    throw new Error(
      "You already have an active collaboration relationship for this initiative.",
    );
  }

  const timestamp = nowIso();
  const ally: InitiativeAlly = {
    initiativeId,
    participantId: identity.participantId,
    status: "interest_pending",
    requestedByParticipantId: identity.participantId,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };

  await deps.allyStore.upsertAlly(ally);

  deps.notifier({
    recipientParticipantId: initiative.stewardId,
    actorParticipantId: identity.participantId,
    eventType: "initiative_collaboration_interest_expressed",
    initiativeId,
  });

  return ally;
}

/**
 * Part 9 — Invite to Allies. Only the Initiative steward may invite, the
 * target is always the given comment's author, and no Ally is created until
 * the target accepts (see respondToAlliesInvitation).
 */
export async function inviteCommentAuthorToAllies(
  identity: RequestIdentity,
  initiativeId: string,
  commentId: string,
  deps: InitiativeDiscussionCollaborationDependencies = defaultDependencies,
): Promise<InitiativeAlly> {
  const initiative = requireInitiative(initiativeId, deps.initiativeAccessResolver);

  if (initiative.stewardId !== identity.participantId) {
    throw new Error("You do not have access to invite Allies for this initiative.");
  }

  const comment = await requireApprovedComment(initiativeId, commentId);
  const targetParticipantId = await deps.authorIdentityResolver.resolveParticipantIdForAuthUser(
    comment.authorUserId,
  );

  if (!targetParticipantId) {
    throw new Error("Comment author could not be identified.");
  }

  if (targetParticipantId === identity.participantId) {
    throw new Error("You cannot invite yourself to Allies.");
  }

  const existing = await deps.allyStore.findAlly(initiativeId, targetParticipantId);

  if (existing?.status === "active") {
    throw new Error("This participant is already an Ally of this initiative.");
  }

  if (existing?.status === "invitation_pending") {
    return existing;
  }

  const timestamp = nowIso();
  const ally: InitiativeAlly = {
    initiativeId,
    participantId: targetParticipantId,
    status: "invitation_pending",
    requestedByParticipantId: identity.participantId,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };

  await deps.allyStore.upsertAlly(ally);

  deps.notifier({
    recipientParticipantId: targetParticipantId,
    actorParticipantId: identity.participantId,
    eventType: "initiative_allies_invitation_received",
    initiativeId,
  });

  return ally;
}

/** Part 9 — the invited Participant accepts or declines. */
export async function respondToAlliesInvitation(
  identity: RequestIdentity,
  initiativeId: string,
  response: "accept" | "decline",
  deps: InitiativeDiscussionCollaborationDependencies = defaultDependencies,
): Promise<InitiativeAlly> {
  requireInitiative(initiativeId, deps.initiativeAccessResolver);

  const existing = await deps.allyStore.findAlly(initiativeId, identity.participantId);

  if (!existing || existing.status !== "invitation_pending") {
    throw new Error("No pending Allies invitation found for this initiative.");
  }

  const ally: InitiativeAlly = {
    ...existing,
    status: response === "accept" ? "active" : "declined",
    updatedAt: nowIso(),
  };

  await deps.allyStore.upsertAlly(ally);

  deps.notifier({
    recipientParticipantId: existing.requestedByParticipantId,
    actorParticipantId: identity.participantId,
    eventType:
      response === "accept"
        ? "initiative_allies_invitation_accepted"
        : "initiative_allies_invitation_declined",
    initiativeId,
  });

  return ally;
}

/**
 * Profile UX Pack 01 Parts 2/5/6 — the Initiative Author (steward) reviews
 * a Participant's own "Ready to Collaborate" request and Accepts or
 * Declines it directly. This is the reverse direction of
 * `respondToAlliesInvitation` (there, the steward invites and the
 * Participant responds; here, the Participant requests and the steward
 * responds) — both are status transitions on the same one-row-per-key
 * `InitiativeAlly`, never a second model.
 *
 * Idempotent and race-safe: only a request still in `interest_pending` at
 * the moment of the atomic transition is affected. A request already
 * resolved (`active` or `declined`) — whether by an earlier call from this
 * same steward or by a concurrent racing call — is returned as-is, with no
 * error and no duplicate notification (Part 13).
 */
export async function respondToCollaborationInterest(
  identity: RequestIdentity,
  initiativeId: string,
  participantId: string,
  response: "accept" | "decline",
  deps: InitiativeDiscussionCollaborationDependencies = defaultDependencies,
): Promise<InitiativeAlly> {
  const initiative = requireInitiative(initiativeId, deps.initiativeAccessResolver);

  if (initiative.stewardId !== identity.participantId) {
    throw new Error("You do not have access to review collaboration requests for this initiative.");
  }

  if (participantId === identity.participantId) {
    throw new Error("You cannot accept or decline your own collaboration request.");
  }

  const existing = await deps.allyStore.findAlly(initiativeId, participantId);

  if (!existing) {
    throw new Error("Collaboration request not found for this participant.");
  }

  // Already resolved (by this call or a racing one) — idempotent no-op,
  // never a duplicate notification and never a hard error.
  if (existing.status === "active" || existing.status === "declined") {
    return existing;
  }

  if (existing.status !== "interest_pending") {
    throw new Error("This collaboration request is not awaiting review.");
  }

  const nextStatus: InitiativeAllyStatus = response === "accept" ? "active" : "declined";
  const { ally, transitioned } = await deps.allyStore.transitionAllyStatus({
    initiativeId,
    participantId,
    fromStatus: "interest_pending",
    toStatus: nextStatus,
    updatedAt: nowIso(),
  });

  if (transitioned) {
    deps.notifier({
      recipientParticipantId: participantId,
      actorParticipantId: identity.participantId,
      eventType:
        response === "accept"
          ? "initiative_collaboration_interest_accepted"
          : "initiative_collaboration_interest_declined",
      initiativeId,
    });
  }

  return ally;
}

/**
 * Part 6 — Proposal action, implemented as a Proposal Candidate boundary
 * (see the "architectural gap" section of the Final Response). Idempotent:
 * re-clicking Proposal on the same comment returns the existing candidate
 * rather than creating a duplicate.
 */
export async function createProposalCandidateFromComment(
  identity: RequestIdentity,
  initiativeId: string,
  commentId: string,
  deps: InitiativeDiscussionCollaborationDependencies = defaultDependencies,
): Promise<InitiativeDiscussionProposalCandidate> {
  requireInitiative(initiativeId, deps.initiativeAccessResolver);

  const existing = await deps.proposalCandidateStore.findProposalCandidateByCommentId(commentId);

  if (existing) {
    return existing;
  }

  const comment = await requireApprovedComment(initiativeId, commentId);
  const sourceParticipantId = await deps.authorIdentityResolver.resolveParticipantIdForAuthUser(
    comment.authorUserId,
  );

  if (!sourceParticipantId) {
    throw new Error("Comment author could not be identified.");
  }

  const candidate: InitiativeDiscussionProposalCandidate = {
    candidateId: randomUUID(),
    initiativeId,
    sourceCommentId: commentId,
    sourceParticipantId,
    creatorParticipantId: identity.participantId,
    commentText: comment.body,
    status: "candidate",
    createdAt: nowIso(),
  };

  return deps.proposalCandidateStore.createProposalCandidate(candidate);
}

/** Part 14 — clean read boundary for future widgets (Workspace Allies, eligibility, etc.). */
export async function listActiveAlliesForInitiative(
  initiativeId: string,
  deps: InitiativeDiscussionCollaborationDependencies = defaultDependencies,
): Promise<InitiativeAlly[]> {
  return deps.allyStore.listActiveAlliesByInitiative(initiativeId);
}

/**
 * Profile UX Pack 01 Part 8 — the single set of "working" Ally statuses
 * shown in the Discussion → Collaboration view and returned by
 * `listCollaborationParticipantsForInitiative`. Excludes `declined` (per
 * spec); `withdrawn` / `removed` do not exist as persisted statuses today
 * (see `InitiativeAllyStatus`) and are intentionally not listed here.
 */
const COLLABORATION_WORKING_LIST_STATUSES: ReadonlySet<InitiativeAllyStatus> = new Set([
  "interest_pending",
  "invitation_pending",
  "active",
]);

/**
 * Profile UX Pack 01 Parts 2/8 — the Initiative Author's (and any viewer's)
 * compact Collaboration working list, sourced directly from the Ally store
 * rather than derived from Discussion comments. This is deliberate: a
 * Participant may select "Ready to Collaborate" under someone else's
 * comment (the action always targets `(initiativeId, viewer)`, never the
 * comment author — see `expressCollaborationInterest`), so a comment-
 * derived list would silently omit any Participant who never posted a
 * comment themselves. Deduplication is automatic here: one Ally row exists
 * per (initiativeId, participantId) by construction (Pack 02.1).
 */
export async function listCollaborationParticipantsForInitiative(
  initiativeId: string,
  viewerParticipantId: string | null,
  deps: InitiativeDiscussionCollaborationDependencies = defaultDependencies,
): Promise<PublicInitiativeCollaborationParticipantsResult> {
  const initiative = requireInitiative(initiativeId, deps.initiativeAccessResolver);
  const allies = await deps.allyStore.listAlliesByInitiative(initiativeId);
  const workingAllies = allies
    .filter((ally) => COLLABORATION_WORKING_LIST_STATUSES.has(ally.status))
    /*
     * Communication UX Pack 03.8 Part 11 — the Initiative's own steward is
     * never a "Participant interested in collaborating" on their own
     * Initiative; `expressCollaborationInterest`/`inviteToAllies` both
     * already refuse to create such a row going forward (Part 15 #24), but
     * this filter is the defensive backstop that keeps any pre-existing
     * self-row — however it got there — out of the working list and out of
     * reach of Accept/Decline, without deleting the underlying persisted
     * document (Part 11: "do not delete shared development records
     * automatically").
     */
    .filter((ally) => ally.participantId !== initiative.stewardId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  const authorsByParticipantId = await deps.participantIdentityResolver.resolveAuthorsForParticipantIds(
    workingAllies.map((ally) => ally.participantId),
  );

  const participants: PublicInitiativeCollaborationParticipant[] = workingAllies.map((ally) => ({
    participantId: ally.participantId,
    status: ally.status,
    author: authorsByParticipantId.get(ally.participantId) ?? { displayName: "Participant" },
  }));

  return {
    participants,
    isViewerInitiativeSteward: Boolean(
      viewerParticipantId && initiative.stewardId === viewerParticipantId,
    ),
  };
}

/**
 * Merges per-comment collaboration state (indicators + viewer permission
 * flags) onto already-projected public discussion comments. Read-only and
 * additive: never mutates comment content, and callers that never invoke
 * this function get comments with `collaboration` simply absent.
 */
export async function attachCollaborationStateToComments(input: {
  initiativeId: string;
  rawComments: readonly InitiativeComment[];
  projectedComments: readonly PublicInitiativeDiscussionComment[];
  viewerParticipantId: string | null;
  deps?: InitiativeDiscussionCollaborationDependencies;
}): Promise<PublicInitiativeDiscussionComment[]> {
  const deps = input.deps ?? defaultDependencies;
  const initiative = deps.initiativeAccessResolver.getInitiative(input.initiativeId);
  const isAuthenticatedViewer = Boolean(input.viewerParticipantId);
  const isViewerSteward = Boolean(
    initiative && input.viewerParticipantId && initiative.stewardId === input.viewerParticipantId,
  );

  const uniqueAuthorUserIds = [...new Set(input.rawComments.map((comment) => comment.authorUserId))];
  const participantIdByAuthorUserId = new Map<string, string | null>();

  // Performance Recovery Task — batch-resolve every unique comment author
  // with a single lookup when the resolver supports it (the real,
  // Mongo-backed resolver always does; see `defaultAuthorIdentityResolver`),
  // instead of one Mongo round trip per unique author. Falls back to the
  // original per-author `Promise.all` for any injected test resolver that
  // only implements the single-id method, so existing tests are unaffected.
  const resolveAuthorParticipantIds = deps.authorIdentityResolver.resolveParticipantIdsForAuthUsers
    ? deps.authorIdentityResolver
        .resolveParticipantIdsForAuthUsers(uniqueAuthorUserIds)
        .then((resolved) => {
          for (const [authorUserId, participantId] of resolved) {
            participantIdByAuthorUserId.set(authorUserId, participantId);
          }
        })
    : Promise.all(
        uniqueAuthorUserIds.map(async (authorUserId) => {
          participantIdByAuthorUserId.set(
            authorUserId,
            await deps.authorIdentityResolver.resolveParticipantIdForAuthUser(authorUserId),
          );
        }),
      );
  const loadCandidates = deps.proposalCandidateStore.listProposalCandidatesByCommentIds(
    input.rawComments.map((comment) => comment.commentId),
  );
  const loadAllies = deps.allyStore.listAlliesByInitiative(input.initiativeId);

  const [, candidatesByCommentId, initiativeAllies] = await Promise.all([
    resolveAuthorParticipantIds,
    loadCandidates,
    loadAllies,
  ]);

  const rawByCommentId = new Map(input.rawComments.map((comment) => [comment.commentId, comment]));
  // Fetched once for the whole batch (not per-comment) — Allies are few per
  // Initiative, and this keeps the mapping below a synchronous, allocation-
  // free lookup instead of one Mongo round trip per comment.
  const allyByParticipantId = new Map(initiativeAllies.map((ally) => [ally.participantId, ally]));

  const viewerAlly = input.viewerParticipantId
    ? (allyByParticipantId.get(input.viewerParticipantId) ?? null)
    : null;
  const viewerAllyStatus: InitiativeAllyStatus | "none" = viewerAlly?.status ?? "none";
  // Ready to Collaborate is for other Participants only — Authors/stewards
  // are refused by expressCollaborationInterest and must not see the control.
  // interest_pending / invitation_pending / active are already in-flight or
  // complete; declined may re-express (see expressCollaborationInterest).
  const canReadyToCollaborate =
    isAuthenticatedViewer &&
    !isViewerSteward &&
    viewerAlly?.status !== "interest_pending" &&
    viewerAlly?.status !== "active" &&
    viewerAlly?.status !== "invitation_pending";

  return input.projectedComments.map((projected) => {
    const rawComment = rawByCommentId.get(projected.commentId);
    const authorParticipantId = rawComment
      ? (participantIdByAuthorUserId.get(rawComment.authorUserId) ?? null)
      : null;
    const authorAlly = authorParticipantId
      ? (allyByParticipantId.get(authorParticipantId) ?? null)
      : null;
    const authorAllyStatus: InitiativeAllyStatus | "none" = authorAlly?.status ?? "none";
    const isViewerAuthor = Boolean(
      authorParticipantId && input.viewerParticipantId === authorParticipantId,
    );
    const isAuthorInitiativeSteward = Boolean(
      initiative && authorParticipantId && initiative.stewardId === authorParticipantId,
    );
    const hasCandidate = candidatesByCommentId.has(projected.commentId);

    const collaboration: PublicCommentCollaborationState = {
      proposalCandidateStatus: hasCandidate ? "candidate" : "none",
      authorAllyStatus,
      viewerAllyStatus,
      isAuthorInitiativeSteward,
      isViewerAuthor,
      isViewerInitiativeSteward: isViewerSteward,
      canMarkProposal: isAuthenticatedViewer && !hasCandidate,
      canReadyToCollaborate,
      canInviteToAllies:
        isViewerSteward &&
        !isViewerAuthor &&
        authorParticipantId !== null &&
        authorAllyStatus !== "active" &&
        authorAllyStatus !== "invitation_pending",
      authorParticipantId,
    };

    return { ...projected, collaboration };
  });
}
