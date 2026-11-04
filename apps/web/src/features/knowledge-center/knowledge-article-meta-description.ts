/**
 * SEO-BING-04 — automatic Knowledge article description from existing
 * editorial fields: the `purpose` question followed by the `overview` answer.
 * Admin SEO overrides are applied by the caller and still take priority.
 */
import type { KnowledgeArticlePublic } from "@hu/types";

export const KNOWLEDGE_ARTICLE_META_DESCRIPTION_MAX = 200;

const ELLIPSIS = "…";
const TRAILING_SEPARATORS = /[\s,;:.—–-]+$/u;

type KnowledgeArticleDescriptionSource = Pick<
  KnowledgeArticlePublic,
  "title" | "purpose" | "overview"
>;

function collapseWhitespace(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/gu, " ").trim();
}

/**
 * Whole words only, so the shared normalizer never has to hard-cut the result.
 * Returns an empty string when not even the first word fits.
 */
export function truncateAtWordBoundary(
  text: string,
  maxLength: number = KNOWLEDGE_ARTICLE_META_DESCRIPTION_MAX,
): string {
  if (text.length <= maxLength) {
    return text;
  }

  const budget = maxLength - ELLIPSIS.length;
  let kept = "";
  for (const word of text.split(" ")) {
    const next = kept ? `${kept} ${word}` : word;
    if (next.length > budget) {
      break;
    }
    kept = next;
  }

  kept = kept.replace(TRAILING_SEPARATORS, "");
  return kept ? `${kept}${ELLIPSIS}` : "";
}

export function buildKnowledgeArticleMetaDescription(
  article: KnowledgeArticleDescriptionSource,
): string {
  const purpose = collapseWhitespace(article.purpose);
  const titleFallback = `${article.title} — Knowledge on Humanity Union`;
  if (!purpose) {
    return titleFallback;
  }

  const overview = collapseWhitespace(article.overview);
  const combined = overview ? `${purpose} ${overview}` : purpose;
  return truncateAtWordBoundary(combined) || truncateAtWordBoundary(purpose) || titleFallback;
}
