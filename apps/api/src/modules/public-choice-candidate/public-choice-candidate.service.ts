import type { PublicChoiceCandidate, PublicChoiceCandidatePublicProjection } from "@hu/types";
import {
  PUBLIC_CHOICE_MAX_CANDIDATES,
  isInitiativeAdministrativelyBlocked,
  isPublicChoiceCandidateAdministrativelyBlocked,
  isPublicChoiceCandidateAvailableForNewSelect,
  resolveEffectiveModerationBlock,
  resolveInitiativeLifecycleProfile,
  toPublicChoiceCandidatePublicProjection,
} from "@hu/types";

import { findAuthUserById } from "../auth/auth-user.repository.js";
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

export const PUBLIC_CHOICE_CANDIDATE_LIMIT_MESSAGE =
  "This election has reached the maximum of 20 candidates.";

export const PUBLIC_CHOICE_CANDIDATE_DELETE_VOTE_SAFETY_MESSAGE =
  "This candidate cannot be deleted after voting has started. Contact the election author or administrator.";

export const PUBLIC_CHOICE_CANDIDATE_ADMIN_BLOCKED_MUTATION_MESSAGE =
  "This candidate has been blocked by an administrator. Please contact the administrator.";

export const PUBLIC_CHOICE_CANDIDATE_BLOCKED_SELECT_MESSAGE =
  "This candidate is unavailable for selection.";

export const PUBLIC_CHOICE_ELECTION_BLOCKED_INTERACTION_MESSAGE =
  "This election has been blocked by an administrator. Please contact the administrator.";

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
  initiative: NonNullable<ReturnType<typeof getInitiativeById>>,
  participantId: string,
): boolean {
  return initiative.stewardId === participantId;
}

/**
 * Fix 08A — who may mutate a candidate (ownership).
 * Steward: all candidates (including legacy without submittedByParticipantId).
 * Submitter: only their own (exact submittedByParticipantId match; never claim legacy).
 * Fix 08B — admin block is enforced separately; ownership alone does not clear a block.
 */
export function canManagePublicChoiceCandidate(input: {
  initiative: NonNullable<ReturnType<typeof getInitiativeById>>;
  participantId: string;
  candidate: PublicChoiceCandidate;
}): boolean {
  if (isInitiativeSteward(input.initiative, input.participantId)) {
    return true;
  }
  const submitter = input.candidate.submittedByParticipantId?.trim();
  return Boolean(submitter && submitter === input.participantId);
}

function assertNotAdministrativelyBlocked(candidate: PublicChoiceCandidate): void {
  if (isPublicChoiceCandidateAdministrativelyBlocked(candidate)) {
    throw new Error(PUBLIC_CHOICE_CANDIDATE_ADMIN_BLOCKED_MUTATION_MESSAGE);
  }
}

function assertCanMutateCandidate(
  initiative: NonNullable<ReturnType<typeof getInitiativeById>>,
  identity: RequestIdentity,
  candidate: PublicChoiceCandidate,
): void {
  if (isInitiativeAdministrativelyBlocked(initiative)) {
    throw new Error(PUBLIC_CHOICE_ELECTION_BLOCKED_INTERACTION_MESSAGE);
  }
  assertNotAdministrativelyBlocked(candidate);
  const participantId = assertAuthenticatedParticipant(identity);
  if (canManagePublicChoiceCandidate({ initiative, participantId, candidate })) {
    return;
  }

  throw new Error("You do not have access to modify this candidate.");
}

