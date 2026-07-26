/**
 * TASK-065 — Knowledge Center Foundation verification.
 * Run: npm run verify:knowledge
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");
const KNOWLEDGE_DIR = path.join(REPO_ROOT, "apps/api/src/modules/knowledge-center");

const REQUIRED_CATEGORIES = [
  "getting-started",
  "explanations",
  "institutions-experience",
  "guides",
  "constitution",
  "glossary",
  "faq",
] as const;

const REQUIRED_EXPLANATION_SLUGS = [
  "what-is-an-initiative",
  "collaborative-analysis",
  "improvement-proposal",
  "decision-session",
  "collective-decision",
  "implementation-commitment",
  "implementation-tracking",
  "public-impact",
  "public-civic-archive",
  "civic-action-package",
  "official-response",
  "civic-accountability",
  "capability02-civic-pipeline",
  "participation-areas",
  "workspace",
  "global-search",
  "notifications",
  "ai-assistant",
] as const;

const FORBIDDEN_TERMS = ["blog", "comment", "like", "rating", "news feed", "cms editor"] as const;

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function verifyModuleStructure(): void {
  console.log("1. Knowledge Center module structure");

  for (const file of [
    "knowledge-center.service.ts",
    "knowledge-center.routes.ts",
    "knowledge-center.projection.ts",
    "content/index.ts",
    "index.ts",
  ]) {
    assert(fs.existsSync(path.join(KNOWLEDGE_DIR, file)), `Missing ${file}`);
  }

  assert(
    readRepoFile("apps/api/src/app.ts").includes("knowledgeCenterRouter"),
    "App must mount knowledge router",
  );
  assert(
    readRepoFile("packages/types/src/domain/knowledge-center.ts").includes(
      "KnowledgeArticlePublic",
    ),
    "Domain must define KnowledgeArticlePublic",
  );
  assert(
    readRepoFile("docs/KNOWLEDGE_CENTER_ARCHITECTURE.md").includes("Assistant integration"),
    "Architecture doc must describe assistant integration",
  );
}

async function verifyCategoriesAndArticles(): Promise<void> {
  console.log("2. Categories and required articles");

  const { listKnowledgeCategories, getKnowledgeArticleBySlug } =
    await import("../modules/knowledge-center/knowledge-center.service.js");

  const listing = listKnowledgeCategories();
  const categoryIds = listing.categories.map((category) => category.id);

  for (const categoryId of REQUIRED_CATEGORIES) {
    assert(categoryIds.includes(categoryId), `Missing category: ${categoryId}`);
  }

  for (const slug of REQUIRED_EXPLANATION_SLUGS) {
    const article = getKnowledgeArticleBySlug(slug);
    assert(article !== null, `Missing required explanation article: ${slug}`);
    assert(article.diagramSvg.length > 0, `Article ${slug} must include diagram SVG`);
    assert(article.keyConcepts.length > 0, `Article ${slug} must include key concepts`);
    assert(article.version.length > 0, `Article ${slug} must include version`);
  }

  assert(
    listing.totalArticles >= 50,
    "Knowledge Center must include comprehensive article library",
  );
}

async function verifySearchIntegration(): Promise<void> {
  console.log("3. Global Search integration");

  const { resetGlobalSearchIndexForTests, getGlobalSearchIndex } =
    await import("../modules/global-search/global-search.index.js");
  const { searchPublicCivicRecords } =
    await import("../modules/global-search/global-search.service.js");

  resetGlobalSearchIndexForTests();
  const index = getGlobalSearchIndex();
  const knowledgeEntries = index.filter((entry) => entry.entityType === "knowledge_article");

  assert(knowledgeEntries.length > 0, "Global search index must include knowledge_article entries");

  const results = searchPublicCivicRecords({
    q: "initiative",
    entityTypes: ["knowledge_article"],
    limit: 10,
    offset: 0,
  });

  assert(
    results.results.every((result) => result.entityType === "knowledge_article"),
    "Search filter must restrict to knowledge articles",
  );
  assert(results.results.length > 0, "Knowledge search must return matches");
}

async function verifyAssistantReferences(): Promise<void> {
  console.log("4. Assistant knowledge references");

  const { resolveKnowledgeArticlesForAssistant } =
    await import("../modules/knowledge-center/knowledge-center.service.js");

  const references = resolveKnowledgeArticlesForAssistant({
    capability: "explain_decision_result",
    currentSection: "Collective Decisions",
    userPrompt: "How do decision results work?",
  });

  assert(references.length > 0, "Assistant must resolve knowledge references");
  assert(
    references.every((reference) => reference.href.startsWith("/knowledge/")),
    "Knowledge references must link to Knowledge Center",
  );

  const typesSource = readRepoFile("packages/types/src/domain/workspace-assistant.ts");
  assert(
    typesSource.includes("knowledgeReferences"),
    "Assistant response must expose knowledgeReferences",
  );
}

function verifyFrontendAndNavigation(): void {
  console.log("5. Frontend pages, sidebar, and navigation");

  assert(
    fs.existsSync(path.join(REPO_ROOT, "apps/web/src/app/knowledge/page.tsx")),
    "Knowledge listing page must exist",
  );
  assert(
    fs.existsSync(path.join(REPO_ROOT, "apps/web/src/app/knowledge/[slug]/page.tsx")),
    "Knowledge article page must exist",
  );

  const sidebarSource = readRepoFile(
    "apps/web/src/features/knowledge-center/components/KnowledgeSidebar.tsx",
  );
  const sidebarCss = readRepoFile("apps/web/src/features/knowledge-center/knowledge-center.css");
  assert(sidebarCss.includes("position: sticky"), "Sidebar must use sticky positioning");
  assert(sidebarSource.includes("knowledge-center__sidebar"), "Sidebar component must exist");

  const articleSource = readRepoFile(
    "apps/web/src/features/knowledge-center/components/KnowledgeArticlePageContent.tsx",
  );
  assert(
    articleSource.includes("Previous article"),
    "Article page must support previous navigation",
  );
  assert(articleSource.includes("Next article"), "Article page must support next navigation");
  assert(articleSource.includes("readingTimeMinutes"), "Article page must show reading time");

  const constants = readRepoFile("apps/web/src/features/public-experience/constants.ts");
  assert(
    constants.includes('href: "/knowledge"'),
    "Primary navigation must link to Knowledge Center",
  );

  const searchApi = readRepoFile("apps/web/src/features/knowledge-center/api.ts");
  assert(
    searchApi.includes("knowledge_article"),
    "Knowledge search must filter global search to knowledge articles",
  );
}

function verifyNoBlogOrForbiddenFeatures(): void {
  console.log("6. No blog or forbidden functionality");

  const files = fs
    .readdirSync(KNOWLEDGE_DIR, { recursive: true })
    .filter((file): file is string => typeof file === "string" && file.endsWith(".ts"));

  for (const file of files) {
    const source = fs.readFileSync(path.join(KNOWLEDGE_DIR, file), "utf-8").toLowerCase();

    for (const term of FORBIDDEN_TERMS) {
      assert(
        !source.includes(term),
        `Knowledge module must not reference forbidden feature: ${term} in ${file}`,
      );
    }
  }
}

function verifyPublicRoutesUnauthenticated(): void {
  console.log("7. Public routes require no auth");

  const routes = readRepoFile("apps/api/src/modules/knowledge-center/knowledge-center.routes.ts");
  assert(!routes.includes("authenticationMiddleware"), "Knowledge routes must remain public");
  assert(
    !routes.includes("requireAuthenticationMiddleware"),
    "Knowledge routes must remain public",
  );
}

async function main(): Promise<void> {
  verifyModuleStructure();
  await verifyCategoriesAndArticles();
  await verifySearchIntegration();
  await verifyAssistantReferences();
  verifyFrontendAndNavigation();
  verifyNoBlogOrForbiddenFeatures();
  verifyPublicRoutesUnauthenticated();
  console.log("verify:knowledge passed.");
}

const { runVerificationScript } = await import("./verification-script-lifecycle.js");

void runVerificationScript(main);
