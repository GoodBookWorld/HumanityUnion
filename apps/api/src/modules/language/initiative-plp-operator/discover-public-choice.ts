/**
 * RESET 05B.1 — thin READ-ONLY PUBLIC_CHOICE Initiative discovery.
 * Same Mongo initiatives collection + identity as Initiative PLP adapter.
 * Bounded find; no store hydrate; no translation provider import.
 */

import {
  INITIATIVE_PLP_ENTITY_TYPE,
  resolveInitiativeLifecycleProfile,
} from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { INITIATIVE_PLP_PUBLIC_CHOICE_DISCOVERY_DEFAULT_LIMIT } from "./constants.js";
import { buildInitiativePlpCardFromThinDoc } from "./source-resolve.js";

type ThinDiscoveryDoc = {
  initiativeId?: string;
  title?: string;
  description?: string;
  status?: string;
  lifecycleProfile?: string;
  lifecyclePhase?: string;
  updatedAt?: string;
  visibility?: { policy?: string };
  metadata?: {
    activityArea?: string;
    activityAreaOther?: string;
    countrySlug?: string;
    regionSlug?: string;
    communitySlug?: string;
    region?: string;
    communityAssociation?: string;
  };
};

export type InitiativePlpPublicChoiceDiscoveryRow = {
  readonly initiativeId: string;
  /** Same PLP entity identity used by diagnose/materialize. */
  readonly entityType: typeof INITIATIVE_PLP_ENTITY_TYPE.INITIATIVE;
  readonly entityId: string;
  readonly lifecycleProfile: "PUBLIC_CHOICE";
  readonly title: string;
  readonly status: string | null;
  readonly lifecyclePhase: string | null;
  readonly countryCode: string | null;
  readonly regionCode: string | null;
  readonly communitySlug: string | null;
  readonly geographySummary: string | null;
  readonly electionName: string | null;
  readonly consumerVisible: boolean;
  readonly updatedAt: string | null;
};

export type InitiativePlpPublicChoiceDiscoveryResult = {
  readonly FOUND_COUNT: number;
  readonly LIMIT: number;
  readonly ROWS: readonly InitiativePlpPublicChoiceDiscoveryRow[];
};

/**
 * Pure row mapping — used by Mongo discovery and unit tests.
 * Skips non-PUBLIC_CHOICE docs even if they appear in the input set.
 */
export function mapPublicChoiceDiscoveryRows(
  docs: readonly ThinDiscoveryDoc[],
  limit: number,
): InitiativePlpPublicChoiceDiscoveryResult {
  const bounded = Math.min(
    Math.max(limit, 1),
    INITIATIVE_PLP_PUBLIC_CHOICE_DISCOVERY_DEFAULT_LIMIT,
  );
  const rows: InitiativePlpPublicChoiceDiscoveryRow[] = [];

  for (const doc of docs) {
    if (rows.length >= bounded) {
      break;
    }
    if (resolveInitiativeLifecycleProfile(doc.lifecycleProfile) !== "PUBLIC_CHOICE") {
      continue;
    }
    const card = buildInitiativePlpCardFromThinDoc(doc);
    if (!card?.initiativeId) {
      continue;
    }
    const consumerVisible =
      doc.lifecyclePhase === "projected" && doc.visibility?.policy === "public";

    rows.push({
      initiativeId: card.initiativeId,
      entityType: INITIATIVE_PLP_ENTITY_TYPE.INITIATIVE,
      entityId: card.initiativeId,
      lifecycleProfile: "PUBLIC_CHOICE",
      title: card.title,
      status: doc.status?.trim() || null,
      lifecyclePhase: doc.lifecyclePhase?.trim() || null,
      countryCode: card.countryCode?.trim() || null,
      regionCode: card.regionCode?.trim() || null,
      communitySlug: card.communitySlug?.trim() || null,
      geographySummary: card.geographyLabel?.trim() || null,
      electionName: card.electionName?.trim() || null,
      consumerVisible,
      updatedAt: doc.updatedAt?.trim() || null,
    });
  }

  return {
    FOUND_COUNT: rows.length,
    LIMIT: bounded,
    ROWS: rows,
  };
}

/**
 * Bounded Mongo discovery of PUBLIC_CHOICE Initiatives.
 * Filter mirrors public consumer eligibility (projected + visibility.public).
 */
export async function discoverPublicChoiceInitiativesForPlp(input?: {
  readonly limit?: number;
}): Promise<InitiativePlpPublicChoiceDiscoveryResult> {
  const limit = Math.min(
    Math.max(input?.limit ?? INITIATIVE_PLP_PUBLIC_CHOICE_DISCOVERY_DEFAULT_LIMIT, 1),
    INITIATIVE_PLP_PUBLIC_CHOICE_DISCOVERY_DEFAULT_LIMIT,
  );

  const collection = getMongoCollection<ThinDiscoveryDoc>(
    MONGO_COLLECTIONS.initiatives,
  );

  // Hard limit on cursor — never toArray unbounded.
  const cursor = collection
    .find(
      {
        lifecycleProfile: "PUBLIC_CHOICE",
        lifecyclePhase: "projected",
        "visibility.policy": "public",
      },
      {
        projection: {
          initiativeId: 1,
          title: 1,
          description: 1,
          status: 1,
          lifecycleProfile: 1,
          lifecyclePhase: 1,
          updatedAt: 1,
          visibility: 1,
          "metadata.activityArea": 1,
          "metadata.activityAreaOther": 1,
          "metadata.countrySlug": 1,
          "metadata.regionSlug": 1,
          "metadata.communitySlug": 1,
          "metadata.region": 1,
          "metadata.communityAssociation": 1,
        },
        limit,
        sort: { updatedAt: -1 },
      },
    )
    .limit(limit);

  const docs = await cursor.toArray();
  return mapPublicChoiceDiscoveryRows(docs, limit);
}
