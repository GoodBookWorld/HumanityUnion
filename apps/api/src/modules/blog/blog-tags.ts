const MAX_TAG_LENGTH = 40;
const MAX_TAGS = 12;

/**
 * Normalize optional lightweight tags. Not a taxonomy.
 * Collapses whitespace, lowercases, dedupes case-insensitively.
 */
export function normalizeBlogTags(input: unknown): string[] {
  if (input === undefined || input === null) {
    return [];
  }

  if (!Array.isArray(input)) {
    throw new Error("tags must be an array of strings.");
  }

  const seen = new Set<string>();
  const tags: string[] = [];

  for (const raw of input) {
    if (typeof raw !== "string") {
      throw new Error("Each tag must be a string.");
    }

    const normalized = raw.trim().replace(/\s+/g, " ").toLowerCase();

    if (!normalized) {
      continue;
    }

    if (normalized.length > MAX_TAG_LENGTH) {
      throw new Error(`Tag exceeds ${MAX_TAG_LENGTH} characters.`);
    }

    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    tags.push(normalized);

    if (tags.length > MAX_TAGS) {
      throw new Error(`At most ${MAX_TAGS} tags are allowed.`);
    }
  }

  return tags;
}
