import type { Initiative, InitiativeNewsSourceReference, ParticipationScope, InitiativeActivityAreaOption } from "@hu/types";
import { INITIATIVE_ACTIVITY_AREA_OTHER, isKnownInitiativeActivityArea } from "@hu/types";

export interface CreateInitiativeDraftInput {
  title: string;
  description: string;
  /** @deprecated Prefer communityAssociation. Retained for existing API clients and verify scripts. */
  communitySlug?: string;
  countrySlug?: string;
  regionSlug?: string;
  region?: string;
  communityAssociation?: string;
  activityArea: string;
  activityAreaOther?: string;
  participationScope?: ParticipationScope;
  imageUrl?: string;
  imageAltText?: string;
  startDate?: string;
  completionDate?: string;
  sourceNewsId?: string;
  sourceReferences?: InitiativeNewsSourceReference[];
}

export interface SaveInitiativeDraftInput {
  title?: string;
  description?: string;
  /** @deprecated Prefer communityAssociation. Retained for existing API clients and verify scripts. */
  communitySlug?: string;
  countrySlug?: string;
  regionSlug?: string;
  region?: string;
  communityAssociation?: string;
  activityArea?: string;
  activityAreaOther?: string;
  participationScope?: ParticipationScope;
  imageUrl?: string;
  imageAltText?: string;
  startDate?: string;
  completionDate?: string;
  clearSourceReferences?: boolean;
}

