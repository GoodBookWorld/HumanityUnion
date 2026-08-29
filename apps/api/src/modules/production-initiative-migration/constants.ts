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
