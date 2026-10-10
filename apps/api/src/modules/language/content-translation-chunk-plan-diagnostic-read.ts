/**
 * Bounded reads for the chunk-plan diagnostic.
 *
 * One blog document by postId, then one language-registry document by locale
 * key. No inserts, updates, or collection scans.
 */

import { normalizeLanguageRegistryLocaleKey } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import {
  fromBlogPostMongoDocument,
  type BlogPostMongoDocument,
} from "../blog/persistence/blog.mongo-document.js";

export class ContentTranslationChunkPlanDiagnosticError extends Error {
  constructor(readonly code: "usage" | "failed") {
    super(code);
    this.name = "ContentTranslationChunkPlanDiagnosticError";
  }
}

export const CHUNK_PLAN_DIAGNOSTIC_READ_MAX_TIME_MS = 8_000;

export interface AutomaticWarmRegistryRecord {
  readonly locale: string;
  readonly enabled: boolean;
  readonly contentTranslationEnabled: boolean;
}

/**
 * Same membership rule as resolveAutomaticContentTranslationWarmTargets:
 * enabled, content-translation enabled, and not the source language.
 * The target must equal the registry locale string.
 */
export function localeIsAutomaticWarmTarget(input: {
  readonly targetLocale: string;
  readonly sourceLanguage: string;
  readonly record: AutomaticWarmRegistryRecord | null;
}): boolean {
  if (!input.record) {
    return false;
  }
  const locale = input.record.locale.trim();
  if (locale !== input.targetLocale.trim()) {
    return false;
  }
  if (input.record.enabled !== true || input.record.contentTranslationEnabled !== true) {
    return false;
  }
  const sourceLanguage = input.sourceLanguage.trim().toLowerCase();
  return locale.toLowerCase() !== sourceLanguage;
}

export async function readBlogPostForChunkPlanDiagnostic(
  postId: string,
): Promise<ReturnType<typeof fromBlogPostMongoDocument> | null> {
  try {
    await connectMongoClient();
    const doc = await getMongoCollection<BlogPostMongoDocument>(MONGO_COLLECTIONS.blogPosts).findOne(
      { postId },
      { maxTimeMS: CHUNK_PLAN_DIAGNOSTIC_READ_MAX_TIME_MS },
    );
    return doc ? fromBlogPostMongoDocument(doc) : null;
  } catch (error) {
    if (error instanceof ContentTranslationChunkPlanDiagnosticError) {
      throw error;
    }
    throw new ContentTranslationChunkPlanDiagnosticError("failed");
  }
}

export async function readAutomaticWarmTargetForChunkPlanDiagnostic(input: {
  readonly targetLocale: string;
  readonly sourceLanguage: string;
}): Promise<boolean> {
  const targetLocale = input.targetLocale.trim();
  const localeKey = normalizeLanguageRegistryLocaleKey(targetLocale);
  if (!localeKey) {
    return false;
  }
  try {
    await connectMongoClient();
    const doc = await getMongoCollection<{
      locale?: string;
      enabled?: boolean;
      contentTranslationEnabled?: boolean;
    }>(MONGO_COLLECTIONS.languageRegistry).findOne(
      { localeKey },
      {
        projection: { locale: 1, enabled: 1, contentTranslationEnabled: 1 },
        maxTimeMS: CHUNK_PLAN_DIAGNOSTIC_READ_MAX_TIME_MS,
      },
    );
    return localeIsAutomaticWarmTarget({
      targetLocale,
      sourceLanguage: input.sourceLanguage,
      record: doc
        ? {
            locale: typeof doc.locale === "string" ? doc.locale : "",
            enabled: doc.enabled === true,
            contentTranslationEnabled: doc.contentTranslationEnabled === true,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof ContentTranslationChunkPlanDiagnosticError) {
      throw error;
    }
    throw new ContentTranslationChunkPlanDiagnosticError("failed");
  }
}
