/** A stored generation. Missing, zero, and fractional values are not a generation. */
export function assignedLinkRevision(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    return null;
  }

  return value;
}

export function revisionForNewLink(): number {
  return 1;
}

/** Duplicate redeem keeps the current generation. A legacy row is assigned 1 once. */
export function revisionForDuplicateRedeem(current: number | null | undefined): number {
  return assignedLinkRevision(current) ?? 1;
}

/**
 * Reconnect starts a new generation. A legacy row already had one confirmation,
 * so the first explicit reconnect is generation 2 and does not restart at 1.
 */
export function revisionForReconnect(current: number | null | undefined): number {
  const assigned = assignedLinkRevision(current);
  return assigned === null ? 2 : assigned + 1;
}

/** Generation 1 is the only request that can match a row that has never been assigned. */
export function linkRevisionMatches(
  current: number | null | undefined,
  expected: number,
): boolean {
  const assigned = assignedLinkRevision(current);
  if (expected === 1 && assigned === null) {
    return true;
  }

  return assigned === expected;
}
