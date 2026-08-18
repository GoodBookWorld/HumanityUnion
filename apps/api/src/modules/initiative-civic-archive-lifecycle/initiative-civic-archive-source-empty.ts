import type { InitiativeLifecycleProfile } from "@hu/types";
import { resolveInitiativeLifecycleProfile } from "@hu/types";

/**
 * Final Certification Fix 03 — profile-aware Archive Sources empty gate.
 * STANDARD still requires Public Impact. PUBLIC_CHOICE must not appear empty
 * solely because Public Impact is absent.
 */
export function resolveCivicArchiveSourceEmptyState(input: {
  hasInitiative: boolean;
  publicImpactAvailable: boolean;
  lifecycleProfile?: InitiativeLifecycleProfile | string | null;
}): { requirePublicImpact: boolean; isEmpty: boolean } {
  const requirePublicImpact =
    resolveInitiativeLifecycleProfile(input.lifecycleProfile) !== "PUBLIC_CHOICE";
  return {
    requirePublicImpact,
    isEmpty: !input.hasInitiative || (requirePublicImpact && !input.publicImpactAvailable),
  };
}
