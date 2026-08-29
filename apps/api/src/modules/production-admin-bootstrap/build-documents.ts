import { randomUUID } from "node:crypto";

import type { DirectMessagingPolicy, MemberProfileVisibility } from "@hu/types";

import { hashPassword } from "../auth/auth-password.js";
import {
  maskEmail,
  normalizeEmail,
} from "../production-steward-bootstrap/redact.js";
import { APPROVED_PRODUCTION_ADMIN } from "./constants.js";
import { ProductionAdminBootstrapError } from "./errors.js";
import type {
  AdminPreparedDocuments,
  SanitizedAdminAuthUserDocument,
  SanitizedAdminMemberDocument,
  SanitizedAdminMemberProfileDocument,
  SourceAdminIdentity,
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

function createMemberNumber(): string {
  return `HU-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export async function buildSanitizedAdminAuthUser(
  source: SourceAdminIdentity,
  nowIso: string,
): Promise<{ document: SanitizedAdminAuthUserDocument; unusablePasswordSecret: string }> {
  if (source.authRole !== "admin") {
    throw new ProductionAdminBootstrapError(
      "Refuse non-admin authRole in Admin bootstrap document builder.",
      "INVALID_ADMIN_ROLE",
    );
  }
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
      role: "admin",
      status: "active",
      emailVerificationStatus: "pending",
      createdAt: source.authCreatedAt ?? nowIso,
      updatedAt: nowIso,
    },
  };
}

export function buildSanitizedAdminMember(
  source: SourceAdminIdentity,
  nowIso: string,
): SanitizedAdminMemberDocument {
  return {
    memberId: source.memberId,
    identityId: source.userId,
    displayName: source.displayName.trim(),
    uniqueName: source.uniqueName,
    languages: source.languages?.length ? [...source.languages] : ["en"],
    status: "active",
    verificationLevel: "email",
    roles: ["member"],
    registrationStatus: "registered",
    version: 1,
    createdAt: source.memberCreatedAt ?? nowIso,
    updatedAt: nowIso,
  };
}

export function buildSanitizedAdminMemberProfile(
  source: SourceAdminIdentity,
  nowIso: string,
): SanitizedAdminMemberProfileDocument {
  const profile = source.profile ?? {};
  const document: SanitizedAdminMemberProfileDocument = {
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
    // Volody is not an active_member; default false unless staging explicitly set true
    // (Pack 25A.1 requires active_member to enable true — preserve only if present).
    membershipPubliclyVisible: profile.membershipPubliclyVisible === true ? true : false,
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

export async function prepareAdminDocuments(
  identity: SourceAdminIdentity,
  nowIso: string = new Date().toISOString(),
): Promise<AdminPreparedDocuments> {
  if (identity.memberId !== APPROVED_PRODUCTION_ADMIN.memberId) {
    throw new ProductionAdminBootstrapError(
      "Refuse Admin document prep for non-allow-listed identity.",
      "ADMIN_ALLOWLIST_MISMATCH",
    );
  }

  const emailMasked = maskEmail(identity.email);
  if (!emailMasked) {
    throw new ProductionAdminBootstrapError(
      "Cannot mask Admin source email.",
      "INVALID_MANIFEST",
    );
  }

  const { document: auth } = await buildSanitizedAdminAuthUser(identity, nowIso);
  return {
    label: APPROVED_PRODUCTION_ADMIN.label,
    memberId: identity.memberId,
    userId: identity.userId,
    profileId: identity.profileId,
    emailMasked,
    publicName: identity.publicName,
    uniqueName: identity.uniqueName,
    authRole: "admin",
    auth,
    member: buildSanitizedAdminMember(identity, nowIso),
    profile: buildSanitizedAdminMemberProfile(identity, nowIso),
    discardedSourcePasswordHash: identity.sourcePasswordHash,
  };
}
