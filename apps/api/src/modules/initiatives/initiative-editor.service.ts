/**
 * Pack 12B2 — Delegated Initiative content editing for ACTIVE Editors.
 * Does not transfer stewardship. Reuses steward content mutation cores.
 */
import {
  INITIATIVE_ADMIN_BLOCKED_MUTATION_MESSAGE,
  INITIATIVE_EDITOR_BLOCKED_MUTATION_MESSAGE,
  PUBLIC_CHOICE_ELECTION_ADMIN_BLOCKED_MUTATION_MESSAGE,
  PUBLIC_CHOICE_ELECTION_EDITOR_BLOCKED_MUTATION_MESSAGE,
  resolveEffectiveModerationBlock,
  resolveInitiativeLifecycleProfile,
  type Initiative,
} from "@hu/types";

import { assertEditorCanMutate } from "../editor-grants/editor-grant.authorization.js";
import { initiativeContentGeography } from "../editor-grants/editor-content-geography.js";
import { getInitiativeById } from "./initiative.store.js";
import type { SaveInitiativeDraftInput } from "./initiative.validators.js";
import {
  republishInitiativeContent,
  saveInitiativeDraftContent,
  updatePublishedInitiativeContent,
} from "./initiative.service.js";

function assertAdminBlock(initiative: Initiative): void {
  const resolved = resolveEffectiveModerationBlock(initiative);
  if (!resolved.isBlocked) {
    return;
  }
  const isPublicChoice =
    resolveInitiativeLifecycleProfile(initiative.lifecycleProfile) === "PUBLIC_CHOICE";
  if (resolved.authority === "ADMIN") {
    throw new Error(
      isPublicChoice
        ? PUBLIC_CHOICE_ELECTION_ADMIN_BLOCKED_MUTATION_MESSAGE
        : INITIATIVE_ADMIN_BLOCKED_MUTATION_MESSAGE,
    );
  }
  throw new Error(
    isPublicChoice
      ? PUBLIC_CHOICE_ELECTION_EDITOR_BLOCKED_MUTATION_MESSAGE
      : INITIATIVE_EDITOR_BLOCKED_MUTATION_MESSAGE,
  );
}

async function assertEditorMayEditInitiative(input: {
  actorUserId: string;
  initiative: Initiative;
  nextCountrySlug?: string;
  nextRegionSlug?: string;
  nextCommunitySlug?: string;
}): Promise<void> {
  const isPublicChoice =
    resolveInitiativeLifecycleProfile(input.initiative.lifecycleProfile) === "PUBLIC_CHOICE";
  const capability = isPublicChoice ? "PUBLIC_CHOICE_EDIT" : "INITIATIVE_EDIT";

  // PUBLIC_CHOICE elections: either INITIATIVE_EDIT or PUBLIC_CHOICE_EDIT may edit content.
  // STANDARD: INITIATIVE_EDIT only.
  const tryCapabilities = isPublicChoice
    ? (["PUBLIC_CHOICE_EDIT", "INITIATIVE_EDIT"] as const)
    : (["INITIATIVE_EDIT"] as const);

  async function assertOne(content: {
    countrySlug?: string;
    regionSlug?: string;
    communitySlug?: string;
  }): Promise<void> {
    let lastError: unknown;
    for (const cap of tryCapabilities) {
      try {
        await assertEditorCanMutate({
          actorUserId: input.actorUserId,
          capability: cap,
          content: initiativeContentGeography(content),
        });
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(`Editor ${capability} permission is required.`);
  }

  await assertOne({
    countrySlug: input.initiative.metadata.countrySlug,
    regionSlug: input.initiative.metadata.regionSlug,
    communitySlug: input.initiative.metadata.communitySlug,
  });

  await assertOne({
    countrySlug: input.nextCountrySlug ?? input.initiative.metadata.countrySlug,
    regionSlug: input.nextRegionSlug ?? input.initiative.metadata.regionSlug,
    communitySlug: input.nextCommunitySlug ?? input.initiative.metadata.communitySlug,
  });
}

/**
 * Load Initiative for Editor edit form — scoped + capability checked.
 * STANDARD requires INITIATIVE_EDIT; PUBLIC_CHOICE accepts INITIATIVE_EDIT or PUBLIC_CHOICE_EDIT.
 */
export async function getInitiativeForEditor(input: {
  actorUserId: string;
  initiativeId: string;
}): Promise<Initiative> {
  const initiative = getInitiativeById(input.initiativeId);
  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  await assertEditorMayEditInitiative({
    actorUserId: input.actorUserId,
    initiative,
  });

  return initiative;
}

/**
 * Allowed editorial fields (same SaveInitiativeDraftInput as steward):
 * title, description, geography metadata, media/cover, activity/participation,
 * ballotMode for PUBLIC_CHOICE. Not: stewardship transfer, delete, archive, identity.
 */
export async function updateInitiativeAsEditor(input: {
  actorUserId: string;
  initiativeId: string;
  body: SaveInitiativeDraftInput;
}): Promise<Initiative> {
  const initiative = getInitiativeById(input.initiativeId);
  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  assertAdminBlock(initiative);

  await assertEditorMayEditInitiative({
    actorUserId: input.actorUserId,
    initiative,
    nextCountrySlug: input.body.countrySlug,
    nextRegionSlug: input.body.regionSlug,
    nextCommunitySlug: input.body.communitySlug,
  });

  switch (initiative.lifecyclePhase) {
    case "draft":
      return saveInitiativeDraftContent(initiative, input.body);
    case "published":
    case "projected":
      return updatePublishedInitiativeContent(initiative, input.body);
    case "archived":
      throw new Error("Archived initiatives cannot be updated.");
    default:
      throw new Error("Initiative update is not allowed from the current lifecycle phase.");
  }
}

export async function republishInitiativeAsEditor(input: {
  actorUserId: string;
  initiativeId: string;
  body?: SaveInitiativeDraftInput;
}): Promise<Initiative> {
  const initiative = getInitiativeById(input.initiativeId);
  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  assertAdminBlock(initiative);

  const body = input.body ?? {};
  await assertEditorMayEditInitiative({
    actorUserId: input.actorUserId,
    initiative,
    nextCountrySlug: body.countrySlug,
    nextRegionSlug: body.regionSlug,
    nextCommunitySlug: body.communitySlug,
  });

  return republishInitiativeContent(initiative, body);
}
