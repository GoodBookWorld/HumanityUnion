/**
 * Daily News-to-Initiative MVP verification.
 * Run: npm run verify:daily-news-initiative
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  calculateExpiresAt,
  normalizeExternalNewsArticle,
} from "../modules/public-news/public-news.normalize.js";
import { filterExternalNewsArticles } from "../modules/public-news/public-news.filter.js";
import {
  cleanupExpiredPublicNews,
  listPublicNewsArticles,
  parsePublicNewsQuery,
  refreshPublicNews,
} from "../modules/public-news/public-news.service.js";
import {
  findActivePublicNewsRecords,
  resetPublicNewsMemoryStoreForTests,
  upsertPublicNewsRecords,
} from "../modules/public-news/public-news.repository.js";
import { MockNewsProvider } from "../modules/public-news/providers/mock-news.provider.js";
import { createInitiativeDraft } from "../modules/initiatives/initiative.service.js";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

async function verifyNormalizationAndValidation(): Promise<void> {
  console.log("1. Provider normalization and invalid article rejection");

  const normalized = normalizeExternalNewsArticle(
    {
      provider: "mock",
      sourceName: "BBC News",
      sourceDomain: "bbc.co.uk",
      title: "  Civic forum convenes  ",
      summary: "<p>Short summary text.</p>",
      articleUrl: "https://www.bbc.co.uk/news/example",
      publishedAt: new Date().toISOString(),
      language: "en",
    },
    7,
  );

  assert(normalized.title === "Civic forum convenes", "Title must be trimmed.");
  assert(!normalized.summary.includes("<"), "Summary must not contain HTML.");
  assert(normalized.normalizedArticleUrl.includes("bbc.co.uk"), "URL must normalize.");

  let rejected = false;

  try {
    normalizeExternalNewsArticle(
      {
        provider: "mock",
        sourceName: "BBC News",
        title: "Missing URL",
        articleUrl: "ftp://example.com/article",
        publishedAt: new Date().toISOString(),
        language: "en",
      },
      7,
    );
  } catch {
    rejected = true;
  }

  assert(rejected, "Invalid article URL must be rejected.");
}

async function verifyDuplicateAndExpiration(): Promise<void> {
  console.log("2. Duplicate prevention and seven-day expiration");

  process.env.PUBLIC_NEWS_PERSISTENCE = "memory";
  resetPublicNewsMemoryStoreForTests();

  const fetchedAt = new Date().toISOString();
  const record = normalizeExternalNewsArticle(
    {
      provider: "mock",
      sourceName: "BBC News",
      sourceDomain: "bbc.co.uk",
      title: "Duplicate article",
      summary: "Summary",
      articleUrl: "https://www.bbc.co.uk/news/duplicate",
      publishedAt: fetchedAt,
      language: "en",
    },
    7,
    fetchedAt,
  );

  await upsertPublicNewsRecords([record]);
  await upsertPublicNewsRecords([
    {
      ...record,
      id: "news-different-id",
      title: "Duplicate article updated",
    },
  ]);

  const active = await findActivePublicNewsRecords({ limit: 10, language: "en" });
  assert(active.length === 1, "Duplicate normalized URLs must not create second records.");

  const expiresAt = calculateExpiresAt(fetchedAt, 7);
  const expiresMs = Date.parse(expiresAt) - Date.parse(fetchedAt);
  assert(Math.round(expiresMs / (24 * 60 * 60 * 1000)) === 7, "Expiration must be 7 days.");
}

async function verifyCleanupAndPublicEndpoint(): Promise<void> {
  console.log("3. Cleanup, public endpoint ordering, and limit validation");

  process.env.PUBLIC_NEWS_PERSISTENCE = "memory";
  resetPublicNewsMemoryStoreForTests();

  const older = normalizeExternalNewsArticle(
    {
      provider: "mock",
      sourceName: "BBC News",
      sourceDomain: "bbc.co.uk",
      title: "Older article",
      summary: "Older summary",
      articleUrl: "https://www.bbc.co.uk/news/older",
      publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      language: "en",
    },
    7,
  );
  const newer = normalizeExternalNewsArticle(
    {
      provider: "mock",
      sourceName: "NPR",
      sourceDomain: "npr.org",
      title: "Newer article",
      summary: "Newer summary",
      articleUrl: "https://www.npr.org/news/newer",
      publishedAt: new Date().toISOString(),
      language: "en",
    },
    7,
  );

  await upsertPublicNewsRecords([older, newer]);

  const listing = await listPublicNewsArticles(parsePublicNewsQuery({ limit: "2", language: "en" }));
  assert(listing.items.length === 2, "Public endpoint must return active articles.");
  assert(
    Date.parse(listing.items[0]?.publishedAt ?? "") >= Date.parse(listing.items[1]?.publishedAt ?? ""),
    "Public endpoint must sort by publishedAt descending.",
  );

  const limited = parsePublicNewsQuery({ limit: "999", language: "en" });
  assert(limited.limit === 50, "Public endpoint must enforce maximum limit.");

  older.expiresAt = new Date(Date.now() - 60_000).toISOString();
  await upsertPublicNewsRecords([older]);
  const cleanup = await cleanupExpiredPublicNews();
  assert(cleanup.marked + cleanup.deleted >= 1, "Cleanup must mark or delete expired records.");
}

async function verifyProviderFallbackAndInitiativeSnapshot(): Promise<void> {
  console.log("4. Provider fallback, initiative prefill wiring, and source snapshot");

  process.env.PUBLIC_NEWS_PERSISTENCE = "memory";
  process.env.NEWS_PROVIDER_ENABLED = "true";
  process.env.NEWS_PROVIDER_NAME = "mock";
  resetPublicNewsMemoryStoreForTests();

  const articles = await new MockNewsProvider().fetchRecentArticles({ language: "en", limit: 3 });
  const filtered = filterExternalNewsArticles(articles, { retentionDays: 7 });
  assert(filtered.length >= 1, "Mock provider articles must pass filtering.");

  await upsertPublicNewsRecords(
    filtered.map((article) => normalizeExternalNewsArticle(article, 7)),
  );

  const beforeCount = (await findActivePublicNewsRecords({ limit: 10, language: "en" })).length;
  process.env.NEWS_PROVIDER_NAME = "unsupported-provider-name";
  await refreshPublicNews();
  const afterCount = (await findActivePublicNewsRecords({ limit: 10, language: "en" })).length;
  assert(beforeCount === afterCount, "Provider failure must keep cached articles.");

  const pageSource = readRepoFile(
    "apps/web/src/features/civic-media-center/components/CivicMediaCenterPageContent.tsx",
  );
  assert(pageSource.includes("PublicNewsSection"), "Media page must render live news widgets.");
  assert(
    !pageSource.includes("media.newsWidgets.map"),
    "Static example news widgets must be removed from media page.",
  );

  const initiativeSource = readRepoFile(
    "apps/web/src/features/initiatives/initiative-create-news-source.ts",
  );
  const newsApiSource = readRepoFile("apps/web/src/features/public-news/api.ts");
  assert(
    initiativeSource.includes("resolveInitiativeCreateNewsSourceId"),
    "Initiative create form must resolve news source id from query params.",
  );
  assert(
    newsApiSource.includes('source: "news"') && newsApiSource.includes("newsId"),
    "Create Initiative must route by internal news id.",
  );
  assert(
    readRepoFile("apps/web/src/features/initiatives/components/StartNewInitiativeButton.tsx").includes(
      "fetchPublicNewsArticleById",
    ),
    "Initiative create form must fetch news by id.",
  );

  const initiative = createInitiativeDraft(
    { participantId: "member-verify-news" },
    {
      title: "Initiative from news",
      description: "Context from news summary",
      activityArea: "Democracy and Governance",
      sourceReferences: [
        {
          type: "public-news",
          sourceRecordId: "news-test-1",
          sourceName: "BBC News",
          title: "Example headline",
          summary: "Example summary",
          articleUrl: "https://www.bbc.co.uk/news/example",
          publishedAt: new Date().toISOString(),
          capturedAt: new Date().toISOString(),
        },
      ],
    },
  );

  assert(
    initiative.sourceReferences?.[0]?.sourceRecordId === "news-test-1",
    "Initiative must preserve immutable news source snapshot.",
  );
}

function verifyFrontendSafetyAndLayout(): void {
  console.log("5. Image fallback, mobile layout, hydration safety, and secret exposure");

  const newsCss = readRepoFile("apps/web/src/features/public-news/public-news-discovery.css");
  assert(newsCss.includes("grid-template-columns: repeat(4"), "Desktop news grid must use four columns.");
  assert(newsCss.includes("grid-template-columns: repeat(3"), "Laptop news grid must use three columns.");
  assert(newsCss.includes("grid-template-columns: repeat(2"), "Tablet news grid must use two columns.");
  assert(newsCss.includes("grid-template-columns: 1fr"), "Mobile news grid must collapse to one column.");

  const imageSource = readRepoFile("apps/web/src/features/public-news/components/PublicNewsCardImage.tsx");
  assert(imageSource.includes("PUBLIC_NEWS_FALLBACK_IMAGE"), "News cards must use fallback image.");
  assert(imageSource.includes("onError"), "Failed images must swap to fallback.");

  const placeholderSource = readRepoFile(
    "apps/web/src/features/public-news/components/PublicNewsPlaceholder.tsx",
  );
  assert(placeholderSource.includes('role="status"'), "Loading and empty states must be announced.");
  assert(
    readRepoFile("apps/web/src/features/public-news/components/PublicNewsPlaceholder.tsx").includes(
      "No current news articles",
    ),
    "Empty state message must be present.",
  );
  assert(
    readRepoFile("apps/web/src/features/public-news/public-news-initiative-discovery.utils.ts").includes(
      "buildNewsAiSummaryBullets",
    ),
    "News initiative discovery helpers must exist.",
  );
  assert(
    readRepoFile("apps/web/src/features/public-news/components/PublicNewsRail.tsx").includes(
      "Show previous news cards",
    ),
    "News discovery must use horizontal rail navigation.",
  );

  const webBundleScan = [
    readRepoFile("apps/web/src/features/public-news/api.ts"),
    readRepoFile("apps/web/src/features/public-news/components/NewsWidgetsSection.tsx"),
    readRepoFile("apps/web/src/features/public-news/components/NewsCreateInitiativeButton.tsx"),
  ].join("\n");

  assert(!webBundleScan.includes("NEWS_PROVIDER_API_KEY"), "Frontend must not reference provider API key.");
  assert(!webBundleScan.includes("process.env"), "Frontend news feature must not read server env vars.");
}

function verifyModuleStructure(): void {
  console.log("6. Module structure and routes");

  assert(
    fs.existsSync(path.join(REPO_ROOT, "apps/api/src/modules/public-news/public-news.routes.ts")),
    "Public news routes must exist.",
  );
  assert(
    readRepoFile("apps/api/src/app.ts").includes('"/api/v1/public/news"'),
    "App must mount /api/v1/public/news.",
  );
  assert(
    readRepoFile("apps/api/src/app.ts").includes('"/api/v1/public/media/registry"'),
    "App must mount /api/v1/public/media/registry.",
  );
  assert(
    fs.existsSync(path.join(REPO_ROOT, "packages/media-registry/src/media-registry.ts")),
    "Trusted global media registry must exist.",
  );
  assert(
    readRepoFile("packages/media-registry/src/media-registry.ts").includes("BBC World"),
    "Registry must include BBC World.",
  );
  assert(
    !readRepoFile("apps/api/src/modules/public-news/public-news.rss-parser.ts").includes(
      "bbc.co.uk",
    ),
    "RSS parser must not hardcode provider domains.",
  );
  assert(
    readRepoFile("apps/api/src/modules/public-news/public-news.config.ts").includes(
      "deriveApprovedNewsSources",
    ),
    "Public news config must derive approved sources from the media registry.",
  );
  assert(
    readRepoFile("apps/api/src/infrastructure/mongodb/mongo-collections.ts").includes(
      "public_news_articles",
    ),
    "Mongo collection public_news_articles must be registered.",
  );
}

async function main(): Promise<void> {
  verifyModuleStructure();
  await verifyNormalizationAndValidation();
  await verifyDuplicateAndExpiration();
  await verifyCleanupAndPublicEndpoint();
  await verifyProviderFallbackAndInitiativeSnapshot();
  verifyFrontendSafetyAndLayout();
  console.log("verify:daily-news-initiative PASS");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
