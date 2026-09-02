import { randomUUID } from "node:crypto";

import type {
  ContentTranslationIntent,
  ContentTranslationSourceKind,
  LanguageCode,
  ResolvedTranslatedDisplay,
  TranslatedContentRecord,
  TranslationDisplayPreference,
} from "@hu/types";
import {
  DEFAULT_PLATFORM_LANGUAGE,
  normalizeLanguageCode,
} from "@hu/types";

import { findBlogPostById } from "../blog/persistence/blog.repository.js";
import { invalidateGlobalSearchIndex } from "../global-search/global-search.index.js";
import { getAnalysisById } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { getPetition } from "../petition/petition.store.js";
import { blogHtmlToPlainText } from "../blog/blog-content-sanitize.js";
import {
  loadCivicArchiveTranslationSource,
  loadCivicMediaTranslationSource,
  loadCollectiveDecisionTranslationSource,
  loadDecisionSessionTranslationSource,
  loadImplementationCommitmentTranslationSource,
  loadImplementationTrackingTranslationSource,
  loadImprovementProposalTranslationSource,
  loadInitiativeRevisionTranslationSource,
  loadOfficialResponseTranslationSource,
  loadPublicImpactTranslationSource,
} from "./content-translation-civic-loaders.js";
import {
  assertCanonicalSourceEligibleForTranslation,
  isRedundantTargetLanguage,
  type CanonicalTranslatableSourceEligibility,
} from "./content-translation-eligibility.js";
import {
  assertCivicTitleFieldsTranslatedFromSource,
  assertTranslatedProseChangedFromSource,
  filterTranslatedFieldsToSourceAllowlist,
} from "./content-translation-output-validation.js";
import { buildContentTranslationSourceVersion } from "./content-translation-version.js";
import { assertAutomaticContentTranslationTargetLocale } from "./content-translation-warm-targets.js";
import {
  assertEnabledSelectableLocale,
  resolveLocaleWithEnglishFallback,
} from "./language-registry-runtime.js";
import { resolveParticipantLanguageContext } from "./participant-language-context.js";
import {
  findContentTranslation,
  listContentTranslationsForSource,
  markStaleTranslationsForSource,
  upsertContentTranslation,
} from "./persistence/content-translation.repository.js";
import {
  resolveStructuredTranslatedDisplay,
} from "./resolve-translated-display.js";
import { resolveTranslationProvider } from "./resolve-translation-provider.js";
import { TerminologyGlossaryValidationError } from "./terminology-glossary/terminology-glossary.errors.js";
import { resolveProviderTerminologyContext } from "./terminology-glossary/terminology-glossary.provider-context.js";
import { TranslationProviderError } from "./translation.config.js";

export interface LoadedTranslatableSource {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly sourceVersion: string;
  readonly sourceLanguage: LanguageCode;
  readonly fields: Record<string, string>;
  readonly authorParticipantId: string | null;
  readonly isPublished: boolean;
}

function toEligibilitySource(
  source: LoadedTranslatableSource,
): CanonicalTranslatableSourceEligibility {
  return {
    sourceKind: source.sourceKind,
    sourceRecordId: source.sourceRecordId,
    sourceLanguage: source.sourceLanguage,
    fields: source.fields,
    sourceVersion: source.sourceVersion,
    isPublished: source.isPublished,
    safetyCleared: true,
  };
}

