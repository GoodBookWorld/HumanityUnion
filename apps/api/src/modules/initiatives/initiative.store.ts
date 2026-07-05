import type {
  Initiative,
  InitiativeDescription,
  InitiativeLifecyclePhase,
  InitiativeMetadata,
  InitiativeRevision,
  InitiativeContribution,
  InitiativeStatus,
  InitiativeTitle,
  InitiativeVisibility,
  TimelineEvent,
} from "@hu/types";

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

export function createInitiative(initiative: Initiative): Initiative {
  initiatives.set(initiative.initiativeId, structuredClone(initiative));
  persistInitiativesMap(initiatives);
  rebuildProjectedInitiativeCards(Array.from(initiatives.values()));

  return structuredClone(initiative);
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

  initiative.updatedAt = new Date().toISOString();

  persistInitiativesMap(initiatives);
  rebuildProjectedInitiativeCards(Array.from(initiatives.values()));

  return structuredClone(initiative);
}
