/**
 * SEO-BING-05 — glossary definitions share titles with their concept articles,
 * so the automatic document title adds the existing category label. H1, social
 * titles and JSON-LD keep the editorial title; Admin `seoTitle` still wins.
 */
import type { KnowledgeArticlePublic } from "@hu/types";

const GLOSSARY_CATEGORY_ID = "glossary";
const GLOSSARY_QUALIFIER = "Glossary";
const ALREADY_QUALIFIED = /(?:[—–-]\s*Glossary|\(Glossary\))$/iu;

export function buildKnowledgeArticleSeoTitle(
  article: Pick<KnowledgeArticlePublic, "title" | "categoryId">,
): string {
  if (article.categoryId !== GLOSSARY_CATEGORY_ID) {
    return article.title;
  }

  const title = (article.title ?? "").replace(/\s+/gu, " ").trim();
  if (!title || ALREADY_QUALIFIED.test(title)) {
    return title;
  }

  return `${title} — ${GLOSSARY_QUALIFIER}`;
}
