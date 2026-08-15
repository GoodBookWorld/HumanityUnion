import type {
  DirectMessagingPolicy,
  InitiativeActiveAlliesProjection,
  InitiativeActiveAllyEntry,
  InitiativeAlly,
} from "@hu/types";

import { findAuthUsersByMemberIds } from "../auth/auth-user.repository.js";
import { isNewDirectConversationAllowed } from "../direct-messaging/direct-messaging-eligibility.js";
import { listUnreadDirectMessageSenderParticipantIds } from "../direct-messaging/index.js";
import { findMemberProfilesByUserIds } from "../member-profile/member-profile.repository.js";
import { resolvePublicAuthorIdentity } from "../member-profile/public-author-identity.projection.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";

import { listActiveAlliesByInitiative } from "./initiative-ally.store.js";

/**
 * Communication UX Pack 03.3 — the Initiative Active Allies widget.
 *
 * Reuses, rather than duplicates, every existing read boundary:
 * - `listActiveAlliesByInitiative` (Part 14 read boundary already added by
 *   UX Evolution Pack 02.1 "for future widgets") for the Initiative-scoped
 *   `status === "active"` Ally rows;
 * - the Initiative store's `stewardId` for Author identity (never a second
 *   ownership projection);
 * - the exact same batched `AuthUserRecord` + `MemberProfile` lookups
 *   `resolvePublicAuthorsForParticipantIds` already performs for Discussion
 *   comment authors and the Workspace Allies widget (this module also needs
 *   each Participant's `messagingPolicy`, which that helper does not
 *   expose, so the two batched round trips are inlined here rather than
 *   duplicated as a third near-identical resolver);
 * - `isNewDirectConversationAllowed` (Direct Messaging's single source of
 *   truth for "may viewer message target") for the per-row `canMessage`
 *   flag — the backend remains the only authority, never inferred from
 *   both Participants merely appearing in this widget;
 * - `listUnreadDirectMessageSenderParticipantIds` (Communication UX Pack
 *   03.2) for the per-row unread marker — one call for the whole widget,
 *   not one Direct Messaging read per row.
 */
export interface InitiativeActiveAlliesAccessSummary {
  initiativeId: string;
  stewardId: string;
}

export interface ResolvedParticipantIdentity {
  displayName: string;
  avatarUrl?: string;
  profileUrl?: string;
  messagingPolicy: DirectMessagingPolicy;
}

export interface InitiativeActiveAlliesDependencies {
  getInitiative(initiativeId: string): InitiativeActiveAlliesAccessSummary | null;
  listActiveAllies(initiativeId: string): Promise<InitiativeAlly[]>;
  resolveIdentitiesAndPolicies(
    participantIds: readonly string[],
  ): Promise<Map<string, ResolvedParticipantIdentity>>;
  listUnreadSenderParticipantIds(viewerParticipantId: string): Promise<Set<string>>;
  isMessageAllowed(
    viewerParticipantId: string | undefined,
    targetParticipantId: string,
    targetPolicy: DirectMessagingPolicy,
  ): Promise<boolean>;
}

export class InitiativeActiveAlliesNotFoundError extends Error {
  constructor() {
    super("Initiative not found.");
    this.name = "InitiativeActiveAlliesNotFoundError";
  }
}

const FALLBACK_MESSAGING_POLICY: DirectMessagingPolicy = "active_allies";

/**
 * Part 14 — two batched round trips regardless of team size (mirrors
 * `resolvePublicAuthorsForParticipantIds`): one to resolve
 * `memberId -> AuthUserRecord`, one to resolve `userId -> MemberProfile`.
 * Adds `messagingPolicy` (defaulting exactly like the rest of the codebase
 * does when a Participant has no profile row yet) so `canMessage` never
 * needs a third round trip per row.
 */
async function resolveIdentitiesAndPolicies(
  participantIds: readonly string[],
): Promise<Map<string, ResolvedParticipantIdentity>> {
  const uniqueParticipantIds = [...new Set(participantIds.filter((id) => id.trim().length > 0))];
  const result = new Map<string, ResolvedParticipantIdentity>();

  if (uniqueParticipantIds.length === 0) {
    return result;
  }

  const authUsersByMemberId = await findAuthUsersByMemberIds(uniqueParticipantIds);
  const userIds = [...authUsersByMemberId.values()].map((record) => record.userId);
  const profilesByUserId = await findMemberProfilesByUserIds(userIds);

  for (const participantId of uniqueParticipantIds) {
    const authUser = authUsersByMemberId.get(participantId);
    const profile = authUser ? profilesByUserId.get(authUser.userId) : undefined;
    const identity = resolvePublicAuthorIdentity(profile, authUser?.displayName ?? "Participant");

    result.set(participantId, {
      displayName: identity.displayName,
      avatarUrl: identity.avatarUrl,
      profileUrl: identity.profileUrl,
      messagingPolicy: profile?.messagingPolicy ?? FALLBACK_MESSAGING_POLICY,
    });
  }

  return result;
}

