import type {
  AdminParticipantDirectoryItem,
  AdminParticipantDirectoryResponse,
  MembershipRecord,
  MembershipStatus,
} from "@hu/types";

import {
  findAuthUserById,
  listAuthUsersForAdmin,
  type AdminAuthUserListSort,
} from "../auth/auth-user.repository.js";
import type { AuthUserRecord } from "../auth/auth-user.types.js";
import { findMemberProfilesByUserIds } from "../member-profile/member-profile.repository.js";
import {
  findIdentityIdsByUniqueNameSearch,
  findMembersByIdentityIds,
} from "../member/infrastructure/member.repository.js";
import {
  findMembershipsByUserIds,
  findUserIdsByMembershipStatus,
} from "../membership/membership.repository.js";
import { toMembershipStatusPayload } from "../membership/membership.projection.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "./administration.errors.js";

export class AdminParticipantDirectoryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminParticipantDirectoryValidationError";
  }
}

export interface ListAdminParticipantsInput {
  actorUserId: string;
  search?: string;
  status?: AuthUserRecord["status"];
  role?: AuthUserRecord["role"];
  membershipStatus?: MembershipStatus;
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

function toDirectoryItem(
  authUser: AuthUserRecord,
  member: Awaited<ReturnType<typeof findMembersByIdentityIds>> extends Map<string, infer V>
    ? V | undefined
    : never,
  profile: { publicName?: string; displayName?: string; avatarUrl?: string } | undefined,
  membership: MembershipRecord | undefined,
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

  let userIdAllowlist: string[] | undefined;

  if (input.membershipStatus) {
    userIdAllowlist = await findUserIdsByMembershipStatus(input.membershipStatus);
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
  const [membersByIdentity, profilesByUserId, membershipsByUserId] = await Promise.all([
    findMembersByIdentityIds(userIds),
    findMemberProfilesByUserIds(userIds),
    findMembershipsByUserIds(userIds),
  ]);

    const participants = listed.items.map((authUser) => {
    const profile = profilesByUserId.get(authUser.userId);
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
