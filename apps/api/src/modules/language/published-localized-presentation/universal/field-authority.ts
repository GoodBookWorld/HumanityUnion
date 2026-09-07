/**
 * RESET 05D.3 — path-aware field ownership resolution.
 *
 * One resolver for collect / provider / validate / integrity / diagnostic.
 * Supports exact keys and `[*]` array wildcards. Technical `.id` leaves never
 * inherit MACHINE_CONTENT from a parent AUTO object.
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

/** Structural entity-local ids — never MACHINE prose. */
export function isTechnicalIdentityPath(path: string): boolean {
  return path === "id" || path.endsWith(".id");
}

/**
 * Match score: higher = more specific. null = no match.
 * Exact key → 1000 + length. Wildcard `[*]` → 100 + literal length.
 * Parent prefix inheritance (non-wildcard policy key) → 10 + key length.
 */
function matchPolicyPatternScore(pattern: string, path: string): number | null {
  if (pattern === path) {
    return 1000 + pattern.length;
  }

  if (pattern.includes("[*]")) {
    let escaped = "";
    for (let i = 0; i < pattern.length; ) {
      if (pattern.startsWith("[*]", i)) {
        escaped += "\\[\\d+\\]";
        i += 3;
        continue;
      }
      const ch = pattern[i]!;
      escaped += /[.+?^${}()|[\]\\]/.test(ch) ? `\\${ch}` : ch;
      i += 1;
    }
    if (new RegExp(`^${escaped}$`).test(path)) {
      return 100 + pattern.replace(/\[\*\]/g, "").length;
    }
    return null;
  }

  // Prefix inheritance: policy root `faq` covers `faq[0].question`.
  if (path.startsWith(`${pattern}.`) || path.startsWith(`${pattern}[`)) {
    return 10 + pattern.length;
  }

  return null;
}

/**
 * Resolve ownership for one collected semantic path.
 * Explicit / wildcard matches beat parent-root inheritance.
 * Unmatched `.id` → NON_LOCALIZABLE_DATA; other unmatched → NON_LOCALIZABLE_DATA.
 */
export function resolveCollectedPathOwnership(
  path: string,
  fieldPolicy: PlpFieldPolicyMap | null | undefined,
): PlpFieldOwnershipClass {
  const policy = fieldPolicy ?? {};
  let best: { ownership: PlpFieldOwnershipClass; score: number } | null = null;

  // Fail-closed when no policy is registered: non-id string leaves require MACHINE.
  if (Object.keys(policy).length === 0) {
    return isTechnicalIdentityPath(path)
      ? "NON_LOCALIZABLE_DATA"
      : "MACHINE_CONTENT";
  }

  for (const [pattern, ownership] of Object.entries(policy)) {
    const score = matchPolicyPatternScore(pattern, path);
    if (score === null) {
      continue;
    }
    if (!best || score > best.score) {
      best = { ownership, score };
    }
  }

  if (best) {
    // Technical ids never become MACHINE merely by nesting under an AUTO root.
    if (
      isTechnicalIdentityPath(path) &&
      plpFieldMayEnterMachineLayer(best.ownership) &&
      best.score < 100
    ) {
      return "NON_LOCALIZABLE_DATA";
    }
    return best.ownership;
  }

  if (isTechnicalIdentityPath(path)) {
    return "NON_LOCALIZABLE_DATA";
  }

  return "NON_LOCALIZABLE_DATA";
}

export function isCollectedPathMachineEligible(
  path: string,
  fieldPolicy: PlpFieldPolicyMap,
): boolean {
  return plpFieldMayEnterMachineLayer(
    resolveCollectedPathOwnership(path, fieldPolicy),
  );
}

export function isCollectedPathLocalizationRequired(
  path: string,
  fieldPolicy: PlpFieldPolicyMap,
): boolean {
  return isCollectedPathMachineEligible(path, fieldPolicy);
}

export function machineMayOverwriteExisting(
  existing: PublishedLocalizationProvenanceSource,
): boolean {
  return provenanceRank("MACHINE") <= provenanceRank(existing);
}

export function assertFieldAuthorityOrderDocumented(): readonly PlpFieldOwnershipClass[] {
  return PLP_FIELD_AUTHORITY_ORDER;
}

export type EditorialPathAuthorityInventory = {
  readonly TOTAL_SEMANTIC_LEAVES: number;
  readonly MACHINE_CONTENT_PATHS: readonly string[];
  readonly BRAND_TOKEN_PATHS: readonly string[];
  readonly PROTECTED_PATHS: readonly string[];
  readonly OTHER_AUTHORITY_PATHS: readonly string[];
};

export function inventoryPresentationPathAuthority(input: {
  readonly leaves: ReadonlyArray<{ readonly path: string; readonly value: string }>;
  readonly fieldPolicy: PlpFieldPolicyMap;
  readonly brandToken?: string;
}): EditorialPathAuthorityInventory {
  const brandToken = input.brandToken ?? "{siteName}";
  const machine: string[] = [];
  const brand: string[] = [];
  const protectedPaths: string[] = [];
  const other: string[] = [];

  for (const leaf of input.leaves) {
    const ownership = resolveCollectedPathOwnership(leaf.path, input.fieldPolicy);
    if (leaf.value.includes(brandToken)) {
      brand.push(leaf.path);
    }
    if (ownership === "MACHINE_CONTENT") {
      machine.push(leaf.path);
    } else if (
      ownership === "PROTECTED_CANONICAL" ||
      ownership === "NON_LOCALIZABLE_DATA"
    ) {
      protectedPaths.push(leaf.path);
    } else {
      other.push(leaf.path);
    }
  }

  return {
    TOTAL_SEMANTIC_LEAVES: input.leaves.length,
    MACHINE_CONTENT_PATHS: machine,
    BRAND_TOKEN_PATHS: brand,
    PROTECTED_PATHS: protectedPaths,
    OTHER_AUTHORITY_PATHS: other,
  };
}
