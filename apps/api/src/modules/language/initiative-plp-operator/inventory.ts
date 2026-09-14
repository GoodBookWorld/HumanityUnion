/**
 * RESET 05B — semantic node inventory for Initiative PLP operator reports.
 */

import type { PublicPresentationNode } from "@hu/types";
import { INITIATIVE_CARD_FIELD_OWNERSHIP, isPublicProtectedValue } from "@hu/types";

import { collectAutoPaths } from "../published-localized-presentation/presentation-paths.js";

export type InitiativePlpSemanticNodeInventoryRow = {
  readonly path: string;
  readonly ownership: string;
  readonly machineEligible: boolean;
  readonly valuePreview: string | null;
};

export function inventoryInitiativePlpSemanticNodes(
  presentation: PublicPresentationNode | null,
): readonly InitiativePlpSemanticNodeInventoryRow[] {
  const rows: InitiativePlpSemanticNodeInventoryRow[] = [];
  for (const [path, ownership] of Object.entries(INITIATIVE_CARD_FIELD_OWNERSHIP)) {
    let valuePreview: string | null = null;
    if (presentation && typeof presentation === "object" && !Array.isArray(presentation)) {
      const raw = (presentation as Record<string, unknown>)[path];
      if (typeof raw === "string") {
        valuePreview = raw.slice(0, 80);
      } else if (isPublicProtectedValue(raw)) {
        valuePreview = String(raw.value).slice(0, 80);
      } else if (raw === null || raw === undefined) {
        valuePreview = null;
      }
    }
    rows.push({
      path,
      ownership,
      machineEligible: ownership === "MACHINE_CONTENT",
      valuePreview,
    });
  }

  // Ensure auto machine leaves are represented even if policy key missing.
  if (presentation) {
    for (const node of collectAutoPaths(presentation)) {
      if (!rows.some((row) => row.path === node.path)) {
        rows.push({
          path: node.path,
          ownership: "MACHINE_CONTENT",
          machineEligible: true,
          valuePreview: node.value.slice(0, 80),
        });
      }
    }
  }

  return rows;
}

/** Machine AUTO paths must never include geography or lifecycle vocabulary. */
export function assertInitiativeMachineNodesExcludeNonMachine(
  autoPaths: readonly { readonly path: string }[],
): { readonly ok: boolean; readonly offenders: readonly string[] } {
  const forbidden = [
    "geographyLabel",
    "countryCode",
    "regionCode",
    "communitySlug",
    "activityArea",
    "publicStatus",
    "currentStageLabel",
    "lifecycleStage",
  ];
  const offenders = autoPaths
    .map((n) => n.path)
    .filter((path) => forbidden.includes(path) || path.startsWith("geography"));
  return { ok: offenders.length === 0, offenders };
}
