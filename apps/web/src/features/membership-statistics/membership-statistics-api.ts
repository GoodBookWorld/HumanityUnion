import type { MembershipStatisticsPayload } from "@hu/types";

import { API_BASE_URL } from "../../lib/api-client";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta: Record<string, unknown>;
  message: string;
}

export async function fetchMembershipStatistics(): Promise<MembershipStatisticsPayload> {
  const response = await fetch(`${API_BASE_URL}/api/v1/statistics/membership`, {
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Membership statistics are temporarily unavailable.");
  }

  const body = (await response.json()) as ApiEnvelope<MembershipStatisticsPayload>;

  if (!body.success || !body.data) {
    throw new Error("Membership statistics are temporarily unavailable.");
  }

  return body.data;
}

export function formatMembershipStatisticValue(value: number, locale = "en"): string {
  return new Intl.NumberFormat(locale).format(value);
}
