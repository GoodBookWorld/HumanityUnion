import type { IndexDescription } from "mongodb";

export const SEARCH_DAILY_METRICS_INDEXES: IndexDescription[] = [
  {
    key: { provider: 1, siteUrl: 1, day: 1 },
    unique: true,
    name: "seo_search_daily_metrics_provider_site_day_unique",
  },
  {
    key: { expiresAt: 1 },
    expireAfterSeconds: 0,
    name: "seo_search_daily_metrics_expires_at_ttl",
  },
];

export const SEARCH_SYNC_STATE_INDEXES: IndexDescription[] = [
  { key: { provider: 1 }, unique: true, name: "seo_search_sync_state_provider_unique" },
];
