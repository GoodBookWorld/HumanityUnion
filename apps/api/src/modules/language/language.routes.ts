import { Router, type Response } from "express";

import type { ContentTranslationSourceKind, LanguageCode } from "@hu/types";
import { normalizeLanguageCode } from "@hu/types";

import { createSuccessResponse } from "../../shared/http-response.js";
import { authenticatedWorkspaceWriteMiddleware } from "../auth/auth-workspace-gate.js";
import { optionalAuthenticationMiddleware } from "../auth/auth.middleware.js";
import {
  loadTranslatableSource,
  resolvePublicTranslatedContent,
} from "./content-translation.service.js";
import {
  assertEnabledSelectableLocale,
  listEnabledSelectableLanguages,
} from "./language-registry-runtime.js";
import { translationProviderPublicErrorMessage } from "./resolve-translation-provider.js";
import { TranslationProviderError } from "./translation.config.js";
import { translateDraft } from "./translate-draft.js";
import { translationRateLimiter } from "./translation-rate-limit.js";

/**
 * Preserve Registry locale identity for CT resolve (`zh-Hant` must not become `zh`).
 * `normalizeLanguageCode` collapses script tags and breaks CURRENT matching.
 */
function coercePreferredReadingLanguageQuery(
  value: unknown,
): LanguageCode | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? (trimmed as LanguageCode) : undefined;
}

const languageRouter = Router();

const SOURCE_KINDS: readonly ContentTranslationSourceKind[] = [
  "initiative",
  "collaborative_analysis",
  "petition",
  "lifecycle_stage",
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
  "public_news",
];

function failure(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

function handleTranslationError(res: Response, error: unknown): void {
  if (error instanceof TranslationProviderError) {
    const status =
      error.code === "forbidden"
        ? 403
        : error.code === "bad_request" || error.code === "unsupported_language"
          ? 400
          : error.code === "rate_limited"
            ? 429
            : error.code === "not_configured"
              ? 503
              : 502;
    res.status(status).json(failure(translationProviderPublicErrorMessage(error)));
    return;
  }

  res.status(500).json(failure(translationProviderPublicErrorMessage(error)));
}

function parseSourceKind(value: unknown): ContentTranslationSourceKind | null {
  return typeof value === "string" && (SOURCE_KINDS as readonly string[]).includes(value)
    ? (value as ContentTranslationSourceKind)
    : null;
}

languageRouter.get("/languages", async (_req, res) => {
  try {
    const languages = await listEnabledSelectableLanguages();
    res.json(createSuccessResponse(languages, "Priority languages loaded."));
  } catch (error) {
    handleTranslationError(res, error);
  }
});

/**
 * Resolve display for published content. Does not call Gemini.
 * Falls back to original when no current translation exists.
 */
languageRouter.get(
  "/resolve/:sourceKind/:sourceRecordId",
  optionalAuthenticationMiddleware,
  async (req, res) => {
    const sourceKind = parseSourceKind(req.params.sourceKind);
    const sourceRecordId = String(req.params.sourceRecordId ?? "").trim();
    if (!sourceKind || sourceKind === "lifecycle_stage" || !sourceRecordId) {
      res.status(400).json(failure("Unsupported translation source kind."));
      return;
    }

    try {
      const preferredReadingLanguage = coercePreferredReadingLanguageQuery(
        req.query.language,
      );
      // Pack 08I.13 — explicit public `?language=` requests warm translation DISPLAY.
      // Member `translationPreference: none` must not hide current content_translations
      // for public surfaces (Live: Initiative/Blog/Media stayed English despite warm rows).
      // Pack 1.1 — cache-only resolve; never generate on read.
      // Registry locale identity preserved (zh-Hant ≠ zh) for CURRENT matching.
      const resolved = await resolvePublicTranslatedContent({
        sourceKind,
        sourceRecordId,
        participantId: req.auth?.memberId,
        preferredReadingLanguage,
        translationPreference: preferredReadingLanguage ? "preferred" : undefined,
        generateIfMissing: false,
      });
      res.json(createSuccessResponse(resolved, "Translated display resolved."));
    } catch (error) {
      handleTranslationError(res, error);
    }
  },
);

/**
 * Pack 1.1 — participant on-demand generation retired.
 *
 * Translations are built only via automatic_warm / authorized rebuild operators.
 * Author draft assist remains at POST /draft. Route kept as 410 so old Web
 * clients fail closed instead of invoking TranslationProvider.
 */
languageRouter.post(
  "/generate",
  optionalAuthenticationMiddleware,
  translationRateLimiter,
  async (_req, res) => {
    res.status(410).json(
      failure(
        "On-demand content translation is retired. Translations are built asynchronously; use cache resolve or wait for warm CURRENT.",
      ),
    );
  },
);

/**
 * Explicit Author Translate Draft — never mutates the canonical draft.
 */
languageRouter.post(
  "/draft",
  ...authenticatedWorkspaceWriteMiddleware,
  translationRateLimiter,
  async (req, res) => {
    if (!req.auth?.memberId) {
      res.status(401).json(failure("Authentication required."));
      return;
    }

    const sourceKind = parseSourceKind(req.body?.sourceKind) ?? "lifecycle_stage";
    const sourceRecordId =
      typeof req.body?.sourceRecordId === "string" ? req.body.sourceRecordId.trim() : "";
    const sourceVersion =
      typeof req.body?.sourceVersion === "string" ? req.body.sourceVersion.trim() : "draft";
    const sourceLanguage = normalizeLanguageCode(req.body?.sourceLanguage);
    const draftContent = req.body?.draftContent;
    const initiativeId =
      typeof req.body?.initiativeId === "string" ? req.body.initiativeId.trim() : undefined;

    if (!sourceRecordId || draftContent == null) {
      res.status(400).json(failure("sourceRecordId and draftContent are required."));
      return;
    }

    let targetLanguage: string;
    try {
      targetLanguage = await assertEnabledSelectableLocale(req.body?.targetLanguage);
    } catch (error) {
      handleTranslationError(res, error);
      return;
    }

    try {
      // Authorization: when translating against a known published/source record,
      // only the Author/steward may request draft assistance for that record.
      if (sourceKind !== "lifecycle_stage" && sourceRecordId) {
        const source = await loadTranslatableSource({ sourceKind, sourceRecordId });
        if (
          source?.authorParticipantId &&
          source.authorParticipantId !== req.auth.memberId
        ) {
          throw new TranslationProviderError(
            "forbidden",
            "Only the Author can translate this draft.",
          );
        }
      }

      // Refuse private communication shapes even if someone posts them here.
      if (
        typeof draftContent === "object" &&
        draftContent &&
        ("messageBody" in draftContent ||
          "directMessageId" in draftContent ||
          "conversationId" in draftContent ||
          "channelMessageId" in draftContent)
      ) {
        throw new TranslationProviderError(
          "forbidden",
          "Private messages cannot be translated through this endpoint.",
        );
      }

      const result = await translateDraft({
        sourceRecordId,
        sourceVersion,
        sourceLanguage,
        targetLanguage,
        draftContent,
        initiativeId,
        sourceKind,
      });

      res.json(createSuccessResponse(result, "Working translation ready."));
    } catch (error) {
      handleTranslationError(res, error);
    }
  },
);

export default languageRouter;
