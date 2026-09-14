/**
 * Pack 08I.11 — normalize lifecycle stage ids for catalog lookup.
 * Does NOT mutate stored domain values.
 *
 * World card projections historically Title-Case Initiative **status** into
 * `currentStageLabel` — callers must not treat that as a lifecycle stage id.
 * This helper is for real stage ids / English stage labels only.
 */

import { PUBLIC_INITIATIVE_EXPERIENCE_STAGES } from "@hu/types";

const STAGE_CODE_SET = new Set(
  PUBLIC_INITIATIVE_EXPERIENCE_STAGES.map((stage) => stage.stageId),
);

const ENGLISH_STAGE_LABEL_TO_ID: Record<string, string> = {
  initiative: "initiative",
  discussion: "discussion",
  "collaborative analysis": "analysis",
  analysis: "analysis",
  "improvement proposals": "proposal",
  proposal: "proposal",
  petition: "petition",
  "decision session": "decision_session",
  "collective decision": "collective_decision",
  "implementation commitments": "commitment",
  commitment: "commitment",
  "implementation tracking": "tracking",
  tracking: "tracking",
  "official responses": "official_response",
  "official response": "official_response",
  "public impact": "public_impact",
  "civic archive": "archive",
  archive: "archive",
};

/**
 * Normalize Title-Case / spaced / mixed stage strings to catalog stage ids.
 * Unknown values return lowercased underscored token (never a namespaced key).
 */
export function normalizeInitiativeStageCode(stageIdOrLabel: string): string {
  const trimmed = stageIdOrLabel.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (STAGE_CODE_SET.has(trimmed)) {
    return trimmed;
  }

  const lower = trimmed.toLowerCase();
  if (ENGLISH_STAGE_LABEL_TO_ID[lower]) {
    return ENGLISH_STAGE_LABEL_TO_ID[lower];
  }

  const snake = trimmed
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();

  if (STAGE_CODE_SET.has(snake)) {
    return snake;
  }

  const spaced = snake.replaceAll("_", " ");
  const fromSpaced = ENGLISH_STAGE_LABEL_TO_ID[spaced];
  if (fromSpaced) {
    return fromSpaced;
  }

  return snake;
}

export function isKnownInitiativeStageCode(code: string): boolean {
  return STAGE_CODE_SET.has(code);
}