export async function loadTranslatableSource(input: {
  sourceKind: ContentTranslationSourceKind;
  sourceRecordId: string;
}): Promise<LoadedTranslatableSource | null> {
  if (input.sourceKind === "initiative") {
    const initiative = getInitiativeById(input.sourceRecordId);
    if (!initiative) {
      return null;
    }
    const fields = {
      title: initiative.title,
      description: initiative.description,
    };
    return {
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      sourceVersion: buildContentTranslationSourceVersion({
        fields,
        versionStamp: initiative.updatedAt,
      }),
      sourceLanguage: normalizeLanguageCode(
        initiative.metadata?.language,
        DEFAULT_PLATFORM_LANGUAGE,
      ),
      fields,
      authorParticipantId: initiative.stewardId,
      isPublished: initiative.lifecyclePhase === "published" || initiative.status !== "draft",
    };
  }

  if (input.sourceKind === "collaborative_analysis") {
    const analysis = getAnalysisById(input.sourceRecordId);
    if (!analysis) {
      return null;
    }
    const fields = {
      title: analysis.title,
      summary: analysis.summary,
      supportingEvidence: analysis.supportingEvidence,
      risks: analysis.risks,
      openQuestions: analysis.openQuestions ?? "",
      suggestedImprovements: analysis.suggestedImprovements,
      references: analysis.references,
    };
    return {
      sourceKind: "collaborative_analysis",
      sourceRecordId: analysis.analysisId,
      sourceVersion: buildContentTranslationSourceVersion({
        fields,
        versionStamp: analysis.updatedAt,
      }),
      sourceLanguage: DEFAULT_PLATFORM_LANGUAGE,
      fields,
      authorParticipantId: analysis.authorId,
      isPublished: analysis.status === "published",
    };
  }

  if (input.sourceKind === "petition") {
    const petition = await getPetition(input.sourceRecordId);
    if (!petition) {
      return null;
    }
    const fields = {
      title: petition.subject.title,
      summary: petition.subject.summary,
      requestStatement: petition.subject.requestStatement ?? "",
      expectedOutcome: petition.subject.expectedOutcome ?? "",
      supportingContext: petition.subject.supportingContext ?? "",
      keyArguments: (petition.subject.keyArguments ?? []).join("\n"),
    };
    return {
      sourceKind: "petition",
      sourceRecordId: petition.petitionId,
      sourceVersion: buildContentTranslationSourceVersion({
        fields,
        versionStamp: petition.updatedAt,
      }),
      sourceLanguage: DEFAULT_PLATFORM_LANGUAGE,
      fields,
      authorParticipantId: null,
      isPublished: petition.status !== "Draft",
    };
  }

  if (input.sourceKind === "blog_post") {
    const post = await findBlogPostById(input.sourceRecordId);
    if (!post) {
      return null;
    }
    // Original remains canonical — translation never overwrites these fields.
    const fields = {
      title: post.title,
      excerpt: post.excerpt,
      content: blogHtmlToPlainText(post.content),
    };
    return {
      sourceKind: "blog_post",
      sourceRecordId: post.postId,
      sourceVersion: buildContentTranslationSourceVersion({
        fields,
        versionStamp: post.updatedAt,
        publishedVersion: post.publishedVersion,
      }),
      sourceLanguage: normalizeLanguageCode(post.originalLanguage, DEFAULT_PLATFORM_LANGUAGE),
      fields,
      authorParticipantId: post.authorParticipantId,
      isPublished: post.status === "published",
    };
  }

  if (input.sourceKind === "improvement_proposal") {
    return loadImprovementProposalTranslationSource(input.sourceRecordId);
  }
  if (input.sourceKind === "initiative_revision") {
    return loadInitiativeRevisionTranslationSource(input.sourceRecordId);
  }
  if (input.sourceKind === "decision_session") {
    return loadDecisionSessionTranslationSource(input.sourceRecordId);
  }
  if (input.sourceKind === "collective_decision") {
    return loadCollectiveDecisionTranslationSource(input.sourceRecordId);
  }
  if (input.sourceKind === "implementation_commitment") {
    return loadImplementationCommitmentTranslationSource(input.sourceRecordId);
  }
  if (input.sourceKind === "implementation_tracking") {
    return loadImplementationTrackingTranslationSource(input.sourceRecordId);
  }
  if (input.sourceKind === "official_response") {
    return loadOfficialResponseTranslationSource(input.sourceRecordId);
  }
  if (input.sourceKind === "public_impact") {
    return loadPublicImpactTranslationSource(input.sourceRecordId);
  }
  if (input.sourceKind === "civic_archive") {
    return loadCivicArchiveTranslationSource(input.sourceRecordId);
  }
  if (input.sourceKind === "civic_media") {
    return loadCivicMediaTranslationSource(input.sourceRecordId);
  }

  return null;
}

