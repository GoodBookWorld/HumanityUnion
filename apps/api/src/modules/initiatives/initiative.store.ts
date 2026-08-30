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

import { resolvePlatformMode } from "../../config/platform.config.js";
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
  administrativelyBlocked?: boolean | null;
  administrativeBlockAuthority?: "ADMIN" | "EDITOR" | null;
  administrativelyBlockedAt?: string | null;
  administrativelyBlockedByParticipantId?: string | null;
  administrativeBlockReason?: string | null;
}

const persistence = resolveInitiativePersistenceAdapter();

/**
 * Bootstrap sample Initiative is for local/dev fixtures only.
 * Staging/production must not re-seed after operator cleanup.
 * Opt-in: INITIATIVE_BOOTSTRAP_SEED=true; opt-out: =false.
 */
export function shouldSeedBootstrapInitiative(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const explicit = env.INITIATIVE_BOOTSTRAP_SEED?.trim();
  if (explicit === "true" || explicit === "1") {
    return true;
  }
  if (explicit === "false" || explicit === "0") {
    return false;
  }

  const platformMode = env.PLATFORM_MODE?.trim();
  if (platformMode === "staging" || platformMode === "production") {
    return false;
  }

  if (resolvePlatformMode() === "production") {
    return false;
  }

  return true;
}

function ensureBootstrapSeed(target: Map<string, Initiative>): boolean {
  if (target.has(sampleInitiative.initiativeId)) {
    return false;
  }

  if (!shouldSeedBootstrapInitiative()) {
    return false;
  }

  target.set(sampleInitiative.initiativeId, structuredClone(sampleInitiative));
  return true;
}

function replaceInitiativesMap(next: Map<string, Initiative>): void {
  initiatives.clear();
  for (const [initiativeId, initiative] of next) {
    initiatives.set(initiativeId, initiative);
  }
}

/**
 * Loads the in-memory Initiative map from the active persistence adapter.
 *
 * Mongo mode must not write during module import — `save()` would call Mongo
 * before `connectMongoClient()` / hydrate. Seed persistence for Mongo happens
 * in `syncInitiativeStoreAfterMongoHydrate()` after bootstrap.
 */
function loadInitiativesMap(): Map<string, Initiative> {
  const snapshot = persistence.load();
  const loaded = new Map<string, Initiative>(
    Object.entries(snapshot.initiatives).map(([initiativeId, initiative]) => [
      initiativeId,
      structuredClone(initiative),
    ]),
  );
  const seededBootstrap = ensureBootstrapSeed(loaded);

  if (seededBootstrap && persistence.mode !== "mongodb") {
    persistInitiativesMap(loaded);
  }

  return loaded;
}

function persistInitiativesMap(source: Map<string, Initiative>): void {
  persistence.save(snapshotFromInitiatives(source));
}

const initiatives = loadInitiativesMap();

rebuildProjectedInitiativeCards(Array.from(initiatives.values()));

/**
 * Re-bind the Initiative store from the Mongo adapter cache after
 * `hydrateInitiativeMongoPersistence()`. Safe to call only after Mongo connect.
 */
export function syncInitiativeStoreAfterMongoHydrate(): void {
  if (persistence.mode !== "mongodb") {
    return;
  }

  const snapshot = persistence.load();
  const reloaded = new Map<string, Initiative>(
    Object.entries(snapshot.initiatives).map(([initiativeId, initiative]) => [
      initiativeId,
      structuredClone(initiative),
    ]),
  );
  const seededBootstrap = ensureBootstrapSeed(reloaded);
  replaceInitiativesMap(reloaded);

  if (seededBootstrap) {
    persistInitiativesMap(initiatives);
  }

  rebuildProjectedInitiativeCards(Array.from(initiatives.values()));
}

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

  if (update.administrativelyBlocked === null || update.administrativelyBlocked === false) {
    delete initiative.administrativelyBlocked;
    delete initiative.administrativeBlockAuthority;
    delete initiative.administrativelyBlockedAt;
    delete initiative.administrativelyBlockedByParticipantId;
    delete initiative.administrativeBlockReason;
  } else if (update.administrativelyBlocked === true) {
    initiative.administrativelyBlocked = true;
    if (update.administrativeBlockAuthority !== undefined) {
      if (update.administrativeBlockAuthority === null) {
        delete initiative.administrativeBlockAuthority;
      } else {
        initiative.administrativeBlockAuthority = update.administrativeBlockAuthority;
      }
    }
    if (update.administrativelyBlockedAt !== undefined) {
      if (update.administrativelyBlockedAt === null) {
        delete initiative.administrativelyBlockedAt;
      } else {
        initiative.administrativelyBlockedAt = update.administrativelyBlockedAt;
      }
    }
    if (update.administrativelyBlockedByParticipantId !== undefined) {
      if (update.administrativelyBlockedByParticipantId === null) {
        delete initiative.administrativelyBlockedByParticipantId;
      } else {
        initiative.administrativelyBlockedByParticipantId =
          update.administrativelyBlockedByParticipantId;
      }
    }
    if (update.administrativeBlockReason !== undefined) {
      if (update.administrativeBlockReason === null) {
        delete initiative.administrativeBlockReason;
      } else {
        initiative.administrativeBlockReason = update.administrativeBlockReason;
      }
    }
  }

  initiative.updatedAt = new Date().toISOString();

  persistInitiativesMap(initiatives);
  rebuildProjectedInitiativeCards(Array.from(initiatives.values()));

  return structuredClone(initiative);
}
