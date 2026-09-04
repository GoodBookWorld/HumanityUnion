/**
 * Pack 02G Task 02 / 08J — canonical source eligibility for content translation.
 *
 * Pack 08J: participant-facing semantic fields are AUTO_TRANSLATABLE by default.
 * CONTENT_TRANSLATION_FIELD_ALLOWLIST is a compatibility shim (unioned with
 * projection keys), not the presentation enrollment gate. NON_TRANSLATABLE
 * policy is the exclusion boundary for provider payloads.
 *
 * Private surfaces (DMs, Participant PII, auth, shipping, admin notes, moderation,
 * drafts, raw events, secrets, Official Response raw headers, Civic Archive
 * verification metadata) are not ContentTranslationSourceKind values and have
 * no field allowlist — they cannot become warm-eligible through this contract.
 */

import type {
  ContentTranslationIntent,
  ContentTranslationSourceKind,
  LanguageCode,
} from "@hu/types";

import {
  assertSafeForAutomaticTranslation,
  resolveAutomaticTranslationFieldKeys,
  stripNonTranslatableKeys,
} from "./non-translatable-policy.js";
import { TranslationProviderError } from "./translation.config.js";

/**
 * Compatibility field shim per sourceKind (Pack 08J — not the primary gate).
 * New projection keys are accepted when present on the loaded source bag and
 * not NON_TRANSLATABLE, without editing this map.
 */
export const CONTENT_TRANSLATION_FIELD_ALLOWLIST = {
  initiative: ["title", "description"],
  collaborative_analysis: [
    "title",
    "summary",
    "supportingEvidence",
    "risks",
    "openQuestions",
    "suggestedImprovements",
    "references",
  ],
  petition: [
    "title",
    "summary",
    "requestStatement",
    "expectedOutcome",
    "supportingContext",
    "keyArguments",
  ],
  blog_post: ["title", "excerpt", "content"],
  /** Public participant-visible Discussion comments — body only. */
  discussion_comment: ["body"],
  /** Draft assist only — not public warm-eligible. */
  lifecycle_stage: [] as readonly string[],
  improvement_proposal: [
    "targetSection",
    "currentIssue",
    "proposedChange",
    "rationale",
    "expectedImprovement",
    "references",
    "decisionNote",
  ],
  initiative_revision: ["revisionSummary", "title", "description", "changes"],
  decision_session: ["title", "purpose", "decisionQuestion", "structuredContent"],
  collective_decision: ["question", "outcomeSummary", "transparencyNote", "structuredContent"],
  implementation_commitment: [
    "title",
    "summary",
    "organization",
    "commitmentScope",
    "approvedAction",
    "suggestedResponsibleRole",
    "priority",
    "requiredResources",
    "relatedRisks",
    "references",
  ],
  implementation_tracking: [
    "currentStage",
    "summary",
    "notes",
    "approvedAction",
    "dependencies",
    "obstacles",
    "evidenceReferences",
    "executionHistory",
  ],
  official_response: ["subject", "summary", "responseReference", "organizationName"],
  public_impact: [
    "title",
    "summary",
    "observedImpact",
    "affectedCommunity",
    "evidenceSummary",
    "evidence",
  ],
  civic_archive: [
    "title",
    "summary",
    "implementationPeriod",
    "initiativeSummary",
    "civicChallenge",
    "implementationStory",
    "verifiedPublicImpact",
    "lessonsLearned_whatWorked",
    "lessonsLearned_whatDidNotWork",
    "lessonsLearned_recommendationsForFuture",
    "lessonsLearned_transferableExperience",
    "knowledgeContribution_socialBenefits",
    "knowledgeContribution_environmentalBenefits",
    "knowledgeContribution_economicBenefits",
    "knowledgeContribution_governanceBenefits",
    "knowledgeContribution_educationalBenefits",
    "knowledgeContribution_additionalObservations",
    "timelineLabels",
  ],
  civic_media: [
    "overviewTitle",
    "overviewSummary",
    "overviewPoints",
    "selectionPrinciples",
    "faq",
    "initiativeFlowTitle",
    "initiativeFlowSummary",
    "initiativeFlowStages",
    "trustedMediaExplanations",
  ],
} as const satisfies Record<ContentTranslationSourceKind, readonly string[]>;

/**
 * Pack 02G Task 07E.1 — civic display titles/headings that must differ from
 * source when sourceLanguage !== targetLanguage (non-empty source values).
 * Strict subset of CONTENT_TRANSLATION_FIELD_ALLOWLIST per sourceKind.
 */
export const CONTENT_TRANSLATION_CIVIC_TITLE_FIELDS = {
  initiative: ["title"],
  collaborative_analysis: ["title"],
  petition: ["title"],
  blog_post: ["title"],
  discussion_comment: [] as readonly string[],
  lifecycle_stage: [] as readonly string[],
  improvement_proposal: [] as readonly string[],
  initiative_revision: ["title"],
  decision_session: ["title"],
  collective_decision: ["question"],
  implementation_commitment: ["title"],
  implementation_tracking: [] as readonly string[],
  official_response: ["subject"],
  public_impact: ["title"],
  civic_archive: ["title"],
  civic_media: ["overviewTitle", "initiativeFlowTitle"],
} as const satisfies Record<ContentTranslationSourceKind, readonly string[]>;

/** Public kinds that require published/public projection eligibility for generation. */
export const PUBLIC_CONTENT_TRANSLATION_SOURCE_KINDS = [
  "initiative",
  "collaborative_analysis",
  "petition",
  "blog_post",
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
] as const satisfies readonly ContentTranslationSourceKind[];

