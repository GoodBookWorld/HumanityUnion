import { createHash, randomUUID } from "node:crypto";

import type {
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
import { getAnalysisById } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { getPetition } from "../petition/petition.store.js";
import { blogHtmlToPlainText } from "../blog/blog-content-sanitize.js";
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

function versionFromFields(fields: Record<string, string>, stamp: string): string {
  const hash = createHash("sha256")
    .update(JSON.stringify(fields))
    .update(stamp)
    .digest("hex")
    .slice(0, 16);
  return `v-${hash}`;
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
      sourceVersion: versionFromFields(fields, initiative.updatedAt),
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
      sourceVersion: versionFromFields(fields, analysis.updatedAt),
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
      sourceVersion: versionFromFields(fields, petition.updatedAt),
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
      sourceVersion: `v-${post.publishedVersion}-${versionFromFields(fields, post.updatedAt)}`,
      sourceLanguage: normalizeLanguageCode(post.originalLanguage, DEFAULT_PLATFORM_LANGUAGE),
      fields,
      authorParticipantId: post.authorParticipantId,
      isPublished: post.status === "published",
    };
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
 */
export async function getOrCreateContentTranslation(input: {
  sourceKind: ContentTranslationSourceKind;
  sourceRecordId: string;
  targetLanguage: LanguageCode;
  generateIfMissing?: boolean;
}): Promise<{
  readonly source: LoadedTranslatableSource;
  readonly translation: TranslatedContentRecord | null;
  readonly generated: boolean;
}> {
  const source = await loadTranslatableSource(input);
  if (!source) {
    throw new TranslationProviderError("bad_request", "Source content was not found.");
  }

  await markStaleTranslationsForSource({
    sourceKind: source.sourceKind,
    sourceRecordId: source.sourceRecordId,
    liveSourceVersion: source.sourceVersion,
  });

  const targetLanguage = await assertEnabledSelectableLocale(input.targetLanguage);
  if (targetLanguage === source.sourceLanguage) {
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

  if (!source.isPublished && source.sourceKind !== "lifecycle_stage") {
    // Public generate path only for published records.
    if (source.sourceKind === "initiative" || source.sourceKind === "collaborative_analysis" || source.sourceKind === "petition") {
      if (!source.isPublished) {
        throw new TranslationProviderError(
          "forbidden",
          "Only published content can generate public translations.",
        );
      }
    }
  }

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
      const created = await getOrCreateContentTranslation({
        sourceKind: input.sourceKind,
        sourceRecordId: input.sourceRecordId,
        targetLanguage: preferredReadingLanguage,
        generateIfMissing: true,
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
