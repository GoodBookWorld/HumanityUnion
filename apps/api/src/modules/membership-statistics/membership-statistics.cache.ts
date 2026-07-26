import type { MembershipStatisticsPayload } from "@hu/types";

import { MEMBERSHIP_STATISTICS_CACHE_TTL_MS } from "./membership-statistics.types.js";

let cachedPayload: MembershipStatisticsPayload | null = null;
let cachedAt = 0;

export function readCachedMembershipStatistics(
  now = Date.now(),
): MembershipStatisticsPayload | null {
  if (!cachedPayload || now - cachedAt > MEMBERSHIP_STATISTICS_CACHE_TTL_MS) {
    return null;
  }

  return structuredClone(cachedPayload);
}

export function writeCachedMembershipStatistics(payload: MembershipStatisticsPayload): void {
  cachedPayload = structuredClone(payload);
  cachedAt = Date.now();
}

export function clearMembershipStatisticsCache(): void {
  cachedPayload = null;
  cachedAt = 0;
}
