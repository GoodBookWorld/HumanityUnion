import type {
  Availability,
  CommitmentContributionType,
} from "@hu/types";

import type {
  AddContributionItemInput,
  ContributionProfileUpdate,
  ImplementationCommitmentCreateInput,
  ImplementationCommitmentUpdate,
} from "./implementation-commitment.store.js";

const COMMITMENT_CONTRIBUTION_TYPES = new Set<CommitmentContributionType>([
  "Volunteer",
  "Professional",
  "Resource",
]);

const IMMUTABLE_PATCH_FIELDS = new Set([
  "implementationCommitmentId",
  "initiativeId",
  "collectiveDecisionId",
  "petitionId",
  "status",
  "createdAt",
  "updatedAt",
  "contributionProfiles",
  "contributionItems",
  "communityCapacity",
  "implementationReadiness",
  "policySatisfaction",
  "contributionSummary",
]);

const PATCHABLE_FIELDS = new Set(["subjectTitle", "subjectSummary", "frozenPolicyId"]);

export function validateCommitmentId(commitmentId: string): string | null {
  if (!commitmentId.trim()) {
    return "Implementation Commitment identifier is required.";
  }

  return null;
}

export function validateReferenceId(referenceId: string, label: string): string | null {
  if (!referenceId.trim()) {
    return `${label} is required.`;
  }

  return null;
}

export function validateContributionItemId(itemId: string): string | null {
  if (!itemId.trim()) {
    return "Contribution Item identifier is required.";
  }

  return null;
}

export function validatePatchBody(body: Record<string, unknown>): string | null {
  if (Object.keys(body).length === 0) {
    return "At least one patch field is required.";
  }

  for (const key of Object.keys(body)) {
    if (IMMUTABLE_PATCH_FIELDS.has(key)) {
      return `Field "${key}" cannot be modified.`;
    }

    if (!PATCHABLE_FIELDS.has(key)) {
      return `Field "${key}" cannot be modified.`;
    }
  }

  if (body.subjectTitle !== undefined && typeof body.subjectTitle !== "string") {
    return "subjectTitle must be a string.";
  }

  if (body.subjectSummary !== undefined && typeof body.subjectSummary !== "string") {
    return "subjectSummary must be a string.";
  }

  if (body.frozenPolicyId !== undefined && typeof body.frozenPolicyId !== "string") {
    return "frozenPolicyId must be a string.";
  }

  return null;
}

export function validateCreateBody(body: Record<string, unknown>): string | null {
  if (typeof body.implementationCommitmentId !== "string" || !body.implementationCommitmentId.trim()) {
    return "implementationCommitmentId is required.";
  }

  if (typeof body.initiativeId !== "string" || !body.initiativeId.trim()) {
    return "initiativeId is required.";
  }

  if (typeof body.collectiveDecisionId !== "string" || !body.collectiveDecisionId.trim()) {
    return "collectiveDecisionId is required.";
  }

  if (typeof body.petitionId !== "string" || !body.petitionId.trim()) {
    return "petitionId is required.";
  }

  if (typeof body.subjectTitle !== "string" || !body.subjectTitle.trim()) {
    return "subjectTitle is required.";
  }

  if (typeof body.subjectSummary !== "string" || !body.subjectSummary.trim()) {
    return "subjectSummary is required.";
  }

  if (body.frozenPolicyId !== undefined && typeof body.frozenPolicyId !== "string") {
    return "frozenPolicyId must be a string when provided.";
  }

  if (body.status !== undefined && body.status !== "Draft") {
    return 'status must be "Draft" when creating an Implementation Commitment.';
  }

  return null;
}

export function parseCreateInput(body: Record<string, unknown>): ImplementationCommitmentCreateInput {
  return {
    implementationCommitmentId: body.implementationCommitmentId as string,
    initiativeId: body.initiativeId as string,
    collectiveDecisionId: body.collectiveDecisionId as string,
    petitionId: body.petitionId as string,
    subjectTitle: body.subjectTitle as string,
    subjectSummary: body.subjectSummary as string,
    frozenPolicyId:
      typeof body.frozenPolicyId === "string" ? body.frozenPolicyId : undefined,
  };
}

export function parsePatchUpdate(body: Record<string, unknown>): ImplementationCommitmentUpdate {
  const update: ImplementationCommitmentUpdate = {};

  if (body.subjectTitle !== undefined) {
    update.subjectTitle = body.subjectTitle as string;
  }

  if (body.subjectSummary !== undefined) {
    update.subjectSummary = body.subjectSummary as string;
  }

  if (body.frozenPolicyId !== undefined) {
    update.frozenPolicyId = body.frozenPolicyId as string;
  }

  return update;
}

