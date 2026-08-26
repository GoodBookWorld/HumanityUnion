/**
 * Pack 20C — client-side category order helpers (mirrors API semantics).
 */

export function moveCategoryIdInOrder(
  orderedCategoryIds: readonly string[],
  categoryId: string,
  direction: "up" | "down",
): string[] {
  const next = [...orderedCategoryIds];
  const index = next.indexOf(categoryId);
  if (index < 0) {
    return next;
  }
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= next.length) {
    return next;
  }
  const [removed] = next.splice(index, 1);
  next.splice(target, 0, removed!);
  return next;
}

export function moveCategoryIndexInOrder(
  orderedCategoryIds: readonly string[],
  fromIndex: number,
  toIndex: number,
): string[] {
  const next = [...orderedCategoryIds];
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= next.length ||
    toIndex >= next.length ||
    fromIndex === toIndex
  ) {
    return next;
  }
  const [removed] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, removed!);
  return next;
}
