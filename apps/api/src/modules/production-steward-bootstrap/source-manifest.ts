import fs from "node:fs";
import path from "node:path";

import type { DirectMessagingPolicy, MemberProfileVisibility } from "@hu/types";

import {
  APPROVED_PRODUCTION_STEWARDS,
  SOURCE_MANIFEST_VERSION,
} from "./constants.js";
import { ProductionStewardBootstrapError } from "./errors.js";
import { normalizeEmail } from "./redact.js";
import type {
  SourceProfileAttribution,
  SourceStewardIdentity,
  SourceStewardManifest,
} from "./types.js";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function readOptionalString(value: unknown): string | undefined {
  return isNonEmptyString(value) ? value.trim() : undefined;
}

function readVisibility(value: unknown): MemberProfileVisibility | undefined {
  return value === "public" || value === "members_only" || value === "private"
    ? value
    : undefined;
}

function readMessagingPolicy(value: unknown): DirectMessagingPolicy | undefined {
  return value === "active_allies" ||
    value === "registered_participants" ||
    value === "nobody"
    ? value
    : undefined;
}

function parseProfile(raw: Record<string, unknown> | undefined): SourceProfileAttribution | undefined {
  if (!raw) return undefined;
  return {
    memberNumber: readOptionalString(raw.memberNumber),
    biography: readOptionalString(raw.biography),
    avatarUrl: readOptionalString(raw.avatarUrl),
    organization: readOptionalString(raw.organization),
    website: readOptionalString(raw.website),
    linkedinUrl: readOptionalString(raw.linkedinUrl),
    facebookUrl: readOptionalString(raw.facebookUrl),
    youtubeUrl: readOptionalString(raw.youtubeUrl),
    instagramUrl: readOptionalString(raw.instagramUrl),
    xUrl: readOptionalString(raw.xUrl),
    skills: Array.isArray(raw.skills)
      ? raw.skills.filter((entry): entry is string => typeof entry === "string")
      : undefined,
    country: readOptionalString(raw.country),
    region: readOptionalString(raw.region),
    community: readOptionalString(raw.community),
    participationAreaId: readOptionalString(raw.participationAreaId),
    participationVisibility: readVisibility(raw.participationVisibility),
    language: readOptionalString(raw.language),
    timezone: readOptionalString(raw.timezone),
    profileVisibility: readVisibility(raw.profileVisibility),
    showOrganization: typeof raw.showOrganization === "boolean" ? raw.showOrganization : undefined,
    showLocation: typeof raw.showLocation === "boolean" ? raw.showLocation : undefined,
    showParticipationArea:
      typeof raw.showParticipationArea === "boolean" ? raw.showParticipationArea : undefined,
    skillsVisibility: readVisibility(raw.skillsVisibility),
    professionalLinksVisibility: readVisibility(raw.professionalLinksVisibility),
    showInitiativesStatistics:
      typeof raw.showInitiativesStatistics === "boolean"
        ? raw.showInitiativesStatistics
        : undefined,
    showCollectiveDecisionsStatistics:
      typeof raw.showCollectiveDecisionsStatistics === "boolean"
        ? raw.showCollectiveDecisionsStatistics
        : undefined,
    showAlliesStatistics:
      typeof raw.showAlliesStatistics === "boolean" ? raw.showAlliesStatistics : undefined,
    showProposalsStatistics:
      typeof raw.showProposalsStatistics === "boolean" ? raw.showProposalsStatistics : undefined,
    showPetitionsStatistics:
      typeof raw.showPetitionsStatistics === "boolean" ? raw.showPetitionsStatistics : undefined,
    showCommitmentsStatistics:
      typeof raw.showCommitmentsStatistics === "boolean"
        ? raw.showCommitmentsStatistics
        : undefined,
    messagingPolicy: readMessagingPolicy(raw.messagingPolicy),
    createdAt: readOptionalString(raw.createdAt),
  };
}

