/**
 * Request-scoped Initiative document data for generateMetadata and the page.
 * React cache() dedupes one RSC render. It is not a persistent or Mongo cache.
 */
import { cache } from "react";

import type { PublicInitiativeProjection } from "@hu/types";

import { getPublicInitiative } from "../initiatives/api";
import { resolveDocumentHtmlLocale } from "../language/resolve-document-locale";
import {
  loadInitiativeDetailPresentationSeed,
  type InitiativeDetailPresentationSeed,
} from "./load-initiative-detail-presentation-seed";

export interface InitiativeDocumentServerData {
  readonly initiative: PublicInitiativeProjection;
  readonly documentLocale: string;
  readonly presentationSeed: InitiativeDetailPresentationSeed;
}

export function initiativeMetadataFieldsFromPresentationSeed(input: {
  readonly canonicalTitle: string;
  readonly canonicalDescription: string;
  readonly seed: InitiativeDetailPresentationSeed;
}): {
  readonly translatedTitle?: string;
  readonly translatedDescription?: string;
} {
  const canonicalTitle = input.canonicalTitle.trim();
  const canonicalDescription = input.canonicalDescription.trim();
  const seedTitle = input.seed.title.trim();
  const seedDescription = input.seed.description.trim();

  return {
    ...(seedTitle && seedTitle !== canonicalTitle ? { translatedTitle: seedTitle } : {}),
    ...(seedDescription && seedDescription !== canonicalDescription
      ? { translatedDescription: seedDescription }
      : {}),
  };
}

async function loadInitiativeDocumentServerDataUncached(
  initiativeId: string,
): Promise<InitiativeDocumentServerData> {
  const initiative = await getPublicInitiative(initiativeId);
  const documentLocale = await resolveDocumentHtmlLocale();
  const presentationSeed = await loadInitiativeDetailPresentationSeed({
    initiativeId,
    language: documentLocale.locale,
    canonical: {
      title: initiative.title,
      description: initiative.description,
    },
  });

  return {
    initiative,
    documentLocale: documentLocale.locale,
    presentationSeed,
  };
}

export const loadInitiativeDocumentServerData = cache(loadInitiativeDocumentServerDataUncached);
