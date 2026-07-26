import type { MemberProfile } from "@hu/types";

import {
  ALLOWED_AVATAR_EXTENSIONS,
  LINKEDIN_URL_PREFIX,
  MAX_AVATAR_URL_LENGTH,
  MAX_BIOGRAPHY_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_LINKEDIN_URL_LENGTH,
  MAX_MEMBER_SKILL_LABEL_LENGTH,
  MAX_MEMBER_SKILLS,
  MAX_ORGANIZATION_LENGTH,
  MAX_PUBLIC_NAME_LENGTH,
  MAX_WEBSITE_LENGTH,
} from "./member-profile.constants.js";
import { isPlatformMediaUrl } from "../media-upload/media-upload.validation.js";
import { MemberProfileValidationError } from "./member-profile.errors.js";

function normalizeOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new MemberProfileValidationError("Expected a string value.");
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeRequiredString(value: unknown, fieldName: string, maxLength: number): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new MemberProfileValidationError(`${fieldName} is required.`);
  }

  const trimmed = value.trim();

  if (trimmed.length > maxLength) {
    throw new MemberProfileValidationError(`${fieldName} must be at most ${maxLength} characters.`);
  }

  return trimmed;
}

export function validateAvatarUrl(avatarUrl: unknown): string | undefined {
  if (avatarUrl === null || avatarUrl === "") {
    return undefined;
  }

  const value = normalizeOptionalString(avatarUrl);

  if (!value) {
    return undefined;
  }

  if (isPlatformMediaUrl(value)) {
    return value;
  }

  if (value.length > MAX_AVATAR_URL_LENGTH) {
    throw new MemberProfileValidationError(
      `Avatar URL must be at most ${MAX_AVATAR_URL_LENGTH} characters.`,
    );
  }

  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new MemberProfileValidationError("Avatar URL must be a valid http or https URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new MemberProfileValidationError("Avatar URL must use http or https.");
  }

  const pathname = parsed.pathname.toLowerCase();
  const hasAllowedExtension = ALLOWED_AVATAR_EXTENSIONS.some((extension) =>
    pathname.endsWith(extension),
  );

  if (!hasAllowedExtension) {
    throw new MemberProfileValidationError("Avatar URL must point to a PNG, JPG, or WEBP image.");
  }

  return value;
}

export function validateWebsiteUrl(website: unknown): string | undefined {
  const value = normalizeOptionalString(website);

  if (!value) {
    return undefined;
  }

  if (value.length > MAX_WEBSITE_LENGTH) {
    throw new MemberProfileValidationError(
      `Website URL must be at most ${MAX_WEBSITE_LENGTH} characters.`,
    );
  }

  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new MemberProfileValidationError("Website must be a valid http or https URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new MemberProfileValidationError("Website must use http or https.");
  }

  return value;
}

export function validateLinkedInUrl(linkedinUrl: unknown): string | undefined {
  const value = normalizeOptionalString(linkedinUrl);

  if (!value) {
    return undefined;
  }

  if (value.length > MAX_LINKEDIN_URL_LENGTH) {
    throw new MemberProfileValidationError(
      `LinkedIn URL must be at most ${MAX_LINKEDIN_URL_LENGTH} characters.`,
    );
  }

  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new MemberProfileValidationError("LinkedIn must be a valid https URL.");
  }

  if (parsed.protocol !== "https:") {
    throw new MemberProfileValidationError("LinkedIn must use https.");
  }

  const normalized = `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}`;

  if (!normalized.startsWith(LINKEDIN_URL_PREFIX)) {
    throw new MemberProfileValidationError(
      "LinkedIn URL must start with https://www.linkedin.com/",
    );
  }

  return normalized;
}

export function validateSkills(skills: unknown): string[] {
  if (skills === undefined || skills === null) {
    return [];
  }

  if (!Array.isArray(skills)) {
    throw new MemberProfileValidationError("Skills must be an array of strings.");
  }

  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const item of skills) {
    if (typeof item !== "string") {
      throw new MemberProfileValidationError("Each skill must be a string.");
    }

    const trimmed = item.trim();

    if (trimmed.length === 0) {
      continue;
    }

    if (trimmed.length > MAX_MEMBER_SKILL_LABEL_LENGTH) {
      throw new MemberProfileValidationError(
        `Each skill must be at most ${MAX_MEMBER_SKILL_LABEL_LENGTH} characters.`,
      );
    }

    const dedupeKey = trimmed.toLowerCase();

    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    normalized.push(trimmed);

    if (normalized.length > MAX_MEMBER_SKILLS) {
      throw new MemberProfileValidationError(
        `Skills must include at most ${MAX_MEMBER_SKILLS} items.`,
      );
    }
  }

  return normalized;
}

