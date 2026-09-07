/**
 * RESET 04 — field authority helpers (ownership ↔ provenance).
 */

import type {
  PlpFieldOwnershipClass,
  PlpFieldPolicyMap,
  PublishedLocalizationProvenanceSource,
} from "@hu/types";
import {
  PLP_FIELD_AUTHORITY_ORDER,
  PLP_OWNERSHIP_TO_PROVENANCE,
  plpFieldMayEnterMachineLayer,
} from "@hu/types";

import { provenanceRank } from "../provenance-priority.js";

export function ownershipToProvenance(
  ownership: PlpFieldOwnershipClass,
): PublishedLocalizationProvenanceSource {
  return PLP_OWNERSHIP_TO_PROVENANCE[ownership];
}

export function machineEligiblePaths(
  fieldPolicy: PlpFieldPolicyMap,
): readonly string[] {
  return Object.entries(fieldPolicy)
    .filter(([, ownership]) => plpFieldMayEnterMachineLayer(ownership))
    .map(([path]) => path);
}

/**
 * RESET 05D.2 — collected nested paths (e.g. `faq[0].question`) inherit MACHINE
 * eligibility from parent policy roots (`faq`). Structural `.id` leaves stay out.
 */
export function isCollectedPathMachineEligible(
  path: string,
  fieldPolicy: PlpFieldPolicyMap,
): boolean {
  if (/\.id$/.test(path)) {
    return false;
  }
  const roots = machineEligiblePaths(fieldPolicy);
  for (const root of roots) {
    if (path === root) {
      return true;
    }
    if (path.startsWith(`${root}.`) || path.startsWith(`${root}[`)) {
      return true;
    }
  }
  return false;
}

/**
 * MACHINE may never overwrite a higher-authority existing provenance.
 * Uses the same rank table as mergeLocalizedLayersByProvenance.
 */
export function machineMayOverwriteExisting(
  existing: PublishedLocalizationProvenanceSource,
): boolean {
  return (
    provenanceRank("MACHINE") <= provenanceRank(existing)
  );
}

export function assertFieldAuthorityOrderDocumented(): readonly PlpFieldOwnershipClass[] {
  return PLP_FIELD_AUTHORITY_ORDER;
}
