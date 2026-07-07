import type {
  CivicActionPackageDelivery,
  CivicDeliveryRecipient,
  PublicCivicDeliveryListItem,
  PublicCivicDeliveryProjection,
  RecommendedCivicDeliveryRecipient,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

const API_BASE_URL = "http://localhost:4000";

export interface CivicDeliveryDetail {
  delivery: CivicActionPackageDelivery;
  recipients: CivicDeliveryRecipient[];
}

export async function listMyCivicDeliveries(): Promise<CivicDeliveryDetail[]> {
  return apiRequest<CivicDeliveryDetail[]>("/api/v1/civic-deliveries/mine");
}

export async function createCivicDeliveryDraft(capId: string): Promise<CivicActionPackageDelivery> {
  return apiRequest<CivicActionPackageDelivery>("/api/v1/civic-deliveries/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ capId }),
  });
}

export async function getRecommendedCivicDeliveryRecipients(
  capId: string,
): Promise<RecommendedCivicDeliveryRecipient[]> {
  return apiRequest<RecommendedCivicDeliveryRecipient[]>(
    `/api/v1/civic-deliveries/recommended/${encodeURIComponent(capId)}`,
  );
}

export async function addCivicDeliveryRecipient(
  deliveryId: string,
  input: {
    name: string;
    organization?: string;
    recipientType: string;
    email: string;
    reason: string;
    source: "recommended" | "user_added";
  },
): Promise<CivicDeliveryRecipient> {
  return apiRequest<CivicDeliveryRecipient>(
    `/api/v1/civic-deliveries/${encodeURIComponent(deliveryId)}/recipients`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export async function removeCivicDeliveryRecipient(
  deliveryId: string,
  recipientId: string,
): Promise<void> {
  await apiRequest<{ removed: boolean }>(
    `/api/v1/civic-deliveries/${encodeURIComponent(deliveryId)}/recipients/${encodeURIComponent(recipientId)}`,
    { method: "DELETE" },
  );
}

export async function sendCivicDelivery(deliveryId: string): Promise<CivicDeliveryDetail> {
  return apiRequest<CivicDeliveryDetail>(
    `/api/v1/civic-deliveries/${encodeURIComponent(deliveryId)}/send`,
    { method: "POST" },
  );
}

export async function listPublicCivicDeliveriesForCap(
  capId: string,
): Promise<PublicCivicDeliveryListItem[]> {
  const url = `${API_BASE_URL}/api/v1/public/civic-action-packages/${encodeURIComponent(capId)}/deliveries`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as {
    success: boolean;
    data: PublicCivicDeliveryListItem[];
  };

  return payload.success ? payload.data : [];
}

export async function getPublicCivicDelivery(
  deliveryId: string,
): Promise<PublicCivicDeliveryProjection | null> {
  const url = `${API_BASE_URL}/api/v1/public/civic-deliveries/${encodeURIComponent(deliveryId)}`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    success: boolean;
    data: PublicCivicDeliveryProjection;
  };

  return payload.success ? payload.data : null;
}
