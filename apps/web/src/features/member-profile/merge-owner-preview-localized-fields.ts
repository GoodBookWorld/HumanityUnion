/**
 * `/profile` owner-preview: keep privacy-filtered field visibility from
 * `/me/public-preview`, but take Biography/Skills/(visible) Organization
 * values from the same public member projection `/member/{publicName}` uses
 * (participant_public CURRENT via that read path).
 *
 * Never invents sections Privacy hid; never mixes partial localized trees
 * beyond the fields the privacy projection already exposes.
 */

import type { PublicMemberProfile } from "@hu/types";

export function mergeOwnerPreviewLocalizedFields(input: {
  readonly privacyFiltered: PublicMemberProfile;
  readonly localizedPublic: PublicMemberProfile;
}): PublicMemberProfile {
  const { privacyFiltered, localizedPublic } = input;

  return {
    ...privacyFiltered,
    ...(privacyFiltered.biography !== undefined && localizedPublic.biography !== undefined
      ? { biography: localizedPublic.biography }
      : {}),
    ...(privacyFiltered.organization !== undefined &&
    localizedPublic.organization !== undefined
      ? { organization: localizedPublic.organization }
      : {}),
    ...(privacyFiltered.skills !== undefined && localizedPublic.skills !== undefined
      ? { skills: localizedPublic.skills }
      : {}),
  };
}
