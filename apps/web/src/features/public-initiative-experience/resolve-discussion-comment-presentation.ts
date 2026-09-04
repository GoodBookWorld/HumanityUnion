/**
 * Pack 08I.13 / 08J.1 — public Discussion comment body via generic boundary.
 * Translates `body` only. Canonical comment body is never overwritten.
 * Interface locale drives resolve language.
 */

import type { LanguageCode } from "@hu/types";

import {
  resolveLocalizedPresentation,
  type LocalizedPresentationDeps,
} from "../language/resolve-localized-presentation";
import {
  generateContentTranslation,
  resolveTranslatedContent,
} from "../language/translation-api";

export interface DiscussionCommentPresentationDeps extends LocalizedPresentationDeps {}

const defaultDeps: DiscussionCommentPresentationDeps = {
  resolveTranslatedContent,
  generateContentTranslation,
};

export interface ResolvedDiscussionCommentPresentation {
  readonly body: string;
  readonly presentationMode: "translated" | "original";
  readonly isStale: boolean;
  readonly activeLanguage: LanguageCode | string;
}

export async function resolveDiscussionCommentPresentation(
  input: {
    readonly commentId: string;
    readonly canonicalBody: string;
    readonly displayLanguage?: LanguageCode | string;
    readonly ready?: boolean;
    readonly translationPreference?: string;
    readonly requestGeneration?: number;
    /** @deprecated Prefer displayLanguage + ready + translationPreference. */
    readonly readingContext?: {
      readonly ready: boolean;
      readonly readingLanguage: string;
      readonly translationPreference: string;
    };
  },
  deps: DiscussionCommentPresentationDeps = defaultDeps,
): Promise<ResolvedDiscussionCommentPresentation> {
  const ready = input.ready ?? input.readingContext?.ready ?? false;
  const translationPreference =
    input.translationPreference ??
    input.readingContext?.translationPreference ??
    "preferred";
  const displayLanguage =
    input.displayLanguage ?? input.readingContext?.readingLanguage ?? "en";

  const resolved = await resolveLocalizedPresentation({
    request: {
      sourceKind: "discussion_comment",
      sourceRecordId: input.commentId,
      displayLanguage,
      ready,
      translationPreference,
      requestGeneration: input.requestGeneration,
      enableOnDemandGenerate: true,
    },
    canonicalFields: { body: input.canonicalBody },
    deps,
  });

  if (resolved.presentationMode === "original") {
    return {
      body: input.canonicalBody,
      presentationMode: "original",
      isStale: resolved.isStale,
      activeLanguage: resolved.activeLanguage,
    };
  }

  return {
    body: resolved.fields.body?.trim() || input.canonicalBody,
    presentationMode: "translated",
    isStale: resolved.isStale,
    activeLanguage: resolved.activeLanguage,
  };
}
