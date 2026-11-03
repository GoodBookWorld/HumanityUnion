import { apiRequest } from "../../lib/api-client";

import type {
  AdminSearchPerformanceResponse,
  SearchPerformancePeriod,
} from "./admin-seo-search-performance-model";

export async function fetchAdminSearchPerformance(
  period: SearchPerformancePeriod,
): Promise<AdminSearchPerformanceResponse> {
  return apiRequest<AdminSearchPerformanceResponse>(
    `/api/v1/admin/seo/search-performance?period=${encodeURIComponent(period)}`,
  );
}
