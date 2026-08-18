import type { InitiativeLifecycleProfile } from "@hu/types";

/**
 * Step 03 — Collective Decision Sources empty gate.
 * Decision Session is SOURCE_OPTIONAL for all profiles. Empty only when the
 * Initiative itself is missing.
 */
export function resolveCollectiveDecisionSourceEmptyState(input: {
  hasInitiative: boolean;
  decisionSessionAvailable: boolean;
  lifecycleProfile?: InitiativeLifecycleProfile | string | null;
}): { requireDecisionSession: boolean; isEmpty: boolean } {
  void input.decisionSessionAvailable;
  void input.lifecycleProfile;
  return {
    requireDecisionSession: false,
    isEmpty: !input.hasInitiative,
  };
}
