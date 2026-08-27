import type {
  MemberProfile,
  MemberProfilePrivacySettings,
  MemberProfilePublicPreview,
  MemberProfilePublicRecentInitiative,
  ParticipantStatistics,
  PublicMemberProfile,
} from "@hu/types";

import { findAuthUserById, findAuthUserByMemberId } from "../auth/auth-user.repository.js";
import { isNewDirectConversationAllowed } from "../direct-messaging/direct-messaging-eligibility.js";
import { listPublicInitiativesBySteward } from "../initiatives/initiative.store.js";
import { findMembershipByUserId } from "../membership/membership.repository.js";
import { getParticipantStatistics } from "../participant-statistics/participant-statistics.service.js";
import {
  MemberProfileAccessDeniedError,
  MemberProfileNotFoundError,
  MemberProfileValidationError,
  mapMemberProfilePersistenceError,
} from "./member-profile.errors.js";
import {
  resolvePublicMemberProfileHiddenSections,
  toMemberProfilePrivacySettings,
  toPublicMemberProfile,
  toPublicParticipantStatistics,
  toWorkspaceMemberIdentity,
} from "./member-profile.projection.js";
import {
  buildDefaultMemberProfile,
  findMemberProfileByProfileId,
  findMemberProfileByPublicName,
  findMemberProfileByUserId,
  insertMemberProfile,
  updateMemberProfileRecord,
} from "./member-profile.repository.js";
import {
  validateMemberProfilePatch,
  validateMemberProfilePrivacyPatch,
} from "./member-profile.validators.js";

export async function createMemberProfileForUser(input: {
  userId: string;
  displayName: string;
  language?: string;
}): Promise<MemberProfile> {
  try {
    const existing = await findMemberProfileByUserId(input.userId);

    if (existing) {
      return existing;
    }

    const profile = buildDefaultMemberProfile(input);
    return await insertMemberProfile(profile);
  } catch (error) {
    mapMemberProfilePersistenceError(error);
  }
}

export async function getOrCreateMemberProfileForUser(input: {
  userId: string;
  displayName: string;
  language?: string;
}): Promise<MemberProfile> {
  try {
    const existing = await findMemberProfileByUserId(input.userId);

    if (existing) {
      return existing;
    }

    return await createMemberProfileForUser(input);
  } catch (error) {
    mapMemberProfilePersistenceError(error);
  }
}

export async function getMemberProfileForAuthUser(userId: string): Promise<MemberProfile> {
  try {
    const profile = await findMemberProfileByUserId(userId);

    if (!profile) {
      throw new MemberProfileNotFoundError();
    }

    return profile;
  } catch (error) {
    mapMemberProfilePersistenceError(error);
  }
}

export async function updateMemberProfileForUser(
  userId: string,
  body: unknown,
): Promise<MemberProfile> {
  const patch = validateMemberProfilePatch(body);

  try {
    const updated = await updateMemberProfileRecord(userId, patch);

    if (!updated) {
      throw new MemberProfileNotFoundError();
    }

    return updated;
  } catch (error) {
    mapMemberProfilePersistenceError(error);
  }
}

export async function updateMemberProfilePrivacyForUser(
  userId: string,
  body: unknown,
): Promise<MemberProfilePrivacySettings> {
  const patch = validateMemberProfilePrivacyPatch(body);

  if (patch.membershipPubliclyVisible === true) {
    const membership = await findMembershipByUserId(userId);

    if (!membership || membership.status !== "active_member") {
      throw new MemberProfileValidationError(
        "Only active Members can enable public Membership visibility.",
      );
    }
  }

  try {
    const updated = await updateMemberProfileRecord(userId, patch);

    if (!updated) {
      throw new MemberProfileNotFoundError();
    }

    return toMemberProfilePrivacySettings(updated);
  } catch (error) {
    mapMemberProfilePersistenceError(error);
  }
}

export async function getMemberProfilePrivacyForUser(
  userId: string,
): Promise<MemberProfilePrivacySettings> {
  const profile = await getMemberProfileForAuthUser(userId);
  return toMemberProfilePrivacySettings(profile);
}

