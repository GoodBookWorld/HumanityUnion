/**
 * Pack 08I.13 — public Discussion comment body presentation via content_translations.
 * Translates `body` only. Canonical comment body is never overwritten.
 */

import type { ResolvedTranslatedDisplay } from "@hu/types";

import { resolvePublicContentTranslationDisplay } from "../language/resolve-public-content-translation-display";
import {
  generateContentTranslation,
  resolveTranslatedContent,
} from "../language/translation-api";
import type { PublicContentReadingContext } from "../language/use-public-content-reading-context";

export interface DiscussionCommentPresentationDeps {
  readonly resolveTranslatedContent: typeof resolveTranslatedContent;
  readonly generateContentTranslation: typeof generateContentTranslation;
}

const defaultDeps: DiscussionCommentPresentationDeps = {
  resolveTranslatedContent,
  generateContentTranslation,
};

export interface ResolvedDiscussionCommentPresentation {
  readonly body: string;
  readonly presentationMode: "translated" | "original";
  readonly isStale: boolean;
}

function pickBody(
  resolved: ResolvedTranslatedDisplay<Record<string, string>>,
  fallback: string,
): string {
  const value = resolved.content.body;
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  return fallback;
}

export async function resolveDiscussionCommentPresentation(
  input: {
    readonly commentId: string;
    readonly canonicalBody: string;
    readonly readingContext: Pick<
      PublicContentReadingContext,
      "ready" | "readingLanguage" | "translationPreference"
    >;
  },
  deps: DiscussionCommentPresentationDeps = defaultDeps,
): Promise<ResolvedDiscussionCommentPresentation> {
  const { canonicalBody, readingContext } = input;

  if (!readingContext.ready) {
    return {
      body: canonicalBody,
      presentationMode: "original",
      isStale: false,
    };
  }

  const resolved = await resolvePublicContentTranslationDisplay({
    sourceKind: "discussion_comment",
    sourceRecordId: input.commentId,
    readingContext,
    deps,
  });

  if (!resolved || resolved.presentationMode === "original") {
    return {
      body: canonicalBody,
      presentationMode: "original",
      isStale: Boolean(resolved?.isStale),
    };
  }

  return {
    body: pickBody(resolved, canonicalBody),
    presentationMode: "translated",
    isStale: Boolean(resolved.isStale),
  };
}
