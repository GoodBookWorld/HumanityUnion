import type {
  AdminParticipantDirectoryItem,
  AdminParticipantDirectoryResponse,
  AdminParticipantPublicProfileResolve,
  MembershipRecord,
  MembershipStatus,
} from "@hu/types";

import {
  findAuthUserById,
  findAuthUserByMemberId,
  listAuthUsersForAdmin,
  type AdminAuthUserListSort,
} from "../auth/auth-user.repository.js";
import type { AuthUserRecord } from "../auth/auth-user.types.js";
import { toPublicMemberProfile } from "../member-profile/member-profile.projection.js";
import {
  findMemberProfileByUserId,
  findMemberProfilesByUserIds,
} from "../member-profile/member-profile.repository.js";
import {
  findIdentityIdsByUniqueNameSearch,
  findMembersByIdentityIds,
} from "../member/infrastructure/member.repository.js";
import {
  findMembershipByUserId,
  findMembershipsByUserIds,
  findUserIdsByMembershipStatus,
  findUserIdsByMembershipStatuses,
} from "../membership/membership.repository.js";
import { toMembershipStatusPayload } from "../membership/membership.projection.js";
import {
  findLatestMemberBadgeApplicationByUserIds,
  findUserIdsWithMemberBadgeApplications,
} from "../member-badge-application/member-badge-application.repository.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "./administration.errors.js";
import { findActiveSuspensionSummariesByParticipantIds } from "../participant-suspension/participant-suspension.service.js";

export class AdminParticipantDirectoryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminParticipantDirectoryValidationError";
  }
}

/** Pack 24A — no guest-visible/current public profile for this Participant. */
export class AdminParticipantPublicProfileUnavailableError extends Error {
  constructor(message = "A public profile is not currently available for this Participant.") {
    super(message);
    this.name = "AdminParticipantPublicProfileUnavailableError";
  }
}

/** Pack 24A — Participant identity not found for Admin resolve. */
export class AdminParticipantNotFoundError extends Error {
  constructor(message = "Participant not found.") {
    super(message);
    this.name = "AdminParticipantNotFoundError";
  }
}

/** Canonical MembershipStatus values plus Pack 25D operational aliases. */
const MEMBERSHIP_STATUS_FILTERS: readonly MembershipStatus[] = [
  "not_started",
  "application_started",
  "application_completed",
  "pending_payment",
  "manual_review",
  "active_member",
  "payment_refunded",
  "payment_disputed",
  "technical_error",
];

const OPERATIONAL_MEMBERSHIP_FILTERS = [
  "application_submitted",
  "member_badge_orders",
] as const;

export type AdminParticipantMembershipFilter =
  | MembershipStatus
  | (typeof OPERATIONAL_MEMBERSHIP_FILTERS)[number];

export interface ListAdminParticipantsInput {
  actorUserId: string;
  search?: string;
  status?: AuthUserRecord["status"];
  role?: AuthUserRecord["role"];
  /** MembershipStatus or Pack 25D operational filter (application_submitted / member_badge_orders). */
  membershipStatus?: string | MembershipStatus;
  sort?: AdminAuthUserListSort;
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

async function assertAdminUser(userId: string): Promise<void> {
  if (!userId.trim()) {
    throw new AdministrationUnauthorizedError("Authentication is required.");
  }

  const user = await findAuthUserById(userId);

  if (!user || user.role !== "admin") {
    throw new AdministrationForbiddenError("Administrator access is required.");
  }
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || Number.isNaN(limit)) {
    return 25;
  }
  return Math.min(Math.max(Math.trunc(limit), 1), 100);
}

function clampOffset(offset: number | undefined): number {
  if (offset === undefined || Number.isNaN(offset) || offset < 0) {
    return 0;
  }
  return Math.trunc(offset);
}

