/**
 * Initiative Lifecycle Finalization Phase 04 — Lazy stage initialization.
 *
 * Preferred next-stage model (Phase 02): LAZY.
 * - Opening an AVAILABLE applicable stage may create an empty working draft.
 * - Absence of a pre-created next-stage artifact is NOT_CREATED_YET, not failure.
 * - Initialization must be idempotent, must not publish, and must not advance
 *   lifecycle progression.
 */

export type LazyStageAbsenceClassification = "NOT_CREATED_YET" | "INFRASTRUCTURE_FAILURE";

/**
 * Idempotent get-or-create for a working draft/workspace artifact.
 * Callers own domain validation (stewardship, applicability, publish guards).
 */
export function ensureLazyWorkingArtifact<T>(input: {
  readonly getExisting: () => T | null | undefined;
  readonly create: () => T;
}): T {
  const existing = input.getExisting();
  if (existing != null) {
    return existing;
  }

  return input.create();
}

/**
 * Async variant for stores whose lookups are Promise-based.
 */
export async function ensureLazyWorkingArtifactAsync<T>(input: {
  readonly getExisting: () => Promise<T | null | undefined>;
  readonly create: () => Promise<T>;
}): Promise<T> {
  const existing = await input.getExisting();
  if (existing != null) {
    return existing;
  }

  return input.create();
}