function parseStructuredTranslation(text: string): Record<string, string> {
  const parsed = JSON.parse(text) as Record<string, unknown>;
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "string") {
      fields[key] = value;
    }
  }
  return fields;
}

/**
 * Idempotent: same sourceKind + sourceRecordId + sourceVersion + targetLanguage
 * returns the existing record without a second provider call.
 *
 * `intent` defaults to `on_demand` (enabled locale gate — preserves Pack 02 UX).
 * `automatic_warm` additionally requires contentTranslationEnabled.
 */
export async function getOrCreateContentTranslation(input: {
  sourceKind: ContentTranslationSourceKind;
  sourceRecordId: string;
  targetLanguage: LanguageCode;
  generateIfMissing?: boolean;
  /**
   * Pack 02G: on_demand (default) vs automatic_warm.
   * Does not change provider/persistence — only locale eligibility gates.
   */
  intent?: ContentTranslationIntent;
}): Promise<{
  readonly source: LoadedTranslatableSource;
  readonly translation: TranslatedContentRecord | null;
  readonly generated: boolean;
}> {
  const intent: ContentTranslationIntent = input.intent ?? "on_demand";
  const source = await loadTranslatableSource(input);
  if (!source) {
    throw new TranslationProviderError("bad_request", "Source content was not found.");
  }

  await markStaleTranslationsForSource({
    sourceKind: source.sourceKind,
    sourceRecordId: source.sourceRecordId,
    liveSourceVersion: source.sourceVersion,
  });
  // Pack 02H — stale rows must stop contributing as current searchable text on next rebuild.
  invalidateGlobalSearchIndex();

  const targetLanguage =
    intent === "automatic_warm"
      ? await assertAutomaticContentTranslationTargetLocale(input.targetLanguage)
      : await assertEnabledSelectableLocale(input.targetLanguage);

  if (
    isRedundantTargetLanguage({
      sourceLanguage: source.sourceLanguage,
      targetLanguage,
    })
  ) {
    return { source, translation: null, generated: false };
  }

  const existing = await findContentTranslation({
    sourceKind: source.sourceKind,
    sourceRecordId: source.sourceRecordId,
    sourceVersion: source.sourceVersion,
    targetLanguage,
  });
  if (existing && !existing.stale) {
    return { source, translation: existing, generated: false };
  }

  if (!input.generateIfMissing) {
    return { source, translation: existing, generated: false };
  }

  assertCanonicalSourceEligibleForTranslation({
    source: toEligibilitySource(source),
    intent,
  });

  const provider = resolveTranslationProvider();
  let terminologyContext: string;
  try {
    terminologyContext = await resolveProviderTerminologyContext(targetLanguage);
  } catch (error) {
    if (error instanceof TerminologyGlossaryValidationError) {
      throw new TranslationProviderError("unsupported_language", error.message);
    }
    throw error;
  }

  const result = await provider.translate({
    sourceLanguage: source.sourceLanguage,
    targetLanguage,
    text: JSON.stringify(source.fields),
    contentType: "structured_json",
    sourceRecordId: source.sourceRecordId,
    sourceVersion: source.sourceVersion,
    terminologyContext,
    safetyCleared: true,
  });

  let translatedFields: Record<string, string>;
  try {
    translatedFields = parseStructuredTranslation(result.translatedText);
  } catch {
    throw new TranslationProviderError(
      "malformed_response",
      "Translation provider returned malformed structured content.",
    );
  }

  // Pack 02G Task 07C / 07E.1 — drop invented keys; reject all-unchanged prose;
  // require designated civic title/heading fields to differ for cross-language.
  translatedFields = filterTranslatedFieldsToSourceAllowlist({
    sourceKind: source.sourceKind,
    sourceFields: source.fields,
    translatedFields,
  });
  assertTranslatedProseChangedFromSource({
    sourceKind: source.sourceKind,
    sourceLanguage: source.sourceLanguage,
    targetLanguage,
    sourceFields: source.fields,
    translatedFields,
  });
  assertCivicTitleFieldsTranslatedFromSource({
    sourceKind: source.sourceKind,
    sourceLanguage: source.sourceLanguage,
    targetLanguage,
    sourceFields: source.fields,
    translatedFields,
  });

  const record: TranslatedContentRecord = {
    translationId: existing?.translationId ?? `translation-${randomUUID()}`,
    sourceKind: source.sourceKind,
    sourceRecordId: source.sourceRecordId,
    sourceVersion: source.sourceVersion,
    sourceLanguage: source.sourceLanguage,
    targetLanguage,
    translatedContent: translatedFields,
    translationProvider: result.providerId,
    translationKind: "machine",
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stale: false,
    freshness: "current",
  };

  await upsertContentTranslation(record);
  // Pack 02H — translation upsert invalidates search index; rebuild on next query.
  invalidateGlobalSearchIndex();
  return { source, translation: record, generated: true };
}

