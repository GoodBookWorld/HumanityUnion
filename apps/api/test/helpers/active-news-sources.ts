import type { MediaResource } from "@hu/types";

import {
  resetMediaResourcesMemoryForTests,
  upsertMediaResourceMemory,
} from "../../src/modules/media-resources/persistence/media-resource.memory.store.js";
import { setMediaResourceForceMemoryForTests } from "../../src/modules/media-resources/persistence/media-resource.repository.js";

/**
 * MEDIA-NEWS-01B — the /media carousel only selects articles of active NEWS_SOURCE
 * resources; fixtures that exercise it seed matching sources in memory.
 */
export function seedActiveNewsSourcesForTests(
  sources: readonly { name: string; websiteUrl: string; scopeType?: "WORLD" | "COUNTRY" }[],
): void {
  setMediaResourceForceMemoryForTests(true);
  resetMediaResourcesMemoryForTests();
  sources.forEach((source, index) => {
    const resource: MediaResource = {
      id: `test-news-source-${index}`,
      resourceType: "NEWS_SOURCE",
      scopeType: source.scopeType ?? "WORLD",
      countryCode: source.scopeType === "COUNTRY" ? "CA" : null,
      name: source.name,
      logoLabel: source.name.slice(0, 2).toUpperCase(),
      websiteUrl: source.websiteUrl,
      rssUrl: `${source.websiteUrl.replace(/\/$/, "")}/rss`,
      language: "en",
      active: true,
      sortOrder: index,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    upsertMediaResourceMemory(resource);
  });
}

export function resetActiveNewsSourcesForTests(): void {
  resetMediaResourcesMemoryForTests();
  setMediaResourceForceMemoryForTests(false);
}
