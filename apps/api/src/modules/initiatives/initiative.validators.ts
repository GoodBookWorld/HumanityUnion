import type {
  Initiative,
  InitiativeCoverMedia,
  InitiativeNewsSourceReference,
  ParticipationScope,
  InitiativeActivityAreaOption,
} from "@hu/types";
import {
  INITIATIVE_ACTIVITY_AREA_OTHER,
  isKnownInitiativeActivityArea,
  parseExternalVideoUrl,
} from "@hu/types";
import { isPlatformMediaUrl } from "../media-upload/media-upload.validation.js";

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
  /** UX Evolution Pack 03 — see `validateCoverMediaInput`; always server re-derived, never trusted verbatim. */
  coverMedia?: InitiativeCoverMedia;
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
  /** UX Evolution Pack 03 — see `validateCoverMediaInput`; always server re-derived, never trusted verbatim. */
  coverMedia?: InitiativeCoverMedia;
  /** UX Evolution Pack 03 — explicit "Remove Media" action; clears both `coverMedia` and the legacy `imageUrl`. */
  clearCoverMedia?: boolean;
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

/**
 * UX Evolution Pack 03 — server-side re-derivation of `coverMedia`. Client
 * input is treated only as a hint of intent (which type, which url); every
 * field that matters for safety (`verificationStatus`, `provider`,
 * `providerVideoId`) is recomputed here rather than trusted verbatim. This
 * is defense in depth against a client crafting a request that skips the
 * dedicated `/api/v1/media/*` validation endpoints entirely — e.g. POSTing a
 * forged `verificationStatus: "approved"` pointing at an arbitrary external
 * image URL, which would otherwise become "arbitrary media hosting"
 * (explicitly out of scope, Part 11).
 */
function validateCoverMediaInput(value: unknown): InitiativeCoverMedia | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "object") {
    throw new Error("Invalid cover media payload.");
  }

  const record = value as Record<string, unknown>;

  if (record.type === "image") {
    const url = typeof record.url === "string" ? record.url.trim() : "";

    if (!url || !isPlatformMediaUrl(url)) {
      throw new Error("Cover image must reference an uploaded platform media file.");
    }

    return {
      type: "image",
      url,
      verificationStatus: "approved",
      createdAt: new Date().toISOString(),
    };
  }

  if (record.type === "video_external") {
    const url = typeof record.url === "string" ? record.url.trim() : "";
    const parsed = parseExternalVideoUrl(url);

    if (!parsed) {
      throw new Error("Video link must be an approved HTTPS YouTube or Vimeo URL.");
    }

    return {
      type: "video_external",
      url: parsed.canonicalUrl,
      provider: parsed.provider,
      providerVideoId: parsed.providerVideoId,
      verificationStatus: "approved",
      createdAt: new Date().toISOString(),
    };
  }

  if (record.type === "video_upload") {
    // Part 5 — no malware/security scanning, transcoding, or quarantine
    // pipeline exists yet; raw video upload must not be presented as
    // production-ready (see the Pack 03 final report).
    throw new Error("Video upload is not yet available. Please use an approved video link instead.");
  }

  throw new Error("Unsupported cover media type.");
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
    coverMedia: validateCoverMediaInput(record.coverMedia),
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

  if (record.coverMedia !== undefined) {
    update.coverMedia = validateCoverMediaInput(record.coverMedia);
  }

  if (record.clearCoverMedia !== undefined) {
    if (typeof record.clearCoverMedia !== "boolean") {
      throw new Error("clearCoverMedia must be a boolean.");
    }

    update.clearCoverMedia = record.clearCoverMedia;
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
