/**
 * Reset 03A — narrow Language Registry locale eligibility lookup.
 */

import type { LanguageCode } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { markMediaPlpPreflightLanguageRegistryLookup } from "./counters.js";

export type MediaPlpPreflightLocaleLookup = {
  readonly LOCALE_REGISTRY_FOUND: boolean;
  readonly LOCALE_ENABLED: boolean;
  readonly CONTENT_TRANSLATION_ENABLED: boolean;
};

export async function loadMediaPlpPreflightLocale(
  locale: LanguageCode,
): Promise<MediaPlpPreflightLocaleLookup> {
  markMediaPlpPreflightLanguageRegistryLookup();
  const collection = getMongoCollection<{
    locale: string;
    enabled?: boolean;
    contentTranslationEnabled?: boolean;
  }>(MONGO_COLLECTIONS.languageRegistry);

  const cursor = collection.find(
    { locale },
    {
      projection: { locale: 1, enabled: 1, contentTranslationEnabled: 1 },
      limit: 2,
    },
  );
  const doc = await cursor.next();
  const second = await cursor.next();
  if (second) {
    throw new Error(
      `Language Registry returned multiple rows for locale "${locale}" (expected at most one).`,
    );
  }

  if (!doc) {
    return {
      LOCALE_REGISTRY_FOUND: false,
      LOCALE_ENABLED: false,
      CONTENT_TRANSLATION_ENABLED: false,
    };
  }

  return {
    LOCALE_REGISTRY_FOUND: true,
    LOCALE_ENABLED: doc.enabled === true,
    CONTENT_TRANSLATION_ENABLED: doc.contentTranslationEnabled === true,
  };
}
