import type {
  Initiative,
  InitiativeDescription,
  InitiativeMetadata,
  InitiativeRevision,
  InitiativeContribution,
  InitiativeStatus,
  InitiativeTitle,
  InitiativeVisibility,
  TimelineEvent,
} from "@hu/types";

import { sampleInitiative } from "./initiative.sample.js";

export interface InitiativeUpdate {
  title?: InitiativeTitle;
  description?: InitiativeDescription;
  status?: InitiativeStatus;
  visibility?: Partial<InitiativeVisibility>;
  metadata?: Partial<InitiativeMetadata>;
  revisions?: InitiativeRevision[];
  contributions?: InitiativeContribution[];
  timeline?: TimelineEvent[];
}

const initiatives = new Map<string, Initiative>([
  [sampleInitiative.initiativeId, structuredClone(sampleInitiative)],
]);

export function getInitiativeById(initiativeId: string): Initiative | null {
  const initiative = initiatives.get(initiativeId);

  return initiative ? structuredClone(initiative) : null;
}

export function listInitiatives(): Initiative[] {
  return Array.from(initiatives.values(), (initiative) => structuredClone(initiative));
}

export function createInitiative(initiative: Initiative): Initiative {
  initiatives.set(initiative.initiativeId, structuredClone(initiative));

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

  return structuredClone(initiative);
}