const defaultDependencies: InitiativeActiveAlliesDependencies = {
  getInitiative(initiativeId) {
    const initiative = getInitiativeById(initiativeId);
    return initiative ? { initiativeId: initiative.initiativeId, stewardId: initiative.stewardId } : null;
  },
  listActiveAllies: listActiveAlliesByInitiative,
  resolveIdentitiesAndPolicies,
  listUnreadSenderParticipantIds: listUnreadDirectMessageSenderParticipantIds,
  isMessageAllowed: isNewDirectConversationAllowed,
};

/**
 * Part 4 — stable Ally ordering: accepted/activated time ascending. Every
 * `InitiativeAlly` row's `updatedAt` is set at the moment
 * `transitionInitiativeAllyStatus` moves it to `"active"` (Accept), and
 * that timestamp is never touched again while the row stays `active`, so
 * it is exactly "the moment this Participant became an active Ally" — a
 * more accurate ordering key here than `createdAt` (which is when
 * collaboration interest was first expressed, possibly long before
 * acceptance).
 */
function compareByActivatedTime(left: InitiativeAlly, right: InitiativeAlly): number {
  return left.updatedAt.localeCompare(right.updatedAt);
}

function resolveViewerRole(input: {
  viewerParticipantId: string | null;
  stewardId: string;
  activeAllyParticipantIds: ReadonlySet<string>;
}): InitiativeActiveAlliesProjection["viewerRole"] {
  if (!input.viewerParticipantId) {
    return "guest";
  }

  if (input.viewerParticipantId === input.stewardId) {
    return "author";
  }

  if (input.activeAllyParticipantIds.has(input.viewerParticipantId)) {
    return "active_ally";
  }

  return "participant";
}

/**
 * Communication UX Pack 03.3 Part 2/14 — the Initiative Active Allies
 * widget's single batch-resolved read. Public-safe by default (every field
 * that would need per-viewer authorization is simply omitted, never sent
 * as `false`, when `viewerParticipantId` is `null`); authenticated callers
 * additionally receive `participantId`/`canMessage`/`hasUnreadMessages`
 * per row (Part 20).
 */
export async function getInitiativeActiveAlliesTeam(
  initiativeId: string,
  viewerParticipantId: string | null,
  deps: InitiativeActiveAlliesDependencies = defaultDependencies,
): Promise<InitiativeActiveAlliesProjection> {
  const initiative = deps.getInitiative(initiativeId);

  if (!initiative) {
    throw new InitiativeActiveAlliesNotFoundError();
  }

  const activeAllyRows = await deps.listActiveAllies(initiativeId);

  // Part 5 — deduplicate by participantId (defensive: the database
  // uniqueness rule on initiativeId+participantId already guarantees at
  // most one row per Participant; this also drops a malformed legacy row
  // that named the Author as their own Ally, per Part 3/5).
  const seenAllyParticipantIds = new Set<string>();
  const uniqueAllyRows: InitiativeAlly[] = [];

  for (const row of activeAllyRows) {
    if (row.participantId === initiative.stewardId) {
      continue;
    }

    if (seenAllyParticipantIds.has(row.participantId)) {
      continue;
    }

    seenAllyParticipantIds.add(row.participantId);
    uniqueAllyRows.push(row);
  }

  const orderedAllyRows = [...uniqueAllyRows].sort(compareByActivatedTime);

  const allParticipantIds = [initiative.stewardId, ...orderedAllyRows.map((row) => row.participantId)];
  const identities = await deps.resolveIdentitiesAndPolicies(allParticipantIds);

  const unreadSenderParticipantIds = viewerParticipantId
    ? await deps.listUnreadSenderParticipantIds(viewerParticipantId)
    : new Set<string>();

  async function buildEntry(
    participantId: string,
    role: InitiativeActiveAllyEntry["role"],
  ): Promise<InitiativeActiveAllyEntry> {
    const identity = identities.get(participantId);

    const entry: InitiativeActiveAllyEntry = {
      displayName: identity?.displayName ?? "Participant",
      avatarUrl: identity?.avatarUrl,
      profileUrl: identity?.profileUrl,
      role,
    };

    if (!viewerParticipantId) {
      return entry;
    }

    entry.participantId = participantId;
    entry.canMessage = await deps.isMessageAllowed(
      viewerParticipantId,
      participantId,
      identity?.messagingPolicy ?? FALLBACK_MESSAGING_POLICY,
    );
    entry.hasUnreadMessages = unreadSenderParticipantIds.has(participantId);

    return entry;
  }

  const author = await buildEntry(initiative.stewardId, "author");
  const allies = await Promise.all(
    orderedAllyRows.map((row) => buildEntry(row.participantId, "ally")),
  );

  return {
    initiativeId,
    author,
    allies,
    // Part 16 — never includes the Author.
    activeAlliesCount: allies.length,
    viewerRole: resolveViewerRole({
      viewerParticipantId,
      stewardId: initiative.stewardId,
      activeAllyParticipantIds: seenAllyParticipantIds,
    }),
    // Part 19/20 — the team itself is always public-safe to view; only
    // per-row action metadata is authenticated-gated.
    canViewTeam: true,
  };
}
