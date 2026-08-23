import type {
  AdminPublicChoiceCandidateRow,
  AdminPublicChoiceDetail,
  AdminPublicChoiceDirectoryItem,
  AdminPublicChoiceDirectoryResponse,
  Initiative,
  InitiativeCollectiveDecision,
  PublicChoiceCandidate,
} from "@hu/types";
import {
  formatModerationBlockLabel,
  isInitiativeAdministrativelyBlocked,
  isPublicChoiceCandidateAdministrativelyBlocked,
  publicChoiceElectionVotingStatusLabel,
  resolveEffectiveModerationBlock,
  resolveInitiativeLifecycleProfile,
  resolvePublicChoiceElectionVotingStatus,
  toPublicChoiceCandidatePublicProjection,
} from "@hu/types";

import { findAuthUserById, findAuthUserByMemberId } from "../auth/auth-user.repository.js";
import { listDecisionsByInitiative } from "../initiative-collective-decision/initiative-collective-decision.store.js";
import { computePublicChoiceBallotAggregatesForDecision } from "../initiative-decision-vote/initiative-decision-vote.service.js";
import { getInitiativeById, listInitiatives } from "../initiatives/initiative.store.js";
import { findMemberProfileByUserId } from "../member-profile/member-profile.repository.js";
import { resolvePublicAuthorIdentity } from "../member-profile/public-author-identity.projection.js";
import {
  blockPublicChoiceCandidateAsAdmin,
  unblockPublicChoiceCandidateAsAdmin,
} from "../public-choice-candidate/public-choice-candidate.service.js";
import { listPublicChoiceCandidatesByInitiative } from "../public-choice-candidate/persistence/public-choice-candidate.repository.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "./administration.errors.js";
import { record } from "./audit.service.js";

export class AdminPublicChoiceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminPublicChoiceValidationError";
  }
}

export interface ListAdminPublicChoiceInput {
  actorUserId: string;
  search?: string;
  blocked?: "blocked" | "unblocked" | "";
  sort?: "updatedAt" | "createdAt" | "title";
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface GetAdminPublicChoiceDetailInput {
  actorUserId: string;
  initiativeId: string;
}

async function assertAdminUser(userId: string): Promise<{
  userId: string;
  memberId: string;
}> {
  if (!userId.trim()) {
    throw new AdministrationUnauthorizedError("Authentication is required.");
  }
  const user = await findAuthUserById(userId);
  if (!user || user.role !== "admin") {
    throw new AdministrationForbiddenError("Administrator access is required.");
  }
  return { userId: user.userId, memberId: user.memberId };
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || Number.isNaN(limit)) {
    return 25;
  }
  return Math.min(Math.max(Math.trunc(limit), 1), 100);
}

function clampOffset(offset: number | undefined): number {
  if (offset === undefined || Number.isNaN(offset) || offset < 0) {
    return 0;
  }
  return Math.trunc(offset);
}

async function resolveStewardDisplay(stewardId: string): Promise<{
  displayName: string;
  uniqueName?: string;
}> {
  const authUser = await findAuthUserByMemberId(stewardId);
  if (!authUser) {
    return { displayName: "Unknown steward" };
  }
  const profile = await findMemberProfileByUserId(authUser.userId);
  const identity = resolvePublicAuthorIdentity(profile ?? undefined, authUser.displayName);
  const uniqueName =
    profile?.status === "active" && profile.publicName?.trim()
      ? profile.publicName.trim()
      : undefined;
  return {
    displayName: identity.displayName || authUser.displayName || "Unknown steward",
    ...(uniqueName ? { uniqueName } : {}),
  };
}

