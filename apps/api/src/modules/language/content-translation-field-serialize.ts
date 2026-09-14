/**
 * Pack 02G Task 03 — flatten public structured text into deterministic string maps.
 */

export function joinTranslationLines(values: readonly string[] | undefined | null): string {
  if (!values || values.length === 0) {
    return "";
  }
  return values
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .join("\n");
}

/** Stable JSON for nested public text objects (sorted keys). */
export function stableJsonForTranslation(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort((a, b) => a.localeCompare(b))) {
      sorted[key] = sortKeysDeep(record[key]);
    }
    return sorted;
  }
  return value;
}
