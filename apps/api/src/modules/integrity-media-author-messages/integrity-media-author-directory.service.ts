import { findAuthUsersByMemberIds } from "../auth/auth-user.repository.js";
import { INTEGRITY_MEDIA_SOURCE } from "../external-author-link/external-author-link.constants.js";
import { isIntegrityMediaAuthorLinkOperational } from "../external-author-link/external-author-link.service.js";
import {
  getExternalAuthorLinkStore,
  type ExternalAuthorLinkAdminListState,
} from "../external-author-link/external-author-link.store.js";
import type { ExternalAuthorLinkRecord } from "../external-author-link/external-author-link.types.js";
import { findMemberProfilesByUserIds } from "../member-profile/member-profile.repository.js";
import { requireIntegrityMediaAuthorMessageAdmin } from "./integrity-media-author-message.service.js";
import { getIntegrityMediaAuthorMessageStore } from "./integrity-media-author-message.store.js";
import type {
  IntegrityMediaAuthorDirectoryPage,
  IntegrityMediaAuthorDirectoryRow,
} from "./integrity-media-author-message.types.js";

export interface IntegrityMediaAuthorDirectoryFailure {
  ok: false;
  status: number;
  code: string;
  message: string;
}

export interface IntegrityMediaAuthorParticipantDisplay {
  participantDisplayName: string;
  participantAvatarUrl?: string;
  participantProfileHref?: string;
}

const DIRECTORY_STATES = new Set<ExternalAuthorLinkAdminListState>([
  "all",
  "linked",
  "disabled",
  "setup_pending",
]);

type ParticipantResolver = (
  memberIds: readonly string[],
) => Promise<Map<string, IntegrityMediaAuthorParticipantDisplay>>;

let participantResolverOverride: ParticipantResolver | null = null;

export function setIntegrityMediaAuthorParticipantResolverForTests(
  resolver: ParticipantResolver | null,
): void {
  participantResolverOverride = resolver;
}

/**
 * Admin list of durable Integrity Media collaborations.
 * Disabled and setup-pending rows stay visible. Names come from the HU profile.
 */
export async function listIntegrityMediaAuthors(input: {
  actorUserId: string;
  actorMemberId: string;
  state?: string;
  limit?: number;
  offset?: number;
}): Promise<
  | { ok: true; data: IntegrityMediaAuthorDirectoryPage }
  | IntegrityMediaAuthorDirectoryFailure
> {
  await requireIntegrityMediaAuthorMessageAdmin(input.actorUserId, input.actorMemberId);

  const state = input.state ?? "all";
  if (!isDirectoryState(state)) {
    return failure(400, "invalid_request", "The author list request is not valid.");
  }

  const limit = clampLimit(input.limit);
  const offset = clampOffset(input.offset);
  const page = await getExternalAuthorLinkStore().listForAdmin({
    source: INTEGRITY_MEDIA_SOURCE,
    state,
    limit,
    offset,
  });
  const memberIds = page.items.map((item) => item.memberId);
  const [displays, summaries] = await Promise.all([
    resolveIntegrityMediaAuthorParticipants(memberIds),
    getIntegrityMediaAuthorMessageStore().summarizeForRecipients(memberIds),
  ]);

  const authors = page.items.map((link) =>
    toDirectoryRow(link, displays.get(link.memberId), summaries.get(link.memberId)),
  );

  return {
    ok: true,
    data: {
      authors,
      total: page.total,
      limit,
      offset,
      hasMore: offset + authors.length < page.total,
    },
  };
}

export function deriveIntegrityMediaAuthorParticipantDisplay(input: {
  memberId: string;
  authDisplayName?: string | null;
  profileDisplayName?: string | null;
  publicName?: string | null;
  avatarUrl?: string | null;
}): IntegrityMediaAuthorParticipantDisplay {
  const profileName = readableName(input.profileDisplayName);
  const authName = readableName(input.authDisplayName);
  const publicName = readableName(input.publicName);
  const avatarUrl = input.avatarUrl?.trim();

  return {
    participantDisplayName: profileName || authName || publicName || "Participant",
    ...(avatarUrl ? { participantAvatarUrl: avatarUrl } : {}),
    ...(publicName
      ? {
          participantProfileHref: `/admin/participants/${encodeURIComponent(input.memberId)}/public-profile`,
        }
      : {}),
  };
}

export async function resolveIntegrityMediaAuthorParticipants(
  memberIds: readonly string[],
): Promise<Map<string, IntegrityMediaAuthorParticipantDisplay>> {
  if (participantResolverOverride) {
    return participantResolverOverride(memberIds);
  }

  const uniqueMemberIds = [...new Set(memberIds.filter((memberId) => memberId.trim().length > 0))];
  if (uniqueMemberIds.length === 0) {
    return new Map();
  }

  const authUsers = await findAuthUsersByMemberIds(uniqueMemberIds);
  const profiles = await findMemberProfilesByUserIds(
    [...authUsers.values()].map((user) => user.userId),
  );
  const displays = new Map<string, IntegrityMediaAuthorParticipantDisplay>();

  for (const memberId of uniqueMemberIds) {
    const authUser = authUsers.get(memberId);
    const profile = authUser ? profiles.get(authUser.userId) : undefined;
    displays.set(
      memberId,
      deriveIntegrityMediaAuthorParticipantDisplay({
        memberId,
        authDisplayName: authUser?.displayName,
        profileDisplayName: profile?.displayName,
        publicName: profile?.publicName,
        avatarUrl: profile?.avatarUrl,
      }),
    );
  }

  return displays;
}

function toDirectoryRow(
  link: ExternalAuthorLinkRecord,
  display: IntegrityMediaAuthorParticipantDisplay | undefined,
  summary: { messageCount: number; latest: IntegrityMediaAuthorDirectoryRow["latestMessage"] } | undefined,
): IntegrityMediaAuthorDirectoryRow {
  const identity =
    display ??
    deriveIntegrityMediaAuthorParticipantDisplay({
      memberId: link.memberId,
    });

  return {
    memberId: link.memberId,
    externalAuthorId: link.externalAuthorId,
    state: link.state,
    authorActivationPending: link.authorActivationPending === true,
    canSend: isIntegrityMediaAuthorLinkOperational(link),
    createdAt: link.createdAt,
    confirmedAt: link.confirmedAt,
    disconnectedAt: link.disconnectedAt,
    participantDisplayName: identity.participantDisplayName,
    ...(identity.participantAvatarUrl
      ? { participantAvatarUrl: identity.participantAvatarUrl }
      : {}),
    ...(identity.participantProfileHref
      ? { participantProfileHref: identity.participantProfileHref }
      : {}),
    messageCount: summary?.messageCount ?? 0,
    latestMessage: summary?.latest ?? null,
  };
}

function readableName(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed.includes("@")) {
    return "";
  }

  return trimmed;
}

function isDirectoryState(value: string): value is ExternalAuthorLinkAdminListState {
  return DIRECTORY_STATES.has(value as ExternalAuthorLinkAdminListState);
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return 25;
  }

  return Math.min(100, Math.max(1, Math.trunc(limit)));
}

function clampOffset(offset: number | undefined): number {
  if (offset === undefined || !Number.isFinite(offset) || offset < 0) {
    return 0;
  }

  return Math.trunc(offset);
}

function failure(
  status: number,
  code: string,
  message: string,
): IntegrityMediaAuthorDirectoryFailure {
  return { ok: false, status, code, message };
}