function latestDecision(initiativeId: string): InitiativeCollectiveDecision | null {
  const decisions = listDecisionsByInitiative(initiativeId);
  if (decisions.length === 0) {
    return null;
  }
  return [...decisions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}

function votingStatusFor(
  initiative: Initiative,
  decision: InitiativeCollectiveDecision | null,
): string {
  const status = resolvePublicChoiceElectionVotingStatus({
    decisionStatus: decision?.status,
    openedAt: decision?.openedAt,
    closesAt: decision?.closesAt,
    closedAt: decision?.closedAt,
    resultsExpiredAt: initiative.metadata.publicChoiceResultsExpiredAt,
  });
  return publicChoiceElectionVotingStatusLabel(status);
}

function matchesSearch(initiative: Initiative, stewardName: string, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return (
    initiative.title.toLowerCase().includes(needle) ||
    initiative.initiativeId.toLowerCase().includes(needle) ||
    stewardName.toLowerCase().includes(needle) ||
    (initiative.metadata.countrySlug ?? "").toLowerCase().includes(needle) ||
    (initiative.metadata.communityAssociation ?? "").toLowerCase().includes(needle)
  );
}

async function toDirectoryItem(
  initiative: Initiative,
): Promise<AdminPublicChoiceDirectoryItem> {
  const steward = await resolveStewardDisplay(initiative.stewardId);
  const decision = latestDecision(initiative.initiativeId);
  const candidates = await listPublicChoiceCandidatesByInitiative(initiative.initiativeId);
  let effectiveVoterCount: number | null = null;
  if (decision) {
    try {
      const aggregates = await computePublicChoiceBallotAggregatesForDecision(
        decision.decisionId,
        initiative,
      );
      if (aggregates.ballotMode === "SELECT_ONE_CANDIDATE") {
        effectiveVoterCount = aggregates.totalEffectiveVoters;
      } else {
        effectiveVoterCount = aggregates.total.totalVotes;
      }
    } catch {
      effectiveVoterCount = null;
    }
  }

  return {
    initiativeId: initiative.initiativeId,
    electionTitle:
      initiative.metadata.communityAssociation?.trim() || initiative.title,
    ...(initiative.metadata.countrySlug
      ? { countrySlug: initiative.metadata.countrySlug }
      : {}),
    stewardId: initiative.stewardId,
    stewardDisplayName: steward.displayName,
    ...(steward.uniqueName ? { stewardUniqueName: steward.uniqueName } : {}),
    votingStatus: votingStatusFor(initiative, decision),
    ...(decision?.openedAt ? { openedAt: decision.openedAt } : {}),
    ...(decision?.closesAt ? { closesAt: decision.closesAt } : {}),
    ...(decision?.closedAt ? { closedAt: decision.closedAt } : {}),
    candidateCount: candidates.length,
    effectiveVoterCount,
    administrativelyBlocked: isInitiativeAdministrativelyBlocked(initiative),
    blockAuthority: (() => {
      const resolved = resolveEffectiveModerationBlock(initiative);
      return resolved.isBlocked ? resolved.authority : null;
    })(),
    blockLabel: formatModerationBlockLabel(initiative),
    createdAt: initiative.createdAt,
    updatedAt: initiative.updatedAt,
  };
}

export async function listAdminPublicChoiceElections(
  input: ListAdminPublicChoiceInput,
): Promise<AdminPublicChoiceDirectoryResponse> {
  await assertAdminUser(input.actorUserId);

  const limit = clampLimit(input.limit);
  const offset = clampOffset(input.offset);
  const all = listInitiatives().filter(
    (initiative) =>
      resolveInitiativeLifecycleProfile(initiative.lifecycleProfile) === "PUBLIC_CHOICE",
  );

  const stewardCache = new Map<string, Awaited<ReturnType<typeof resolveStewardDisplay>>>();
  async function stewardFor(stewardId: string) {
    const cached = stewardCache.get(stewardId);
    if (cached) {
      return cached;
    }
    const resolved = await resolveStewardDisplay(stewardId);
    stewardCache.set(stewardId, resolved);
    return resolved;
  }

  const filtered: Initiative[] = [];
  for (const initiative of all) {
    const blocked = isInitiativeAdministrativelyBlocked(initiative);
    if (input.blocked === "blocked" && !blocked) {
      continue;
    }
    if (input.blocked === "unblocked" && blocked) {
      continue;
    }
    const steward = await stewardFor(initiative.stewardId);
    if (input.search && !matchesSearch(initiative, steward.displayName, input.search)) {
      continue;
    }
    filtered.push(initiative);
  }

  const sort = input.sort ?? "updatedAt";
  const order = input.order ?? "desc";
  filtered.sort((left, right) => {
    let comparison = 0;
    if (sort === "title") {
      comparison = left.title.localeCompare(right.title);
    } else if (sort === "createdAt") {
      comparison = left.createdAt.localeCompare(right.createdAt);
    } else {
      comparison = left.updatedAt.localeCompare(right.updatedAt);
    }
    return order === "asc" ? comparison : -comparison;
  });

  const total = filtered.length;
  const page = filtered.slice(offset, offset + limit);
  const elections = await Promise.all(page.map((initiative) => toDirectoryItem(initiative)));

  return {
    elections,
    total,
    limit,
    offset,
    hasMore: offset + elections.length < total,
  };
}

export async function getAdminPublicChoiceDetail(
  input: GetAdminPublicChoiceDetailInput,
): Promise<AdminPublicChoiceDetail> {
  await assertAdminUser(input.actorUserId);
  const initiative = getInitiativeById(input.initiativeId);
  if (
    !initiative ||
    resolveInitiativeLifecycleProfile(initiative.lifecycleProfile) !== "PUBLIC_CHOICE"
  ) {
    throw new AdminPublicChoiceValidationError("Public Choice election not found.");
  }

  const steward = await resolveStewardDisplay(initiative.stewardId);
  const decision = latestDecision(initiative.initiativeId);
  const candidates = await listPublicChoiceCandidatesByInitiative(initiative.initiativeId);
  const voteCounts = new Map<string, number>();
  let totalEffectiveVoters: number | null = null;
  let ballotMode = String(initiative.metadata.ballotMode ?? "SELECT_ONE_CANDIDATE");

  if (decision) {
    try {
      const aggregates = await computePublicChoiceBallotAggregatesForDecision(
        decision.decisionId,
        initiative,
      );
      ballotMode = aggregates.ballotMode;
      if (aggregates.ballotMode === "SELECT_ONE_CANDIDATE") {
        totalEffectiveVoters = aggregates.totalEffectiveVoters;
        for (const row of aggregates.candidates) {
          voteCounts.set(row.candidateId, row.count);
        }
      } else {
        totalEffectiveVoters = aggregates.total.totalVotes;
      }
    } catch {
      totalEffectiveVoters = null;
    }
  }

  const candidateRows: AdminPublicChoiceCandidateRow[] = candidates.map((candidate) => {
    const resolved = resolveEffectiveModerationBlock(candidate);
    return {
      candidateId: candidate.candidateId,
      name: candidate.name,
      ...(candidate.photoUrl ? { photoUrl: candidate.photoUrl } : {}),
      ...(candidate.campaignPageUrl ? { campaignPageUrl: candidate.campaignPageUrl } : {}),
      voteCount: voteCounts.get(candidate.candidateId) ?? 0,
      isBlocked: resolved.isBlocked,
      blockAuthority: resolved.isBlocked ? resolved.authority : null,
      blockLabel: formatModerationBlockLabel(candidate),
      sortOrder: candidate.sortOrder,
    };
  });

  return {
    initiativeId: initiative.initiativeId,
    electionTitle:
      initiative.metadata.communityAssociation?.trim() || initiative.title,
    descriptionPreview: initiative.description.slice(0, 280),
    stewardId: initiative.stewardId,
    stewardDisplayName: steward.displayName,
    ...(steward.uniqueName ? { stewardUniqueName: steward.uniqueName } : {}),
    ...(initiative.metadata.countrySlug
      ? { countrySlug: initiative.metadata.countrySlug }
      : {}),
    votingStatus: votingStatusFor(initiative, decision),
    ...(decision?.openedAt ? { openedAt: decision.openedAt } : {}),
    ...(decision?.closesAt ? { closesAt: decision.closesAt } : {}),
    ...(decision?.closedAt ? { closedAt: decision.closedAt } : {}),
    decisionId: decision?.decisionId ?? null,
    candidateCount: candidates.length,
    effectiveVoterCount: totalEffectiveVoters,
    administrativelyBlocked: isInitiativeAdministrativelyBlocked(initiative),
    blockAuthority: (() => {
      const resolved = resolveEffectiveModerationBlock(initiative);
      return resolved.isBlocked ? resolved.authority : null;
    })(),
    blockLabel: formatModerationBlockLabel(initiative),
    publicUrl: `/initiatives/public/${encodeURIComponent(initiative.initiativeId)}`,
    candidates: candidateRows,
    resultSummary: {
      ballotMode,
      totalEffectiveVoters,
    },
  };
}

export async function blockAdminPublicChoiceCandidate(input: {
  actorUserId: string;
  initiativeId: string;
  candidateId: string;
  reason?: string;
}): Promise<PublicChoiceCandidate> {
  const admin = await assertAdminUser(input.actorUserId);
  const blocked = await blockPublicChoiceCandidateAsAdmin({
    actorUserId: input.actorUserId,
    initiativeId: input.initiativeId,
    candidateId: input.candidateId,
    reason: input.reason,
  });
  await record({
    actorParticipantId: admin.memberId,
    action: "public_choice.candidate.block",
    targetType: "public_choice_candidate",
    targetId: input.candidateId,
    reason: input.reason?.trim() || undefined,
    beforeSummary: "administrativelyBlocked=false",
    afterSummary: "administrativelyBlocked=true",
  });
  return blocked;
}

export async function unblockAdminPublicChoiceCandidate(input: {
  actorUserId: string;
  initiativeId: string;
  candidateId: string;
}): Promise<PublicChoiceCandidate> {
  const admin = await assertAdminUser(input.actorUserId);
  const unblocked = await unblockPublicChoiceCandidateAsAdmin({
    actorUserId: input.actorUserId,
    initiativeId: input.initiativeId,
    candidateId: input.candidateId,
  });
  await record({
    actorParticipantId: admin.memberId,
    action: "public_choice.candidate.unblock",
    targetType: "public_choice_candidate",
    targetId: input.candidateId,
    beforeSummary: "administrativelyBlocked=true",
    afterSummary: "administrativelyBlocked=false",
  });
  return unblocked;
}

/**
 * Fix 08C — Admin may edit candidate fields even while candidate is admin-blocked.
 */
export async function updateAdminPublicChoiceCandidate(input: {
  actorUserId: string;
  initiativeId: string;
  candidateId: string;
  name?: string;
  photoUrl?: string | null;
  campaignPageUrl?: string | null;
}) {
  await assertAdminUser(input.actorUserId);
  const { updatePublicChoiceCandidateAsAdmin } = await import(
    "../public-choice-candidate/public-choice-candidate.service.js"
  );
  return updatePublicChoiceCandidateAsAdmin({
    actorUserId: input.actorUserId,
    initiativeId: input.initiativeId,
    candidateId: input.candidateId,
    name: input.name,
    photoUrl: input.photoUrl,
    campaignPageUrl: input.campaignPageUrl,
  });
}

/** Test helper — public projection shape for admin rows. */
export function projectCandidateForAdminTests(candidate: PublicChoiceCandidate) {
  return toPublicChoiceCandidatePublicProjection(candidate);
}
