import type { Initiative, PublicInitiativeProjection } from "@hu/types";
import { isInitiativeAdministrativelyBlocked, resolveInitiativeCoverMedia } from "@hu/types";

import { findAuthUserByMemberId } from "../auth/auth-user.repository.js";
import { findMemberProfileByUserId } from "../member-profile/member-profile.repository.js";
import { resolvePublicAuthorIdentity } from "../member-profile/public-author-identity.projection.js";
import { getCurrentPublishedVersion } from "../initiative-version-revision/initiative-version-revision.store.js";
import { isInitiativeEligibleForPublicProjection } from "./initiative-public-projection.access.js";

/**
 * UX Evolution Pack 02.4 Part 3/4 root-cause fix — "Unknown Steward" was
 * caused by resolving `initiative.stewardId` (a `memberId`, i.e.
 * `identity.participantId` — see `initiative.service.ts`) against the
 * legacy `member` module's `getMemberById`, which only has a record once a
 * user has *verified their email* (see `confirmMemberRegistration`). Every
 * other public author surface (comment authors, workspace identity) instead
 * resolves through the live, editable `member-profile` module, keyed by
 * `userId`. `findAuthUserByMemberId` is the existing bridge from
 * `memberId` -> `userId` (already used by password-reset / two-step login),
 * so this reuses it rather than inventing a new identity lookup.
 */
async function resolveStewardIdentity(stewardId: string) {
  const stewardAuthUser = await findAuthUserByMemberId(stewardId);
  const stewardProfile = stewardAuthUser
    ? await findMemberProfileByUserId(stewardAuthUser.userId)
    : null;

  return resolvePublicAuthorIdentity(stewardProfile ?? undefined, stewardAuthUser?.displayName ?? "");
}

export async function toPublicInitiativeProjection(
  initiative: Initiative,
): Promise<PublicInitiativeProjection> {
  const steward = await resolveStewardIdentity(initiative.stewardId);

  return {
    initiativeId: initiative.initiativeId,
    title: initiative.title,
    description: initiative.description,
    status: initiative.status,
    metadata: {
      category: initiative.metadata.category,
      tags: [...initiative.metadata.tags],
      region: initiative.metadata.region,
      language: initiative.metadata.language,
      countrySlug: initiative.metadata.countrySlug,
      regionSlug: initiative.metadata.regionSlug,
      communitySlug: initiative.metadata.communitySlug,
      communityAssociation: initiative.metadata.communityAssociation,
      participationScope: initiative.metadata.participationScope,
      activityArea: initiative.metadata.activityArea,
      activityAreaOther: initiative.metadata.activityAreaOther,
      ballotMode: initiative.metadata.ballotMode,
      publicChoiceResultsExpiredAt: initiative.metadata.publicChoiceResultsExpiredAt,
      publicChoiceResultsExpireAt: initiative.metadata.publicChoiceResultsExpireAt,
      imageUrl: initiative.metadata.imageUrl,
      imageAltText: initiative.metadata.imageAltText,
      // UX Evolution Pack 03 — public-safe, approved-only view; never the
      // raw stored `coverMedia` (which may carry a pending/rejected status
      // and an internal-only verificationReasonCode).
      coverMedia: resolveInitiativeCoverMedia(initiative.metadata),
      startDate: initiative.metadata.startDate,
      completionDate: initiative.metadata.completionDate,
    },
    stewardDisplayName: steward.displayName,
    stewardAvatarUrl: steward.avatarUrl,
    stewardProfileUrl: steward.profileUrl,
    createdAt: initiative.createdAt,
    currentVersion: getCurrentPublishedVersion(initiative.initiativeId) || 1,
    sourceReferences: initiative.sourceReferences
      ? structuredClone(initiative.sourceReferences)
      : undefined,
    ...(isInitiativeAdministrativelyBlocked(initiative)
      ? { isAdministrativelyBlocked: true as const }
      : {}),
  };
}

export function canExposePublicInitiativeProjection(initiative: Initiative): boolean {
  return isInitiativeEligibleForPublicProjection(initiative);
}
