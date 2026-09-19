function normalizeOwnedSourceVersion(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed === "unloaded") {
    return null;
  }
  return trimmed;
}

/**
 * Source version a warm attempt can be proven to belong to.
 * Failure metadata wins when present. Command payload is the fallback for
 * attempts recorded before metadata. Missing both means unproven — never invented.
 */
export function resolveWarmAttemptSourceVersion(input: {
  readonly failureMetadataSourceVersion?: string | null;
  readonly payloadSourceVersion?: string | null;
}): string | null {
  return (
    normalizeOwnedSourceVersion(input.failureMetadataSourceVersion) ??
    normalizeOwnedSourceVersion(input.payloadSourceVersion)
  );
}

/**
 * A failed attempt may suppress automatic retry for the current live identity
 * only when that failure is proven to belong to the same sourceVersion.
 * Legacy rows with no version, and failures of an older version, do not.
 */
export function failedAttemptSuppressesLiveSourceVersion(input: {
  readonly disposition: "pending" | "failed" | "published" | "none";
  readonly attemptSourceVersion: string | null;
  readonly liveSourceVersion: string | null;
}): boolean {
  if (input.disposition !== "failed") {
    return false;
  }
  const attempt = normalizeOwnedSourceVersion(input.attemptSourceVersion);
  const live = normalizeOwnedSourceVersion(input.liveSourceVersion);
  if (!attempt || !live) {
    return false;
  }
  return attempt === live;
}