function assertCandidateSubmissionAllowed(initiative: NonNullable<ReturnType<typeof getInitiativeById>>) {
  if (isInitiativeAdministrativelyBlocked(initiative)) {
    throw new Error(PUBLIC_CHOICE_ELECTION_BLOCKED_INTERACTION_MESSAGE);
  }
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

function projectCandidate(
  candidate: PublicChoiceCandidate,
  initiative: NonNullable<ReturnType<typeof getInitiativeById>>,
  viewerParticipantId?: string | null,
): PublicChoiceCandidatePublicProjection {
  const electionBlocked = isInitiativeAdministrativelyBlocked(initiative);
  const blocked = isPublicChoiceCandidateAdministrativelyBlocked(candidate);
  const viewerCanManage =
    !electionBlocked &&
    !blocked &&
    Boolean(viewerParticipantId) &&
    canManagePublicChoiceCandidate({
      initiative,
      participantId: viewerParticipantId!,
      candidate,
    });
  return toPublicChoiceCandidatePublicProjection(candidate, { viewerCanManage });
}

export async function listPublicChoiceCandidatesForInitiative(
  initiativeId: string,
  viewerIdentity?: RequestIdentity | null,
): Promise<PublicChoiceCandidatePublicProjection[]> {
  const initiative = assertPublicChoiceInitiative(initiativeId);
  // Fix 06 — ensure voting substrate exists when the public roster is read.
  try {
    const { ensurePublicChoiceElectionVotingDecision } = await import(
      "../initiative-collective-decision/ensure-public-choice-election-decision.js"
    );
    ensurePublicChoiceElectionVotingDecision(initiativeId);
  } catch {
    // Candidate listing must not fail if decision ensure is unavailable.
  }
  const viewerParticipantId = viewerIdentity?.participantId?.trim() || null;
  const candidates = await listPublicChoiceCandidatesByInitiative(initiativeId);
  return candidates.map((candidate) =>
    projectCandidate(candidate, initiative, viewerParticipantId),
  );
}

/**
 * Fix 08A / Pack 02D — authenticated Participant or Member (or steward) may add a candidate.
 * Visitors cannot (route requires auth). No steward-only ownership gate on create.
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
  if (existing.length >= PUBLIC_CHOICE_MAX_CANDIDATES) {
    throw new Error(PUBLIC_CHOICE_CANDIDATE_LIMIT_MESSAGE);
  }

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

  const inserted = await insertPublicChoiceCandidate(candidate);
  return projectCandidate(inserted, initiative, participantId);
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
  const participantId = assertAuthenticatedParticipant(identity);

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

  return projectCandidate(await updatePublicChoiceCandidate(updated), initiative, participantId);
}

/**
 * Fix 08A — steward or submitter may hard-delete only when zero effective votes.
 * Fix 08B — admin-blocked candidates cannot be deleted by submitter/steward.
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
      throw new Error(PUBLIC_CHOICE_CANDIDATE_DELETE_VOTE_SAFETY_MESSAGE);
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

/**
 * Fix 08B — Select may target only unblocked candidates.
 * Fix 08C — parent election admin block freezes new Select.
 * Parent Decision open/closed gating remains in Decision Vote authority.
 */
export async function assertCandidateAcceptsNewSelectVote(
  initiativeId: string,
  candidateId: string,
  options?: {
    parentElectionAcceptsVotes?: boolean;
    parentElectionAdministrativelyBlocked?: boolean;
  },
): Promise<PublicChoiceCandidate> {
  const initiative = getInitiativeById(initiativeId);
  const parentBlocked =
    options?.parentElectionAdministrativelyBlocked ??
    (initiative ? isInitiativeAdministrativelyBlocked(initiative) : false);
  if (parentBlocked) {
    throw new Error(PUBLIC_CHOICE_ELECTION_BLOCKED_INTERACTION_MESSAGE);
  }

  const candidate = await assertCandidateBelongsToInitiative(initiativeId, candidateId);
  if (
    !isPublicChoiceCandidateAvailableForNewSelect(candidate, {
      parentElectionAcceptsVotes: options?.parentElectionAcceptsVotes,
      parentElectionAdministrativelyBlocked: parentBlocked,
    })
  ) {
    throw new Error(PUBLIC_CHOICE_CANDIDATE_BLOCKED_SELECT_MESSAGE);
  }
  return candidate;
}

async function assertAdminActor(userId: string): Promise<{
  userId: string;
  participantId: string;
}> {
  const trimmed = userId.trim();
  if (!trimmed) {
    throw new Error("Authentication is required.");
  }
  const user = await findAuthUserById(trimmed);
  if (!user || user.role !== "admin") {
    throw new Error("Administrator access is required.");
  }
  return { userId: user.userId, participantId: user.memberId };
}

export interface AdminPublicChoiceCandidateBlockInput {
  actorUserId: string;
  initiativeId: string;
  candidateId: string;
  reason?: string;
}

/**
 * Fix 08B / Pack 12C — Admin candidate block (authority=ADMIN).
 * Upgrades an EDITOR block to ADMIN. Does not delete votes or alter election lifecycle.
 */
export async function blockPublicChoiceCandidateAsAdmin(
  input: AdminPublicChoiceCandidateBlockInput,
): Promise<PublicChoiceCandidate> {
  const admin = await assertAdminActor(input.actorUserId);
  assertPublicChoiceInitiative(input.initiativeId);

  const existing = await getPublicChoiceCandidateById(input.candidateId);
  if (!existing || existing.initiativeId !== input.initiativeId) {
    throw new Error("Candidate not found.");
  }

  const resolved = resolveEffectiveModerationBlock(existing);
  if (resolved.isBlocked && resolved.authority === "ADMIN") {
    return existing;
  }

  const reason = input.reason?.trim() || undefined;
  const now = new Date().toISOString();
  const updated: PublicChoiceCandidate = {
    candidateId: existing.candidateId,
    initiativeId: existing.initiativeId,
    name: existing.name,
    photoUrl: existing.photoUrl,
    campaignPageUrl: existing.campaignPageUrl,
    sortOrder: existing.sortOrder,
    submittedByParticipantId: existing.submittedByParticipantId,
    administrativelyBlocked: true,
    administrativeBlockAuthority: "ADMIN",
    administrativelyBlockedAt: now,
    administrativelyBlockedByParticipantId: admin.participantId,
    ...(reason ? { administrativeBlockReason: reason } : {}),
    createdAt: existing.createdAt,
    updatedAt: now,
  };

  return updatePublicChoiceCandidate(updated);
}

/**
 * Fix 08B — Admin-only unblock. Does not reopen voting when the parent election is closed.
 */
export async function unblockPublicChoiceCandidateAsAdmin(
  input: Omit<AdminPublicChoiceCandidateBlockInput, "reason">,
): Promise<PublicChoiceCandidate> {
  await assertAdminActor(input.actorUserId);
  assertPublicChoiceInitiative(input.initiativeId);

  const existing = await getPublicChoiceCandidateById(input.candidateId);
  if (!existing || existing.initiativeId !== input.initiativeId) {
    throw new Error("Candidate not found.");
  }

  if (!isPublicChoiceCandidateAdministrativelyBlocked(existing)) {
    return existing;
  }

  const updated: PublicChoiceCandidate = {
    candidateId: existing.candidateId,
    initiativeId: existing.initiativeId,
    name: existing.name,
    photoUrl: existing.photoUrl,
    campaignPageUrl: existing.campaignPageUrl,
    sortOrder: existing.sortOrder,
    submittedByParticipantId: existing.submittedByParticipantId,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  return updatePublicChoiceCandidate(updated);
}

/**
 * Fix 08A — PUBLIC_CHOICE candidate photo upload may be performed by any
 * authenticated Participant (not only the steward). STANDARD cover uploads
 * remain steward-owned.
 */
export function assertCanUploadPublicChoiceCandidateMedia(
  initiative: NonNullable<ReturnType<typeof getInitiativeById>>,
  identity: RequestIdentity,
): void {
  const participantId = identity.participantId?.trim();
  if (!participantId) {
    throw new Error("You do not have access to this initiative.");
  }
  if (isInitiativeSteward(initiative, participantId)) {
    return;
  }
  if (resolveInitiativeLifecycleProfile(initiative.lifecycleProfile) === "PUBLIC_CHOICE") {
    return;
  }
  throw new Error("You do not have access to this initiative.");
}

/**
 * Fix 08C — Admin may edit candidate fields even while the candidate is blocked.
 * Election-wide admin block still rejects non-admin mutation paths; this override
 * is admin-only and does not clear the block flag.
 */
export async function updatePublicChoiceCandidateAsAdmin(input: {
  actorUserId: string;
  initiativeId: string;
  candidateId: string;
  name?: string;
  photoUrl?: string | null;
  campaignPageUrl?: string | null;
}): Promise<PublicChoiceCandidatePublicProjection> {
  const user = await findAuthUserById(input.actorUserId);
  if (!user || user.status !== "active") {
    throw new Error("Authentication is required.");
  }

  if (user.role === "admin") {
    await assertAdminActor(input.actorUserId);
  } else {
    const { assertEditorMayMutatePublicChoiceElection } = await import(
      "../editor-grants/editor-panel.service.js"
    );
    await assertEditorMayMutatePublicChoiceElection({
      actorUserId: input.actorUserId,
      initiativeId: input.initiativeId,
    });
  }

  const initiative = assertPublicChoiceInitiative(input.initiativeId);
  const existing = await getPublicChoiceCandidateById(input.candidateId);
  if (!existing || existing.initiativeId !== input.initiativeId) {
    throw new Error("Candidate not found.");
  }

  if (
    user.role !== "admin" &&
    isPublicChoiceCandidateAdministrativelyBlocked(existing)
  ) {
    throw new Error(PUBLIC_CHOICE_CANDIDATE_ADMIN_BLOCKED_MUTATION_MESSAGE);
  }

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

  return projectCandidate(await updatePublicChoiceCandidate(updated), initiative, null);
}