/**
 * Profile UX Pack 02 Part 4/11 — statistics for the signed-in Participant's
 * own Member Profile page. `participantId` (the Ally-store / steward key)
 * is the AuthUserRecord's `memberId`, not the profile's `userId` — see
 * `participant-statistics.service.ts` for the shared aggregation.
 */
export async function getMemberProfileStatisticsForUser(
  userId: string,
): Promise<ParticipantStatistics> {
  const authUser = await findAuthUserById(userId);

  if (!authUser) {
    throw new MemberProfileNotFoundError();
  }

  return getParticipantStatistics(authUser.memberId);
}

/**
 * Profile UX Pack 02 Part 6/9 — enriches a public projection (once it has
 * already passed every existing visibility/ownership gate in
 * `toPublicMemberProfile`) with the privacy-filtered statistics block and
 * the "Recent Public Initiatives" list. Both are additive and best-effort:
 * if the owning auth account cannot be resolved (should not happen for a
 * real profile), the base projection is still returned unchanged.
 */
async function enrichPublicMemberProfileProjection(
  projection: PublicMemberProfile,
  profile: MemberProfile,
  viewerIsOwner: boolean,
  viewerParticipantId: string | undefined,
): Promise<PublicMemberProfile> {
  const authUser = await findAuthUserById(profile.userId);

  if (!authUser) {
    return projection;
  }

  const statistics = await getParticipantStatistics(authUser.memberId);
  const publicStatistics = toPublicParticipantStatistics(statistics, profile, viewerIsOwner);

  if (publicStatistics) {
    projection.statistics = publicStatistics;
  }

  const recentInitiatives = listPublicInitiativesBySteward(authUser.memberId, 5);

  if (recentInitiatives.length > 0) {
    projection.recentPublicInitiatives = recentInitiatives.map(
      (initiative): MemberProfilePublicRecentInitiative => ({
        initiativeId: initiative.initiativeId,
        title: initiative.title,
        href: `/initiatives/public/${encodeURIComponent(initiative.initiativeId)}`,
      }),
    );
  }

  // Profile UX Pack 03 Part 7 — computed with the exact same eligibility
  // function the open-conversation write path uses
  // (`isNewDirectConversationAllowed`), so the button a viewer sees and
  // the server's authorization decision can never disagree. Guests
  // (`viewerParticipantId` undefined) and the owner viewing their own
  // profile both resolve to `false` inside that function, which this maps
  // to "hidden"; every other `false` (an authenticated, blocked viewer)
  // maps to "unavailable" neutral text instead.
  //
  // Pack 26B — Admin viewers may bypass Ally restriction (not `nobody`);
  // disabled/suspended targets never expose a new-conversation CTA.
  let canMessage = false;

  if (authUser.status !== "disabled") {
    let viewerIsAdmin = false;

    if (viewerParticipantId) {
      const viewerAuth = await findAuthUserByMemberId(viewerParticipantId);
      viewerIsAdmin =
        viewerAuth?.role === "admin" &&
        viewerAuth.status === "active" &&
        viewerAuth.emailVerificationStatus === "verified";
    }

    canMessage = await isNewDirectConversationAllowed(
      viewerParticipantId,
      authUser.memberId,
      profile.messagingPolicy,
      undefined,
      { viewerIsAdmin },
    );
  }

  if (canMessage) {
    projection.messagingAvailability = "available";
  } else if (!viewerParticipantId || viewerIsOwner) {
    projection.messagingAvailability = "hidden";
  } else {
    projection.messagingAvailability = "unavailable";
  }

  return projection;
}

