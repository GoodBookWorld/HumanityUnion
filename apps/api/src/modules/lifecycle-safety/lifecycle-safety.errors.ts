import type { LifecycleSafetyDecision } from "@hu/types";

/**
 * Thrown when content is Rejected by the central Safety Service.
 * Callers must not persist the content, must not fan out notifications,
 * and must not pass it to Stage Intelligence.
 */
export class LifecycleSafetyRejectedError extends Error {
  readonly decision: LifecycleSafetyDecision;

  constructor(decision: LifecycleSafetyDecision) {
    super(decision.summary || "Content rejected by Lifecycle Safety.");
    this.name = "LifecycleSafetyRejectedError";
    this.decision = decision;
  }
}

/**
 * Thrown when content Needs Review and the caller requested a hard gate
 * (no quarantine path available yet in this architecture pack).
 */
export class LifecycleSafetyNeedsReviewError extends Error {
  readonly decision: LifecycleSafetyDecision;

  constructor(decision: LifecycleSafetyDecision) {
    super(decision.summary || "Content requires safety review before it can proceed.");
    this.name = "LifecycleSafetyNeedsReviewError";
    this.decision = decision;
  }
}
