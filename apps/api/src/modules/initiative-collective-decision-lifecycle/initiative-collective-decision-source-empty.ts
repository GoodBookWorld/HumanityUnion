import type { InitiativeLifecycleProfile } from "@hu/types";
import { resolveInitiativeLifecycleProfile } from "@hu/types";

/**
 * Final Certification Fix 03 — profile-aware Collective Decision Sources empty gate.
 * STANDARD still requires Decision Session. PUBLIC_CHOICE must not appear empty
 * solely because Decision Session is absent.
 */
export function resolveCollectiveDecisionSourceEmptyState(input: {
  hasInitiative: boolean;
  decisionSessionAvailable: boolean;
  lifecycleProfile?: InitiativeLifecycleProfile | string | null;
}): { requireDecisionSession: boolean; isEmpty: boolean } {
  const requireDecisionSession =
    resolveInitiativeLifecycleProfile(input.lifecycleProfile) !== "PUBLIC_CHOICE";
  return {
    requireDecisionSession,
    isEmpty: !input.hasInitiative || (requireDecisionSession && !input.decisionSessionAvailable),
  };
}
