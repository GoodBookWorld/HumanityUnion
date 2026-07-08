import type { InitiativePublicImpact, PublicImpactEvidence } from "@hu/types";

import { resolveInitiativePublicImpactPersistenceAdapter } from "./persistence/resolve-initiative-public-impact-persistence.js";
import { snapshotFromPublicImpactData } from "./persistence/initiative-public-impact-persistence.types.js";

export interface InitiativePublicImpactUpdate {
  title?: string;
  summary?: string;
  observedImpact?: string;
  affectedCommunity?: string;
  evidenceSummary?: string;
  status?: InitiativePublicImpact["status"];
  publishedAt?: string;
  verifiedAt?: string;
  archivedAt?: string;
}

const PUBLIC_STATUSES = new Set<InitiativePublicImpact["status"]>([
  "published",
  "verified",
  "archived",
]);

const persistence = resolveInitiativePublicImpactPersistenceAdapter();

function loadState(): {
  impacts: Map<string, InitiativePublicImpact>;
  evidence: Map<string, PublicImpactEvidence>;
} {
  const snapshot = persistence.load();

  return {
    impacts: new Map<string, InitiativePublicImpact>(
      Object.entries(snapshot.impacts).map(([impactId, impact]) => [
        impactId,
        structuredClone(impact),
      ]),
    ),
    evidence: new Map<string, PublicImpactEvidence>(
      Object.entries(snapshot.evidence).map(([evidenceId, item]) => [
        evidenceId,
        structuredClone(item),
      ]),
    ),
  };
}

function persistState(input: {
  impacts: Map<string, InitiativePublicImpact>;
  evidence: Map<string, PublicImpactEvidence>;
}): void {
  persistence.save(snapshotFromPublicImpactData(input));
}

const initialState = loadState();
const impacts = initialState.impacts;
const evidence = initialState.evidence;

export function getImpactById(impactId: string): InitiativePublicImpact | null {
  const impact = impacts.get(impactId);

  return impact ? structuredClone(impact) : null;
}

export function listImpacts(): InitiativePublicImpact[] {
  return Array.from(impacts.values(), (impact) => structuredClone(impact));
}

export function listImpactsByInitiative(initiativeId: string): InitiativePublicImpact[] {
  return listImpacts().filter((impact) => impact.initiativeId === initiativeId);
}

export function listImpactsByTracking(trackingId: string): InitiativePublicImpact[] {
  return listImpacts().filter((impact) => impact.trackingId === trackingId);
}

export function listImpactsByParticipant(participantId: string): InitiativePublicImpact[] {
  return listImpacts().filter((impact) => impact.participantId === participantId);
}

export function listPublicImpactsByInitiative(initiativeId: string): InitiativePublicImpact[] {
  return listImpactsByInitiative(initiativeId)
    .filter((impact) => PUBLIC_STATUSES.has(impact.status))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function listPublicImpactsByTracking(trackingId: string): InitiativePublicImpact[] {
  return listImpactsByTracking(trackingId)
    .filter((impact) => PUBLIC_STATUSES.has(impact.status))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function createImpact(impact: InitiativePublicImpact): InitiativePublicImpact {
  impacts.set(impact.impactId, structuredClone(impact));
  persistState({ impacts, evidence });

  return structuredClone(impact);
}

export function updateImpact(
  impactId: string,
  update: InitiativePublicImpactUpdate,
): InitiativePublicImpact | null {
  const impact = impacts.get(impactId);

  if (!impact) {
    return null;
  }

  if (update.title !== undefined) {
    impact.title = update.title;
  }

  if (update.summary !== undefined) {
    impact.summary = update.summary;
  }

  if (update.observedImpact !== undefined) {
    impact.observedImpact = update.observedImpact;
  }

  if (update.affectedCommunity !== undefined) {
    impact.affectedCommunity = update.affectedCommunity;
  }

  if (update.evidenceSummary !== undefined) {
    impact.evidenceSummary = update.evidenceSummary;
  }

  if (update.status !== undefined) {
    impact.status = update.status;
  }

  if (update.publishedAt !== undefined) {
    impact.publishedAt = update.publishedAt;
  }

  if (update.verifiedAt !== undefined) {
    impact.verifiedAt = update.verifiedAt;
  }

  if (update.archivedAt !== undefined) {
    impact.archivedAt = update.archivedAt;
  }

  impact.updatedAt = new Date().toISOString();

  persistState({ impacts, evidence });

  return structuredClone(impact);
}

export function appendPublicImpactEvidence(item: PublicImpactEvidence): PublicImpactEvidence {
  evidence.set(item.evidenceId, structuredClone(item));
  persistState({ impacts, evidence });

  return structuredClone(item);
}

export function listEvidenceByImpact(impactId: string): PublicImpactEvidence[] {
  return Array.from(evidence.values())
    .filter((item) => item.impactId === impactId)
    .sort((left, right) => {
      const timeComparison = right.createdAt.localeCompare(left.createdAt);

      if (timeComparison !== 0) {
        return timeComparison;
      }

      return right.evidenceId.localeCompare(left.evidenceId);
    });
}

export function countEvidenceForImpact(impactId: string): number {
  return listEvidenceByImpact(impactId).length;
}

export function getEvidenceById(evidenceId: string): PublicImpactEvidence | null {
  const item = evidence.get(evidenceId);

  return item ? structuredClone(item) : null;
}

export function getPersistenceMode(): "file" | "memory" | "mongodb" {
  return persistence.mode;
}
