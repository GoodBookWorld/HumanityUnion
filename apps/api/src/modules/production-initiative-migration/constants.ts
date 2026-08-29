/**
 * Production Initiative / civic graph migration — Task 07.1 read-only preflight.
 * Independent of Pack 02 historical migration allow-lists and write paths.
 */

export const PRODUCTION_INITIATIVE_MIGRATION_SOURCE_DATABASE =
  "humanity_union_staging" as const;
export const PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE =
  "humanity_union_production" as const;

/** Exact nine Initiative roots — never substitute. */
export const CANONICAL_PRODUCTION_INITIATIVE_IDS = [
  "initiative-1783748417899",
  "initiative-1784349613932",
  "initiative-1785636843367",
  "initiative-1787085139612",
  "initiative-1785948978037",
  "initiative-1785693642422",
  "initiative-1787021393864",
  "initiative-1787025677193",
  "initiative-1787189571159",
] as const;

export type CanonicalProductionInitiativeId =
  (typeof CANONICAL_PRODUCTION_INITIATIVE_IDS)[number];

/** Explicitly excluded from production civic migration. */
export const EXCLUDED_PRODUCTION_INITIATIVE_IDS = [
  "initiative-bootstrap-001",
  "initiative-1787191372634",
] as const;

/** Known typo — AI for the Common Good is …2422, never this. */
export const FORBIDDEN_TYPO_AI_COMMON_GOOD_ID = "initiative-1785693643367" as const;

export const CANONICAL_INITIATIVE_EXPECTATIONS = [
  {
    initiativeId: "initiative-1783748417899",
    title: "Citizen Support Squad (CSS)",
    stewardMemberId: "a5e65d2f-3be7-4f8f-acd9-87c68027d662",
    stewardLabel: "Vlad Shapran",
  },
  {
    initiativeId: "initiative-1784349613932",
    title: "The Mind-Safe Alliance",
    stewardMemberId: "a5e65d2f-3be7-4f8f-acd9-87c68027d662",
    stewardLabel: "Vlad Shapran",
  },
  {
    initiativeId: "initiative-1785636843367",
    title: 'Bridging the "New World Disorder"',
    stewardMemberId: "9cde6a4e-0fda-4132-8e7e-78432b864231",
    stewardLabel: "Leonardo",
  },
  {
    initiativeId: "initiative-1787085139612",
    title: "The Global Human Capital & Democracy Initiative",
    stewardMemberId: "9cde6a4e-0fda-4132-8e7e-78432b864231",
    stewardLabel: "Leonardo",
  },
  {
    initiativeId: "initiative-1785948978037",
    title: "Development of the Humanity Union platform",
    stewardMemberId: "5bb8e373-c042-4786-a69c-0340301711d8",
    stewardLabel: "Munia Khan",
  },
  {
    initiativeId: "initiative-1785693642422",
    title: "AI for the Common Good",
    stewardMemberId: "57696395-199d-48b2-bbeb-bc30d2a1ba6c",
    stewardLabel: "Derek Jennett",
  },
  {
    initiativeId: "initiative-1787021393864",
    title: "The Global Civic Defense",
    stewardMemberId: "57696395-199d-48b2-bbeb-bc30d2a1ba6c",
    stewardLabel: "Derek Jennett",
  },
  {
    initiativeId: "initiative-1787025677193",
    title: "Chief Destroyer of Statehood and Morality",
    stewardMemberId: "57696395-199d-48b2-bbeb-bc30d2a1ba6c",
    stewardLabel: "Derek Jennett",
  },
  {
    initiativeId: "initiative-1787189571159",
    title: "Kelowna Mayor Election",
    stewardMemberId: "57696395-199d-48b2-bbeb-bc30d2a1ba6c",
    stewardLabel: "Derek Jennett",
  },
] as const;

