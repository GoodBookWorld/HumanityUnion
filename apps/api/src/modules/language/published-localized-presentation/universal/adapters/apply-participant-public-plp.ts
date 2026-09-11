/**
 * Apply CURRENT participant_public PLP onto a public profile projection.
 * Provider-free read: usable CURRENT → localized fields; otherwise keep canonical.
 * Whole-presentation only — never mix partial localized fields with canonical.
 */

import type { PublicMemberProfile, PublicPresentationNode } from "@hu/types";
import { PLP_UNIVERSAL_DEFAULT_SCHEMA_VERSION } from "@hu/types";

import { resolvePublishedPresentation } from "../../resolve-published-presentation.js";
import {
  buildParticipantPublicCanonicalPresentation,
  PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE,
} from "./participant-public-adapter.js";

function readStringField(
  presentation: PublicPresentationNode,
  key: string,
): string | undefined {
  if (!presentation || typeof presentation !== "object" || Array.isArray(presentation)) {
    return undefined;
  }
  const value = (presentation as Record<string, PublicPresentationNode>)[key];
  return typeof value === "string" ? value : undefined;
}

function readSkillsField(presentation: PublicPresentationNode): string[] | undefined {
  if (!presentation || typeof presentation !== "object" || Array.isArray(presentation)) {
    return undefined;
  }
  const value = (presentation as Record<string, PublicPresentationNode>).skills;
  if (!Array.isArray(value)) {
    return undefined;
  }
  const skills = value.filter((entry): entry is string => typeof entry === "string");
  return skills;
}

export async function applyParticipantPublicPlpToProjection(input: {
  readonly projection: PublicMemberProfile;
  readonly locale: string | null | undefined;
}): Promise<PublicMemberProfile> {
  const locale = typeof input.locale === "string" ? input.locale.trim() : "";
  if (!locale || locale.toLowerCase() === "en") {
    return input.projection;
  }

  const canonical = buildParticipantPublicCanonicalPresentation({
    profileId: input.projection.profileId,
    displayName: input.projection.displayName ?? "",
    biography: input.projection.biography,
    organization: input.projection.organization,
    skills: input.projection.skills,
  });

  const resolved = await resolvePublishedPresentation({
    entityType: PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE,
    entityId: input.projection.profileId,
    locale,
    liveCanonicalVersion: canonical.canonicalVersion,
    liveLocalizationSchemaVersion: PLP_UNIVERSAL_DEFAULT_SCHEMA_VERSION,
    canonicalPresentation: canonical.presentation,
  });

  if (resolved.mode !== "PUBLISHED_LOCALIZED") {
    return input.projection;
  }

  const biography = readStringField(resolved.presentation, "biography");
  const organization = readStringField(resolved.presentation, "organization");
  const skills = readSkillsField(resolved.presentation);

  return {
    ...input.projection,
    ...(biography !== undefined && input.projection.biography !== undefined
      ? { biography }
      : {}),
    ...(organization !== undefined && input.projection.organization !== undefined
      ? { organization }
      : {}),
    ...(skills !== undefined && input.projection.skills !== undefined
      ? { skills }
      : {}),
  };
}
