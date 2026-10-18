import { MemberProfileValidationError } from "../member-profile/member-profile.errors.js";
import { validateMemberProfilePatch } from "../member-profile/member-profile.validators.js";
import { INTEGRITY_MEDIA_PROVISION_SNAPSHOT_VERSION } from "./external-author-link.constants.js";

/** Matches the avatar upload ceiling. The photograph itself is not transferred here. */
export const SNAPSHOT_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
const SNAPSHOT_PHOTO_MAX_DIMENSION = 8000;
const SNAPSHOT_PHOTO_MAX_PIXELS = 40_000_000;
const SNAPSHOT_PHOTO_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const SNAPSHOT_FIELDS = new Set([
  "version",
  "displayName",
  "biography",
  "website",
  "linkedinUrl",
  "facebookUrl",
  "youtubeUrl",
  "instagramUrl",
  "xUrl",
  "photo",
]);
const PHOTO_FIELDS = new Set([
  "mediaType",
  "width",
  "height",
  "byteLength",
  "digestAlgorithm",
  "digest",
]);

/**
 * Integrity Media serializes `SHA-256`. Existing fixtures use `sha256`.
 * Both name the same algorithm. The snapshot string itself is not rewritten.
 */
const ACCEPTED_SNAPSHOT_DIGEST_ALGORITHMS = new Set(["SHA-256", "sha256"]);

export const MAX_PROVISION_SNAPSHOT_BYTES = 16 * 1024;

export interface ApprovedProvisionSnapshot {
  displayName: string;
  biography?: string;
  website?: string;
  linkedinUrl?: string;
  facebookUrl?: string;
  youtubeUrl?: string;
  instagramUrl?: string;
  xUrl?: string;
}

export type SnapshotSchemaFailure = "unexpected_field" | "unsupported_snapshot_version" | "invalid_snapshot";

export type SnapshotSchemaResult =
  | { ok: true; fields: ApprovedProvisionSnapshot }
  | { ok: false; code: SnapshotSchemaFailure };

/** Frozen WEBP metadata that can be retrieved from Integrity Media. No URL is accepted. */
export interface ImportableSnapshotPhoto {
  mediaType: "image/webp";
  byteLength: number;
  digest: string;
}

export function readImportableSnapshotPhoto(
  snapshot: string | undefined,
): ImportableSnapshotPhoto | null {
  if (!snapshot) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(snapshot);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const photo = (parsed as Record<string, unknown>).photo;
  if (!photo || typeof photo !== "object" || Array.isArray(photo)) {
    return null;
  }

  const record = photo as Record<string, unknown>;
  if (record.mediaType !== "image/webp" || !isAcceptedDigestAlgorithm(record.digestAlgorithm)) {
    return null;
  }

  if (typeof record.digest !== "string" || !/^[0-9a-f]{64}$/.test(record.digest)) {
    return null;
  }

  if (
    typeof record.byteLength !== "number" ||
    !Number.isInteger(record.byteLength) ||
    record.byteLength < 1 ||
    record.byteLength > SNAPSHOT_PHOTO_MAX_BYTES
  ) {
    return null;
  }

  return {
    mediaType: "image/webp",
    byteLength: record.byteLength,
    digest: record.digest,
  };
}

export function parseApprovedProvisionSnapshot(snapshot: string): SnapshotSchemaResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(snapshot);
  } catch {
    return { ok: false, code: "invalid_snapshot" };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, code: "invalid_snapshot" };
  }

  const record = parsed as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (!SNAPSHOT_FIELDS.has(key)) {
      return { ok: false, code: "unexpected_field" };
    }
  }

  if (record.version !== INTEGRITY_MEDIA_PROVISION_SNAPSHOT_VERSION) {
    return { ok: false, code: "unsupported_snapshot_version" };
  }

  const photoCode = photoFailure(record.photo);
  if (photoCode) {
    return { ok: false, code: photoCode };
  }

  try {
    const patch = validateMemberProfilePatch({
      displayName: record.displayName,
      ...(record.biography !== undefined ? { biography: record.biography } : {}),
      ...(record.website !== undefined ? { website: record.website } : {}),
      ...(record.linkedinUrl !== undefined ? { linkedinUrl: record.linkedinUrl } : {}),
      ...(record.facebookUrl !== undefined ? { facebookUrl: record.facebookUrl } : {}),
      ...(record.youtubeUrl !== undefined ? { youtubeUrl: record.youtubeUrl } : {}),
      ...(record.instagramUrl !== undefined ? { instagramUrl: record.instagramUrl } : {}),
      ...(record.xUrl !== undefined ? { xUrl: record.xUrl } : {}),
    });

    if (!patch.displayName) {
      return { ok: false, code: "invalid_snapshot" };
    }

    const fields: ApprovedProvisionSnapshot = { displayName: patch.displayName };
    assignOptional(fields, "biography", patch.biography);
    assignOptional(fields, "website", patch.website);
    assignOptional(fields, "linkedinUrl", patch.linkedinUrl);
    assignOptional(fields, "facebookUrl", patch.facebookUrl);
    assignOptional(fields, "youtubeUrl", patch.youtubeUrl);
    assignOptional(fields, "instagramUrl", patch.instagramUrl);
    assignOptional(fields, "xUrl", patch.xUrl);
    return { ok: true, fields };
  } catch (error) {
    if (error instanceof MemberProfileValidationError) {
      return { ok: false, code: "invalid_snapshot" };
    }

    throw error;
  }
}

function assignOptional<K extends keyof ApprovedProvisionSnapshot>(
  fields: ApprovedProvisionSnapshot,
  key: K,
  value: ApprovedProvisionSnapshot[K] | undefined,
): void {
  if (value !== undefined) {
    fields[key] = value;
  }
}

function photoFailure(photo: unknown): SnapshotSchemaFailure | null {
  if (photo === undefined) {
    return null;
  }
  if (!photo || typeof photo !== "object" || Array.isArray(photo)) {
    return "invalid_snapshot";
  }

  const record = photo as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (!PHOTO_FIELDS.has(key)) {
      return "unexpected_field";
    }
  }

  for (const key of PHOTO_FIELDS) {
    if (!(key in record)) {
      return "invalid_snapshot";
    }
  }

  if (
    typeof record.mediaType !== "string" ||
    !SNAPSHOT_PHOTO_MEDIA_TYPES.has(record.mediaType)
  ) {
    return "invalid_snapshot";
  }

  if (!boundedDimension(record.width) || !boundedDimension(record.height)) {
    return "invalid_snapshot";
  }

  if ((record.width as number) * (record.height as number) > SNAPSHOT_PHOTO_MAX_PIXELS) {
    return "invalid_snapshot";
  }

  if (
    typeof record.byteLength !== "number" ||
    !Number.isInteger(record.byteLength) ||
    record.byteLength < 1 ||
    record.byteLength > SNAPSHOT_PHOTO_MAX_BYTES
  ) {
    return "invalid_snapshot";
  }

  if (!isAcceptedDigestAlgorithm(record.digestAlgorithm)) {
    return "invalid_snapshot";
  }

  if (typeof record.digest !== "string" || !/^[0-9a-f]{64}$/.test(record.digest)) {
    return "invalid_snapshot";
  }

  return null;
}

function isAcceptedDigestAlgorithm(value: unknown): boolean {
  return typeof value === "string" && ACCEPTED_SNAPSHOT_DIGEST_ALGORITHMS.has(value);
}

function boundedDimension(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= SNAPSHOT_PHOTO_MAX_DIMENSION
  );
}
