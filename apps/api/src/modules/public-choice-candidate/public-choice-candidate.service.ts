import type { PublicChoiceCandidate, PublicChoiceCandidatePublicProjection } from "@hu/types";
import { resolveInitiativeLifecycleProfile, toPublicChoiceCandidatePublicProjection } from "@hu/types";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { countInitiativeDecisionVotesForCandidate } from "../initiative-decision-vote/persistence/initiative-decision-vote.repository.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import {
  createPublicChoiceCandidateId,
  deletePublicChoiceCandidate,
  getPublicChoiceCandidateById,
  insertPublicChoiceCandidate,
  listPublicChoiceCandidatesByInitiative,
  updatePublicChoiceCandidate,
} from "./persistence/public-choice-candidate.repository.js";

function assertPublicChoiceInitiative(initiativeId: string) {
  const initiative = getInitiativeById(initiativeId);
  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  if (resolveInitiativeLifecycleProfile(initiative.lifecycleProfile) !== "PUBLIC_CHOICE") {
    throw new Error("Candidates are only available on Public Choice initiatives.");
  }

  return initiative;
}

function assertAuthenticatedParticipant(identity: RequestIdentity): string {
  const participantId = identity.participantId?.trim();
  if (!participantId) {
    throw new Error("Authentication required to manage candidates.");
  }
  return participantId;
}

function isInitiativeSteward(
  initiative: ReturnType<typeof getInitiativeById>,
  participantId: string,
): boolean {
  return Boolean(initiative && initiative.stewardId === participantId);
}

function assertCanMutateCandidate(
  initiative: NonNullable<ReturnType<typeof getInitiativeById>>,
  identity: RequestIdentity,
  candidate: PublicChoiceCandidate,
): void {
  const participantId = assertAuthenticatedParticipant(identity);
  if (isInitiativeSteward(initiative, participantId)) {
    return;
  }

  if (candidate.submittedByParticipantId === participantId) {
    return;
  }

  throw new Error("You do not have access to modify this candidate.");
}

function assertCandidateSubmissionAllowed(initiative: NonNullable<ReturnType<typeof getInitiativeById>>) {
  if (initiative.metadata.publicChoiceResultsExpiredAt) {
    throw new Error("Candidate submission is closed. Temporary results retention has ended.");
  }
}

function validateCampaignPageUrl(value: string | undefined): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error("Campaign page must be a valid http or https URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Campaign page must be a valid http or https URL.");
  }

  return parsed.toString();
}

export interface CreatePublicChoiceCandidateInput {
  name: string;
  photoUrl?: string;
  campaignPageUrl?: string;
}

export interface UpdatePublicChoiceCandidateInput {
  name?: string;
  photoUrl?: string | null;
  campaignPageUrl?: string | null;
}

export async function listPublicChoiceCandidatesForInitiative(
  initiativeId: string,
): Promise<PublicChoiceCandidatePublicProjection[]> {
  assertPublicChoiceInitiative(initiativeId);
  // Fix 06 — ensure voting substrate exists when the public roster is read.
  try {
    const { ensurePublicChoiceElectionVotingDecision } = await import(
      "../initiative-collective-decision/ensure-public-choice-election-decision.js"
    );
    ensurePublicChoiceElectionVotingDecision(initiativeId);
  } catch {
    // Candidate listing must not fail if decision ensure is unavailable.
  }
  const candidates = await listPublicChoiceCandidatesByInitiative(initiativeId);
  return candidates.map(toPublicChoiceCandidatePublicProjection);
}

/**
 * Pack 02D — any authenticated Participant may add a candidate.
 * Visitors cannot (route requires auth). No moderation subsystem in this pack.
 */
export async function createPublicChoiceCandidateForInitiative(
  identity: RequestIdentity,
  initiativeId: string,
  input: CreatePublicChoiceCandidateInput,
): Promise<PublicChoiceCandidatePublicProjection> {
  const initiative = assertPublicChoiceInitiative(initiativeId);
  const participantId = assertAuthenticatedParticipant(identity);
  assertCandidateSubmissionAllowed(initiative);

  const name = input.name?.trim();
  if (!name) {
    throw new Error("Candidate name is required.");
  }

  const existing = await listPublicChoiceCandidatesByInitiative(initiativeId);
  const now = new Date().toISOString();
  const candidate: PublicChoiceCandidate = {
    candidateId: createPublicChoiceCandidateId(),
    initiativeId,
    name,
    photoUrl: input.photoUrl?.trim() || undefined,
    campaignPageUrl: validateCampaignPageUrl(input.campaignPageUrl),
    sortOrder: existing.length,
    submittedByParticipantId: participantId,
    createdAt: now,
    updatedAt: now,
  };

  return toPublicChoiceCandidatePublicProjection(await insertPublicChoiceCandidate(candidate));
}

export async function updatePublicChoiceCandidateForInitiative(
  identity: RequestIdentity,
  initiativeId: string,
  candidateId: string,
  input: UpdatePublicChoiceCandidateInput,
): Promise<PublicChoiceCandidatePublicProjection> {
  const initiative = assertPublicChoiceInitiative(initiativeId);
  assertCandidateSubmissionAllowed(initiative);

  const existing = await getPublicChoiceCandidateById(candidateId);
  if (!existing || existing.initiativeId !== initiativeId) {
    throw new Error("Candidate not found.");
  }

  assertCanMutateCandidate(initiative, identity, existing);

  const name = input.name !== undefined ? input.name.trim() : existing.name;
  if (!name) {
    throw new Error("Candidate name is required.");
  }

  const photoUrl =
    input.photoUrl === null
      ? undefined
      : input.photoUrl !== undefined
        ? input.photoUrl.trim() || undefined
        : existing.photoUrl;

  const campaignPageUrl =
    input.campaignPageUrl === null
      ? undefined
      : input.campaignPageUrl !== undefined
        ? validateCampaignPageUrl(input.campaignPageUrl)
        : existing.campaignPageUrl;

  const updated: PublicChoiceCandidate = {
    ...existing,
    name,
    photoUrl,
    campaignPageUrl,
    updatedAt: new Date().toISOString(),
  };

  return toPublicChoiceCandidatePublicProjection(await updatePublicChoiceCandidate(updated));
}

/**
 * Pack 02B/02D — steward or submitter may delete when no votes exist.
 */
export async function deletePublicChoiceCandidateForInitiative(
  identity: RequestIdentity,
  initiativeId: string,
  candidateId: string,
): Promise<void> {
  const initiative = assertPublicChoiceInitiative(initiativeId);

  const existing = await getPublicChoiceCandidateById(candidateId);
  if (!existing || existing.initiativeId !== initiativeId) {
    throw new Error("Candidate not found.");
  }

  assertCanMutateCandidate(initiative, identity, existing);

  if (isMongoConfigured()) {
    const voteCount = await countInitiativeDecisionVotesForCandidate(initiativeId, candidateId);
    if (voteCount > 0) {
      throw new Error(
        "Cannot delete a candidate that already has votes. Withdrawal/status is not implemented in this pack.",
      );
    }
  }

  await deletePublicChoiceCandidate(candidateId);
}

export async function assertCandidateBelongsToInitiative(
  initiativeId: string,
  candidateId: string,
): Promise<PublicChoiceCandidate> {
  const candidate = await getPublicChoiceCandidateById(candidateId);
  if (!candidate || candidate.initiativeId !== initiativeId) {
    throw new Error("Candidate is not part of this Public Choice election.");
  }

  return candidate;
}
