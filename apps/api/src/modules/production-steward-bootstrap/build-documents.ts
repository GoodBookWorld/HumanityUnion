import { randomUUID } from "node:crypto";

import type { MemberProfileVisibility } from "@hu/types";
import type { DirectMessagingPolicy } from "@hu/types";

import { hashPassword } from "../auth/auth-password.js";
import { APPROVED_PRODUCTION_STEWARDS } from "./constants.js";
import { ProductionStewardBootstrapError } from "./errors.js";
import { maskEmail, normalizeEmail } from "./redact.js";
import type {
  SanitizedAuthUserDocument,
  SanitizedMemberDocument,
  SanitizedMemberProfileDocument,
  SourceStewardIdentity,
  StewardPreparedDocuments,
} from "./types.js";

function asVisibility(
  value: string | undefined,
  fallback: MemberProfileVisibility,
): MemberProfileVisibility {
  if (value === "public" || value === "members_only" || value === "private") {
    return value;
  }
  return fallback;
}

function asMessagingPolicy(
  value: string | undefined,
  fallback: DirectMessagingPolicy,
): DirectMessagingPolicy {
  if (value === "active_allies" || value === "registered_participants" || value === "nobody") {
    return value;
  }
  return fallback;
}

function resolveLanguages(source: SourceStewardIdentity): string[] {
  if (source.languages && source.languages.length > 0) {
    return [...source.languages];
  }
  return ["en"];
}

function createMemberNumber(): string {
  return `HU-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export async function buildSanitizedAuthUser(
  source: SourceStewardIdentity,
  nowIso: string,
): Promise<{ document: SanitizedAuthUserDocument; unusablePasswordSecret: string }> {
  const unusablePasswordSecret = `migration-reset-required-${randomUUID()}`;
  const passwordHash = await hashPassword(unusablePasswordSecret);
  return {
    unusablePasswordSecret,
    document: {
      userId: source.userId,
      memberId: source.memberId,
      email: normalizeEmail(source.email),
      passwordHash,
      displayName: source.displayName.trim(),
      role: "member",
      status: "active",
      emailVerificationStatus: "pending",
      createdAt: source.authCreatedAt ?? nowIso,
      updatedAt: nowIso,
    },
  };
}

export function buildSanitizedMember(
  source: SourceStewardIdentity,
  nowIso: string,
): SanitizedMemberDocument {
  return {
    memberId: source.memberId,
    identityId: source.userId,
    displayName: source.displayName.trim(),
    uniqueName: source.uniqueName,
    languages: resolveLanguages(source),
    status: "active",
    verificationLevel: "email",
    roles: ["member"],
    registrationStatus: "registered",
    version: 1,
    createdAt: source.memberCreatedAt ?? nowIso,
    updatedAt: nowIso,
  };
}

export function buildSanitizedMemberProfile(
  source: SourceStewardIdentity,
  nowIso: string,
): SanitizedMemberProfileDocument {
  const profile = source.profile ?? {};
  const document: SanitizedMemberProfileDocument = {
    profileId: source.profileId,
    userId: source.userId,
    memberNumber: profile.memberNumber?.trim() || createMemberNumber(),
    displayName: source.displayName.trim(),
    publicName: source.publicName,
    skills: profile.skills ? [...profile.skills] : [],
    participationVisibility: asVisibility(profile.participationVisibility, "members_only"),
    language: profile.language?.trim() || "en",
    profileVisibility: asVisibility(profile.profileVisibility, "members_only"),
    showOrganization: profile.showOrganization ?? true,
    showLocation: profile.showLocation ?? true,
    showParticipationArea: profile.showParticipationArea ?? true,
    membershipPubliclyVisible: false,
    skillsVisibility: asVisibility(profile.skillsVisibility, "members_only"),
    professionalLinksVisibility: asVisibility(profile.professionalLinksVisibility, "public"),
    showInitiativesStatistics: profile.showInitiativesStatistics ?? true,
    showCollectiveDecisionsStatistics: profile.showCollectiveDecisionsStatistics ?? true,
    showAlliesStatistics: profile.showAlliesStatistics ?? true,
    showProposalsStatistics: profile.showProposalsStatistics ?? true,
    showPetitionsStatistics: profile.showPetitionsStatistics ?? true,
    showCommitmentsStatistics: profile.showCommitmentsStatistics ?? true,
    messagingPolicy: asMessagingPolicy(profile.messagingPolicy, "active_allies"),
    status: "active",
    createdAt: profile.createdAt ?? nowIso,
    updatedAt: nowIso,
  };

  if (profile.biography) document.biography = profile.biography;
  if (profile.avatarUrl) document.avatarUrl = profile.avatarUrl;
  if (profile.organization) document.organization = profile.organization;
  if (profile.website) document.website = profile.website;
  if (profile.linkedinUrl) document.linkedinUrl = profile.linkedinUrl;
  if (profile.facebookUrl) document.facebookUrl = profile.facebookUrl;
  if (profile.youtubeUrl) document.youtubeUrl = profile.youtubeUrl;
  if (profile.instagramUrl) document.instagramUrl = profile.instagramUrl;
  if (profile.xUrl) document.xUrl = profile.xUrl;
  if (profile.country) document.country = profile.country;
  if (profile.region) document.region = profile.region;
  if (profile.community) document.community = profile.community;
  if (profile.participationAreaId) document.participationAreaId = profile.participationAreaId;
  if (profile.timezone) document.timezone = profile.timezone;

  return document;
}

export async function prepareStewardDocuments(
  identities: SourceStewardIdentity[],
  nowIso: string = new Date().toISOString(),
): Promise<StewardPreparedDocuments[]> {
  if (identities.length !== APPROVED_PRODUCTION_STEWARDS.length) {
    throw new ProductionStewardBootstrapError(
      `Expected ${APPROVED_PRODUCTION_STEWARDS.length} identities.`,
      "INVALID_MANIFEST",
    );
  }

  const prepared: StewardPreparedDocuments[] = [];
  for (const source of identities) {
    const approved = APPROVED_PRODUCTION_STEWARDS.find((row) => row.memberId === source.memberId);
    if (!approved) {
      throw new ProductionStewardBootstrapError(
        `Unexpected steward memberId ${source.memberId}.`,
        "MANIFEST_ALLOWLIST_MISMATCH",
      );
    }
    const emailMasked = maskEmail(source.email);
    if (!emailMasked) {
      throw new ProductionStewardBootstrapError(
        `Cannot mask email for ${approved.label}.`,
        "INVALID_MANIFEST",
      );
    }
    const { document: auth } = await buildSanitizedAuthUser(source, nowIso);
    prepared.push({
      label: approved.label,
      memberId: source.memberId,
      userId: source.userId,
      profileId: source.profileId,
      emailMasked,
      publicName: source.publicName,
      uniqueName: source.uniqueName,
      auth,
      member: buildSanitizedMember(source, nowIso),
      profile: buildSanitizedMemberProfile(source, nowIso),
      discardedSourcePasswordHash: source.sourcePasswordHash,
    });
  }
  return prepared;
}
