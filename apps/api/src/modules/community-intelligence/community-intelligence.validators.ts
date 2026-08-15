import type { CommunitySimilarityCheckRequest } from "@hu/types";

import { CommunityIntelligenceError } from "./community-intelligence.errors.js";

function readString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new CommunityIntelligenceError(400, `${field} must be a string.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new CommunityIntelligenceError(400, `${field} is required.`);
  }

  if (trimmed.length > maxLength) {
    throw new CommunityIntelligenceError(400, `${field} is too long.`);
  }

  return trimmed;
}

function readOptionalString(value: unknown, field: string, maxLength: number): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new CommunityIntelligenceError(400, `${field} must be a string.`);
  }

  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new CommunityIntelligenceError(400, `${field} is too long.`);
  }

  return trimmed;
}

export function parseSimilarityCheckBody(body: unknown): CommunitySimilarityCheckRequest {
  if (!body || typeof body !== "object") {
    throw new CommunityIntelligenceError(400, "Request body is required.");
  }

  const record = body as Record<string, unknown>;
  const tags = Array.isArray(record.tags)
    ? record.tags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 12)
    : undefined;

  return {
    title: readString(record.title, "title", 200),
    description: readString(record.description, "description", 8000),
    activityArea: readOptionalString(record.activityArea, "activityArea", 120),
    activityAreaOther: readOptionalString(record.activityAreaOther, "activityAreaOther", 120),
    tags,
    countrySlug: readOptionalString(record.countrySlug, "countrySlug", 80),
    regionSlug: readOptionalString(record.regionSlug, "regionSlug", 80),
    communitySlug: readOptionalString(record.communitySlug, "communitySlug", 120),
    participationScope: readOptionalString(record.participationScope, "participationScope", 40),
    excludeInitiativeId: readOptionalString(record.excludeInitiativeId, "excludeInitiativeId", 120),
  };
}
