import type { Initiative } from "@hu/types";

import { isKnownInitiativeCommunitySlug } from "./initiative-communities.js";

export interface CreateInitiativeDraftInput {
  title: string;
  description: string;
  communitySlug: string;
  activityArea: string;
}

export interface SaveInitiativeDraftInput {
  title?: string;
  description?: string;
  communitySlug?: string;
  activityArea?: string;
}

function normalizeText(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} is required.`);
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }

  return normalized;
}

export function validateCreateInitiativeDraftInput(body: unknown): CreateInitiativeDraftInput {
  if (!body || typeof body !== "object") {
    throw new Error("Request body is required.");
  }

  const record = body as Record<string, unknown>;

  const title = normalizeText(record.title, "Title");
  const description = normalizeText(record.description, "Short description");
  const communitySlug = normalizeText(record.communitySlug, "Community association");
  const activityArea = normalizeText(record.activityArea, "Activity area");

  if (!isKnownInitiativeCommunitySlug(communitySlug)) {
    throw new Error("Community association is not recognized.");
  }

  return {
    title,
    description,
    communitySlug,
    activityArea,
  };
}

export function validateSaveInitiativeDraftInput(body: unknown): SaveInitiativeDraftInput {
  if (!body || typeof body !== "object") {
    throw new Error("Request body is required.");
  }

  const record = body as Record<string, unknown>;
  const update: SaveInitiativeDraftInput = {};

  if (record.title !== undefined) {
    update.title = normalizeText(record.title, "Title");
  }

  if (record.description !== undefined) {
    update.description = normalizeText(record.description, "Short description");
  }

  if (record.communitySlug !== undefined) {
    const communitySlug = normalizeText(record.communitySlug, "Community association");

    if (!isKnownInitiativeCommunitySlug(communitySlug)) {
      throw new Error("Community association is not recognized.");
    }

    update.communitySlug = communitySlug;
  }

  if (record.activityArea !== undefined) {
    update.activityArea = normalizeText(record.activityArea, "Activity area");
  }

  if (Object.keys(update).length === 0) {
    throw new Error("At least one editable field is required.");
  }

  return update;
}

export function validateInitiativeForPublication(initiative: Initiative): void {
  normalizeText(initiative.title, "Title");
  normalizeText(initiative.description, "Short description");
  normalizeText(initiative.metadata.communitySlug, "Community association");
  normalizeText(initiative.metadata.activityArea, "Activity area");

  if (!isKnownInitiativeCommunitySlug(initiative.metadata.communitySlug)) {
    throw new Error("Community association is not recognized.");
  }

  if (initiative.visibility.policy !== "public") {
    throw new Error("Visibility must be Public before publishing.");
  }
}
