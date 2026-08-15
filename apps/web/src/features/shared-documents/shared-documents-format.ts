/**
 * Communication UX Pack 03.7 Part 6/11 — shared formatting helpers for
 * every Shared Documents surface (Direct Messages, Collaboration Channel,
 * Collaboration Sessions), mirroring the exact
 * `formatDirectMessageTimestamp` convention already used across the
 * Communication packs.
 */
export function formatSharedDocumentTimestamp(isoDate: string): string {
  return new Date(isoDate).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const SIZE_UNITS = ["B", "KB", "MB", "GB"] as const;

/** Part 11 — "File size" column; matches the 20 MB ceiling's own precision (one decimal above KB). */
export function formatSharedDocumentSize(bytes: number): string {
  if (bytes <= 0) {
    return "0 B";
  }

  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < SIZE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const rounded = unitIndex === 0 ? Math.round(value).toString() : value.toFixed(1);
  return `${rounded} ${SIZE_UNITS[unitIndex]}`;
}

/** Part 6/14 — a short, readable type label for the file icon glyph; never relies on color alone. */
export function sharedDocumentTypeLabel(extension: string): string {
  const normalized = extension.replace(/^\./, "").toUpperCase();
  return normalized.length > 4 ? normalized.slice(0, 4) : normalized;
}
