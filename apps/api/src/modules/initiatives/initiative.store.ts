import type {
  Initiative,
  InitiativeDescription,
  InitiativeLifecyclePhase,
  InitiativeMetadata,
  InitiativeNewsSourceReference,
  InitiativeRevision,
  InitiativeContribution,
  InitiativeStatus,
  InitiativeTitle,
  InitiativeVisibility,
  TimelineEvent,
} from "@hu/types";

import { isInitiativeEligibleForPublicProjection } from "./initiative-public-projection.access.js";
import { rebuildProjectedInitiativeCards } from "./initiative-projection.store.js";
import { resolveInitiativePersistenceAdapter } from "./persistence/resolve-initiative-persistence.js";
import { snapshotFromInitiatives } from "./persistence/initiative-persistence.types.js";
import { sampleInitiative } from "./initiative.sample.js";

export interface InitiativeUpdate {
  title?: InitiativeTitle;
  description?: InitiativeDescription;
  status?: InitiativeStatus;
  lifecyclePhase?: InitiativeLifecyclePhase;
  visibility?: Partial<InitiativeVisibility>;
  metadata?: Partial<InitiativeMetadata>;
  revisions?: InitiativeRevision[];
  contributions?: InitiativeContribution[];
  timeline?: TimelineEvent[];
  sourceReferences?: InitiativeNewsSourceReference[] | null;
}

const persistence = resolveInitiativePersistenceAdapter();

function ensureBootstrapSeed(initiatives: Map<string, Initiative>): boolean {
  if (initiatives.has(sampleInitiative.initiativeId)) {
    return false;
  }

  initiatives.set(sampleInitiative.initiativeId, structuredClone(sampleInitiative));
  return true;
}

function loadInitiativesMap(): Map<string, Initiative> {
  const snapshot = persistence.load();
  const initiatives = new Map<string, Initiative>(
    Object.entries(snapshot.initiatives).map(([initiativeId, initiative]) => [
      initiativeId,
      structuredClone(initiative),
    ]),
  );
  const seededBootstrap = ensureBootstrapSeed(initiatives);

  if (seededBootstrap) {
    persistInitiativesMap(initiatives);
  }

  return initiatives;
}

function persistInitiativesMap(initiatives: Map<string, Initiative>): void {
  persistence.save(snapshotFromInitiatives(initiatives));
}

const initiatives = loadInitiativesMap();

rebuildProjectedInitiativeCards(Array.from(initiatives.values()));

export function getInitiativeById(initiativeId: string): Initiative | null {
  const initiative = initiatives.get(initiativeId);

  return initiative ? structuredClone(initiative) : null;
}

export function listInitiatives(): Initiative[] {
  return Array.from(initiatives.values(), (initiative) => structuredClone(initiative));
}

export function listInitiativesBySteward(stewardId: string): Initiative[] {
  return listInitiatives().filter((initiative) => initiative.stewardId === stewardId);
}

/**
 * Profile UX Pack 02 Part 9 — "Recent Public Initiatives" on a Public
 * Profile must only ever surface Initiatives that are ALREADY publicly
 * projected (`isInitiativeEligibleForPublicProjection`), regardless of the
 * viewer. This is a strictly narrower view of `listInitiativesBySteward`,
 * not a new eligibility rule.
 */
export function listPublicInitiativesBySteward(stewardId: string, limit = 5): Initiative[] {
  const boundedLimit = Math.max(0, limit);

  return listInitiativesBySteward(stewardId)
    .filter(isInitiativeEligibleForPublicProjection)
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, boundedLimit);
}

export function createInitiative(initiative: Initiative): Initiative {
  initiatives.set(initiative.initiativeId, structuredClone(initiative));
  persistInitiativesMap(initiatives);
  rebuildProjectedInitiativeCards(Array.from(initiatives.values()));

  return structuredClone(initiative);
}

/**
 * Initiative UX Pack 01.1 — permanent, hard removal of one Initiative
 * record. No prior `deleteInitiative`/soft-delete concept existed on this
 * store before this pack (only `createInitiative`/`updateInitiative`), and
 * this is the only place an Initiative is ever removed from the map —
 * callers (see `initiative.service.ts#deleteInitiativeDraft`) are
 * responsible for verifying ownership + Draft-only eligibility first, and
 * for cleaning up any dependent data before calling this. Returns `false`
 * when the Initiative was already gone (e.g. a concurrent delete), so
 * callers can distinguish "nothing to delete" from a genuine deletion.
 */
export function deleteInitiative(initiativeId: string): boolean {
  const existed = initiatives.delete(initiativeId);

  if (!existed) {
    return false;
  }

  persistInitiativesMap(initiatives);
  rebuildProjectedInitiativeCards(Array.from(initiatives.values()));

  return true;
}

export function updateInitiative(
  initiativeId: string,
  update: InitiativeUpdate,
): Initiative | null {
  const initiative = initiatives.get(initiativeId);

  if (!initiative) {
    return null;
  }

  if (update.title !== undefined) {
    initiative.title = update.title;
  }

  if (update.description !== undefined) {
    initiative.description = update.description;
  }

  if (update.status !== undefined) {
    initiative.status = update.status;
  }

  if (update.lifecyclePhase !== undefined) {
    initiative.lifecyclePhase = update.lifecyclePhase;
  }

  if (update.visibility !== undefined) {
    Object.assign(initiative.visibility, update.visibility);
  }

  if (update.metadata !== undefined) {
    Object.assign(initiative.metadata, update.metadata);
  }

  if (update.revisions !== undefined) {
    initiative.revisions = structuredClone(update.revisions);
  }

  if (update.contributions !== undefined) {
    initiative.contributions = structuredClone(update.contributions);
  }

  if (update.timeline !== undefined) {
    initiative.timeline = structuredClone(update.timeline);
  }

  if (update.sourceReferences !== undefined) {
    if (update.sourceReferences === null) {
      delete initiative.sourceReferences;
    } else {
      initiative.sourceReferences = structuredClone(update.sourceReferences);
    }
  }

  initiative.updatedAt = new Date().toISOString();

  persistInitiativesMap(initiatives);
  rebuildProjectedInitiativeCards(Array.from(initiatives.values()));

  return structuredClone(initiative);
}