export interface ValidatedMemberProfilePatch {
  displayName?: string;
  publicName?: string;
  biography?: string;
  avatarUrl?: string;
  organization?: string;
  website?: string;
  linkedinUrl?: string;
  skills?: string[];
  language?: string;
  timezone?: string;
}

export function validateMemberProfilePatch(body: unknown): ValidatedMemberProfilePatch {
  if (!body || typeof body !== "object") {
    throw new MemberProfileValidationError("Request body is required.");
  }

  const record = body as Record<string, unknown>;
  const patch: ValidatedMemberProfilePatch = {};

  if ("displayName" in record) {
    patch.displayName = normalizeRequiredString(
      record.displayName,
      "Display name",
      MAX_DISPLAY_NAME_LENGTH,
    );
  }

  if ("publicName" in record) {
    patch.publicName = normalizeRequiredString(
      record.publicName,
      "Public name",
      MAX_PUBLIC_NAME_LENGTH,
    );
  }

  if ("biography" in record) {
    const biography = normalizeOptionalString(record.biography);

    if (biography && biography.length > MAX_BIOGRAPHY_LENGTH) {
      throw new MemberProfileValidationError(
        `Biography must be at most ${MAX_BIOGRAPHY_LENGTH} characters.`,
      );
    }

    patch.biography = biography;
  }

  if ("avatarUrl" in record) {
    patch.avatarUrl = validateAvatarUrl(record.avatarUrl);
  }

  if ("organization" in record) {
    const organization = normalizeOptionalString(record.organization);

    if (organization && organization.length > MAX_ORGANIZATION_LENGTH) {
      throw new MemberProfileValidationError(
        `Organization must be at most ${MAX_ORGANIZATION_LENGTH} characters.`,
      );
    }

    patch.organization = organization;
  }

  if ("website" in record) {
    patch.website = validateWebsiteUrl(record.website);
  }

  if ("linkedinUrl" in record) {
    patch.linkedinUrl = validateLinkedInUrl(record.linkedinUrl);
  }

  if ("skills" in record) {
    patch.skills = validateSkills(record.skills);
  }

  if ("language" in record) {
    patch.language = normalizeRequiredString(record.language, "Language", 32);
  }

  if ("timezone" in record) {
    patch.timezone = normalizeOptionalString(record.timezone);
  }

  if (Object.keys(patch).length === 0) {
    throw new MemberProfileValidationError("No valid profile fields were provided.");
  }

  return patch;
}

export function validateMemberProfilePrivacyPatch(
  body: unknown,
): Partial<MemberProfile> & { participationVisibility?: MemberProfile["participationVisibility"] } {
  if (!body || typeof body !== "object") {
    throw new MemberProfileValidationError("Request body is required.");
  }

  const record = body as Record<string, unknown>;
  const patch: Partial<MemberProfile> = {};

  const visibilityFields = [
    "profileVisibility",
    "participationVisibility",
    "skillsVisibility",
    "professionalLinksVisibility",
  ] as const satisfies readonly (keyof MemberProfile)[];

  for (const field of visibilityFields) {
    if (!(field in record)) {
      continue;
    }

    const value = record[field];

    if (value !== "public" && value !== "members_only" && value !== "private") {
      throw new MemberProfileValidationError(`${field} must be public, members_only, or private.`);
    }

    patch[field] = value;
  }

  for (const field of ["showOrganization", "showLocation", "showParticipationArea"] as const) {
    if (!(field in record)) {
      continue;
    }

    if (typeof record[field] !== "boolean") {
      throw new MemberProfileValidationError(`${field} must be a boolean.`);
    }

    patch[field] = record[field];
  }

  if ("membershipPubliclyVisible" in record) {
    if (typeof record.membershipPubliclyVisible !== "boolean") {
      throw new MemberProfileValidationError("membershipPubliclyVisible must be a boolean.");
    }

    patch.membershipPubliclyVisible = record.membershipPubliclyVisible;
  }

  if (Object.keys(patch).length === 0) {
    throw new MemberProfileValidationError("No valid privacy fields were provided.");
  }

  return patch;
}

export function slugifyPublicName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