function isAllowedMembershipFilter(value: string): value is AdminParticipantMembershipFilter {
  return (
    (MEMBERSHIP_STATUS_FILTERS as readonly string[]).includes(value) ||
    (OPERATIONAL_MEMBERSHIP_FILTERS as readonly string[]).includes(value)
  );
}

function toDirectoryItem(
  authUser: AuthUserRecord,
  member: Awaited<ReturnType<typeof findMembersByIdentityIds>> extends Map<string, infer V>
    ? V | undefined
    : never,
  profile: { publicName?: string; displayName?: string; avatarUrl?: string } | undefined,
  membership: MembershipRecord | undefined,
  suspension?: AdminParticipantDirectoryItem["suspension"],
  memberBadgeOrder?: AdminParticipantDirectoryItem["memberBadgeOrder"],
): AdminParticipantDirectoryItem {
  const membershipPayload = membership ? toMembershipStatusPayload(membership) : undefined;

  return {
    userId: authUser.userId,
    memberId: authUser.memberId,
    email: authUser.email,
    displayName: authUser.displayName,
    role: authUser.role,
    status: authUser.status,
    emailVerificationStatus: authUser.emailVerificationStatus,
    createdAt: authUser.createdAt,
    ...(authUser.lastLoginAt ? { lastLoginAt: authUser.lastLoginAt } : {}),
    ...(member?.uniqueName ? { uniqueName: member.uniqueName } : {}),
    ...(member?.status ? { memberRecordStatus: member.status } : {}),
    ...(member?.verificationLevel ? { verificationLevel: member.verificationLevel } : {}),
    ...(profile?.publicName ? { publicName: profile.publicName } : {}),
    ...(profile?.displayName ? { profileDisplayName: profile.displayName } : {}),
    ...(profile?.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}),
    ...(membershipPayload
      ? {
          membership: {
            cohortLabel: membershipPayload.cohortLabel,
            status: membershipPayload.status,
            applicationStatus: membershipPayload.applicationStatus,
            memberNumber: membershipPayload.memberNumber,
          },
        }
      : {}),
    ...(memberBadgeOrder ? { memberBadgeOrder } : {}),
    ...(authUser.status === "disabled" && suspension ? { suspension } : {}),
  };
}

/**
 * Narrow admin-authorized Participant directory read.
 * Joins Auth → Member → Profile → Membership without inventing a parallel identity.
 */
