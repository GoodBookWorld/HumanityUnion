/**
 * Reset 03B — bounded existing content_translations reuse (read-only).
 * One findOne; never scans history; never writes.
 */

import type { LanguageCode, MediaPlpEntityType } from "@hu/types";
import { MEDIA_PLP_ENTITY_TYPE } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import {
  CIVIC_MEDIA_CT_RECORD_ID,
  CIVIC_MEDIA_CT_SOURCE_KIND,
} from "./constants.js";
import { markMaterializerTranslationLookup } from "./counters.js";

export type ExistingTranslationState =
  | "MISSING"
  | "COMPLETE"
  | "INCOMPLETE"
  | "STALE";

export type MediaPlpExistingTranslationLookup = {
  readonly EXISTING_TRANSLATION_STATE: ExistingTranslationState;
  readonly EXISTING_TRANSLATION_COMPLETE: boolean;
  readonly values: Readonly<Record<string, string>>;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function empty(
  state: ExistingTranslationState = "MISSING",
): MediaPlpExistingTranslationLookup {
  return {
    EXISTING_TRANSLATION_STATE: state,
    EXISTING_TRANSLATION_COMPLETE: false,
    values: {},
  };
}

function fieldBag(doc: Record<string, unknown> | null): Record<string, string> {
  if (!doc) {
    return {};
  }
  const content = doc.translatedContent;
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(content as Record<string, unknown>)) {
    if (typeof value === "string" && value.trim()) {
      out[key] = value;
    }
  }
  return out;
}

function isStaleDoc(doc: Record<string, unknown>): boolean {
  return doc.stale === true || asString(doc.freshness) === "stale";
}

async function loadContentTranslationRow(input: {
  readonly sourceKind: string;
  readonly sourceRecordId: string;
  readonly locale: LanguageCode;
}): Promise<Record<string, unknown> | null> {
  markMaterializerTranslationLookup();
  const collection = getMongoCollection<Record<string, unknown>>(
    MONGO_COLLECTIONS.contentTranslations,
  );
  return collection.findOne(
    {
      sourceKind: input.sourceKind,
      sourceRecordId: input.sourceRecordId,
      targetLanguage: input.locale,
    },
    {
      projection: {
        sourceVersion: 1,
        stale: 1,
        freshness: 1,
        translatedContent: 1,
        updatedAt: 1,
      },
      sort: { updatedAt: -1 },
    },
  );
}

function completeIfAllPaths(
  autoPaths: readonly string[],
  values: Readonly<Record<string, string>>,
): boolean {
  if (autoPaths.length === 0) {
    return false;
  }
  return autoPaths.every((path) => Boolean(values[path]?.trim()));
}

export async function lookupExistingMediaPlpTranslation(input: {
  readonly entityType: MediaPlpEntityType;
  readonly entityId: string;
  readonly locale: LanguageCode;
  readonly autoPaths: readonly string[];
  /** Live semantic version for public_news rows (when known). */
  readonly expectedSourceVersion?: string | null;
}): Promise<MediaPlpExistingTranslationLookup> {
  const autoPaths = input.autoPaths;

  if (input.entityType === MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS) {
    const doc = await loadContentTranslationRow({
      sourceKind: "public_news",
      sourceRecordId: input.entityId,
      locale: input.locale,
    });
    if (!doc) {
      return empty("MISSING");
    }
    if (isStaleDoc(doc)) {
      return empty("STALE");
    }
    if (
      input.expectedSourceVersion &&
      asString(doc.sourceVersion) &&
      asString(doc.sourceVersion) !== input.expectedSourceVersion
    ) {
      return empty("STALE");
    }
    const fields = fieldBag(doc);
    const values: Record<string, string> = {};
    for (const path of autoPaths) {
      if (fields[path]) {
        values[path] = fields[path]!;
      }
    }
    const complete = completeIfAllPaths(autoPaths, values);
    return {
      EXISTING_TRANSLATION_STATE: complete ? "COMPLETE" : "INCOMPLETE",
      EXISTING_TRANSLATION_COMPLETE: complete,
      values,
    };
  }

  // Principles + trusted reuse the civic_media aggregate bag (one bounded findOne).
  const doc = await loadContentTranslationRow({
    sourceKind: CIVIC_MEDIA_CT_SOURCE_KIND,
    sourceRecordId: CIVIC_MEDIA_CT_RECORD_ID,
    locale: input.locale,
  });
  if (!doc) {
    return empty("MISSING");
  }
  if (isStaleDoc(doc)) {
    return empty("STALE");
  }

  const fields = fieldBag(doc);
  const values: Record<string, string> = {};

  if (input.entityType === MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED) {
    const raw = fields.trustedMediaExplanations;
    if (!raw) {
      return empty("INCOMPLETE");
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return empty("INCOMPLETE");
      }
      const match = parsed.find(
        (item) =>
          item &&
          typeof item === "object" &&
          asString((item as { id?: unknown }).id) === input.entityId,
      ) as { explanation?: unknown } | undefined;
      const explanation = asString(match?.explanation);
      if (!explanation.trim()) {
        return empty("INCOMPLETE");
      }
      if (autoPaths.includes("explanation")) {
        values.explanation = explanation;
      }
    } catch {
      return empty("INCOMPLETE");
    }
  } else if (input.entityType === MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE) {
    const raw = fields.selectionPrinciples;
    if (!raw) {
      return empty("INCOMPLETE");
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return empty("INCOMPLETE");
      }
      const match = parsed.find(
        (item) =>
          item &&
          typeof item === "object" &&
          asString((item as { id?: unknown }).id) === input.entityId,
      ) as { title?: unknown; description?: unknown } | undefined;
      const title = asString(match?.title);
      const description = asString(match?.description);
      if (autoPaths.includes("title") && title.trim()) {
        values.title = title;
      }
      if (autoPaths.includes("description") && description.trim()) {
        values.description = description;
      }
    } catch {
      return empty("INCOMPLETE");
    }
  }

  const complete = completeIfAllPaths(autoPaths, values);
  return {
    EXISTING_TRANSLATION_STATE: complete ? "COMPLETE" : "INCOMPLETE",
    EXISTING_TRANSLATION_COMPLETE: complete,
    values,
  };
}
