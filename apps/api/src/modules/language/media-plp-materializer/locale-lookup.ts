/**
 * Reset 03B — narrow Language Registry eligibility lookup.
 */

import type { LanguageCode } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { markMaterializerLanguageRegistryLookup } from "./counters.js";

export type MediaPlpMaterializerLocaleLookup = {
  readonly LOCALE_REGISTRY_FOUND: boolean;
  readonly LOCALE_ENABLED: boolean;
  readonly CONTENT_TRANSLATION_ENABLED: boolean;
};

export async function loadMediaPlpMaterializerLocale(
  locale: LanguageCode,
): Promise<MediaPlpMaterializerLocaleLookup> {
  markMaterializerLanguageRegistryLookup();
  const collection = getMongoCollection<{
    locale: string;
    enabled?: boolean;
    contentTranslationEnabled?: boolean;
  }>(MONGO_COLLECTIONS.languageRegistry);
  const doc = await collection.findOne(
    { locale },
    { projection: { locale: 1, enabled: 1, contentTranslationEnabled: 1 } },
  );
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
