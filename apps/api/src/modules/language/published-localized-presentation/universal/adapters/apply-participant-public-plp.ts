/**
 * Apply CURRENT participant_public PLP onto a public profile projection.
 * Provider-free read: usable CURRENT → localized fields; otherwise keep canonical.
 * Whole-presentation only — never mix partial localized fields with canonical.
 *
 * Live canonicalVersion MUST match the PLP adapter / materializer contract
 * (full MemberProfile fields), not a privacy-filtered PublicMemberProfile
 * fingerprint — otherwise CURRENT stays usable for materialize but `/profile`
 * falls back to English.
 */

import type { LanguageCode, PublicMemberProfile, PublicPresentationNode } from "@hu/types";
import { isPublicProtectedValue } from "@hu/types";

import { resolvePublishedPresentation } from "../../resolve-published-presentation.js";
import {
  getPlpDomainAdapter,
  registerPlpDomainAdapter,
} from "../domain-adapter-registry.js";
import {
  PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE,
  participantPublicPlpDomainAdapter,
} from "./participant-public-adapter.js";

function ensureParticipantPublicAdapterRegistered(): void {
  if (!getPlpDomainAdapter(PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE)) {
    try {
      registerPlpDomainAdapter(participantPublicPlpDomainAdapter);
    } catch {
      // already registered
    }
  }
}

function readStringField(
  presentation: PublicPresentationNode,
  key: string,
): string | undefined {
  if (!presentation || typeof presentation !== "object" || Array.isArray(presentation)) {
    return undefined;
  }
  const value = (presentation as Record<string, PublicPresentationNode>)[key];
  if (typeof value === "string") {
    return value;
  }
  if (isPublicProtectedValue(value) && typeof value.value === "string") {
    return value.value;
  }
  return undefined;
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

  ensureParticipantPublicAdapterRegistered();

  const contract = await participantPublicPlpDomainAdapter.resolveCanonicalEntity({
    entityType: PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE,
    entityId: input.projection.profileId,
    locale: locale as LanguageCode,
  });
  if (!contract) {
    return input.projection;
  }

  const resolved = await resolvePublishedPresentation({
    entityType: PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE,
    entityId: input.projection.profileId,
    locale,
    liveCanonicalVersion: contract.canonicalVersion,
    liveLocalizationSchemaVersion: contract.localizationSchemaVersion,
    canonicalPresentation: contract.canonicalPresentation,
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
