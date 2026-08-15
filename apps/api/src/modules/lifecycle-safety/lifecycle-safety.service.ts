import type {
  LifecycleSafetyDecision,
  LifecycleSafetyEvaluationInput,
  LifecycleSafetySurfaceId,
} from "@hu/types";
import { LIFECYCLE_SAFETY_PROTECTED_SURFACES } from "@hu/types";

import {
  LifecycleSafetyNeedsReviewError,
  LifecycleSafetyRejectedError,
} from "./lifecycle-safety.errors.js";
import {
  mapProviderSignalToOutcome,
  mayEnterLifecycleStorage,
  mayEnterStageIntelligence,
  mayNotifyOtherParticipants,
} from "./safety-policy.js";
import { resolveSafetyProvider } from "./safety-provider.js";

function assertKnownSurface(surfaceId: LifecycleSafetySurfaceId): void {
  if (!LIFECYCLE_SAFETY_PROTECTED_SURFACES.includes(surfaceId)) {
    throw new Error(`Unknown Lifecycle Safety surface: ${surfaceId}`);
  }
}

function buildSummary(
  outcome: LifecycleSafetyDecision["outcome"],
  categories: LifecycleSafetyDecision["categories"],
): string {
  if (outcome === "accepted") {
    return "Content accepted by Lifecycle Safety.";
  }

  const categoryList =
    categories.length > 0
      ? categories.map((hit) => hit.categoryId).join(", ")
      : "unspecified";

  if (outcome === "needs_review") {
    return `Content held for safety review (${categoryList}).`;
  }

  return `Content rejected by Lifecycle Safety (${categoryList}).`;
}

/**
 * Safety Architecture Pack 01 — the single central Safety Service.
 * All Lifecycle stages and future AI prompts must call this before storage
 * or Stage Intelligence. No censorship logic belongs in the UI.
 */
export async function evaluateLifecycleSafety(
  input: LifecycleSafetyEvaluationInput,
): Promise<LifecycleSafetyDecision> {
  assertKnownSurface(input.surfaceId);

  const provider = resolveSafetyProvider();
  const providerResult = await provider.evaluate({
    ...input,
    text: typeof input.text === "string" ? input.text : "",
  });

  const outcome = mapProviderSignalToOutcome(providerResult.signal);
  const categories = [...providerResult.categories];

  return {
    outcome,
    categories,
    providerId: providerResult.providerId,
    evaluatedAt: new Date().toISOString(),
    surfaceId: input.surfaceId,
    mayNotifyOtherParticipants: mayNotifyOtherParticipants(outcome),
    mayEnterLifecycleStorage: mayEnterLifecycleStorage(outcome),
    mayEnterStageIntelligence: mayEnterStageIntelligence(outcome),
    summary: buildSummary(outcome, categories),
  };
}

/**
 * Hard gate for write paths: Accepted continues; Rejected / Needs Review throw.
 * Architecture pack default — quarantine persistence for Needs Review is a
 * later pack.
 */
export async function assertLifecycleContentSafe(
  input: LifecycleSafetyEvaluationInput,
): Promise<LifecycleSafetyDecision> {
  const decision = await evaluateLifecycleSafety(input);

  if (decision.outcome === "rejected") {
    throw new LifecycleSafetyRejectedError(decision);
  }

  if (decision.outcome === "needs_review") {
    throw new LifecycleSafetyNeedsReviewError(decision);
  }

  return decision;
}

/**
 * Convenience for multi-field drafts: evaluate each non-empty field;
 * first Rejected / Needs Review wins. Empty fields are skipped.
 */
export async function assertLifecycleFieldsSafe(input: {
  readonly surfaceId: LifecycleSafetySurfaceId;
  readonly initiativeId: string | null;
  readonly actorParticipantId: string | null;
  readonly fields: ReadonlyArray<{ readonly fieldName: string; readonly text: string }>;
  readonly correlationId?: string;
}): Promise<LifecycleSafetyDecision[]> {
  const decisions: LifecycleSafetyDecision[] = [];

  for (const field of input.fields) {
    if (!field.text.trim()) {
      continue;
    }

    const decision = await assertLifecycleContentSafe({
      surfaceId: input.surfaceId,
      initiativeId: input.initiativeId,
      actorParticipantId: input.actorParticipantId,
      text: field.text,
      fieldName: field.fieldName,
      correlationId: input.correlationId,
    });
    decisions.push(decision);
  }

  return decisions;
}

/** Part 6 — AI prompts use the same pipeline with surface `ai_prompt`. */
export async function assertAiPromptSafe(input: {
  readonly initiativeId: string | null;
  readonly actorParticipantId: string | null;
  readonly prompt: string;
  readonly correlationId?: string;
}): Promise<LifecycleSafetyDecision> {
  return assertLifecycleContentSafe({
    surfaceId: "ai_prompt",
    initiativeId: input.initiativeId,
    actorParticipantId: input.actorParticipantId,
    text: input.prompt,
    fieldName: "prompt",
    correlationId: input.correlationId,
  });
}
