/**
 * Enqueue participant_public PLP builds after public profile prose changes.
 * Async only — never provider-on-read.
 */

import type { MemberProfile } from "@hu/types";

import { resolvePlpAutoBuildLocales } from "../public-source-mutation-bridge.js";
import { enqueuePlpBuildRequest } from "../build-request-queue.js";
import {
  buildParticipantPublicCanonicalPresentation,
  PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE,
} from "./participant-public-adapter.js";

function isEligibleForPublicPlp(profile: MemberProfile): boolean {
  if (profile.status === "suspended") {
    return false;
  }
  return profile.profileVisibility === "public" || profile.profileVisibility === "members_only";
}

/**
 * Fire-and-forget enqueue for Registry locales (excluding English).
 * Safe to call after biography / skills / organization / visibility mutations.
 */
export async function enqueueParticipantPublicPlpBuilds(
  profile: MemberProfile,
): Promise<void> {
  if (!isEligibleForPublicPlp(profile)) {
    return;
  }

  const { presentation, canonicalVersion } = buildParticipantPublicCanonicalPresentation({
    profileId: profile.profileId,
    displayName: profile.displayName,
    biography: profile.biography,
    organization: profile.organization,
    skills: profile.skills,
  });

  const locales = await resolvePlpAutoBuildLocales({ excludeSourceLanguage: "en" });
  for (const locale of locales) {
    void enqueuePlpBuildRequest({
      entityType: PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE,
      entityId: profile.profileId,
      locale,
      canonicalVersion,
      contentRevision: 1,
      trigger: "CANONICAL_CONTENT_UPDATED",
      canonicalPresentation: presentation,
    });
  }
}
