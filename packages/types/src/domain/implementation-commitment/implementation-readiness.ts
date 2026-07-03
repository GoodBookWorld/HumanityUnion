import type { ReadinessThresholdId } from "./identifiers.js";

/** Derived evaluation of whether Community Capacity satisfies Frozen Policy. */
export interface ImplementationReadiness {
  readinessReached: boolean;
  readinessScore?: number;
  satisfiedThresholds: ReadinessThresholdId[];
  unsatisfiedThresholds: ReadinessThresholdId[];
  derivedAt: string;
  explanation: string;
}
