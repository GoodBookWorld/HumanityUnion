/**
 * Public news RSS provider diagnostics.
 * Run: npm run verify:public-news-providers
 */

import type { MediaRegistryProvider } from "@hu/types";
import { TRUSTED_GLOBAL_MEDIA_REGISTRY } from "@hu/media-registry";

import { resolvePublicNewsConfig } from "../modules/public-news/public-news.config.js";
import {
  filterExternalNewsArticles,
  validateExternalNewsArticleUrls,
} from "../modules/public-news/public-news.filter.js";
import { fetchExternalDocument, validatePublicArticleUrl } from "../modules/public-news/public-news.fetch.js";
import type { ExternalNewsArticle } from "../modules/public-news/public-news.normalize.js";
import { parseRssOrAtomFeed } from "../modules/public-news/public-news.rss-parser.js";

interface ProviderDiagnostic {
  provider: string;
  feedUrl: string;
  feedHttpStatus: string;
  parsedItems: number;
  acceptedItems: number;
  rejectedItems: number;
  sampleArticleUrl: string;
  sampleImageUrl: string;
  enabled: boolean;
  reason: string;
}

async function diagnoseProvider(provider: MediaRegistryProvider): Promise<ProviderDiagnostic> {
  const feed = provider.rssFeeds[0];
  const base: ProviderDiagnostic = {
    provider: provider.name,
    feedUrl: feed?.url ?? "",
    feedHttpStatus: "n/a",
    parsedItems: 0,
    acceptedItems: 0,
    rejectedItems: 0,
    sampleArticleUrl: "n/a",
    sampleImageUrl: "n/a",
    enabled: provider.rssEnabled !== false,
    reason: provider.rssDisabledReason ?? (provider.rssEnabled === false ? "Disabled in registry." : "Enabled."),
  };

  if (provider.rssEnabled === false) {
    return base;
  }

  if (!feed?.url) {
    return {
      ...base,
      enabled: false,
      reason: "No RSS feed URL configured.",
    };
  }

  const config = resolvePublicNewsConfig();

  let xml = "";

  try {
    xml = await fetchExternalDocument(feed.url, {
      timeoutMs: config.fetchTimeoutMs,
      maxBytes: config.maxResponseBytes,
    });
    base.feedHttpStatus = "200-399";
  } catch (error) {
    base.feedHttpStatus = error instanceof Error ? error.message : "fetch failed";
    base.enabled = false;
    base.reason = `Feed fetch failed: ${base.feedHttpStatus}`;
    return base;
  }

  const parsedItems = parseRssOrAtomFeed(xml, feed.url);
  base.parsedItems = parsedItems.length;

  if (parsedItems.length === 0) {
    base.enabled = false;
    base.reason = "Feed returned no parseable RSS/Atom items.";
    return base;
  }

  const externalArticles: ExternalNewsArticle[] = parsedItems.slice(0, 20).map((item) => ({
    externalId: item.externalId,
    provider: "rss",
    sourceName: provider.name,
    sourceDomain: provider.sourceDomains[0] ?? "",
    title: item.title,
    summary: item.summary ?? item.title,
    articleUrl: item.articleUrl,
    imageUrl: item.imageUrl,
    publishedAt: item.publishedAt,
    language: provider.language,
    category: feed.defaultCategory,
  }));

  const filtered = filterExternalNewsArticles(externalArticles, {
    retentionDays: config.retentionDays,
  });
  const validated = await validateExternalNewsArticleUrls(filtered);

  base.acceptedItems = validated.length;
  base.rejectedItems = externalArticles.length - validated.length;

  const sample = validated[0] ?? filtered[0] ?? parsedItems[0];
  base.sampleArticleUrl = sample?.articleUrl ?? "n/a";
  const sampleImage =
    sample && "imageUrl" in sample && sample.imageUrl
      ? sample.imageUrl
      : parsedItems.find((item) => item.imageUrl)?.imageUrl;
  base.sampleImageUrl = sampleImage ?? "n/a";

  if (validated.length === 0) {
    base.enabled = false;
    base.reason = "No items passed article URL validation.";
    return base;
  }

  const reachable = await validatePublicArticleUrl(validated[0]!.articleUrl, {
    timeoutMs: config.fetchTimeoutMs,
  });

  if (!reachable) {
    base.enabled = false;
    base.reason = "Sample article URL failed HTTP validation.";
    return base;
  }

  base.enabled = true;
  base.reason = "Feed ingests validated article URLs.";
  return base;
}

function printReport(results: ProviderDiagnostic[]): void {
  console.log("\nPublic News Provider Diagnostics\n");

  for (const result of results) {
    console.log(`Provider: ${result.provider}`);
    console.log(`Feed URL: ${result.feedUrl}`);
    console.log(`Feed HTTP status: ${result.feedHttpStatus}`);
    console.log(`Parsed items: ${result.parsedItems}`);
    console.log(`Accepted items: ${result.acceptedItems}`);
    console.log(`Rejected items: ${result.rejectedItems}`);
    console.log(`Sample article URL: ${result.sampleArticleUrl}`);
    console.log(`Sample image URL: ${result.sampleImageUrl}`);
    console.log(`Enabled: ${result.enabled ? "yes" : "no"}`);
    console.log(`Reason: ${result.reason}`);
    console.log("");
  }

  const enabledCount = results.filter((result) => result.enabled).length;
  console.log(`Summary: ${enabledCount}/${results.length} providers ingest validated articles.`);
}

async function main(): Promise<void> {
  const results: ProviderDiagnostic[] = [];

  for (const provider of TRUSTED_GLOBAL_MEDIA_REGISTRY) {
    results.push(await diagnoseProvider(provider));
  }

  printReport(results);

  const enabledCount = results.filter((result) => result.enabled).length;

  if (enabledCount < 2) {
    throw new Error("Expected at least two working public news providers.");
  }
}

void main()
  .then(() => {
    console.log("verify:public-news-providers passed.");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
