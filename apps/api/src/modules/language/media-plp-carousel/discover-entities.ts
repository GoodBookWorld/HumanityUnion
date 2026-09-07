/**
 * Reset 03E.9 — discover bounded Media/Country carousel entity identities.
 * Catalog + hard-capped Mongo id projections only. No bodies. No .toArray.
 */

import type { MediaPlpEntityType } from "@hu/types";
import {
  MEDIA_PLP_EDITORIAL_ENTITY_ID,
  MEDIA_PLP_ENTITY_TYPE,
} from "@hu/types";

import { FACT_CHECK_RESOURCES } from "../../civic-media-center/content/fact-checking.js";
import { PROPAGANDA_ANALYSIS_RESOURCES } from "../../civic-media-center/content/propaganda-analysis.js";
import { CIVIC_MEDIA_SELECTION_PRINCIPLES } from "../../civic-media-center/content/sections.js";
import { TRUSTED_MEDIA_RESOURCES } from "../../civic-media-center/content/trusted-media.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import {
  MEDIA_PLP_CAROUSEL_NEWS_LIMIT,
  MEDIA_PLP_CAROUSEL_TRUSTED_COUNTRY_LIMIT,
  MEDIA_PLP_CAROUSEL_TRUSTED_WORLD_LIMIT,
} from "./constants.js";
import { selectMediaPlpConsumerNewsIds } from "./media-plp-news-selection.js";

export type MediaPlpCarouselSurface =
  | "media_news"
  | "media_principle"
  | "media_trusted"
  | "media_verification"
  | "media_analysis"
  | "media_editorial"
  | "country_media_rail"
  | "country_election_rail"
  | "country_initiative_rail";

export type MediaPlpCarouselEntityRef = {
  readonly surface: MediaPlpCarouselSurface;
  readonly route: "/media" | "/countries/[countryCode]";
  readonly selector: string;
  readonly entityType: MediaPlpEntityType | "initiative";
  readonly entityId: string;
  /** Media PLP owned vs Initiative domain not yet migrated. */
  readonly domain: "media_plp" | "initiative";
  readonly inWebBatch: boolean;
  readonly inMaterializerSource: boolean;
  readonly plpSnapshotExpected: boolean;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Static catalog identities that match Web /media composition + materializer
 * source-resolve (principles / fact / propaganda / WORLD trusted seed / editorial).
 */
export function discoverMediaPlpCarouselStaticEntities(): readonly MediaPlpCarouselEntityRef[] {
  const out: MediaPlpCarouselEntityRef[] = [];

  out.push({
    surface: "media_editorial",
    route: "/media",
    selector: "[data-hu-plp-editorial-mode]",
    entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
    entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
    domain: "media_plp",
    inWebBatch: true,
    inMaterializerSource: true,
    plpSnapshotExpected: true,
  });

  for (const principle of CIVIC_MEDIA_SELECTION_PRINCIPLES) {
    out.push({
      surface: "media_principle",
      route: "/media",
      selector: ".civic-media-resource-card--principle",
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
      entityId: principle.id,
      domain: "media_plp",
      inWebBatch: true,
      inMaterializerSource: true,
      plpSnapshotExpected: true,
    });
  }

  for (const resource of TRUSTED_MEDIA_RESOURCES.slice(
    0,
    MEDIA_PLP_CAROUSEL_TRUSTED_WORLD_LIMIT,
  )) {
    out.push({
      surface: "media_trusted",
      route: "/media",
      selector: ".civic-media-resource-card--trusted",
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: resource.id,
      domain: "media_plp",
      inWebBatch: true,
      inMaterializerSource: true,
      plpSnapshotExpected: true,
    });
  }

  for (const resource of FACT_CHECK_RESOURCES) {
    out.push({
      surface: "media_verification",
      route: "/media",
      selector: ".civic-media-resource-card--verification",
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_FACT_CHECK,
      entityId: resource.id,
      domain: "media_plp",
      inWebBatch: true,
      inMaterializerSource: true,
      plpSnapshotExpected: true,
    });
  }

  for (const resource of PROPAGANDA_ANALYSIS_RESOURCES) {
    out.push({
      surface: "media_analysis",
      route: "/media",
      selector: ".civic-media-resource-card--analysis",
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PROPAGANDA,
      entityId: resource.id,
      domain: "media_plp",
      inWebBatch: true,
      inMaterializerSource: true,
      plpSnapshotExpected: true,
    });
  }

  // Initiative domain — not Media PLP (explicit classification).
  out.push({
    surface: "country_election_rail",
    route: "/countries/[countryCode]",
    selector: ".country-election-rail-card",
    entityType: "initiative",
    entityId: "(rendered-initiative-id)",
    domain: "initiative",
    inWebBatch: false,
    inMaterializerSource: false,
    plpSnapshotExpected: false,
  });
  out.push({
    surface: "country_initiative_rail",
    route: "/countries/[countryCode]",
    selector: ".country-initiative-rail-card",
    entityType: "initiative",
    entityId: "(rendered-initiative-id)",
    domain: "initiative",
    inWebBatch: false,
    inMaterializerSource: false,
    plpSnapshotExpected: false,
  });

  return out;
}

async function discoverActiveNewsIds(
  limit: number,
): Promise<readonly string[]> {
  // Reset 03E.13 — same selection as Web /media SSR news rail (en + source balance).
  return selectMediaPlpConsumerNewsIds({ limit });
}

async function discoverCountryTrustedIds(
  countryCode: string,
  limit: number,
): Promise<readonly string[]> {
  const collection = getMongoCollection<Record<string, unknown>>(
    MONGO_COLLECTIONS.mediaResources,
  );
  const cursor = collection.find(
    {
      resourceType: "TRUSTED_MEDIA",
      active: true,
      scopeType: "COUNTRY",
      countryCode,
    },
    {
      projection: { id: 1 },
      sort: { sortOrder: 1, id: 1 },
      limit,
    },
  );
  const ids: string[] = [];
  for await (const doc of cursor) {
    const id = asString(doc.id);
    if (id) {
      ids.push(id);
    }
  }
  return ids;
}

/**
 * Full bounded carousel inventory for diagnostic (static + optional Mongo news/country).
 */
export async function discoverMediaPlpCarouselEntities(input: {
  readonly countryCode?: string | null;
  readonly includeNews?: boolean;
}): Promise<readonly MediaPlpCarouselEntityRef[]> {
  const out: MediaPlpCarouselEntityRef[] = [...discoverMediaPlpCarouselStaticEntities()];

  if (input.includeNews !== false) {
    const newsIds = await discoverActiveNewsIds(MEDIA_PLP_CAROUSEL_NEWS_LIMIT);
    for (const entityId of newsIds) {
      out.push({
        surface: "media_news",
        route: "/media",
        selector: ".public-news-card",
        entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
        entityId,
        domain: "media_plp",
        inWebBatch: true,
        inMaterializerSource: true,
        plpSnapshotExpected: true,
      });
    }
  }

  const countryCode = input.countryCode?.trim();
  if (countryCode) {
    const countryIds = await discoverCountryTrustedIds(
      countryCode,
      MEDIA_PLP_CAROUSEL_TRUSTED_COUNTRY_LIMIT,
    );
    for (const entityId of countryIds) {
      out.push({
        surface: "country_media_rail",
        route: "/countries/[countryCode]",
        selector: ".country-media-rail-card",
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
        entityId,
        domain: "media_plp",
        inWebBatch: true,
        inMaterializerSource: true,
        plpSnapshotExpected: true,
      });
    }
  }

  return out;
}