function normalizeText(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} is required.`);
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }

  return normalized;
}

function normalizeOptionalText(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error("Expected a string value.");
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeOptionalIsoDate(value: unknown, fieldName: string): string | undefined {
  const normalized = normalizeOptionalText(value);

  if (!normalized) {
    return undefined;
  }

  const parsed = Date.parse(normalized);

  if (Number.isNaN(parsed)) {
    throw new Error(`${fieldName} must be a valid ISO date.`);
  }

  return new Date(parsed).toISOString();
}

function validateParticipationScope(value: unknown): ParticipationScope | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (value === "world" || value === "country" || value === "region" || value === "community") {
    return value;
  }

  throw new Error("Participation scope must be world, country, region, or community.");
}

function validateActivityAreaFields(
  activityArea: string,
  activityAreaOther: string | undefined,
): { activityArea: string; activityAreaOther?: string } {
  if (!isKnownInitiativeActivityArea(activityArea)) {
    throw new Error("Activity area must be selected from the canonical list.");
  }

  if (activityArea === INITIATIVE_ACTIVITY_AREA_OTHER) {
    const other = normalizeText(activityAreaOther, "Activity area (Other)");

    return {
      activityArea,
      activityAreaOther: other,
    };
  }

  if (activityAreaOther) {
    throw new Error("Activity area (Other) is only allowed when Activity area is Other.");
  }

  return { activityArea };
}

const LEGACY_ACTIVITY_AREA_ALIASES: Record<string, InitiativeActivityAreaOption> = {
  Governance: "Democracy and Governance",
  Environment: "Environment and Climate",
  "Civic Engagement": "Democracy and Governance",
};

function normalizeActivityAreaValue(value: string): string {
  return LEGACY_ACTIVITY_AREA_ALIASES[value] ?? value;
}

function readActivityAreaFields(record: Record<string, unknown>): {
  activityArea: string;
  activityAreaOther?: string;
} {
  const activityArea = normalizeActivityAreaValue(
    normalizeText(record.activityArea, "Activity area"),
  );
  const activityAreaOther = normalizeOptionalText(record.activityAreaOther);

  return validateActivityAreaFields(activityArea, activityAreaOther);
}

export function validateCreateInitiativeDraftInput(body: unknown): CreateInitiativeDraftInput {
  if (!body || typeof body !== "object") {
    throw new Error("Request body is required.");
  }

  const record = body as Record<string, unknown>;
  const activityAreaFields = readActivityAreaFields(record);

  return {
    title: normalizeText(record.title, "Title"),
    description: normalizeText(record.description, "Short description"),
    communitySlug: normalizeOptionalText(record.communitySlug),
    countrySlug: normalizeOptionalText(record.countrySlug),
    regionSlug: normalizeOptionalText(record.regionSlug),
    communityAssociation: normalizeOptionalText(record.communityAssociation),
    participationScope: validateParticipationScope(record.participationScope),
    ...activityAreaFields,
    imageUrl: normalizeOptionalText(record.imageUrl),
    imageAltText: normalizeOptionalText(record.imageAltText),
    startDate: normalizeOptionalIsoDate(record.startDate, "Start date"),
    completionDate: normalizeOptionalIsoDate(record.completionDate, "Completion date"),
    sourceNewsId: normalizeOptionalText(record.sourceNewsId),
  };
}

export function validateSaveInitiativeDraftInput(body: unknown): SaveInitiativeDraftInput {
  if (!body || typeof body !== "object") {
    throw new Error("Request body is required.");
  }

  const record = body as Record<string, unknown>;
  const update: SaveInitiativeDraftInput = {};

  if (record.title !== undefined) {
    update.title = normalizeText(record.title, "Title");
  }

  if (record.description !== undefined) {
    update.description = normalizeText(record.description, "Short description");
  }

  if (record.communityAssociation !== undefined) {
    update.communityAssociation = normalizeOptionalText(record.communityAssociation);
  }

  if (record.communitySlug !== undefined) {
    update.communitySlug = normalizeOptionalText(record.communitySlug);
  }

  if (record.countrySlug !== undefined) {
    update.countrySlug = normalizeOptionalText(record.countrySlug);
  }

  if (record.regionSlug !== undefined) {
    update.regionSlug = normalizeOptionalText(record.regionSlug);
  }

  if (record.region !== undefined) {
    update.region = normalizeOptionalText(record.region);
  }

  if (record.participationScope !== undefined) {
    update.participationScope = validateParticipationScope(record.participationScope);
  }

  if (record.activityArea !== undefined) {
    const activityAreaOther =
      record.activityAreaOther !== undefined
        ? normalizeOptionalText(record.activityAreaOther)
        : undefined;
    Object.assign(
      update,
      validateActivityAreaFields(
        normalizeText(record.activityArea, "Activity area"),
        activityAreaOther,
      ),
    );
  } else if (record.activityAreaOther !== undefined) {
    throw new Error("Activity area must be provided when updating Activity area (Other).");
  }

  if (record.imageUrl !== undefined) {
    update.imageUrl = normalizeOptionalText(record.imageUrl);
  }

  if (record.imageAltText !== undefined) {
    update.imageAltText = normalizeOptionalText(record.imageAltText);
  }

  if (record.startDate !== undefined) {
    update.startDate = normalizeOptionalIsoDate(record.startDate, "Start date");
  }

  if (record.completionDate !== undefined) {
    update.completionDate = normalizeOptionalIsoDate(record.completionDate, "Completion date");
  }

  if (record.clearSourceReferences !== undefined) {
    if (typeof record.clearSourceReferences !== "boolean") {
      throw new Error("clearSourceReferences must be a boolean.");
    }

    update.clearSourceReferences = record.clearSourceReferences;
  }

  if (Object.keys(update).length === 0) {
    throw new Error("At least one editable field is required.");
  }

  return update;
}

export function validateInitiativeForPublication(initiative: Initiative): void {
  normalizeText(initiative.title, "Title");
  normalizeText(initiative.description, "Short description");
  normalizeText(initiative.metadata.activityArea, "Activity area");

  const normalizedActivityArea = normalizeActivityAreaValue(initiative.metadata.activityArea);

  if (!isKnownInitiativeActivityArea(normalizedActivityArea)) {
    throw new Error("Activity area must be selected from the canonical list.");
  }

  if (
    normalizedActivityArea === INITIATIVE_ACTIVITY_AREA_OTHER &&
    !initiative.metadata.activityAreaOther
  ) {
    throw new Error("Activity area (Other) is required when Activity area is Other.");
  }

  if (initiative.visibility.policy !== "public") {
    throw new Error("Visibility must be Public before publishing.");
  }
}
