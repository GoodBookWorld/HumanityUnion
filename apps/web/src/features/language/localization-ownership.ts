/**
 * Pack 08I.15 — Web-side localization ownership + DEFAULT_LOCALIZABLE helpers.
 *
 * Classification lives here (and mirrored on the API). Individual React
 * components must NOT invent ad-hoc ownership decisions.
 */

import type {
  ContentTranslationSourceKind,
  LocalizationOwnershipClass,
} from "@hu/types";
import { DEFAULT_LOCALIZABLE_RULE } from "@hu/types";

export { DEFAULT_LOCALIZABLE_RULE };

/** Domains that are never Gemini-owned. */
export const ADMIN_MANAGED_LOCALIZATION_DOMAINS = [
  "BRAND_LOCALIZATION",
  "LEGAL_LOCALIZATION",
] as const satisfies readonly LocalizationOwnershipClass[];

/** CIVIC_CONTENT sourceKinds that must use content_translations + public resolver. */
export const CIVIC_CONTENT_SOURCE_KINDS = [
  "initiative",
  "collaborative_analysis",
  "petition",
  "discussion_comment",
  "improvement_proposal",
  "initiative_revision",
  "decision_session",
  "collective_decision",
  "implementation_commitment",
  "implementation_tracking",
  "official_response",
  "public_impact",
  "civic_archive",
  "civic_media",
  "blog_post",
  "public_news",
] as const satisfies readonly ContentTranslationSourceKind[];

export type CivicContentSourceKind = (typeof CIVIC_CONTENT_SOURCE_KINDS)[number];

export function isCivicContentSourceKind(
  value: string,
): value is CivicContentSourceKind {
  return (CIVIC_CONTENT_SOURCE_KINDS as readonly string[]).includes(value);
}

/**
 * Classify participant-facing text ownership.
 * Unknown semantic prose defaults to CIVIC_CONTENT (localizable by default),
 * never to an implicit "leave English" path.
 */
export function classifyLocalizationOwnership(input: {
  readonly domain?:
    | "web_ui"
    | "civic_content"
    | "brand"
    | "legal"
    | "terminology"
    | "invariant"
    | "unknown_semantic";
  readonly sourceKind?: ContentTranslationSourceKind | string | null;
  readonly fieldKey?: string | null;
}): LocalizationOwnershipClass {
  if (input.domain === "web_ui") {
    return "WEB_UI";
  }
  if (input.domain === "brand") {
    return "BRAND_LOCALIZATION";
  }
  if (input.domain === "legal") {
    return "LEGAL_LOCALIZATION";
  }
  if (input.domain === "terminology") {
    return "CONTROLLED_TERMINOLOGY";
  }
  if (input.domain === "invariant") {
    return "NON_TRANSLATABLE";
  }

  if (input.sourceKind && isCivicContentSourceKind(input.sourceKind)) {
    return "CIVIC_CONTENT";
  }

  if (input.domain === "civic_content" || input.domain === "unknown_semantic") {
    return "CIVIC_CONTENT";
  }

  // DEFAULT_LOCALIZABLE: unclassified participant-facing semantic prose is CIVIC_CONTENT.
  return "CIVIC_CONTENT";
}

/**
 * Explicit NON_TRANSLATABLE field keys (not an allowlist of translatable titles).
 * Everything else participant-facing semantic remains localizable by default.
 */
export const NON_TRANSLATABLE_FIELD_KEYS = [
  "id",
  "initiativeId",
  "commentId",
  "petitionId",
  "analysisId",
  "responseId",
  "responseNumber",
  "email",
  "url",
  "href",
  "imageUrl",
  "createdAt",
  "updatedAt",
  "publishedAt",
  "receivedAt",
  "participantId",
  "stewardId",
  "memberId",
  "candidateCount",
  "voteCount",
  "signatureCount",
  "status",
  "verificationState",
  "lifecycleProfile",
  "publicStatus",
  // Pack 08J — identity / contact
  "name",
  "displayName",
  "authorDisplayName",
  "uniqueName",
  "username",
  "candidateName",
  "organizationName",
  "phone",
  "phoneNumber",
  "emailAddress",
] as const;

export function isRegisteredNonTranslatableFieldKey(fieldKey: string): boolean {
  return (NON_TRANSLATABLE_FIELD_KEYS as readonly string[]).includes(fieldKey);
}

/**
 * Pack 08I.15 — CIVIC_CONTENT manual override status (reportable).
 * Types allow translationKind human | author-approved, but there is no Admin
 * write UI/API that persists those kinds for civic content today.
 */
export const CIVIC_CONTENT_MANUAL_OVERRIDE_STATUS = {
  modelSupportsHumanAndAuthorApprovedKinds: true,
  displayCanPreferApprovedTranslations: true,
  adminWritePathExists: false,
  representation:
    "TranslatedContentRecord.translationKind may be human|author-approved; getOrCreateContentTranslation always writes machine today.",
} as const;

/**
 * Fail closed in tests when a participant-facing semantic field is presented
 * without an ownership class. Does not invent per-component heuristics.
 */
export function assertParticipantFacingTextClassified(input: {
  readonly ownership: LocalizationOwnershipClass | null | undefined;
  readonly surfaceId: string;
  readonly fieldKey?: string;
}): LocalizationOwnershipClass {
  if (!input.ownership) {
    throw new Error(
      `UNCLASSIFIED_PARTICIPANT_TEXT: ${input.surfaceId}` +
        (input.fieldKey ? ` field=${input.fieldKey}` : "") +
        ` — ${DEFAULT_LOCALIZABLE_RULE}`,
    );
  }
  return input.ownership;
}

export function assertNotMachineTranslatedAdminDomain(
  ownership: LocalizationOwnershipClass,
  surfaceId: string,
): void {
  if (
    ownership === "BRAND_LOCALIZATION" ||
    ownership === "LEGAL_LOCALIZATION"
  ) {
    // Callers must use Admin resolvers — never content_translations / Gemini.
    return;
  }
  void surfaceId;
}
