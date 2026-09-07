/**
 * RESET 04 — Universal PLP field ownership classes.
 *
 * Domain adapters map semantic paths → ownership. The publication resolver
 * composes authorities; it does not global-replace strings.
 *
 * Distinct from presentation wrappers and from Pack 08I LocalizationOwnershipClass
 * (legacy CT). Prefer this contract for new PLP adapters.
 */

/** First-class ownership for localizable published entity fields. */
export type PlpFieldOwnershipClass =
  | "MACHINE_CONTENT"
  | "MANUAL_OR_AUTHOR_APPROVED"
  | "CONTROLLED_VOCABULARY"
  | "BRAND"
  | "LEGAL"
  | "PROTECTED_CANONICAL"
  | "UI_DICTIONARY"
  | "NON_LOCALIZABLE_DATA";

export const PLP_FIELD_OWNERSHIP_CLASSES = [
  "PROTECTED_CANONICAL",
  "LEGAL",
  "BRAND",
  "MANUAL_OR_AUTHOR_APPROVED",
  "CONTROLLED_VOCABULARY",
  "UI_DICTIONARY",
  "MACHINE_CONTENT",
  "NON_LOCALIZABLE_DATA",
] as const satisfies readonly PlpFieldOwnershipClass[];

/**
 * Whether a field may be stored as AUTO machine content inside a PLP snapshot.
 * CONTROLLED_VOCABULARY / UI_DICTIONARY / BRAND / LEGAL typically resolve from
 * their authoritative systems at read/compose time when not embedded.
 */
export function plpFieldMayEnterMachineLayer(
  ownership: PlpFieldOwnershipClass,
): boolean {
  return ownership === "MACHINE_CONTENT";
}

export function isPlpFieldOwnershipClass(
  value: string,
): value is PlpFieldOwnershipClass {
  return (PLP_FIELD_OWNERSHIP_CLASSES as readonly string[]).includes(value);
}
