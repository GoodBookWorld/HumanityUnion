import type { TrafficAdminReport, TrafficInsightsPeriod, TrafficInsightsReport } from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function fetchAdminTrafficReport(
  period: "today" | "7d" | "30d",
): Promise<TrafficAdminReport> {
  return apiRequest<TrafficAdminReport>(
    `/api/v1/admin/analytics/traffic?period=${encodeURIComponent(period)}`,
  );
}

export async function fetchAdminTrafficInsights(
  period: TrafficInsightsPeriod,
): Promise<TrafficInsightsReport> {
  return apiRequest<TrafficInsightsReport>(
    `/api/v1/admin/analytics/insights?period=${encodeURIComponent(period)}`,
  );
}
