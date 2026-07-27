import type { ApproximateIpGeography } from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function fetchApproximateIpGeography(): Promise<ApproximateIpGeography> {
  return apiRequest<ApproximateIpGeography>("/api/v1/public/ip-geography/approximate", {
    cache: "no-store",
  });
}
