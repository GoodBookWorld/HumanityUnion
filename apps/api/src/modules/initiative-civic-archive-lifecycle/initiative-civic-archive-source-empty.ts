import type { InitiativeLifecycleProfile } from "@hu/types";

/**
 * Step 03 — Civic Archive Sources empty gate.
 * Public Impact is SOURCE_OPTIONAL for all profiles. Empty only when the
 * Initiative itself is missing.
 */
export function resolveCivicArchiveSourceEmptyState(input: {
  hasInitiative: boolean;
  publicImpactAvailable: boolean;
  lifecycleProfile?: InitiativeLifecycleProfile | string | null;
}): { requirePublicImpact: boolean; isEmpty: boolean } {
  void input.publicImpactAvailable;
  void input.lifecycleProfile;
  return {
    requirePublicImpact: false,
    isEmpty: !input.hasInitiative,
  };
}