/** Five approved Participants for production civic migration. */
export const APPROVED_PRODUCTION_PARTICIPANTS = [
  {
    label: "Vlad Shapran",
    memberId: "a5e65d2f-3be7-4f8f-acd9-87c68027d662",
    userId: "5a56a3fd-58d1-41b3-be64-c15ca3e93a28",
    profileId: "c7ef47df-1078-41c6-bf96-b545d1508dc9",
    authRole: "member" as const,
    isAdmin: false,
  },
  {
    label: "Leonardo",
    memberId: "9cde6a4e-0fda-4132-8e7e-78432b864231",
    userId: "2e3375dd-dfb1-42a2-8ce2-98a9022cbaae",
    profileId: "97e5c58e-502c-4f6e-9e4b-d22621d56225",
    authRole: "member" as const,
    isAdmin: false,
  },
  {
    label: "Derek Jennett",
    memberId: "57696395-199d-48b2-bbeb-bc30d2a1ba6c",
    userId: "0bf8690c-5e07-4fff-8acb-d56722d5ce80",
    profileId: "b7fb919a-d7aa-4cf9-8fb8-5546f6cb1ad6",
    authRole: "member" as const,
    isAdmin: false,
  },
  {
    label: "Munia Khan",
    memberId: "5bb8e373-c042-4786-a69c-0340301711d8",
    userId: "7e876d38-0c1e-4241-b520-44bdfc11781a",
    profileId: "5c0b5c68-7c01-43e7-b456-30e392bb4544",
    authRole: "member" as const,
    isAdmin: false,
  },
  {
    label: "Volody",
    memberId: "58229b2a-adff-4aa0-bb0e-b4d210248ecf",
    userId: "13561681-8a25-4bb7-ab97-f9c9e61870bb",
    profileId: "82f70df3-cb47-4221-96c5-0e154c9834c5",
    authRole: "admin" as const,
    isAdmin: true,
  },
] as const;

/** Synthetic Pack 03 media owner — never bootstrap as Participant. */
export const SYSTEM_MEDIA_RECOVERY_OWNER = "system-media-recovery" as const;

export const ACTOR_IDENTITY_FIELDS = [
  "stewardId",
  "authorId",
  "participantId",
  "authorUserId",
  "actorUserId",
  "userId",
  "ownerUserId",
  "ownerParticipantId",
  "memberId",
  "voterId",
  "signerId",
  "senderParticipantId",
  "createdByParticipantId",
  "uploadedByParticipantId",
  "requestedByParticipantId",
  "completedByParticipantId",
  "submittedByParticipantId",
  "sourceParticipantId",
  "creatorParticipantId",
  "recordedByParticipantId",
  "proposedByParticipantId",
  "proposedParticipantId",
  "previousOwnerId",
  "administrativelyBlockedByParticipantId",
  "respondedByParticipantId",
] as const;

export const STRIPE_OPERATIONAL_FIELDS = [
  "stripeCheckoutSessionId",
  "stripePaymentIntentId",
  "stripeChargeId",
  "stripeCustomerId",
  "lastStripeEventId",
  "stripeEventId",
  "stripeShippingRateId",
] as const;

export const PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_FLAG =
  "PRODUCTION_INITIATIVE_MIGRATION_CONFIRM" as const;
export const PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_VALUE = "YES" as const;

/** Explicit dual-connection env vars — never reuse a single Render service DB as both sides. */
export const SOURCE_MONGODB_URI_ENV = "PRODUCTION_INITIATIVE_MIGRATION_SOURCE_URI" as const;
export const SOURCE_MONGODB_DATABASE_ENV =
  "PRODUCTION_INITIATIVE_MIGRATION_SOURCE_DATABASE" as const;
export const DESTINATION_MONGODB_URI_ENV =
  "PRODUCTION_INITIATIVE_MIGRATION_DESTINATION_URI" as const;
export const DESTINATION_MONGODB_DATABASE_ENV =
  "PRODUCTION_INITIATIVE_MIGRATION_DESTINATION_DATABASE" as const;

/** Canonical production public media base (Task 07.2). */
export const PRODUCTION_MEDIA_PUBLIC_BASE_URL = "https://media.huws.org" as const;

/**
 * Explicit media-copy authorization — required in addition to Mongo --execute confirm.
 * performMediaCopies=true alone is never sufficient.
 */
export const MEDIA_COPY_ENABLED_ENV =
  "PRODUCTION_INITIATIVE_MIGRATION_MEDIA_COPY" as const;
export const MEDIA_COPY_ENABLED_VALUE = "YES" as const;

/** Dual R2 (staging public → production public). Never infer both sides from one R2_* set. */
export const SOURCE_R2_ACCOUNT_ID_ENV =
  "PRODUCTION_INITIATIVE_MIGRATION_SOURCE_R2_ACCOUNT_ID" as const;
export const SOURCE_R2_ACCESS_KEY_ID_ENV =
  "PRODUCTION_INITIATIVE_MIGRATION_SOURCE_R2_ACCESS_KEY_ID" as const;
export const SOURCE_R2_SECRET_ACCESS_KEY_ENV =
  "PRODUCTION_INITIATIVE_MIGRATION_SOURCE_R2_SECRET_ACCESS_KEY" as const;
export const SOURCE_R2_BUCKET_ENV =
  "PRODUCTION_INITIATIVE_MIGRATION_SOURCE_R2_BUCKET" as const;

