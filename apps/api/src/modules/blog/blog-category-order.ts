/**
 * Pack 20C — pure helpers for publication category display priority.
 */

/** Stable ascending sort: sortOrder, then name, then categoryId. */
export function compareBlogCategoryOrder(
  left: { sortOrder: number; name: string; categoryId: string },
  right: { sortOrder: number; name: string; categoryId: string },
): number {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }
  const byName = left.name.localeCompare(right.name);
  if (byName !== 0) {
    return byName;
  }
  return left.categoryId.localeCompare(right.categoryId);
}

/**
 * Validate a full reorder payload against the current category id set.
 * Returns sequential sortOrder assignments (1..n) or a rejection reason.
 */
export function planBlogCategoryReorder(input: {
  existingCategoryIds: readonly string[];
  orderedCategoryIds: readonly string[];
}):
  | { ok: true; assignments: readonly { categoryId: string; sortOrder: number }[] }
  | { ok: false; reason: string } {
  const existing = [...input.existingCategoryIds];
  const ordered = [...input.orderedCategoryIds];

  if (ordered.length !== existing.length) {
    return {
      ok: false,
      reason: `orderedCategoryIds must include exactly ${existing.length} categor${existing.length === 1 ? "y" : "ies"}.`,
    };
  }

  const existingSet = new Set(existing);
  const seen = new Set<string>();
  for (const categoryId of ordered) {
    if (typeof categoryId !== "string" || !categoryId.trim()) {
      return { ok: false, reason: "orderedCategoryIds must contain non-empty category ids." };
    }
    if (!existingSet.has(categoryId)) {
      return { ok: false, reason: `Unknown category id: ${categoryId}.` };
    }
    if (seen.has(categoryId)) {
      return { ok: false, reason: `Duplicate category id: ${categoryId}.` };
    }
    seen.add(categoryId);
  }

  for (const categoryId of existing) {
    if (!seen.has(categoryId)) {
      return { ok: false, reason: `Missing category id: ${categoryId}.` };
    }
  }

  return {
    ok: true,
    assignments: ordered.map((categoryId, index) => ({
      categoryId,
      sortOrder: index + 1,
    })),
  };
}

/** Move an id up/down within an ordered list (no-op at ends). */
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

/** Drag-drop index move within an ordered list. */
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
