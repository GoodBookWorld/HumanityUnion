import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type {
  InitiativeDecisionSessionRecommendation,
  InitiativeDecisionSessionRecommendationKind,
} from "@hu/types";

import { createLegacyFileStoreMongoBridge } from "../../infrastructure/mongodb/legacy-file-store-mongo-bridge.js";
import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoPersistenceMode } from "../../config/production-persistence-contract.js";

interface RecommendationSnapshot {
  version: 1;
  recommendations: Record<string, InitiativeDecisionSessionRecommendation>;
}

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_FILE_PATH = path.resolve(
  MODULE_DIR,
  "../../../.runtime/initiative-decision-session-recommendations.json",
);

function emptySnapshot(): RecommendationSnapshot {
  return { version: 1, recommendations: {} };
}

const bridge = createLegacyFileStoreMongoBridge<RecommendationSnapshot>({
  envKey: "INITIATIVE_DECISION_SESSION_RECOMMENDATION_PERSISTENCE",
  defaultFilePath: DEFAULT_FILE_PATH,
  filePathEnvKey: "INITIATIVE_DECISION_SESSION_RECOMMENDATION_PATH",
  createEmpty: emptySnapshot,
  isValidSnapshot: (value): value is RecommendationSnapshot =>
    Boolean(
      value &&
        typeof value === "object" &&
        (value as RecommendationSnapshot).version === 1 &&
        typeof (value as RecommendationSnapshot).recommendations === "object",
    ),
  bindings: [
    {
      collectionName: MONGO_COLLECTIONS.initiativeDecisionSessionRecommendations,
      idField: "recommendationId",
      select: (snapshot) => snapshot.recommendations as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        recommendations: records as unknown as Record<string, InitiativeDecisionSessionRecommendation>,
      }),
    },
  ],
});

const recommendations = new Map<string, InitiativeDecisionSessionRecommendation>(
  Object.entries(bridge.loadInitial().recommendations).map(([id, recommendation]) => [
    id,
    structuredClone(recommendation),
  ]),
);

function replaceFromSnapshot(snapshot: RecommendationSnapshot): void {
  recommendations.clear();
  for (const [id, recommendation] of Object.entries(snapshot.recommendations)) {
    recommendations.set(id, structuredClone(recommendation));
  }
}

function persist(): void {
  const record: Record<string, InitiativeDecisionSessionRecommendation> = {};
  for (const [id, recommendation] of recommendations) {
    record[id] = structuredClone(recommendation);
  }
  bridge.save({ version: 1, recommendations: record });
}

export async function hydrateInitiativeDecisionSessionRecommendationMongoPersistence(): Promise<void> {
  await bridge.hydrate();
  if (isMongoPersistenceMode("INITIATIVE_DECISION_SESSION_RECOMMENDATION_PERSISTENCE")) {
    replaceFromSnapshot(bridge.loadMongoCache());
  }
}

export async function flushInitiativeDecisionSessionRecommendationMongoPersistence(): Promise<void> {
  await bridge.flush();
}

export function listRecommendationsByInitiative(
  initiativeId: string,
): InitiativeDecisionSessionRecommendation[] {
  return Array.from(recommendations.values())
    .filter((recommendation) => recommendation.initiativeId === initiativeId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((recommendation) => structuredClone(recommendation));
}

export function createRecommendation(input: {
  initiativeId: string;
  authorParticipantId: string;
  kind: InitiativeDecisionSessionRecommendationKind;
  title: string;
  body: string;
}): InitiativeDecisionSessionRecommendation {
  const now = new Date().toISOString();
  const recommendation: InitiativeDecisionSessionRecommendation = {
    recommendationId: `decision-session-recommendation-${randomUUID()}`,
    initiativeId: input.initiativeId,
    authorParticipantId: input.authorParticipantId,
    kind: input.kind,
    title: input.title.trim(),
    body: input.body.trim(),
    createdAt: now,
    updatedAt: now,
  };

  recommendations.set(recommendation.recommendationId, recommendation);
  persist();

  return structuredClone(recommendation);
}

export function deleteRecommendationsByInitiativeIdForTests(initiativeId: string): number {
  let removed = 0;

  for (const [id, recommendation] of recommendations.entries()) {
    if (recommendation.initiativeId === initiativeId) {
      recommendations.delete(id);
      removed += 1;
    }
  }

  if (removed > 0) {
    persist();
  }

  return removed;
}