export const DESTINATION_R2_ACCOUNT_ID_ENV =
  "PRODUCTION_INITIATIVE_MIGRATION_DESTINATION_R2_ACCOUNT_ID" as const;
export const DESTINATION_R2_ACCESS_KEY_ID_ENV =
  "PRODUCTION_INITIATIVE_MIGRATION_DESTINATION_R2_ACCESS_KEY_ID" as const;
export const DESTINATION_R2_SECRET_ACCESS_KEY_ENV =
  "PRODUCTION_INITIATIVE_MIGRATION_DESTINATION_R2_SECRET_ACCESS_KEY" as const;
export const DESTINATION_R2_BUCKET_ENV =
  "PRODUCTION_INITIATIVE_MIGRATION_DESTINATION_R2_BUCKET" as const;
export const DESTINATION_R2_PUBLIC_BASE_URL_ENV =
  "PRODUCTION_INITIATIVE_MIGRATION_DESTINATION_R2_PUBLIC_BASE_URL" as const;

export const FORBIDDEN_MIGRATE_COLLECTIONS = [
  "outbox",
  "processed_events",
  "auth_sessions",
  "email_verification_tokens",
  "email_confirmation_codes",
  "member_notifications",
  "admin_notifications",
  "membership_webhook_events",
  "activities",
  "discussions",
  "proposals",
  "decisions",
] as const;

/**
 * Explicit destination write allow-list for the executor.
 * Any collection not listed here is structurally refused by insertOwned.
 */
export const ALLOWED_WRITE_COLLECTIONS = [
  "initiatives",
  "initiative_analyses",
  "initiative_improvement_proposals_collections",
  "initiative_version_revisions",
  "initiative_revision_drafts",
  "initiative_discussion_completions",
  "initiative_petition_drafts",
  "initiative_decision_session_drafts",
  "initiative_collective_decision_lifecycle_drafts",
  "initiative_implementation_commitment_lifecycle_drafts",
  "initiative_implementation_tracking_lifecycle_drafts",
  "initiative_official_response_lifecycle_drafts",
  "initiative_public_impact_lifecycle_drafts",
  "initiative_civic_archive_lifecycle_drafts",
  "initiative_comments",
  "initiative_allies",
  "initiative_collaboration_channel_messages",
  "initiative_collaboration_sessions",
  "initiative_collaboration_session_attendances",
  "shared_documents",
  "decision_sessions",
  "initiative_collective_decisions",
  "initiative_decision_votes",
  "initiative_decision_vote_history",
  "public_choice_candidates",
  "petitions",
  "petition_signatures",
  "initiative_implementation_commitment_packages",
  "initiative_implementation_commitments",
  "initiative_implementation_tracking_packages",
  "initiative_implementation_trackings",
  "implementation_tracking_updates",
  "initiative_official_response_packages",
  "initiative_official_response_package_records",
  "initiative_public_impact_reports",
  "initiative_public_impacts",
  "public_impact_evidence",
  "initiative_civic_archive_versions",
  "media_upload_records",
  "memberships",
  "membership_contributions",
  "member_badge_applications",
  "member_badge_contributions",
] as const;

export const VLAD_SHAPRAN_MEMBER_ID = "a5e65d2f-3be7-4f8f-acd9-87c68027d662" as const;
export const VLAD_SHAPRAN_USER_ID = "5a56a3fd-58d1-41b3-be64-c15ca3e93a28" as const;

const TEST_DATABASE_NAME_PATTERN = /^hu_test_[a-zA-Z0-9_]+$/;

export function isCanonicalInitiativeId(id: string): boolean {
  return (CANONICAL_PRODUCTION_INITIATIVE_IDS as readonly string[]).includes(id);
}

export function isExcludedInitiativeId(id: string): boolean {
  return (EXCLUDED_PRODUCTION_INITIATIVE_IDS as readonly string[]).includes(id);
}

export function isForbiddenTypoAiCommonGoodId(id: string): boolean {
  return id === FORBIDDEN_TYPO_AI_COMMON_GOOD_ID;
}

export function isTestIsolationDatabase(database: string): boolean {
  return TEST_DATABASE_NAME_PATTERN.test(database.trim());
}

export function approvedMemberIdSet(): Set<string> {
  return new Set(APPROVED_PRODUCTION_PARTICIPANTS.map((p) => p.memberId));
}

export function approvedUserIdSet(): Set<string> {
  return new Set(APPROVED_PRODUCTION_PARTICIPANTS.map((p) => p.userId));
}