function parseIdentity(raw: unknown, index: number): SourceStewardIdentity {
  if (!raw || typeof raw !== "object") {
    throw new ProductionStewardBootstrapError(
      `Source manifest identity[${index}] must be an object.`,
      "INVALID_MANIFEST",
    );
  }
  const row = raw as Record<string, unknown>;
  for (const key of [
    "label",
    "memberId",
    "userId",
    "profileId",
    "email",
    "displayName",
    "publicName",
    "uniqueName",
  ] as const) {
    if (!isNonEmptyString(row[key])) {
      throw new ProductionStewardBootstrapError(
        `Source manifest identity[${index}].${key} is required.`,
        "INVALID_MANIFEST",
      );
    }
  }

  const languages = Array.isArray(row.languages)
    ? row.languages.filter(
        (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
      )
    : undefined;

  return {
    label: String(row.label).trim(),
    memberId: String(row.memberId).trim(),
    userId: String(row.userId).trim(),
    profileId: String(row.profileId).trim(),
    email: normalizeEmail(String(row.email)),
    displayName: String(row.displayName).trim(),
    publicName: String(row.publicName).trim(),
    uniqueName: String(row.uniqueName).trim(),
    languages,
    memberCreatedAt: readOptionalString(row.memberCreatedAt),
    authCreatedAt: readOptionalString(row.authCreatedAt),
    sourcePasswordHash:
      typeof row.sourcePasswordHash === "string" ? row.sourcePasswordHash : undefined,
    profile: parseProfile(
      row.profile && typeof row.profile === "object"
        ? (row.profile as Record<string, unknown>)
        : undefined,
    ),
  };
}

export function parseSourceStewardManifest(raw: unknown): SourceStewardManifest {
  if (!raw || typeof raw !== "object") {
    throw new ProductionStewardBootstrapError(
      "Source manifest must be a JSON object.",
      "INVALID_MANIFEST",
    );
  }
  const doc = raw as Record<string, unknown>;
  if (doc.version !== SOURCE_MANIFEST_VERSION) {
    throw new ProductionStewardBootstrapError(
      `Source manifest version must be ${SOURCE_MANIFEST_VERSION}.`,
      "INVALID_MANIFEST",
    );
  }
  if (!Array.isArray(doc.identities) || doc.identities.length !== APPROVED_PRODUCTION_STEWARDS.length) {
    throw new ProductionStewardBootstrapError(
      `Source manifest must contain exactly ${APPROVED_PRODUCTION_STEWARDS.length} identities.`,
      "INVALID_MANIFEST",
    );
  }

  const identities = doc.identities.map((entry, index) => parseIdentity(entry, index));
  assertManifestMatchesAllowList(identities);
  return { version: SOURCE_MANIFEST_VERSION, identities };
}

export function assertManifestMatchesAllowList(identities: SourceStewardIdentity[]): void {
  const byMemberId = new Map(identities.map((identity) => [identity.memberId, identity]));

  for (const approved of APPROVED_PRODUCTION_STEWARDS) {
    const identity = byMemberId.get(approved.memberId);
    if (!identity) {
      throw new ProductionStewardBootstrapError(
        `Source manifest missing approved steward ${approved.label} (${approved.memberId}).`,
        "MANIFEST_ALLOWLIST_MISMATCH",
      );
    }
    if (identity.userId !== approved.userId) {
      throw new ProductionStewardBootstrapError(
        `Source userId mismatch for ${approved.label}.`,
        "MANIFEST_ALLOWLIST_MISMATCH",
      );
    }
    if (identity.profileId !== approved.profileId) {
      throw new ProductionStewardBootstrapError(
        `Source profileId mismatch for ${approved.label}.`,
        "MANIFEST_ALLOWLIST_MISMATCH",
      );
    }
    if (identity.publicName !== approved.publicName) {
      throw new ProductionStewardBootstrapError(
        `Source publicName mismatch for ${approved.label}: expected exact "${approved.publicName}".`,
        "MANIFEST_ALLOWLIST_MISMATCH",
      );
    }
    if (identity.uniqueName !== approved.uniqueName) {
      throw new ProductionStewardBootstrapError(
        `Source uniqueName mismatch for ${approved.label}: expected exact legacy "${approved.uniqueName}".`,
        "MANIFEST_ALLOWLIST_MISMATCH",
      );
    }
    if (!identity.email.includes("@")) {
      throw new ProductionStewardBootstrapError(
        `Source email invalid for ${approved.label}.`,
        "INVALID_MANIFEST",
      );
    }
  }

  if (byMemberId.size !== APPROVED_PRODUCTION_STEWARDS.length) {
    throw new ProductionStewardBootstrapError(
      "Source manifest contains duplicate or unexpected memberIds.",
      "MANIFEST_ALLOWLIST_MISMATCH",
    );
  }
}

/**
 * Load private JSON manifest from disk.
 * Prefer mode 0600; refuse world-readable files.
 */
export function loadSourceStewardManifestFromFile(filePath: string): SourceStewardManifest {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new ProductionStewardBootstrapError(
      `Source manifest not found at ${resolved}.`,
      "MISSING_MANIFEST",
    );
  }

  const stats = fs.statSync(resolved);
  if (!stats.isFile()) {
    throw new ProductionStewardBootstrapError(
      `Source manifest path is not a file: ${resolved}.`,
      "INVALID_MANIFEST",
    );
  }
  if ((stats.mode & 0o004) !== 0) {
    throw new ProductionStewardBootstrapError(
      `Refusing world-readable source manifest (${resolved}). chmod 600 required.`,
      "INSECURE_MANIFEST_PERMISSIONS",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(resolved, "utf8"));
  } catch {
    throw new ProductionStewardBootstrapError(
      "Source manifest is not valid JSON.",
      "INVALID_MANIFEST",
    );
  }

  return parseSourceStewardManifest(parsed);
}

export function writeSourceStewardManifestFile(
  filePath: string,
  manifest: SourceStewardManifest,
): string {
  const resolved = path.resolve(filePath);
  const dir = path.dirname(resolved);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.chmodSync(resolved, 0o600);
  return resolved;
}
