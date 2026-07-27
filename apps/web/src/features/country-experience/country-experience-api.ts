import type {
  CountryStatisticsCounts,
  TrustedMediaResource,
  WorldInitiativeCardProjection,
} from "@hu/types";

import { API_BASE_URL } from "../../lib/api-client";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta: Record<string, unknown>;
  message: string;
}

export async function fetchCountryStatistics(
  countryCode: string,
): Promise<{ data: CountryStatisticsCounts; meta: Record<string, unknown> }> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/public/countries/${encodeURIComponent(countryCode)}/statistics`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error("Country statistics are temporarily unavailable.");
  }

  const body = (await response.json()) as ApiEnvelope<CountryStatisticsCounts>;

  if (!body.success || !body.data) {
    throw new Error("Country statistics are temporarily unavailable.");
  }

  return { data: body.data, meta: body.meta };
}

export async function fetchCountryInitiatives(
  countryCode: string,
): Promise<WorldInitiativeCardProjection[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/public/countries/${encodeURIComponent(countryCode)}/initiatives`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error("Country initiatives are temporarily unavailable.");
  }

  const body = (await response.json()) as ApiEnvelope<WorldInitiativeCardProjection[]>;

  if (!body.success || !body.data) {
    throw new Error("Country initiatives are temporarily unavailable.");
  }

  return body.data;
}

export async function fetchCountryMedia(countryCode: string): Promise<TrustedMediaResource[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/public/countries/${encodeURIComponent(countryCode)}/media`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error("Country civic media is temporarily unavailable.");
  }

  const body = (await response.json()) as ApiEnvelope<TrustedMediaResource[]>;

  if (!body.success || !body.data) {
    throw new Error("Country civic media is temporarily unavailable.");
  }

  return body.data;
}