export async function listAdminParticipants(
  input: ListAdminParticipantsInput,
): Promise<AdminParticipantDirectoryResponse> {
  await assertAdminUser(input.actorUserId);

  const limit = clampLimit(input.limit);
  const offset = clampOffset(input.offset);
  const sort = input.sort ?? "createdAt";
  const order = input.order ?? "desc";

  if (input.status && input.status !== "active" && input.status !== "disabled") {
    throw new AdminParticipantDirectoryValidationError("Invalid status filter.");
  }

  if (input.role && input.role !== "member" && input.role !== "admin") {
    throw new AdminParticipantDirectoryValidationError("Invalid role filter.");
  }

  if (
    sort !== "createdAt" &&
    sort !== "lastLoginAt" &&
    sort !== "email"
  ) {
    throw new AdminParticipantDirectoryValidationError("Invalid sort field.");
  }

  if (order !== "asc" && order !== "desc") {
    throw new AdminParticipantDirectoryValidationError("Invalid sort order.");
  }

  const membershipFilter = input.membershipStatus?.trim();
  if (membershipFilter && !isAllowedMembershipFilter(membershipFilter)) {
    throw new AdminParticipantDirectoryValidationError("Invalid membershipStatus filter.");
  }

  let userIdAllowlist: string[] | undefined;
  const attachMemberBadgeOrders = membershipFilter === "member_badge_orders";

  if (membershipFilter === "application_submitted") {
    userIdAllowlist = await findUserIdsByMembershipStatuses([
      "application_completed",
      "pending_payment",
    ]);
  } else if (membershipFilter === "member_badge_orders") {
    userIdAllowlist = await findUserIdsWithMemberBadgeApplications();
  } else if (input.membershipStatus) {
    userIdAllowlist = await findUserIdsByMembershipStatus(
      input.membershipStatus as MembershipStatus,
    );
  }

  const search = input.search?.trim();
  const searchAlsoUserIds = search
    ? await findIdentityIdsByUniqueNameSearch(search)
    : undefined;

  const listed = await listAuthUsersForAdmin({
    search,
    status: input.status,
    role: input.role,
    userIdAllowlist,
    searchAlsoUserIds,
    sort,
    order,
    limit,
    offset,
  });

  const userIds = listed.items.map((item) => item.userId);
  const disabledParticipantIds = listed.items
    .filter((item) => item.status === "disabled")
    .map((item) => item.memberId);

  const [
    membersByIdentity,
    profilesByUserId,
    membershipsByUserId,
    suspensionsByParticipantId,
    memberBadgeOrdersByUserId,
  ] = await Promise.all([
    findMembersByIdentityIds(userIds),
    findMemberProfilesByUserIds(userIds),
    findMembershipsByUserIds(userIds),
    findActiveSuspensionSummariesByParticipantIds(disabledParticipantIds),
    attachMemberBadgeOrders
      ? findLatestMemberBadgeApplicationByUserIds(userIds)
      : Promise.resolve(new Map()),
  ]);

  const participants = listed.items.map((authUser) => {
    const profile = profilesByUserId.get(authUser.userId);
    const badgeApplication = memberBadgeOrdersByUserId.get(authUser.userId);
    const memberBadgeOrder = badgeApplication
      ? {
          applicationId: badgeApplication.applicationId,
          paymentStatus: badgeApplication.paymentStatus,
          fulfillmentStatus: badgeApplication.fulfillmentStatus,
          shipped: badgeApplication.shipped,
          delivered: badgeApplication.delivered,
          paidAt: badgeApplication.paidAt,
          updatedAt: badgeApplication.updatedAt,
        }
      : undefined;

    return toDirectoryItem(
      authUser,
      membersByIdentity.get(authUser.userId),
      profile
        ? {
            publicName: profile.publicName,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
          }
        : undefined,
      membershipsByUserId.get(authUser.userId),
      suspensionsByParticipantId.get(authUser.memberId),
      memberBadgeOrder,
    );
  });

  return {
    participants,
    total: listed.total,
    limit,
    offset,
    hasMore: offset + participants.length < listed.total,
  };
}

/**
 * Pack 24A — resolve CURRENT canonical public profile for Admin View action.
 * Stable key: Participant `memberId` (never Member.uniqueName / stale slug).
 * Returns only publicName + publicHref — no email or private fields.
 */
export async function resolveAdminParticipantPublicProfile(input: {
  actorUserId: string;
  participantId: string;
}): Promise<AdminParticipantPublicProfileResolve> {
  await assertAdminUser(input.actorUserId);

  const participantId = input.participantId.trim();
  if (!participantId) {
    throw new AdminParticipantDirectoryValidationError("Participant id is required.");
  }

  const authUser = await findAuthUserByMemberId(participantId);
  if (!authUser) {
    throw new AdminParticipantNotFoundError();
  }

  const profile = await findMemberProfileByUserId(authUser.userId);
  const publicName = profile?.publicName?.trim();
  if (!profile || !publicName) {
    throw new AdminParticipantPublicProfileUnavailableError();
  }

  const membership = await findMembershipByUserId(authUser.userId);
  // Authenticated non-owner view matches what Admin sees on /member/{publicName}.
  const projection = toPublicMemberProfile(profile, {
    viewerIsAuthenticated: true,
    viewerIsOwner: false,
    membership,
  });

  if (!projection?.publicName?.trim()) {
    throw new AdminParticipantPublicProfileUnavailableError();
  }

  // Always use live profile.publicName — never members.uniqueName.
  return {
    publicName,
    publicHref: `/member/${encodeURIComponent(publicName)}`,
  };
}