export async function resolvePublicTranslatedContent(input: {
  sourceKind: ContentTranslationSourceKind;
  sourceRecordId: string;
  participantId?: string;
  preferredReadingLanguage?: LanguageCode;
  translationPreference?: TranslationDisplayPreference;
  generateIfMissing?: boolean;
}): Promise<ResolvedTranslatedDisplay<Record<string, string>>> {
  const language = await resolveParticipantLanguageContext(input.participantId);
  const preferredReadingLanguage = await resolveLocaleWithEnglishFallback(
    input.preferredReadingLanguage ?? language.preferredReadingLanguage,
  );
  const translationPreference =
    input.translationPreference ?? language.translationDisplayPreference;

  let translations = await listContentTranslationsForSource({
    sourceKind: input.sourceKind,
    sourceRecordId: input.sourceRecordId,
  });

  if (input.generateIfMissing) {
    try {
      // Public Web generate remains on_demand — enabled locale is sufficient.
      const created = await getOrCreateContentTranslation({
        sourceKind: input.sourceKind,
        sourceRecordId: input.sourceRecordId,
        targetLanguage: preferredReadingLanguage,
        generateIfMissing: true,
        intent: "on_demand",
      });
      if (created.translation) {
        translations = await listContentTranslationsForSource({
          sourceKind: input.sourceKind,
          sourceRecordId: input.sourceRecordId,
        });
      }
      return resolveStructuredTranslatedDisplay({
        originalFields: created.source.fields,
        originalLanguage: created.source.sourceLanguage,
        preferredReadingLanguage,
        translationPreference,
        translations: translations.map((item) =>
          item.sourceVersion === created.source.sourceVersion
            ? item
            : { ...item, stale: true, freshness: "stale" as const },
        ),
      });
    } catch (error) {
      // Provider failure → original, never empty / never mutate source.
      if (error instanceof TranslationProviderError) {
        const source = await loadTranslatableSource(input);
        if (!source) {
          throw error;
        }
        return resolveStructuredTranslatedDisplay({
          originalFields: source.fields,
          originalLanguage: source.sourceLanguage,
          preferredReadingLanguage,
          translationPreference,
          translations,
        });
      }
      throw error;
    }
  }

  const source = await loadTranslatableSource(input);
  if (!source) {
    throw new TranslationProviderError("bad_request", "Source content was not found.");
  }

  translations = translations.map((item) =>
    item.sourceVersion === source.sourceVersion
      ? item
      : { ...item, stale: true, freshness: "stale" as const },
  );

  return resolveStructuredTranslatedDisplay({
    originalFields: source.fields,
    originalLanguage: source.sourceLanguage,
    preferredReadingLanguage,
    translationPreference,
    translations,
  });
}
