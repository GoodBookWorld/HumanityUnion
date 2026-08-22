/**
 * TASK-066 — Civic Media Center Foundation verification.
 * Run: npm run verify:media-center
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  getGlobalSearchIndex,
  resetGlobalSearchIndexForTests,
} from "../modules/global-search/global-search.index.js";
import { searchPublicCivicRecords } from "../modules/global-search/global-search.service.js";
import { getCivicMediaCenter } from "../modules/civic-media-center/civic-media-center.service.js";
import { resolveCivicMediaForAssistant } from "../modules/civic-media-center/civic-media-center.service.js";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");
const MEDIA_DIR = path.join(REPO_ROOT, "apps/api/src/modules/civic-media-center");

const REQUIRED_TRUSTED_MEDIA = [
  "reuters",
  "associated-press",
  "snopes",
  "politifact",
  "bellingcat",
] as const;

const FORBIDDEN_TERMS = [
  "news feed",
  "rss aggregation",
  "cms editor",
  "reputation scoring",
  "popularity ranking",
] as const;

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function verifyModuleStructure(): void {
  console.log("1. Civic Media Center module structure");

  for (const file of [
    "civic-media-center.service.ts",
    "civic-media-center.routes.ts",
    "civic-media-center.projection.ts",
    "index.ts",
  ]) {
    assert(fs.existsSync(path.join(MEDIA_DIR, file)), `Missing ${file}`);
  }

  const routesSource = readRepoFile(
    "apps/api/src/modules/knowledge-center/knowledge-center.routes.ts",
  );
  assert(routesSource.includes('"/media"'), "Knowledge router must mount /media routes");
  assert(
    readRepoFile("packages/types/src/domain/civic-media-center.ts").includes(
      "CivicMediaCenterPublic",
    ),
    "Domain must define CivicMediaCenterPublic",
  );
  assert(
    fs.existsSync(path.join(REPO_ROOT, "docs/CIVIC_MEDIA_CENTER_ARCHITECTURE.md")),
    "Architecture documentation must exist",
  );
}

async function verifyKnowledgeIntegration(): Promise<void> {
  console.log("2. Knowledge integration");

  const center = await getCivicMediaCenter();
  assert(center.trustedMedia.length >= 10, "Trusted Media must include curated sources");
  assert(center.factChecking.length >= 5, "Fact-check section must include resources");
  assert(
    center.propagandaAnalysis.length >= 4,
    "Propaganda Analysis section must include resources",
  );
  assert(center.faq.length >= 4, "FAQ section must include items");
  assert(
    center.initiativeFlow.stages.length >= 8,
    "Initiative flow must include civic pipeline stages",
  );

  for (const id of REQUIRED_TRUSTED_MEDIA) {
    const haystack = JSON.stringify(center);
    assert(
      haystack.includes(id) ||
        center.trustedMedia.some((item) => item.id === id) ||
        center.factChecking.some((item) => item.id === id),
      `Missing expected resource: ${id}`,
    );
  }
}

function verifySidebarNavigation(): void {
  console.log("3. Route migration and navigation");

  const sidebar = readRepoFile(
    "apps/web/src/features/knowledge-center/components/KnowledgeSidebar.tsx",
  );
  const pageContent = readRepoFile(
    "apps/web/src/features/civic-media-center/components/CivicMediaCenterPageContent.tsx",
  );
  const nextConfig = readRepoFile("apps/web/next.config.ts");

  assert(sidebar.includes("CIVIC_MEDIA_ROUTE"), "Knowledge sidebar must link to Civic Media route constant");
  assert(
    readRepoFile("apps/web/src/app/media/page.tsx").includes("CivicMediaCenterPageContent"),
    "Canonical Civic Media page must exist at /media",
  );
  assert(
    nextConfig.includes('source: "/knowledge/media"') && nextConfig.includes('destination: "/media"'),
    "Legacy /knowledge/media route must permanently redirect to /media",
  );
  assert(
    !pageContent.includes("KnowledgeSidebar"),
    "Civic Media page must not render the Knowledge Center sidebar",
  );
  assert(
    pageContent.includes("HuxWorkflowSection") ||
      pageContent.includes("HuxDiscoveryShell") ||
      pageContent.includes("HuxDirectorySection") ||
      pageContent.includes("HuxEducationSection"),
    "Civic Media page must use HUX horizontal experience sections",
  );
  assert(pageContent.includes("CivicPipelineWorkflow"), "Civic Media page must render semantic workflow");
}

function verifyNewsWidgetArchitecture(): void {
  console.log("4. News widget architecture and Create Initiative integration");

  const newsModuleSource = readRepoFile("apps/api/src/modules/public-news/public-news.routes.ts");
  assert(newsModuleSource.includes('publicNewsRouter.get("/"'), "Public news list route must exist.");
  assert(
    newsModuleSource.includes('publicNewsRouter.get("/:id"'),
    "Public news detail route must exist.",
  );

  const pageSource = readRepoFile(
    "apps/web/src/features/civic-media-center/components/CivicMediaCenterPageContent.tsx",
  );
  assert(pageSource.includes("PublicNewsSection"), "Media page must render live news widgets.");

  const newsSectionSource = readRepoFile(
    "apps/web/src/features/public-news/components/PublicNewsSection.tsx",
  );
  assert(
    newsSectionSource.includes("Turn trusted news into civic action"),
    "Media page must show initiative discovery intro.",
  );

  const newsUiSource = readRepoFile("apps/web/src/features/public-news/components/PublicNewsCard.tsx");
  assert(newsUiSource.includes("Read Original"), "News widgets must include Read Original action");
  assert(
    newsUiSource.includes("Create Initiative"),
    "News widgets must include Create Initiative action",
  );
  assert(!newsUiSource.includes("Discuss"), "MVP news cards must not expose Discuss action");
  assert(!newsUiSource.includes("Bookmark"), "MVP news cards must not expose Bookmark action");
  assert(!newsUiSource.includes("Share"), "MVP news cards must not expose Share action");
  assert(
    newsUiSource.includes("PublicNewsAiSummary"),
    "News discovery cards must include AI summary block",
  );
  assert(
    newsUiSource.includes("PublicNewsRelatedInitiatives"),
    "News discovery cards must include related initiatives block",
  );
  assert(
    !newsUiSource.includes("PublicNewsSuggestedActions"),
    "MVP news cards must not expose unfinished suggested actions",
  );
  const newsApiSource = readRepoFile("apps/web/src/features/public-news/api.ts");
  assert(
    newsApiSource.includes('source: "news"') && newsApiSource.includes("newsId"),
    "Create Initiative must route by internal news id.",
  );
}

function verifyAssistantReferences(): void {
  console.log("5. Assistant references");

  const typesSource = readRepoFile("packages/types/src/domain/workspace-assistant.ts");
  assert(
    typesSource.includes("civicMediaReferences"),
    "Assistant response must expose civicMediaReferences",
  );

  const verifyRefs = resolveCivicMediaForAssistant("Where can I verify this claim?");
  assert(
    verifyRefs.length > 0,
    "Assistant must resolve Civic Media references for verification prompts",
  );
  assert(
    verifyRefs.every((ref) => ref.href.startsWith("/media")),
    "Assistant Civic Media references must link to /media",
  );

  const initiativeRefs = resolveCivicMediaForAssistant("How do I create an initiative from news?");
  assert(
    initiativeRefs.some((ref) => ref.sectionId === "initiative-flow"),
    "Assistant must reference initiative flow section",
  );
}

async function verifyGlobalSearchIntegration(): Promise<void> {
  console.log("6. Global Search integration");

  resetGlobalSearchIndexForTests();
  const index = await getGlobalSearchIndex();
  const mediaEntries = index.filter((entry) => entry.entityType === "knowledge_media");
  assert(mediaEntries.length > 0, "Global search index must include knowledge_media entries");

  const results = await searchPublicCivicRecords({
    q: "Reuters",
    entityTypes: ["knowledge_media"],
    limit: 10,
    offset: 0,
  });

  assert(results.results.length > 0, "Search for knowledge_media must return Civic Media entries");
  assert(
    results.results.every(
      (result: { entityType: string }) => result.entityType === "knowledge_media",
    ),
    "Search results must be knowledge_media entity type",
  );
}

function verifyNoForbiddenFeatures(): void {
  console.log("7. No ranking, likes, comments, or forbidden features");

  const moduleFiles = fs
    .readdirSync(MEDIA_DIR, { recursive: true })
    .filter((entry): entry is string => typeof entry === "string" && entry.endsWith(".ts"));

  for (const file of moduleFiles) {
    const source = fs.readFileSync(path.join(MEDIA_DIR, file), "utf-8").toLowerCase();

    for (const term of FORBIDDEN_TERMS) {
      assert(!source.includes(term), `${file} must not include forbidden term: ${term}`);
    }

    assert(!/\branking\s*[:=]/i.test(source), `${file} must not implement ranking`);
    assert(!source.includes("likecount"), `${file} must not implement likes`);
    assert(!source.includes("commentcount"), `${file} must not implement comments`);
  }

  const pageSource = readRepoFile(
    "apps/web/src/features/civic-media-center/components/CivicMediaCenterPageContent.tsx",
  );
  assert(pageSource.includes("No rankings"), "UI must communicate no ranking policy");
  assert(
    !pageSource.includes("dangerouslySetInnerHTML"),
    "Civic Media workflow must not render SVG diagram text",
  );
  assert(
    readRepoFile("apps/web/src/features/civic-media-center/components/CivicPipelineWorkflow.tsx").includes(
      "civic-pipeline-stage__title",
    ),
    "Workflow stage titles must be visible DOM text",
  );
}

function verifyPublicRoutes(): void {
  console.log("8. Public routes require no auth");

  const routesSource = readRepoFile(
    "apps/api/src/modules/civic-media-center/civic-media-center.routes.ts",
  );
  assert(!routesSource.includes("authenticationMiddleware"), "Media routes must remain public");
  assert(
    !routesSource.includes("requireAuthenticationMiddleware"),
    "Media routes must remain public",
  );
}

async function main(): Promise<void> {
  verifyModuleStructure();
  await verifyKnowledgeIntegration();
  verifySidebarNavigation();
  verifyNewsWidgetArchitecture();
  verifyAssistantReferences();
  await verifyGlobalSearchIntegration();
  verifyNoForbiddenFeatures();
  verifyPublicRoutes();
  console.log("verify:media-center passed.");
}

const { runVerificationScript } = await import("./verification-script-lifecycle.js");

void runVerificationScript(main);