async function resolvePublicMemberProfileProjection(
  profile: MemberProfile | null,
  options: {
    viewerIsAuthenticated: boolean;
    viewerUserId?: string;
    viewerParticipantId?: string;
  },
): Promise<PublicMemberProfile> {
  if (!profile) {
    throw new MemberProfileNotFoundError();
  }

  const membership = await findMembershipByUserId(profile.userId);
  const viewerIsOwner = options.viewerUserId === profile.userId;

  const projection = toPublicMemberProfile(profile, {
    viewerIsAuthenticated: options.viewerIsAuthenticated,
    viewerIsOwner,
    membership,
  });

  if (!projection) {
    throw new MemberProfileAccessDeniedError();
  }

  return enrichPublicMemberProfileProjection(
    projection,
    profile,
    viewerIsOwner,
    options.viewerParticipantId,
  );
}

export async function getPublicMemberProfileById(
  profileId: string,
  options: {
    viewerIsAuthenticated: boolean;
    viewerUserId?: string;
    viewerParticipantId?: string;
  },
): Promise<PublicMemberProfile> {
  try {
    const profile = await findMemberProfileByProfileId(profileId);
    return await resolvePublicMemberProfileProjection(profile, options);
  } catch (error) {
    if (
      error instanceof MemberProfileNotFoundError ||
      error instanceof MemberProfileAccessDeniedError
    ) {
      throw error;
    }

    mapMemberProfilePersistenceError(error);
  }
}

/**
 * UX Evolution Pack 02.4 Part 6 — resolves the same public-safe projection
 * as `getPublicMemberProfileById`, but by the human-readable `publicName`
 * used in every generated `/member/{publicName}` link (comment authors,
 * Initiative steward). Applies the exact same visibility/ownership rules
 * (`toPublicMemberProfile`) — no privacy behavior differs by lookup key.
 */
export async function getPublicMemberProfileByPublicName(
  publicName: string,
  options: {
    viewerIsAuthenticated: boolean;
    viewerUserId?: string;
    viewerParticipantId?: string;
  },
): Promise<PublicMemberProfile> {
  try {
    const profile = await findMemberProfileByPublicName(publicName);
    return await resolvePublicMemberProfileProjection(profile, options);
  } catch (error) {
    if (
      error instanceof MemberProfileNotFoundError ||
      error instanceof MemberProfileAccessDeniedError
    ) {
      throw error;
    }

    mapMemberProfilePersistenceError(error);
  }
}

/**
 * Profile UX Pack 03.3 — "what will other Participants see" preview for the
 * signed-in owner's own `/profile` route. Reuses the exact same
 * `toPublicMemberProfile` / `toPublicParticipantStatistics` /
 * `enrichPublicMemberProfileProjection` pipeline the real
 * `getPublicMemberProfileByPublicName` route uses, but the viewer identity
 * passed in is deliberately forced to "an authenticated Participant who is
 * not the owner" — never the caller's real `userId` or `participantId` —
 * so none of the existing `viewerIsOwner` bypass branches (organization,
 * location, statistics, etc.) ever fire. `viewerIsAuthenticated: true`
 * matches the platform default profile visibility (`members_only`, see
 * `buildDefaultMemberProfile`) and the CORE PRODUCT RULE this preview
 * answers ("what will other Participants see"), i.e. other signed-in
 * platform members, not anonymous internet visitors. Omitting
 * `viewerParticipantId` also makes `messagingAvailability` resolve to
 * `"hidden"` (see `enrichPublicMemberProfileProjection`), matching the
 * existing self-view semantics — the owner never sees a self-message
 * action. No Privacy rule is duplicated: every visibility decision still
 * happens exactly once, inside the shared projection functions.
 */
export async function getMyPublicMemberProfilePreview(
  userId: string,
): Promise<MemberProfilePublicPreview> {
  const profile = await getMemberProfileForAuthUser(userId);

  const projection = await resolvePublicMemberProfileProjection(profile, {
    viewerIsAuthenticated: true,
    viewerUserId: undefined,
    viewerParticipantId: undefined,
  });

  return {
    profile: projection,
    hiddenSections: resolvePublicMemberProfileHiddenSections(profile, projection),
  };
}

export async function getWorkspaceMemberIdentityForUser(userId: string) {
  const profile = await getMemberProfileForAuthUser(userId);
  return toWorkspaceMemberIdentity(profile);
}

export { toPublicMemberProfile, toWorkspaceMemberIdentity };