function validateAvailability(availability: unknown): string | null {
  if (typeof availability !== "object" || availability === null || Array.isArray(availability)) {
    return "availability must be an object.";
  }

  const value = availability as Record<string, unknown>;

  if (value.startsAt !== undefined && typeof value.startsAt !== "string") {
    return "availability.startsAt must be a string when provided.";
  }

  if (value.endsAt !== undefined && typeof value.endsAt !== "string") {
    return "availability.endsAt must be a string when provided.";
  }

  if (value.description !== undefined && typeof value.description !== "string") {
    return "availability.description must be a string when provided.";
  }

  if (!value.startsAt && !value.endsAt && !value.description) {
    return "availability must include a description or time boundary.";
  }

  return null;
}

export function validateContributionProfileBody(body: Record<string, unknown>): string | null {
  if (typeof body.participantId !== "string" || !body.participantId.trim()) {
    return "participantId is required.";
  }

  if (body.skillSummary !== undefined && typeof body.skillSummary !== "string") {
    return "skillSummary must be a string when provided.";
  }

  if (body.regionalContext !== undefined && typeof body.regionalContext !== "string") {
    return "regionalContext must be a string when provided.";
  }

  if (body.organizationalContext !== undefined && typeof body.organizationalContext !== "string") {
    return "organizationalContext must be a string when provided.";
  }

  return null;
}

export function parseContributionProfileUpdate(
  body: Record<string, unknown>,
): { participantId: string; update: ContributionProfileUpdate } {
  return {
    participantId: body.participantId as string,
    update: {
      skillSummary: body.skillSummary as string | undefined,
      regionalContext: body.regionalContext as string | undefined,
      organizationalContext: body.organizationalContext as string | undefined,
    },
  };
}

export function validateAddContributionItemBody(body: Record<string, unknown>): string | null {
  if (typeof body.contributionItemId !== "string" || !body.contributionItemId.trim()) {
    return "contributionItemId is required.";
  }

  if (typeof body.participantId !== "string" || !body.participantId.trim()) {
    return "participantId is required.";
  }

  if (
    typeof body.contributionType !== "string" ||
    !COMMITMENT_CONTRIBUTION_TYPES.has(body.contributionType as CommitmentContributionType)
  ) {
    return 'contributionType must be "Volunteer", "Professional", or "Resource".';
  }

  if (typeof body.contributionCapacity !== "string" || !body.contributionCapacity.trim()) {
    return "contributionCapacity is required.";
  }

  const availabilityError = validateAvailability(body.availability);

  if (availabilityError) {
    return availabilityError;
  }

  if (body.profile !== undefined) {
    if (typeof body.profile !== "object" || body.profile === null || Array.isArray(body.profile)) {
      return "profile must be an object when provided.";
    }

    const profile = body.profile as Record<string, unknown>;

    if (profile.skillSummary !== undefined && typeof profile.skillSummary !== "string") {
      return "profile.skillSummary must be a string when provided.";
    }

    if (profile.regionalContext !== undefined && typeof profile.regionalContext !== "string") {
      return "profile.regionalContext must be a string when provided.";
    }

    if (
      profile.organizationalContext !== undefined &&
      typeof profile.organizationalContext !== "string"
    ) {
      return "profile.organizationalContext must be a string when provided.";
    }
  }

  return null;
}

export function parseAddContributionItemInput(
  body: Record<string, unknown>,
): AddContributionItemInput {
  const availability = body.availability as Availability;
  const profileBody =
    body.profile !== undefined ? (body.profile as Record<string, unknown>) : undefined;

  return {
    contributionItemId: body.contributionItemId as string,
    participantId: body.participantId as string,
    contributionType: body.contributionType as CommitmentContributionType,
    contributionCapacity: body.contributionCapacity as string,
    availability: {
      startsAt: availability.startsAt,
      endsAt: availability.endsAt,
      description: availability.description,
    },
    profile: profileBody
      ? {
          skillSummary: profileBody.skillSummary as string | undefined,
          regionalContext: profileBody.regionalContext as string | undefined,
          organizationalContext: profileBody.organizationalContext as string | undefined,
        }
      : undefined,
  };
}

export function validateWithdrawContributionBody(body: Record<string, unknown>): string | null {
  if (
    body.participantId !== undefined &&
    (typeof body.participantId !== "string" || !body.participantId.trim())
  ) {
    return "participantId must be a non-empty string when provided.";
  }

  return null;
}

export function parseWithdrawContributionBody(body: Record<string, unknown>): {
  participantId?: string;
} {
  return {
    participantId:
      typeof body.participantId === "string" ? body.participantId : undefined,
  };
}
