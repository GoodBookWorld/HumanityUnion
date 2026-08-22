/**
 * Pack 10C — presentation-only Team/Partner slot plan.
 * Placeholders are never persisted.
 */

export const AFFILIATION_MIN_PRESENTATION_SLOTS = 5;

export const AFFILIATION_TONE_COUNT = 5;

export type AffiliationPresentationSlot<T> =
  | { kind: "entry"; entry: T; toneIndex: number }
  | { kind: "placeholder"; placeholderIndex: number; toneIndex: number };

export function countAffiliationPlaceholders(realCount: number): number {
  return Math.max(0, AFFILIATION_MIN_PRESENTATION_SLOTS - Math.max(0, realCount));
}

export function buildAffiliationPresentationSlots<T>(
  entries: readonly T[],
): AffiliationPresentationSlot<T>[] {
  const placeholderCount = countAffiliationPlaceholders(entries.length);
  const slots: AffiliationPresentationSlot<T>[] = [];

  entries.forEach((entry, index) => {
    slots.push({
      kind: "entry",
      entry,
      toneIndex: index % AFFILIATION_TONE_COUNT,
    });
  });

  for (let index = 0; index < placeholderCount; index += 1) {
    slots.push({
      kind: "placeholder",
      placeholderIndex: index,
      toneIndex: (entries.length + index) % AFFILIATION_TONE_COUNT,
    });
  }

  return slots;
}
