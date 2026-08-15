import type { InitiativeCollectiveDecision } from "@hu/types";

import { resolveInitiativeCollectiveDecisionPersistenceAdapter } from "./persistence/resolve-initiative-collective-decision-persistence.js";
import { snapshotFromDecisions } from "./persistence/initiative-collective-decision-persistence.types.js";

export interface InitiativeCollectiveDecisionUpdate {
  status?: InitiativeCollectiveDecision["status"];
  openedAt?: string;
  closedAt?: string;
  cancelledAt?: string;
  /** Initiative Lifecycle — Part H, Section 6/7. Structured Decision Result. */
  structuredContent?: InitiativeCollectiveDecision["structuredContent"];
  /** Initiative Lifecycle — Part H, Section 9. Decision Session provenance. */
  traceability?: InitiativeCollectiveDecision["traceability"];
}

const PUBLIC_STATUSES = new Set<InitiativeCollectiveDecision["status"]>([
  "opened",
  "closed",
  "cancelled",
]);

const persistence = resolveInitiativeCollectiveDecisionPersistenceAdapter();

function loadDecisionsMap(): Map<string, InitiativeCollectiveDecision> {
  const snapshot = persistence.load();

  return new Map<string, InitiativeCollectiveDecision>(
    Object.entries(snapshot.decisions).map(([decisionId, decision]) => [
      decisionId,
      structuredClone(decision),
    ]),
  );
}

function persistDecisionsMap(decisions: Map<string, InitiativeCollectiveDecision>): void {
  persistence.save(snapshotFromDecisions(decisions));
}

const decisions = loadDecisionsMap();

export function getDecisionById(decisionId: string): InitiativeCollectiveDecision | null {
  const decision = decisions.get(decisionId);

  return decision ? structuredClone(decision) : null;
}

export function listDecisions(): InitiativeCollectiveDecision[] {
  return Array.from(decisions.values(), (decision) => structuredClone(decision));
}

export function listDecisionsByInitiative(initiativeId: string): InitiativeCollectiveDecision[] {
  return listDecisions().filter((decision) => decision.initiativeId === initiativeId);
}

export function listDecisionsBySteward(stewardId: string): InitiativeCollectiveDecision[] {
  return listDecisions().filter((decision) => decision.stewardId === stewardId);
}

export function listPublicDecisionsByInitiative(
  initiativeId: string,
): InitiativeCollectiveDecision[] {
  return listDecisionsByInitiative(initiativeId)
    .filter((decision) => PUBLIC_STATUSES.has(decision.status))
    .sort((left, right) => right.sequenceNumber - left.sequenceNumber);
}

export function getNextSequenceNumber(initiativeId: string): number {
  const existing = listDecisionsByInitiative(initiativeId);

  if (existing.length === 0) {
    return 1;
  }

  return Math.max(...existing.map((decision) => decision.sequenceNumber)) + 1;
}

export function createDecision(
  decision: InitiativeCollectiveDecision,
): InitiativeCollectiveDecision {
  decisions.set(decision.decisionId, structuredClone(decision));
  persistDecisionsMap(decisions);

  return structuredClone(decision);
}

export function updateDecision(
  decisionId: string,
  update: InitiativeCollectiveDecisionUpdate,
): InitiativeCollectiveDecision | null {
  const decision = decisions.get(decisionId);

  if (!decision) {
    return null;
  }

  if (update.status !== undefined) {
    decision.status = update.status;
  }

  if (update.openedAt !== undefined) {
    decision.openedAt = update.openedAt;
  }

  if (update.closedAt !== undefined) {
    decision.closedAt = update.closedAt;
  }

  if (update.cancelledAt !== undefined) {
    decision.cancelledAt = update.cancelledAt;
  }

  if (update.structuredContent !== undefined) {
    decision.structuredContent = update.structuredContent
      ? structuredClone(update.structuredContent)
      : null;
  }

  if (update.traceability !== undefined) {
    decision.traceability = update.traceability ? structuredClone(update.traceability) : null;
  }

  decision.updatedAt = new Date().toISOString();

  persistDecisionsMap(decisions);

  return structuredClone(decision);
}

export function getPersistenceMode(): "file" | "memory" | "mongodb" {
  return persistence.mode;
}

/**
 * Test-only cleanup helper (Recovery Task 09), mirroring the pattern
 * established in Tasks 06-08 for file-backed persistence modules that lack
 * a dedicated test-reset mechanism. Removes only decisions authored by the
 * given steward, scoping deletion narrowly so unrelated runtime records are
 * never touched.
 */
export function deleteDecisionsByStewardIdForTests(stewardId: string): void {
  for (const [decisionId, decision] of decisions) {
    if (decision.stewardId === stewardId) {
      decisions.delete(decisionId);
    }
  }

  persistDecisionsMap(decisions);
}
