import { CONSTITUTION_ARTICLES } from "./articles/constitution.js";
import { EXPLANATIONS_ARTICLES } from "./articles/explanations.js";
import { FAQ_ARTICLES } from "./articles/faq.js";
import { GETTING_STARTED_ARTICLES } from "./articles/getting-started.js";
import { GLOSSARY_ARTICLES } from "./articles/glossary.js";
import { GUIDES_ARTICLES } from "./articles/guides.js";
import { INSTITUTIONS_EXPERIENCE_ARTICLES } from "./articles/institutions-experience.js";
import type { KnowledgeArticleRecord } from "./article-factory.js";

export const ALL_KNOWLEDGE_ARTICLES: readonly KnowledgeArticleRecord[] = [
  ...GETTING_STARTED_ARTICLES,
  ...EXPLANATIONS_ARTICLES,
  ...INSTITUTIONS_EXPERIENCE_ARTICLES,
  ...GUIDES_ARTICLES,
  ...CONSTITUTION_ARTICLES,
  ...GLOSSARY_ARTICLES,
  ...FAQ_ARTICLES,
];
