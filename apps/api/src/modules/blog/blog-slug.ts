const MAX_SLUG_LENGTH = 80;

/**
 * Derive a URL-safe slug from a title. Collision suffixes are applied by the service.
 */
export function slugifyBlogTitle(title: string): string {
  const normalized = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");

  return normalized || "post";
}

export function withSlugCollisionSuffix(baseSlug: string, attempt: number): string {
  if (attempt <= 0) {
    return baseSlug;
  }

  const suffix = `-${attempt + 1}`;
  const truncated = baseSlug.slice(0, Math.max(1, MAX_SLUG_LENGTH - suffix.length));
  return `${truncated.replace(/-+$/g, "")}${suffix}`;
}
