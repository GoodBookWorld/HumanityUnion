/**
 * Initiative Lifecycle Finalization Phase 02 — Lifecycle Profiles.
 *
 * One Lifecycle Engine, multiple allowed routes through the same Stage Registry.
 * Profiles never invent parallel Initiative domains or Candidate backends.
 *
 * Discussion is a Stage Registry entry that reuses the Initiative Center-tab
 * Discussion contract — never a second Discussion implementation.
 */

import type { InitiativeLifecycleStageId } from "./initiative-lifecycle-stage.js";
import {
  getInitiativeLifecycleStageDefinition,
  INITIATIVE_LIFECYCLE_STAGE_REGISTRY,
  isInitiativeLifecycleStageId,
} from "./initiative-lifecycle-stage.js";

/** Canonical lifecycle route selector on an Initiative. */
export type InitiativeLifecycleProfile = "STANDARD" | "PUBLIC_CHOICE";

export const DEFAULT_INITIATIVE_LIFECYCLE_PROFILE: InitiativeLifecycleProfile = "STANDARD";

export const INITIATIVE_LIFECYCLE_PROFILES = ["STANDARD", "PUBLIC_CHOICE"] as const;

/**
 * STANDARD: full civic lifecycle (registry order), including Discussion after Initiative.
 * Discussion remains the Center-tab civic surface (#discussion).
 * Revision version history remains available as content — not a route stage.
 */
export const STANDARD_LIFECYCLE_STAGE_ROUTE: readonly InitiativeLifecycleStageId[] =
  INITIATIVE_LIFECYCLE_STAGE_REGISTRY.map((stage) => stage.stageId).filter(
    (stageId) => stageId !== "revision",
  );

/**
 * PUBLIC_CHOICE: Initiative → Discussion → Collective Decision → Civic Archive.
 *
 * User-facing Create → Discussion → Vote → Result → Archive is a later UX projection;
 * "Result" is a projection of Collective Decision, not a new domain stage.
 */
export const PUBLIC_CHOICE_LIFECYCLE_STAGE_ROUTE: readonly InitiativeLifecycleStageId[] = [
  "initiative",
  "discussion",
  "collective_decision",
  "archive",
] as const;

const PROFILE_ROUTES: Record<InitiativeLifecycleProfile, readonly InitiativeLifecycleStageId[]> = {
  STANDARD: STANDARD_LIFECYCLE_STAGE_ROUTE,
  PUBLIC_CHOICE: PUBLIC_CHOICE_LIFECYCLE_STAGE_ROUTE,
};

export function isInitiativeLifecycleProfile(value: unknown): value is InitiativeLifecycleProfile {
  return value === "STANDARD" || value === "PUBLIC_CHOICE";
}

/** Undefined / missing profile on historical Initiatives resolves to STANDARD. */
export function resolveInitiativeLifecycleProfile(
  profile: InitiativeLifecycleProfile | string | null | undefined,
): InitiativeLifecycleProfile {
  if (isInitiativeLifecycleProfile(profile)) {
    return profile;
  }

  return DEFAULT_INITIATIVE_LIFECYCLE_PROFILE;
}

export function getLifecycleStageRouteForProfile(
  profile: InitiativeLifecycleProfile | string | null | undefined,
): readonly InitiativeLifecycleStageId[] {
  return PROFILE_ROUTES[resolveInitiativeLifecycleProfile(profile)];
}

export function isLifecycleStageApplicableToProfile(
  stageId: string,
  profile: InitiativeLifecycleProfile | string | null | undefined,
): boolean {
  if (!isInitiativeLifecycleStageId(stageId)) {
    return false;
  }

  return getLifecycleStageRouteForProfile(profile).includes(stageId);
}

export function getNextApplicableLifecycleStageId(
  stageId: InitiativeLifecycleStageId,
  profile: InitiativeLifecycleProfile | string | null | undefined,
): InitiativeLifecycleStageId | null {
  const route = getLifecycleStageRouteForProfile(profile);
  const index = route.indexOf(stageId);

  if (index < 0 || index >= route.length - 1) {
    return null;
  }

  return route[index + 1] ?? null;
}

export function getPreviousApplicableLifecycleStageId(
  stageId: InitiativeLifecycleStageId,
  profile: InitiativeLifecycleProfile | string | null | undefined,
): InitiativeLifecycleStageId | null {
  const route = getLifecycleStageRouteForProfile(profile);
  const index = route.indexOf(stageId);

  if (index <= 0) {
    return null;
  }

  return route[index - 1] ?? null;
}

export function listNotApplicableLifecycleStageIds(
  profile: InitiativeLifecycleProfile | string | null | undefined,
): readonly InitiativeLifecycleStageId[] {
  const applicable = new Set(getLifecycleStageRouteForProfile(profile));
  return INITIATIVE_LIFECYCLE_STAGE_REGISTRY.map((stage) => stage.stageId).filter(
    (stageId) => !applicable.has(stageId),
  );
}

/**
 * Profile change safety (domain rule — enforce at API when mutation is exposed).
 * Drafts with no published lifecycle artifacts may switch; after meaningful
 * progression, arbitrary switching is refused so artifacts are not orphaned.
 *
 * Profile is Initiative *configuration*, never lifecycle progress state.
 */
export function canChangeInitiativeLifecycleProfile(input: {
  readonly from: InitiativeLifecycleProfile | string | null | undefined;
  readonly to: InitiativeLifecycleProfile | string | null | undefined;
  readonly initiativeLifecyclePhase: string;
  readonly hasPublishedLifecycleArtifactsBeyondInitiative: boolean;
}): { allowed: boolean; reason: string } {
  const from = resolveInitiativeLifecycleProfile(input.from);
  const to = resolveInitiativeLifecycleProfile(input.to);

  if (from === to) {
    return { allowed: true, reason: "Profile unchanged." };
  }

  if (input.hasPublishedLifecycleArtifactsBeyondInitiative) {
    return {
      allowed: false,
      reason:
        "Lifecycle profile cannot change after lifecycle stage artifacts have been published.",
    };
  }

  if (input.initiativeLifecyclePhase !== "draft") {
    return {
      allowed: false,
      reason: "Lifecycle profile can only change while the Initiative is still a draft.",
    };
  }

  return { allowed: true, reason: "Draft Initiative with no published lifecycle artifacts." };
}

export function describeLifecycleProfile(profile: InitiativeLifecycleProfile): string {
  return profile === "PUBLIC_CHOICE"
    ? "Public Choice — Initiative, Discussion, Collective Decision, Civic Archive"
    : "Standard — full Initiative civic lifecycle (including Discussion)";
}

export function getLifecycleStageDefinitionForProfile(
  stageId: string,
  profile: InitiativeLifecycleProfile | string | null | undefined,
) {
  if (!isLifecycleStageApplicableToProfile(stageId, profile)) {
    return null;
  }

  return getInitiativeLifecycleStageDefinition(stageId);
}
