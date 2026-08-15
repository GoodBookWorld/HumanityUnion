import type { ParticipationMode, Petition, PetitionPolicy, PetitionSubject } from "@hu/types";

const IMMUTABLE_PATCH_FIELDS = new Set([
  "petitionId",
  "collectiveDecisionId",
  "status",
  "createdAt",
  "updatedAt",
  "signatures",
  "supportMetrics",
  "outcome",
  "shareLink",
]);

const PATCHABLE_FIELDS = new Set(["subject", "policy"]);

export function validatePetitionId(petitionId: string): string | null {
  if (!petitionId.trim()) {
    return "Petition identifier is required.";
  }

  return null;
}

export function validatePatchBody(body: Record<string, unknown>): string | null {
  for (const key of Object.keys(body)) {
    if (IMMUTABLE_PATCH_FIELDS.has(key)) {
      return `Field "${key}" cannot be modified.`;
    }

    if (!PATCHABLE_FIELDS.has(key)) {
      return `Field "${key}" cannot be modified.`;
    }
  }

  if (body.subject !== undefined && typeof body.subject !== "object") {
    return "subject must be an object.";
  }

  if (body.policy !== undefined && typeof body.policy !== "object") {
    return "policy must be an object.";
  }

  return null;
}

export function validateCreatePetition(petition: Petition): string | null {
  if (!petition.petitionId?.trim()) {
    return "petitionId is required.";
  }

  if (!petition.collectiveDecisionId?.trim()) {
    return "collectiveDecisionId is required.";
  }

  if (!petition.subject?.decisionId?.trim()) {
    return "subject.decisionId is required.";
  }

  if (!petition.subject?.initiativeId?.trim()) {
    return "subject.initiativeId is required.";
  }

  if (!petition.subject?.title?.trim()) {
    return "subject.title is required.";
  }

  if (!petition.subject?.summary?.trim()) {
    return "subject.summary is required.";
  }

  if (!petition.policy) {
    return "policy is required.";
  }

  if (petition.status !== "Draft") {
    return 'status must be "Draft" when creating a Petition.';
  }

  return null;
}

/**
 * Initiative Lifecycle — Part F, Section 7/8 (Representative Signatures).
 * `participantId` is now OPTIONAL in the body: the pre-existing
 * body-supplied contract (legacy Petition workspace UI, existing tests) is
 * left working unchanged, but the new Lifecycle-based public Petition
 * renderer never sends one — it relies on `signPetitionHandler` resolving
 * the real signed-in actor server-side, exactly like every Part D/E
 * reaction endpoint (`setInitiativeRevisionReaction`, etc.).
 */
export function validateSignBody(body: Record<string, unknown>): string | null {
  if (
    body.participantId !== undefined &&
    (typeof body.participantId !== "string" || !body.participantId.trim())
  ) {
    return "participantId must be a non-empty string when provided.";
  }

  if (
    body.participationMode !== undefined &&
    body.participationMode !== "Community" &&
    body.participationMode !== "Public"
  ) {
    return 'participationMode must be "Community" or "Public" when provided.';
  }

  return null;
}

export function parseSignRequest(body: Record<string, unknown>): {
  participantId?: string;
  participationMode?: ParticipationMode;
} {
  return {
    participantId: body.participantId as string | undefined,
    participationMode: body.participationMode as ParticipationMode | undefined,
  };
}

export function validateOptionalTimestampField(
  body: Record<string, unknown>,
  fieldName: string,
): string | null {
  const value = body[fieldName];

  if (value === undefined) {
    return null;
  }

  if (typeof value !== "string" || !value.trim()) {
    return `${fieldName} must be a non-empty string when provided.`;
  }

  return null;
}

export function parsePetitionUpdate(body: Record<string, unknown>): {
  subject?: Partial<PetitionSubject>;
  policy?: Partial<PetitionPolicy>;
} {
  const update: {
    subject?: Partial<PetitionSubject>;
    policy?: Partial<PetitionPolicy>;
  } = {};

  if (body.subject !== undefined) {
    update.subject = body.subject as Partial<PetitionSubject>;
  }

  if (body.policy !== undefined) {
    update.policy = body.policy as Partial<PetitionPolicy>;
  }

  return update;
}