/** Surfaces that must never appear as translation sourceKinds (regression sentinel). */
export const CONTENT_TRANSLATION_PRIVACY_EXCLUSIONS = [
  "direct_message",
  "private_message",
  "dm",
  "participant_private",
  "auth_credential",
  "email_security",
  "shipping_fulfillment",
  "steward_admin_note",
  "moderation_private",
  "unpublished_draft",
  "raw_internal_event",
  "secret_token",
  "official_response_raw_source",
  "official_response_message_headers",
  "official_response_provider_metadata",
  "civic_archive_verification_metadata",
] as const;

export interface CanonicalTranslatableSourceEligibility {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly sourceLanguage: LanguageCode;
  readonly fields: Readonly<Record<string, string>>;
  readonly sourceVersion: string;
  readonly isPublished: boolean;
  /** Provider invariant — civic public path always clears safety. */
  readonly safetyCleared: true;
}

export function isSupportedContentTranslationSourceKind(
  value: string,
): value is ContentTranslationSourceKind {
  return Object.prototype.hasOwnProperty.call(CONTENT_TRANSLATION_FIELD_ALLOWLIST, value);
}

export function isPublicContentTranslationSourceKind(
  value: ContentTranslationSourceKind,
): boolean {
  return (PUBLIC_CONTENT_TRANSLATION_SOURCE_KINDS as readonly string[]).includes(value);
}

export function isPrivacyExcludedTranslationSurface(value: string): boolean {
  return (CONTENT_TRANSLATION_PRIVACY_EXCLUSIONS as readonly string[]).includes(value);
}

/**
 * Pack 08J — projection fields minus NON_TRANSLATABLE; compatibility allowlist
 * is unioned. Rejects only when no AUTO_TRANSLATABLE fields remain.
 * NON_TRANSLATABLE keys on the source bag are stripped, not fatal.
 */
export function assertPublicFieldsAllowlisted(input: {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly fields: Readonly<Record<string, string>>;
}): void {
  const sanitized = stripNonTranslatableKeys(input.fields);
  assertSafeForAutomaticTranslation(sanitized);
  const eligible = resolveAutomaticTranslationFieldKeys({
    sourceFields: sanitized,
    compatibilityAllowlist:
      CONTENT_TRANSLATION_FIELD_ALLOWLIST[input.sourceKind] as readonly string[],
  });
  if (Object.keys(input.fields).length > 0 && eligible.length === 0) {
    throw new TranslationProviderError(
      "forbidden",
      `No AUTO_TRANSLATABLE fields remain for ${input.sourceKind} after NON_TRANSLATABLE exclusion.`,
    );
  }
}

/**
 * Sanitize a loaded source field bag for provider input: strip NON_TRANSLATABLE
 * keys and private-shaped values. Projection keys are kept by default.
 */
export function sanitizeFieldsForAutomaticTranslation(input: {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly fields: Readonly<Record<string, string>>;
}): Record<string, string> {
  const stripped = stripNonTranslatableKeys(input.fields);
  const eligibleKeys = new Set(
    resolveAutomaticTranslationFieldKeys({
      sourceFields: stripped,
      compatibilityAllowlist:
        CONTENT_TRANSLATION_FIELD_ALLOWLIST[input.sourceKind] as readonly string[],
    }),
  );
  const out: Record<string, string> = {};
  for (const key of eligibleKeys) {
    const value = stripped[key];
    if (typeof value === "string") {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Shared public/safety eligibility before any provider call (on-demand or warm).
 */
export function assertCanonicalSourceEligibleForTranslation(input: {
  readonly source: CanonicalTranslatableSourceEligibility;
  readonly intent: ContentTranslationIntent;
}): void {
  const { source, intent } = input;

  if (!isSupportedContentTranslationSourceKind(source.sourceKind)) {
    throw new TranslationProviderError(
      "bad_request",
      `Unsupported content translation sourceKind: ${source.sourceKind}`,
    );
  }

  if (isPrivacyExcludedTranslationSurface(source.sourceKind)) {
    throw new TranslationProviderError(
      "forbidden",
      "Private surfaces cannot be content-translation eligible.",
    );
  }

  if (source.safetyCleared !== true) {
    throw new TranslationProviderError(
      "forbidden",
      "Content translation requires safetyCleared=true.",
    );
  }

  assertPublicFieldsAllowlisted({
    sourceKind: source.sourceKind,
    fields: source.fields,
  });

  if (intent === "automatic_warm") {
    if (source.sourceKind === "lifecycle_stage") {
      throw new TranslationProviderError(
        "forbidden",
        "lifecycle_stage is not eligible for automatic content translation warming.",
      );
    }
    if (!source.isPublished) {
      throw new TranslationProviderError(
        "forbidden",
        "Only published content can be automatically warm-translated.",
      );
    }
  }

  if (
    intent === "on_demand" &&
    !source.isPublished &&
    isPublicContentTranslationSourceKind(source.sourceKind)
  ) {
    throw new TranslationProviderError(
      "forbidden",
      "Only published content can generate public translations.",
    );
  }
}

/**
 * Never generate target == canonical source language.
 */
export function isRedundantTargetLanguage(input: {
  readonly sourceLanguage: LanguageCode;
  readonly targetLanguage: LanguageCode;
}): boolean {
  return (
    input.sourceLanguage.trim().toLowerCase() === input.targetLanguage.trim().toLowerCase()
  );
}
