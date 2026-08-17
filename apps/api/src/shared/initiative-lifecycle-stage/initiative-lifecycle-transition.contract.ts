/**
 * Initiative Lifecycle Finalization Phase 02 — Unified Transition Contract.
 *
 * One Initiative-rooted, profile-aware transition semantics for every stage
 * publish/completion. This is documentation + helpers for callers that already
 * own domain-specific persist/emit steps. It is NOT a second transition engine.
 *
 * Preferred next-stage model: **LAZY**
 * - After successful publication, the derived Lifecycle State Resolver marks the
 *   next applicable stage CURRENT / AVAILABLE.
 * - Opening the next stage initializes/loads its empty working state (idempotent).
 * - Absence of a pre-created next-stage artifact is NOT a failure.
 * - Progression is evidenced by durable published artifacts (survives restart).
 * - Do not also eager-create next-stage aggregates in the same transition.
 *
 * Conceptual sequence after a successful stage transition:
 * 1. validate current canonical lifecycle state
 * 2. validate stage prerequisites (domain-owned)
 * 3. persist stage publication/completion (domain-owned, production-durable)
 * 4. establish resulting derived lifecycle state (artifact counts + profile)
 * 5. make the next *applicable* stage available for the Initiative's profile
 * 6. emit/preserve the canonical lifecycle publication signal
 * 7. update projections
 * 8. enqueue notification work (Phase 06 consumers)
 */

import type {
  InitiativeLifecycleProfile,
  InitiativeLifecycleStageId,
  InitiativeLifecycleStateSnapshot,
} from "@hu/types";
import {
  getNextApplicableLifecycleStageId,
  resolveInitiativeLifecycleState,
} from "@hu/types";

export interface LifecycleTransitionPostconditionInput {
  readonly publishedStageId: InitiativeLifecycleStageId;
  readonly lifecycleProfile?: InitiativeLifecycleProfile | string | null;
  /**
   * Next stage the caller believes is now available after publish.
   * Must equal {@link resolveNextStageAfterPublish} for the same inputs.
   */
  readonly nextStageId: InitiativeLifecycleStageId | null;
}

/**
 * Profile-aware next stage after a successful publish of `publishedStageId`.
 * Skips stages that are not on the Initiative's LifecycleProfile route.
 */
export function resolveNextStageAfterPublish(
  publishedStageId: InitiativeLifecycleStageId,
  lifecycleProfile?: InitiativeLifecycleProfile | string | null,
): InitiativeLifecycleStageId | null {
  return getNextApplicableLifecycleStageId(publishedStageId, lifecycleProfile);
}

/**
 * Deterministic resolver postcondition after a stage publication/completion.
 * Merges the newly published stage into prior published counts and returns the
 * canonical derived lifecycle state — the acceptance criterion for Phase 02.
 */
export function resolveLifecycleStateAfterStagePublication(input: {
  readonly lifecycleProfile?: InitiativeLifecycleProfile | string | null;
  readonly publishedStageId: InitiativeLifecycleStageId;
  readonly priorPublishedStageCounts:
    | ReadonlyMap<string, number>
    | Readonly<Record<string, number>>;
}): InitiativeLifecycleStateSnapshot {
  const counts = new Map<string, number>();

  if (input.priorPublishedStageCounts instanceof Map) {
    for (const [stageId, count] of input.priorPublishedStageCounts.entries()) {
      counts.set(stageId, count);
    }
  } else {
    for (const [stageId, count] of Object.entries(input.priorPublishedStageCounts)) {
      counts.set(stageId, count);
    }
  }

  const previous = counts.get(input.publishedStageId) ?? 0;
  counts.set(input.publishedStageId, Math.max(previous, 1));

  return resolveInitiativeLifecycleState({
    lifecycleProfile: input.lifecycleProfile,
    publishedStageCounts: counts,
  });
}

/**
 * Asserts the unified transition postcondition against the canonical resolver.
 */
export function assertLifecycleTransitionPostcondition(
  input: LifecycleTransitionPostconditionInput & {
    readonly priorPublishedStageCounts?:
      | ReadonlyMap<string, number>
      | Readonly<Record<string, number>>;
  },
): InitiativeLifecycleStateSnapshot {
  const expectedNext = resolveNextStageAfterPublish(
    input.publishedStageId,
    input.lifecycleProfile,
  );

  if (input.nextStageId !== expectedNext) {
    throw new Error(
      `Lifecycle transition postcondition failed for stage "${input.publishedStageId}": expected next stage ${
        expectedNext === null ? "null" : `"${expectedNext}"`
      }, got ${input.nextStageId === null ? "null" : `"${input.nextStageId}"`}.`,
    );
  }

  const prior = input.priorPublishedStageCounts ?? {};
  const state = resolveLifecycleStateAfterStagePublication({
    lifecycleProfile: input.lifecycleProfile,
    publishedStageId: input.publishedStageId,
    priorPublishedStageCounts: prior,
  });

  if (state.currentStageId !== (expectedNext ?? input.publishedStageId)) {
    // When publishing the final stage, current remains that stage.
    if (expectedNext !== null || state.currentStageId !== input.publishedStageId) {
      if (expectedNext !== null && state.currentStageId !== expectedNext) {
        throw new Error(
          `Lifecycle resolver postcondition failed: after publishing "${input.publishedStageId}", expected currentStage "${expectedNext}", got "${state.currentStageId}".`,
        );
      }
    }
  }

  if (expectedNext !== null) {
    if (!state.availableStageIds.includes(expectedNext)) {
      throw new Error(
        `Lifecycle resolver postcondition failed: next stage "${expectedNext}" is not AVAILABLE after publishing "${input.publishedStageId}".`,
      );
    }
    if (!state.completedStageIds.includes(input.publishedStageId)) {
      throw new Error(
        `Lifecycle resolver postcondition failed: published stage "${input.publishedStageId}" is not COMPLETED.`,
      );
    }
  }

  return state;
}

/** Observability helper for logs/tests — not a second engine. */
export function summarizeLifecycleTransitionPostcondition(input: {
  readonly initiativeId: string;
  readonly publishedStageId: InitiativeLifecycleStageId;
  readonly lifecycleProfile?: InitiativeLifecycleProfile | string | null;
  readonly priorPublishedStageCounts?:
    | ReadonlyMap<string, number>
    | Readonly<Record<string, number>>;
}): {
  readonly initiativeId: string;
  readonly publishedStageId: InitiativeLifecycleStageId;
  readonly nextStageId: InitiativeLifecycleStageId | null;
  readonly currentStageId: InitiativeLifecycleStageId;
  readonly message: string;
} {
  const state = resolveLifecycleStateAfterStagePublication({
    lifecycleProfile: input.lifecycleProfile,
    publishedStageId: input.publishedStageId,
    priorPublishedStageCounts: input.priorPublishedStageCounts ?? {},
  });
  const nextStageId = resolveNextStageAfterPublish(
    input.publishedStageId,
    input.lifecycleProfile,
  );

  return {
    initiativeId: input.initiativeId,
    publishedStageId: input.publishedStageId,
    nextStageId,
    currentStageId: state.currentStageId,
    message:
      nextStageId === null
        ? `Published ${input.publishedStageId}; profile route complete (current=${state.currentStageId}).`
        : `Published ${input.publishedStageId}; resolver current=${state.currentStageId}; next applicable=${nextStageId}.`,
  };
}

export const LIFECYCLE_NEXT_STAGE_CREATION_STRATEGY = "LAZY" as const;
