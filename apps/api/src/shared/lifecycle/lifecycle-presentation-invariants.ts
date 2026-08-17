/**
 * Lifecycle Finalization Phase 05A — presentation-state contradiction guards.
 *
 * "Unavailable" means infrastructure/read failure only.
 * It must never coexist with published/completed/current truths for the same stage.
 */

import type { InitiativeLifecyclePresentationStatus } from "@hu/types";
import type { InitiativeExperienceLifecycleStageState } from "@hu/types";

export class LifecyclePresentationContradictionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LifecyclePresentationContradictionError";
  }
}

export interface LifecycleStageTruthSnapshot {
  readonly stageId: string;
  readonly navState?: InitiativeExperienceLifecycleStageState | null;
  readonly presentationStatus?: InitiativeLifecyclePresentationStatus | null;
  readonly hasPublishedArtifact?: boolean;
  readonly authorReportsAlreadyPublished?: boolean;
  readonly optionalLookupUnavailable?: boolean;
}

/**
 * Asserts mutually exclusive truths cannot be claimed together.
 * Returns null when consistent; otherwise a human-readable contradiction.
 */
export function detectLifecycleStageTruthContradiction(
  snapshot: LifecycleStageTruthSnapshot,
): string | null {
  const published =
    snapshot.hasPublishedArtifact === true ||
    snapshot.authorReportsAlreadyPublished === true ||
    snapshot.presentationStatus === "published" ||
    snapshot.navState === "published" ||
    snapshot.navState === "completed";

  const notStarted =
    snapshot.presentationStatus === "not_started" || snapshot.navState === "not_started";

  const unavailable =
    snapshot.presentationStatus === "unavailable" ||
    snapshot.navState === "unavailable" ||
    snapshot.optionalLookupUnavailable === true;

  if (published && notStarted) {
    return `${snapshot.stageId}: cannot be published/completed and not_started simultaneously`;
  }

  if (published && unavailable) {
    return `${snapshot.stageId}: cannot be published/completed and unavailable simultaneously (unavailable is infrastructure-only)`;
  }

  if (snapshot.navState === "in_progress" && unavailable && published) {
    return `${snapshot.stageId}: cannot be in_progress, published, and unavailable simultaneously`;
  }

  if (snapshot.authorReportsAlreadyPublished && notStarted) {
    return `${snapshot.stageId}: author "already published" cannot coexist with public not_started`;
  }

  return null;
}

export function assertLifecycleStageTruthConsistent(snapshot: LifecycleStageTruthSnapshot): void {
  const contradiction = detectLifecycleStageTruthContradiction(snapshot);
  if (contradiction) {
    throw new LifecyclePresentationContradictionError(contradiction);
  }
}
