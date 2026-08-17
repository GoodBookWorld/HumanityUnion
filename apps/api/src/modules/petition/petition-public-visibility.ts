/**
 * Shared Petition public-visibility rule.
 * Author workspace and public projection must use the same truth.
 *
 * Draft / Ready are Author-side preparation — not public lifecycle publication.
 */

import type { PetitionState } from "@hu/types";

export function isPetitionPubliclyVisible(status: PetitionState): boolean {
  return status !== "Draft" && status !== "Ready";
}
