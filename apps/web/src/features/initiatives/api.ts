import type { Initiative } from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function listInitiatives(): Promise<Initiative[]> {
  return apiRequest<Initiative[]>("/api/v1/initiatives");
}

export async function getInitiativeById(initiativeId: string): Promise<Initiative> {
  return apiRequest<Initiative>(`/api/v1/initiatives/${encodeURIComponent(initiativeId)}`);
}

export async function createInitiative(initiative: Initiative): Promise<Initiative> {
  return apiRequest<Initiative>("/api/v1/initiatives", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(initiative),
  });
}
