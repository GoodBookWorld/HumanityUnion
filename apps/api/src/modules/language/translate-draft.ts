import { randomUUID } from "node:crypto";

import type {
  ContentTranslationSourceKind,
  TranslateDraftRequest,
  TranslateDraftResult,
} from "@hu/types";
import { normalizeLanguageCode } from "@hu/types";

import {
  assertEnabledSelectableLocale,
  resolveEnabledCanonicalLocale,
} from "./language-registry-runtime.js";
import { resolveTranslationProvider } from "./resolve-translation-provider.js";
import { TerminologyGlossaryValidationError } from "./terminology-glossary/terminology-glossary.errors.js";
import { resolveProviderTerminologyContext } from "./terminology-glossary/terminology-glossary.provider-context.js";
import { TranslationProviderError } from "./translation.config.js";

export interface TranslateDraftServiceRequest extends TranslateDraftRequest {
  readonly sourceKind?: ContentTranslationSourceKind;
}

/**
 * Explicit Author draft translation assistance.
 * Creates a working translated representation — never mutates the original draft.
 * Target language availability comes from the Language Registry (enabled only).
 */
export async function translateDraft(
  request: TranslateDraftServiceRequest,
): Promise<TranslateDraftResult> {
  const sourceLanguage = (await resolveEnabledCanonicalLocale(request.sourceLanguage)) ??
    normalizeLanguageCode(request.sourceLanguage);
  const targetLanguage = await assertEnabledSelectableLocale(
    request.targetLanguage,
    "target language",
  );
  const provider = resolveTranslationProvider();
  const isStructured = typeof request.draftContent !== "string";

  const sourceText = isStructured
    ? JSON.stringify(request.draftContent)
    : request.draftContent;

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
    sourceLanguage,
    targetLanguage,
    text: sourceText,
    contentType: isStructured ? "structured_json" : "plain",
    sourceRecordId: request.sourceRecordId,
    sourceVersion: request.sourceVersion,
    terminologyContext,
    safetyCleared: true,
  });

  let translatedContent: Record<string, unknown> | string = result.translatedText;
  if (isStructured) {
    try {
      translatedContent = JSON.parse(result.translatedText) as Record<string, unknown>;
    } catch {
      translatedContent = { text: result.translatedText };
    }
  }

  return {
    originalDraftContent: request.draftContent,
    originalLanguage: sourceLanguage,
    workingTranslation: {
      translationId: `translation-${randomUUID()}`,
      sourceKind: request.sourceKind ?? "lifecycle_stage",
      sourceRecordId: request.sourceRecordId,
      sourceVersion: request.sourceVersion,
      sourceLanguage,
      targetLanguage,
      translatedContent,
      translationProvider: result.providerId,
      translationKind: "machine",
      createdAt: new Date().toISOString(),
      stale: false,
      freshness: "current",
    },
  };
}
