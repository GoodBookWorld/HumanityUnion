import type { ParticipationArea, ParticipationAreaTransition } from "@hu/types";

import { updateMemberProfileRecord } from "../member-profile/member-profile.repository.js";
import { resolveParticipationAreaDisplayLabels } from "./participation-area-geography.js";
import {
  ParticipationAreaConflictError,
  ParticipationAreaNotFoundError,
} from "./participation-area.errors.js";
import {
  cancelParticipationAreaTransition,
  createParticipationArea,
  getPendingParticipationAreaTransitionForParticipant,
  requestParticipationAreaTransition,
  resolveActiveParticipationArea,
} from "./participation-area.store.js";
import { validateParticipationAreaInput } from "./participation-area.validators.js";

export const PARTICIPATION_AREA_TRANSITION_DELAY_DAYS = 14;

export interface ParticipationAreaEligibilityPreview {
  world: boolean;
  country?: string;
  region?: string;
  community?: string;
}

export interface ParticipationAreaWorkspaceState {
  activeArea: ParticipationArea | null;
  pendingTransition: ParticipationAreaTransition | null;
  labels: {
    country?: string;
    region?: string;
    community?: string;
  };
  pendingLabels?: {
    country?: string;
    region?: string;
    community?: string;
  };
  eligibilityPreview: ParticipationAreaEligibilityPreview;
}

function defaultTransitionEffectiveAt(from = new Date()): string {
  const effectiveAt = new Date(from);
  effectiveAt.setDate(effectiveAt.getDate() + PARTICIPATION_AREA_TRANSITION_DELAY_DAYS);
  return effectiveAt.toISOString();
}

function mapStoreError(error: unknown): never {
  if (error instanceof Error) {
    if (error.message.includes("already has an active")) {
      throw new ParticipationAreaConflictError(error.message);
    }

    if (error.message.includes("already has a pending")) {
      throw new ParticipationAreaConflictError(error.message);
    }

    if (error.message.includes("no active") || error.message.includes("No pending")) {
      throw new ParticipationAreaNotFoundError(error.message);
    }
  }

  throw error;
}

function buildEligibilityPreview(
  area: ParticipationArea | null,
): ParticipationAreaEligibilityPreview {
  if (!area) {
    return {
      world: true,
    };
  }

  const labels = resolveParticipationAreaDisplayLabels(area);

  return {
    world: true,
    country: labels.country,
    region: labels.region,
    community: labels.community,
  };
}

function buildWorkspaceState(
  participantId: string,
  currentTime: string,
): ParticipationAreaWorkspaceState {
  const activeArea = resolveActiveParticipationArea(participantId, currentTime);
  const pendingTransition = getPendingParticipationAreaTransitionForParticipant(participantId);

  const labels = activeArea ? resolveParticipationAreaDisplayLabels(activeArea) : {};
  const pendingLabels = pendingTransition
    ? resolveParticipationAreaDisplayLabels(pendingTransition.toArea)
    : undefined;

  return {
    activeArea,
    pendingTransition,
    labels,
    pendingLabels,
    eligibilityPreview: buildEligibilityPreview(activeArea),
  };
}

export async function syncMemberProfileParticipationDisplay(
  userId: string,
  area: ParticipationArea | null,
): Promise<void> {
  if (!area) {
    await updateMemberProfileRecord(userId, {
      participationAreaId: undefined,
      country: undefined,
      region: undefined,
      community: undefined,
    });
    return;
  }

  const labels = resolveParticipationAreaDisplayLabels(area);

  await updateMemberProfileRecord(userId, {
    participationAreaId: area.participationAreaId,
    country: labels.country,
    region: labels.region,
    community: labels.community,
  });
}

export function getParticipationAreaWorkspaceState(
  participantId: string,
  currentTime = new Date().toISOString(),
): ParticipationAreaWorkspaceState {
  return buildWorkspaceState(participantId, currentTime);
}

export async function createInitialParticipationAreaForParticipant(input: {
  participantId: string;
  userId: string;
  body: unknown;
}): Promise<ParticipationAreaWorkspaceState> {
  const validated = validateParticipationAreaInput(input.body);
  const currentTime = new Date().toISOString();

  try {
    const area = createParticipationArea({
      participantId: input.participantId,
      countrySlug: validated.countrySlug,
      regionSlug: validated.regionSlug,
      communitySlug: validated.communitySlug,
      regionLabel: validated.regionLabel,
      verificationStatus: "unverified",
    });

    await syncMemberProfileParticipationDisplay(input.userId, area);

    return buildWorkspaceState(input.participantId, currentTime);
  } catch (error) {
    mapStoreError(error);
  }
}

export async function requestParticipationAreaChangeForParticipant(input: {
  participantId: string;
  userId: string;
  body: unknown;
}): Promise<ParticipationAreaWorkspaceState> {
  const validated = validateParticipationAreaInput(input.body);
  const currentTime = new Date().toISOString();

  resolveActiveParticipationArea(input.participantId, currentTime);

  try {
    requestParticipationAreaTransition({
      participantId: input.participantId,
      toArea: {
        countrySlug: validated.countrySlug,
        regionSlug: validated.regionSlug,
        communitySlug: validated.communitySlug,
        regionLabel: validated.regionLabel,
      },
      effectiveAt: defaultTransitionEffectiveAt(),
    });

    return buildWorkspaceState(input.participantId, currentTime);
  } catch (error) {
    mapStoreError(error);
  }
}

export async function cancelParticipationAreaChangeForParticipant(input: {
  participantId: string;
  userId: string;
}): Promise<ParticipationAreaWorkspaceState> {
  const currentTime = new Date().toISOString();

  try {
    cancelParticipationAreaTransition(input.participantId);
    const activeArea = resolveActiveParticipationArea(input.participantId, currentTime);
    await syncMemberProfileParticipationDisplay(input.userId, activeArea);
    return buildWorkspaceState(input.participantId, currentTime);
  } catch (error) {
    mapStoreError(error);
  }
}

export async function loadParticipationAreaWorkspaceForParticipant(input: {
  participantId: string;
  userId: string;
}): Promise<ParticipationAreaWorkspaceState> {
  const currentTime = new Date().toISOString();
  const activeArea = resolveActiveParticipationArea(input.participantId, currentTime);
  await syncMemberProfileParticipationDisplay(input.userId, activeArea);
  return buildWorkspaceState(input.participantId, currentTime);
}
