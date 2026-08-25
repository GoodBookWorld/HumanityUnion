/**
 * SEO Pack 01 — plain-text title / description normalization for public metadata.
 */

const DEFAULT_DESCRIPTION_MAX = 200;

export function stripHtmlToPlainText(value: string): string {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * `{Page Title} | {brandSuffix}` without duplicating an existing Humanity Union suffix.
 */
export function formatPublicPageTitle(
  pageTitle: string,
  brandSuffix: string = "Humanity Union",
): string {
  const title = stripHtmlToPlainText(pageTitle);
  const suffix = brandSuffix.trim();

  if (!title) {
    return suffix || "Humanity Union";
  }

  if (!suffix) {
    return title;
  }

  if (title === suffix || title.endsWith(` | ${suffix}`)) {
    return title;
  }

  // Prefer not to append when the title already ends with "| Humanity Union"
  // even if brandSuffix is a longer intentional variant (e.g. Blog | …).
  if (/\|\s*Humanity Union\s*$/i.test(title) && /Humanity Union/i.test(suffix)) {
    return title;
  }

  return `${title} | ${suffix}`;
}

export function normalizeMetaDescription(
  value: string | undefined | null,
  maxLength: number = DEFAULT_DESCRIPTION_MAX,
): string | undefined {
  if (value == null) {
    return undefined;
  }

  const text = stripHtmlToPlainText(String(value));
  if (!text) {
    return undefined;
  }

  if (text.length <= maxLength) {
    return text;
  }

  const sliced = text.slice(0, maxLength).trimEnd();
  return sliced;
}
