import { resolvePublicNewsConfig } from "../public-news.config.js";
import { MockNewsProvider } from "./mock-news.provider.js";
import type { NewsProvider } from "./news-provider.types.js";
import { RssNewsProvider } from "./rss-news.provider.js";

export function resolveNewsProvider(): NewsProvider | null {
  const config = resolvePublicNewsConfig();

  if (!config.enabled) {
    return null;
  }

  if (config.providerName === "mock" || process.env.HU_VERIFICATION_MODE === "true") {
    return new MockNewsProvider();
  }

  if (config.providerName === "rss" || !config.providerName) {
    return new RssNewsProvider();
  }

  console.warn(`[public-news] Unsupported provider "${config.providerName}". Falling back to RSS.`);
  return new RssNewsProvider();
}
