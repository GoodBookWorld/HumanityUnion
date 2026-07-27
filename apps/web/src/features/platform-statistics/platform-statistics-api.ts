import type { PlatformStatisticsCounts, PlatformStatisticsMeta } from "@hu/types";

import { API_BASE_URL } from "../../lib/api-client";

export interface PlatformStatisticsResponse {
  data: PlatformStatisticsCounts;
  meta: PlatformStatisticsMeta;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta: Record<string, unknown>;
  message: string;
}

export async function fetchPlatformStatistics(): Promise<PlatformStatisticsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/public/platform-statistics`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Platform statistics are temporarily unavailable.");
  }

  const body = (await response.json()) as ApiEnvelope<PlatformStatisticsCounts>;

  if (!body.success || !body.data) {
    throw new Error("Platform statistics are temporarily unavailable.");
  }

  return {
    data: body.data,
    meta: {
      activeMemberWindowDays:
        typeof body.meta.activeMemberWindowDays === "number"
          ? body.meta.activeMemberWindowDays
          : 90,
      generatedAt:
        typeof body.meta.generatedAt === "string"
          ? body.meta.generatedAt
          : new Date().toISOString(),
    },
  };
}

export function formatPlatformStatisticValue(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}
