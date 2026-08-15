import { Router, type Response } from "express";

import type { ContentTranslationSourceKind } from "@hu/types";
import { isPriorityLanguageCode, normalizeLanguageCode } from "@hu/types";

import { createSuccessResponse } from "../../shared/http-response.js";
import { authenticatedWorkspaceWriteMiddleware } from "../auth/auth-workspace-gate.js";
import { optionalAuthenticationMiddleware } from "../auth/auth.middleware.js";
import {
  getOrCreateContentTranslation,
  loadTranslatableSource,
  resolvePublicTranslatedContent,
} from "./content-translation.service.js";
import { PRIORITY_LANGUAGE_CATALOG } from "./language-catalog.js";
import { translationProviderPublicErrorMessage } from "./resolve-translation-provider.js";
import { TranslationProviderError } from "./translation.config.js";
import { translateDraft } from "./translate-draft.js";
import { translationRateLimiter } from "./translation-rate-limit.js";

const languageRouter = Router();

const SOURCE_KINDS: readonly ContentTranslationSourceKind[] = [
  "initiative",
  "collaborative_analysis",
  "petition",
  "lifecycle_stage",
  "blog_post",
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

languageRouter.get("/languages", (_req, res) => {
  res.json(createSuccessResponse(PRIORITY_LANGUAGE_CATALOG, "Priority languages loaded."));
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
      const preferredReadingLanguage = req.query.language
        ? normalizeLanguageCode(String(req.query.language))
        : undefined;
      const resolved = await resolvePublicTranslatedContent({
        sourceKind,
        sourceRecordId,
        participantId: req.auth?.memberId,
        preferredReadingLanguage,
        generateIfMissing: false,
      });
      res.json(createSuccessResponse(resolved, "Translated display resolved."));
    } catch (error) {
      handleTranslationError(res, error);
    }
  },
);

/**
 * Generate missing translation for a published record (rate limited).
 */
languageRouter.post(
  "/generate",
  optionalAuthenticationMiddleware,
  translationRateLimiter,
  async (req, res) => {
    const sourceKind = parseSourceKind(req.body?.sourceKind);
    const sourceRecordId =
      typeof req.body?.sourceRecordId === "string" ? req.body.sourceRecordId.trim() : "";
    const targetLanguage = normalizeLanguageCode(req.body?.targetLanguage);

    if (!sourceKind || sourceKind === "lifecycle_stage" || !sourceRecordId) {
      res.status(400).json(failure("sourceKind and sourceRecordId are required."));
      return;
    }

    if (!isPriorityLanguageCode(targetLanguage)) {
      res.status(400).json(failure("Unsupported target language."));
      return;
    }

    try {
      const result = await getOrCreateContentTranslation({
        sourceKind,
        sourceRecordId,
        targetLanguage,
        generateIfMissing: true,
      });
      const resolved = await resolvePublicTranslatedContent({
        sourceKind,
        sourceRecordId,
        participantId: req.auth?.memberId,
        preferredReadingLanguage: targetLanguage,
        generateIfMissing: false,
      });
      res.json(
        createSuccessResponse(
          {
            generated: result.generated,
            translation: result.translation,
            display: resolved,
          },
          result.generated ? "Translation generated." : "Existing translation reused.",
        ),
      );
    } catch (error) {
      handleTranslationError(res, error);
    }
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
    const targetLanguage = normalizeLanguageCode(req.body?.targetLanguage);
    const draftContent = req.body?.draftContent;
    const initiativeId =
      typeof req.body?.initiativeId === "string" ? req.body.initiativeId.trim() : undefined;

    if (!sourceRecordId || draftContent == null) {
      res.status(400).json(failure("sourceRecordId and draftContent are required."));
      return;
    }

    if (!isPriorityLanguageCode(targetLanguage)) {
      res.status(400).json(failure("Unsupported target language."));
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
