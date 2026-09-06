/**
 * Reset 03C — public Media PLP consumer resolve routes (GET/POST read-only).
 * No provider, no writes, no materializer import.
 */

import { Router } from "express";

import { MEDIA_PLP_ENTITY_TYPES, type MediaPlpEntityType } from "@hu/types";

import { createSuccessResponse } from "../../../../shared/http-response.js";
import { loadMediaPlpLiveCanonicalSource } from "./live-source.js";
import {
  MEDIA_PLP_CONSUMER_RESOLVE_MAX_ITEMS,
  resolveMediaPlpConsumerBatch,
  resolveMediaPlpConsumerItem,
} from "./resolve-consumer.js";

function failure(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

const publicMediaPlpRouter = Router();

/**
 * GET /api/v1/public/media-plp/resolve
 *   ?entityType=&entityId=&locale=
 * Loads live canonical from source, resolves PUBLISHED_LOCALIZED | CANONICAL_FALLBACK.
 */
publicMediaPlpRouter.get("/resolve", async (req, res) => {
  const entityType = String(req.query.entityType ?? "").trim();
  const entityId = String(req.query.entityId ?? "").trim();
  const locale = String(req.query.locale ?? "").trim();

  if (!entityType || !entityId || !locale) {
    res.status(400).json(failure("entityType, entityId, and locale are required."));
    return;
  }
  if (!(MEDIA_PLP_ENTITY_TYPES as readonly string[]).includes(entityType)) {
    res.status(400).json(failure(`Unsupported entityType=${entityType}`));
    return;
  }

  const source = await loadMediaPlpLiveCanonicalSource({
    entityType: entityType as MediaPlpEntityType,
    entityId,
  });
  if (!source.SOURCE_FOUND || !source.canonicalPresentation || !source.CANONICAL_VERSION) {
    res.status(404).json(failure("Media source not found for PLP resolve."));
    return;
  }

  const result = await resolveMediaPlpConsumerItem({
    locale,
    entityType,
    entityId,
    canonicalPresentation: source.canonicalPresentation,
  });

  res.json(
    createSuccessResponse(
      {
        ...result,
        SOURCE_FOUND: true,
        SOURCE_PUBLIC: source.SOURCE_PUBLIC,
      },
      "Media PLP presentation resolved.",
    ),
  );
});

/**
 * POST /api/v1/public/media-plp/resolve
 * Body: { locale, items: [{ entityType, entityId, canonicalPresentation }] }
 * SSR batch resolve — read-only.
 */
publicMediaPlpRouter.post("/resolve", async (req, res) => {
  const body = req.body as {
    locale?: unknown;
    items?: unknown;
  };
  const locale = typeof body.locale === "string" ? body.locale.trim() : "";
  if (!locale) {
    res.status(400).json(failure("locale is required."));
    return;
  }
  if (!Array.isArray(body.items)) {
    res.status(400).json(failure("items array is required."));
    return;
  }
  if (body.items.length > MEDIA_PLP_CONSUMER_RESOLVE_MAX_ITEMS) {
    res
      .status(400)
      .json(
        failure(
          `items length exceeds MEDIA_PLP_CONSUMER_RESOLVE_MAX_ITEMS=${MEDIA_PLP_CONSUMER_RESOLVE_MAX_ITEMS}`,
        ),
      );
    return;
  }

  const items: Array<{
    entityType: string;
    entityId: string;
    canonicalPresentation: import("@hu/types").PublicPresentationNode;
  }> = [];

  for (const raw of body.items) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      res.status(400).json(failure("Each item must be an object."));
      return;
    }
    const row = raw as Record<string, unknown>;
    const entityType = typeof row.entityType === "string" ? row.entityType.trim() : "";
    const entityId = typeof row.entityId === "string" ? row.entityId.trim() : "";
    if (!entityType || !entityId || row.canonicalPresentation == null) {
      res
        .status(400)
        .json(failure("Each item requires entityType, entityId, canonicalPresentation."));
      return;
    }
    items.push({
      entityType,
      entityId,
      canonicalPresentation: row.canonicalPresentation as import("@hu/types").PublicPresentationNode,
    });
  }

  const batch = await resolveMediaPlpConsumerBatch({ locale, items });
  if (!batch.ok) {
    res.status(400).json(failure(batch.error));
    return;
  }

  res.json(
    createSuccessResponse({ results: batch.results }, "Media PLP presentations resolved."),
  );
});

export default publicMediaPlpRouter;
