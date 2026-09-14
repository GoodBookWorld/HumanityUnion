/**
 * RESET 05 — Initiative/Lifecycle PLP entity identities.
 * Initiative remains the sole canonical civic root.
 */

export const INITIATIVE_PLP_ENTITY_TYPE = {
  /** Public Initiative card / detail semantic presentation. */
  INITIATIVE: "initiative",
} as const;

export type InitiativePlpEntityType =
  (typeof INITIATIVE_PLP_ENTITY_TYPE)[keyof typeof INITIATIVE_PLP_ENTITY_TYPE];

export const INITIATIVE_PLP_ENTITY_TYPES: readonly InitiativePlpEntityType[] = [
  INITIATIVE_PLP_ENTITY_TYPE.INITIATIVE,
] as const;

export function initiativePlpEntityId(initiativeId: string): string {
  return initiativeId.trim();
}

export function isInitiativePlpEntityType(
  value: string,
): value is InitiativePlpEntityType {
  return (INITIATIVE_PLP_ENTITY_TYPES as readonly string[]).includes(value);
}
