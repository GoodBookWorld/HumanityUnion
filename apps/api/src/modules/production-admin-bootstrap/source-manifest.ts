import fs from "node:fs";
import path from "node:path";

import type { DirectMessagingPolicy, MemberProfileVisibility } from "@hu/types";

import {
  ADMIN_SOURCE_MANIFEST_VERSION,
  APPROVED_PRODUCTION_ADMIN,
} from "./constants.js";
import { ProductionAdminBootstrapError } from "./errors.js";
import { normalizeEmail } from "../production-steward-bootstrap/redact.js";
import type {
  SourceAdminIdentity,
  SourceAdminManifest,
  SourceAdminProfileAttribution,
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

function parseProfile(raw: Record<string, unknown> | undefined): SourceAdminProfileAttribution | undefined {
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
    membershipPubliclyVisible:
      typeof raw.membershipPubliclyVisible === "boolean"
        ? raw.membershipPubliclyVisible
        : undefined,
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

function parseIdentity(raw: unknown): SourceAdminIdentity {
  if (!raw || typeof raw !== "object") {
    throw new ProductionAdminBootstrapError(
      "Source admin manifest identity must be an object.",
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
      throw new ProductionAdminBootstrapError(
        `Source admin manifest identity.${key} is required.`,
        "INVALID_MANIFEST",
      );
    }
  }

  if (row.authRole !== "admin") {
    throw new ProductionAdminBootstrapError(
      'Source admin manifest identity.authRole must be exactly "admin" (never inferred).',
      "INVALID_ADMIN_ROLE",
    );
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
    authRole: "admin",
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

export function assertManifestMatchesAdminAllowList(identity: SourceAdminIdentity): void {
  const approved = APPROVED_PRODUCTION_ADMIN;
  if (identity.memberId !== approved.memberId) {
    throw new ProductionAdminBootstrapError(
      "Admin bootstrap allow-list mismatch: memberId is not the approved Volody identity.",
      "ADMIN_ALLOWLIST_MISMATCH",
    );
  }
  if (identity.userId !== approved.userId) {
    throw new ProductionAdminBootstrapError(
      "Admin bootstrap allow-list mismatch: userId is not the approved Volody identity.",
      "ADMIN_ALLOWLIST_MISMATCH",
    );
  }
  if (identity.profileId !== approved.profileId) {
    throw new ProductionAdminBootstrapError(
      "Admin bootstrap allow-list mismatch: profileId is not the approved Volody identity.",
      "ADMIN_ALLOWLIST_MISMATCH",
    );
  }
  if (identity.publicName !== approved.publicName) {
    throw new ProductionAdminBootstrapError(
      `Admin bootstrap allow-list mismatch: publicName must be exact "${approved.publicName}".`,
      "ADMIN_ALLOWLIST_MISMATCH",
    );
  }
  if (identity.uniqueName !== approved.uniqueName) {
    throw new ProductionAdminBootstrapError(
      `Admin bootstrap allow-list mismatch: uniqueName must be exact "${approved.uniqueName}".`,
      "ADMIN_ALLOWLIST_MISMATCH",
    );
  }
  if (identity.displayName.trim() !== approved.displayName) {
    throw new ProductionAdminBootstrapError(
      `Admin bootstrap allow-list mismatch: displayName must be exact "${approved.displayName}".`,
      "ADMIN_ALLOWLIST_MISMATCH",
    );
  }
  if (identity.authRole !== "admin") {
    throw new ProductionAdminBootstrapError(
      "Admin bootstrap refuse: authRole must be admin for allow-listed identity.",
      "INVALID_ADMIN_ROLE",
    );
  }
  if (!identity.email.includes("@")) {
    throw new ProductionAdminBootstrapError(
      "Source admin email invalid.",
      "INVALID_MANIFEST",
    );
  }
}

export function parseSourceAdminManifest(raw: unknown): SourceAdminManifest {
  if (!raw || typeof raw !== "object") {
    throw new ProductionAdminBootstrapError(
      "Source admin manifest must be a JSON object.",
      "INVALID_MANIFEST",
    );
  }
  const doc = raw as Record<string, unknown>;
  if (doc.version !== ADMIN_SOURCE_MANIFEST_VERSION) {
    throw new ProductionAdminBootstrapError(
      `Source admin manifest version must be ${ADMIN_SOURCE_MANIFEST_VERSION}.`,
      "INVALID_MANIFEST",
    );
  }
  if (!Array.isArray(doc.identities) || doc.identities.length !== 1) {
    throw new ProductionAdminBootstrapError(
      "Source admin manifest must contain exactly one identity (Volody).",
      "INVALID_MANIFEST",
    );
  }

  const identity = parseIdentity(doc.identities[0]);
  assertManifestMatchesAdminAllowList(identity);
  return { version: ADMIN_SOURCE_MANIFEST_VERSION, identities: [identity] };
}

export function loadSourceAdminManifestFromFile(filePath: string): SourceAdminManifest {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new ProductionAdminBootstrapError(
      `Source admin manifest not found at ${resolved}.`,
      "MISSING_MANIFEST",
    );
  }
  const stats = fs.statSync(resolved);
  if (!stats.isFile()) {
    throw new ProductionAdminBootstrapError(
      `Source admin manifest path is not a file: ${resolved}.`,
      "INVALID_MANIFEST",
    );
  }
  if ((stats.mode & 0o004) !== 0) {
    throw new ProductionAdminBootstrapError(
      `Refusing world-readable source admin manifest (${resolved}). chmod 600 required.`,
      "INSECURE_MANIFEST_PERMISSIONS",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(resolved, "utf8"));
  } catch {
    throw new ProductionAdminBootstrapError(
      "Source admin manifest is not valid JSON.",
      "INVALID_MANIFEST",
    );
  }

  return parseSourceAdminManifest(parsed);
}

export function writeSourceAdminManifestFile(
  filePath: string,
  manifest: SourceAdminManifest,
): string {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.chmodSync(resolved, 0o600);
  return resolved;
}
