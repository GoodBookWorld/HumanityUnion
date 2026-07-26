import type { PlatformStatisticsPayload } from "@hu/types";

import { PLATFORM_STATISTICS_CACHE_TTL_MS } from "./platform-statistics.types.js";

let cachedPayload: PlatformStatisticsPayload | null = null;
let cachedAt = 0;

export function readCachedPlatformStatistics(now = Date.now()): PlatformStatisticsPayload | null {
  if (!cachedPayload || now - cachedAt >= PLATFORM_STATISTICS_CACHE_TTL_MS) {
    return null;
  }

  return structuredClone(cachedPayload);
}

export function writeCachedPlatformStatistics(
  payload: PlatformStatisticsPayload,
  now = Date.now(),
): void {
  cachedPayload = structuredClone(payload);
  cachedAt = now;
}

export function clearPlatformStatisticsCache(): void {
  cachedPayload = null;
  cachedAt = 0;
}
