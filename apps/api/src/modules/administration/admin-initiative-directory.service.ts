import type {
  AdminInitiativeCivicRelationships,
  AdminInitiativeDetail,
  AdminInitiativeDirectoryAggregates,
  AdminInitiativeDirectoryItem,
  AdminInitiativeDirectoryResponse,
  AdminInitiativeIntegrityFinding,
  AdminInitiativeLifecycleStage,
  AdminInitiativeLifecycleStageId,
  Initiative,
  InitiativeLifecyclePhase,
  InitiativeStatus,
  InitiativeVisibilityPolicy,
} from "@hu/types";

import { findAuthUserById, findAuthUserByMemberId } from "../auth/auth-user.repository.js";
import { listAnalysesByInitiative } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import { listDecisionsByInitiative } from "../initiative-collective-decision/initiative-collective-decision.store.js";
import { listCommitmentsByInitiative } from "../initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import { listTrackingsByInitiative } from "../initiative-implementation-tracking/initiative-implementation-tracking.store.js";
import {
  listPublicProposalsByInitiative,
} from "../initiative-improvement-proposal/initiative-improvement-proposal.store.js";
import { listImpactsByInitiative } from "../initiative-public-impact/initiative-public-impact.store.js";
import { listRevisionsByInitiative } from "../initiative-version-revision/initiative-version-revision.store.js";
import { listSessionsByInitiative } from "../decision-session/decision-session.store.js";
import { isInitiativeEligibleForPublicProjection } from "../initiatives/initiative-public-projection.access.js";
import { getInitiativeById, listInitiatives } from "../initiatives/initiative.store.js";
import { findMemberProfileByUserId } from "../member-profile/member-profile.repository.js";
import { resolvePublicAuthorIdentity } from "../member-profile/public-author-identity.projection.js";
import { listResponsesByInitiative } from "../official-response/official-response.store.js";
import { getPetitionByInitiativeId } from "../petition/petition.store.js";
import { listArchiveRecordsByInitiative } from "../public-civic-archive/public-civic-archive.store.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "./administration.errors.js";

export class AdminInitiativeDirectoryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminInitiativeDirectoryValidationError";
  }
}

export interface ListAdminInitiativesInput {
  actorUserId: string;
  search?: string;
  lifecyclePhase?: InitiativeLifecyclePhase;
  status?: InitiativeStatus;
  visibility?: InitiativeVisibilityPolicy;
  geography?: string;
  steward?: string;
  sort?: "updatedAt" | "createdAt" | "title";
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface GetAdminInitiativeDetailInput {
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
  missing: boolean;
}> {
  const authUser = await findAuthUserByMemberId(stewardId);
  if (!authUser) {
    return { displayName: "Unknown steward", missing: true };
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
    missing: false,
  };
}

function proposalCountFor(initiativeId: string): number {
  return listPublicProposalsByInitiative(initiativeId).length;
}

function decisionSummaryFor(initiativeId: string): string | null {
  const decisions = listDecisionsByInitiative(initiativeId);
  if (decisions.length === 0) {
    const sessions = listSessionsByInitiative(initiativeId);
    if (sessions.length === 0) {
      return null;
    }
    const latest = [...sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    return latest ? `Session: ${latest.status}` : null;
  }

  const latest = [...decisions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  return latest ? `Decision: ${latest.status}` : null;
}

function civicArchiveStateFor(initiativeId: string): "none" | "present" {
  return listArchiveRecordsByInitiative(initiativeId).length > 0 ? "present" : "none";
}

function integrityStatusFor(
  initiative: Initiative,
  stewardMissing: boolean,
): "ok" | "warning" {
  if (stewardMissing) {
    return "warning";
  }

  if (
    initiative.lifecyclePhase === "archived" &&
    isInitiativeEligibleForPublicProjection(initiative)
  ) {
    return "warning";
  }

  if (initiative.lifecyclePhase === "draft" && initiative.status === "archived") {
    return "warning";
  }

  return "ok";
}

function matchesSearch(initiative: Initiative, stewardName: string, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) {
    return true;
  }

  return (
    initiative.title.toLowerCase().includes(needle) ||
    initiative.initiativeId.toLowerCase().includes(needle) ||
    initiative.stewardId.toLowerCase().includes(needle) ||
    stewardName.toLowerCase().includes(needle) ||
    (initiative.metadata.region ?? "").toLowerCase().includes(needle) ||
    (initiative.metadata.countrySlug ?? "").toLowerCase().includes(needle) ||
    (initiative.metadata.regionSlug ?? "").toLowerCase().includes(needle)
  );
}

function matchesGeography(initiative: Initiative, geography: string): boolean {
  const needle = geography.trim().toLowerCase();
  if (!needle) {
    return true;
  }

  return (
    (initiative.metadata.region ?? "").toLowerCase().includes(needle) ||
    (initiative.metadata.countrySlug ?? "").toLowerCase().includes(needle) ||
    (initiative.metadata.regionSlug ?? "").toLowerCase().includes(needle) ||
    (initiative.metadata.communitySlug ?? "").toLowerCase().includes(needle)
  );
}

function matchesSteward(
  initiative: Initiative,
  stewardName: string,
  stewardFilter: string,
): boolean {
  const needle = stewardFilter.trim().toLowerCase();
  if (!needle) {
    return true;
  }

  return (
    initiative.stewardId.toLowerCase().includes(needle) ||
    stewardName.toLowerCase().includes(needle)
  );
}

function computeAggregates(initiatives: readonly Initiative[]): AdminInitiativeDirectoryAggregates {
  let publicCount = 0;
  let archived = 0;
  let proposals = 0;

  for (const initiative of initiatives) {
    if (isInitiativeEligibleForPublicProjection(initiative)) {
      publicCount += 1;
    }
    if (initiative.lifecyclePhase === "archived") {
      archived += 1;
    }
    proposals += proposalCountFor(initiative.initiativeId);
  }

  return {
    total: initiatives.length,
    public: publicCount,
    nonPublic: initiatives.length - publicCount,
    activeLifecycle: initiatives.length - archived,
    archived,
    proposals,
  };
}

async function toDirectoryItem(initiative: Initiative): Promise<AdminInitiativeDirectoryItem> {
  const steward = await resolveStewardDisplay(initiative.stewardId);
  const initiativeId = initiative.initiativeId;

  return {
    initiativeId,
    title: initiative.title,
    stewardId: initiative.stewardId,
    stewardDisplayName: steward.displayName,
    ...(steward.uniqueName ? { stewardUniqueName: steward.uniqueName } : {}),
    lifecyclePhase: initiative.lifecyclePhase,
    status: initiative.status,
    visibility: initiative.visibility.policy,
    geography: {
      region: initiative.metadata.region,
      ...(initiative.metadata.countrySlug
        ? { countrySlug: initiative.metadata.countrySlug }
        : {}),
      ...(initiative.metadata.regionSlug ? { regionSlug: initiative.metadata.regionSlug } : {}),
      ...(initiative.metadata.communitySlug
        ? { communitySlug: initiative.metadata.communitySlug }
        : {}),
    },
    createdAt: initiative.createdAt,
    updatedAt: initiative.updatedAt,
    publiclyProjected: isInitiativeEligibleForPublicProjection(initiative),
    proposalCount: proposalCountFor(initiativeId),
    decisionSummary: decisionSummaryFor(initiativeId),
    civicArchiveState: civicArchiveStateFor(initiativeId),
    integrityStatus: integrityStatusFor(initiative, steward.missing),
  };
}

/**
 * Admin-authorized Initiative directory.
 * Filters/paginates server-side from the canonical Initiative store (no browser-only scan).
 */
export async function listAdminInitiatives(
  input: ListAdminInitiativesInput,
): Promise<AdminInitiativeDirectoryResponse> {
  await assertAdminUser(input.actorUserId);

  const limit = clampLimit(input.limit);
  const offset = clampOffset(input.offset);
  const all = listInitiatives();
  const aggregates = computeAggregates(all);

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
    if (input.lifecyclePhase && initiative.lifecyclePhase !== input.lifecyclePhase) {
      continue;
    }
    if (input.status && initiative.status !== input.status) {
      continue;
    }
    if (input.visibility && initiative.visibility.policy !== input.visibility) {
      continue;
    }
    if (input.geography && !matchesGeography(initiative, input.geography)) {
      continue;
    }

    const steward = await stewardFor(initiative.stewardId);

    if (input.steward && !matchesSteward(initiative, steward.displayName, input.steward)) {
      continue;
    }

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
  const initiatives = await Promise.all(page.map((initiative) => toDirectoryItem(initiative)));

  return {
    initiatives,
    aggregates,
    total,
    limit,
    offset,
    hasMore: offset + initiatives.length < total,
  };
}

const LIFECYCLE_STAGE_LABELS: Record<AdminInitiativeLifecycleStageId, string> = {
  initiative: "Initiative",
  discussion: "Discussion",
  collaborative_analysis: "Collaborative Analysis",
  improvement_proposals: "Improvement Proposals",
  revision: "Revision",
  petition: "Petition",
  decision_session: "Decision Session",
  collective_decision: "Collective Decision",
  implementation_commitments: "Implementation Commitments",
  implementation_tracking: "Implementation Tracking",
  official_responses: "Official Responses",
  public_impact: "Public Impact",
  civic_archive: "Civic Archive",
};

function buildLifecycleStages(input: {
  hasDiscussionSignal: boolean;
  analysisCount: number;
  proposalCount: number;
  revisionCount: number;
  hasPetition: boolean;
  decisionSessionCount: number;
  collectiveDecisionCount: number;
  commitmentCount: number;
  trackingCount: number;
  officialResponseCount: number;
  publicImpactCount: number;
  civicArchiveCount: number;
}): AdminInitiativeLifecycleStage[] {
  const presence: Array<{
    stageId: AdminInitiativeLifecycleStageId;
    present: boolean;
    evidence: string;
  }> = [
    { stageId: "initiative", present: true, evidence: "Canonical Initiative record" },
    {
      stageId: "discussion",
      present: input.hasDiscussionSignal,
      evidence: input.hasDiscussionSignal
        ? "Discussion signal from status or Collaborative Analysis"
        : "No discussion signal yet",
    },
    {
      stageId: "collaborative_analysis",
      present: input.analysisCount > 0,
      evidence:
        input.analysisCount > 0
          ? `${input.analysisCount} Collaborative Analysis record(s)`
          : "No Collaborative Analysis records",
    },
    {
      stageId: "improvement_proposals",
      present: input.proposalCount > 0,
      evidence:
        input.proposalCount > 0
          ? `${input.proposalCount} public Improvement Proposal(s)`
          : "No public Improvement Proposals",
    },
    {
      stageId: "revision",
      present: input.revisionCount > 0,
      evidence:
        input.revisionCount > 0
          ? `${input.revisionCount} Revision record(s)`
          : "No Revision records",
    },
    {
      stageId: "petition",
      present: input.hasPetition,
      evidence: input.hasPetition ? "Petition linked to Initiative" : "No Petition",
    },
    {
      stageId: "decision_session",
      present: input.decisionSessionCount > 0,
      evidence:
        input.decisionSessionCount > 0
          ? `${input.decisionSessionCount} Decision Session(s)`
          : "No Decision Sessions",
    },
    {
      stageId: "collective_decision",
      present: input.collectiveDecisionCount > 0,
      evidence:
        input.collectiveDecisionCount > 0
          ? `${input.collectiveDecisionCount} Collective Decision(s)`
          : "No Collective Decisions",
    },
    {
      stageId: "implementation_commitments",
      present: input.commitmentCount > 0,
      evidence:
        input.commitmentCount > 0
          ? `${input.commitmentCount} Implementation Commitment(s)`
          : "No Implementation Commitments",
    },
    {
      stageId: "implementation_tracking",
      present: input.trackingCount > 0,
      evidence:
        input.trackingCount > 0
          ? `${input.trackingCount} Implementation Tracking record(s)`
          : "No Implementation Tracking",
    },
    {
      stageId: "official_responses",
      present: input.officialResponseCount > 0,
      evidence:
        input.officialResponseCount > 0
          ? `${input.officialResponseCount} Official Response(s)`
          : "No Official Responses",
    },
    {
      stageId: "public_impact",
      present: input.publicImpactCount > 0,
      evidence:
        input.publicImpactCount > 0
          ? `${input.publicImpactCount} Public Impact record(s)`
          : "No Public Impact records",
    },
    {
      stageId: "civic_archive",
      present: input.civicArchiveCount > 0,
      evidence:
        input.civicArchiveCount > 0
          ? `${input.civicArchiveCount} Civic Archive record(s)`
          : "No Civic Archive records",
    },
  ];

  let currentIndex = 0;
  for (let index = 0; index < presence.length; index += 1) {
    if (presence[index]!.present) {
      currentIndex = index;
    }
  }

  return presence.map((entry, index) => ({
    stageId: entry.stageId,
    label: LIFECYCLE_STAGE_LABELS[entry.stageId],
    state: entry.present
      ? index === currentIndex
        ? "current"
        : "present"
      : "not_reached",
    evidence: entry.evidence,
  }));
}

function buildIntegrityFindings(input: {
  initiative: Initiative;
  stewardMissing: boolean;
}): AdminInitiativeIntegrityFinding[] {
  const findings: AdminInitiativeIntegrityFinding[] = [];

  if (input.stewardMissing) {
    findings.push({
      code: "missing_steward_reference",
      severity: "warning",
      message: "Steward Participant identity could not be resolved from auth records.",
    });
  }

  if (
    input.initiative.lifecyclePhase === "archived" &&
    isInitiativeEligibleForPublicProjection(input.initiative)
  ) {
    findings.push({
      code: "impossible_public_archived",
      severity: "warning",
      message: "Archived Initiative still satisfies public projection eligibility.",
    });
  }

  if (
    input.initiative.lifecyclePhase === "projected" &&
    input.initiative.visibility.policy === "steward_only"
  ) {
    findings.push({
      code: "admin_or_manual_public_hide",
      severity: "info",
      message:
        "Lifecycle remains projected while visibility is steward_only (not publicly projected).",
    });
  }

  if (!input.initiative.title.trim()) {
    findings.push({
      code: "missing_title",
      severity: "warning",
      message: "Initiative title is empty.",
    });
  }

  if (findings.length === 0) {
    findings.push({
      code: "ok",
      severity: "info",
      message: "No integrity warnings derived from canonical checks.",
    });
  }

  return findings;
}

async function buildRelationships(
  initiativeId: string,
): Promise<AdminInitiativeCivicRelationships> {
  const analyses = listAnalysesByInitiative(initiativeId);
  const proposals = listPublicProposalsByInitiative(initiativeId);
  const revisions = listRevisionsByInitiative(initiativeId);
  const petition = await getPetitionByInitiativeId(initiativeId);
  const sessions = listSessionsByInitiative(initiativeId);
  const commitments = listCommitmentsByInitiative(initiativeId);
  const trackings = listTrackingsByInitiative(initiativeId);
  const responses = listResponsesByInitiative(initiativeId);
  const impacts = listImpactsByInitiative(initiativeId);
  const archives = listArchiveRecordsByInitiative(initiativeId);

  return {
    proposalCount: proposals.length,
    analysisCount: analyses.length,
    revisionCount: revisions.length,
    petitionStatus: petition?.status ?? null,
    decisionSessionCount: sessions.length,
    collectiveDecisionSummary: decisionSummaryFor(initiativeId),
    commitmentCount: commitments.length,
    trackingCount: trackings.length,
    officialResponseCount: responses.length,
    publicImpactCount: impacts.length,
    civicArchiveCount: archives.length,
  };
}

export async function getAdminInitiativeDetail(
  input: GetAdminInitiativeDetailInput,
): Promise<AdminInitiativeDetail> {
  await assertAdminUser(input.actorUserId);

  const initiative = getInitiativeById(input.initiativeId);
  if (!initiative) {
    throw new AdminInitiativeDirectoryValidationError("Initiative not found.");
  }

  const steward = await resolveStewardDisplay(initiative.stewardId);
  const relationships = await buildRelationships(initiative.initiativeId);
  const discussionStatuses: InitiativeStatus[] = [
    "discussion",
    "revision",
    "ready_for_poll",
    "poll",
    "petition",
    "implementation",
    "completed",
  ];
  const hasDiscussionSignal =
    discussionStatuses.includes(initiative.status) || relationships.analysisCount > 0;

  const publiclyProjected = isInitiativeEligibleForPublicProjection(initiative);
  const canHideFromPublic =
    initiative.lifecyclePhase === "projected" && initiative.visibility.policy === "public";
  const canRestorePublicVisibility =
    initiative.lifecyclePhase === "projected" &&
    initiative.visibility.policy === "steward_only";

  return {
    initiativeId: initiative.initiativeId,
    title: initiative.title,
    descriptionPreview:
      initiative.description.length > 280
        ? `${initiative.description.slice(0, 277)}…`
        : initiative.description,
    stewardId: initiative.stewardId,
    stewardDisplayName: steward.displayName,
    ...(steward.uniqueName ? { stewardUniqueName: steward.uniqueName } : {}),
    geography: {
      region: initiative.metadata.region,
      ...(initiative.metadata.countrySlug
        ? { countrySlug: initiative.metadata.countrySlug }
        : {}),
      ...(initiative.metadata.regionSlug ? { regionSlug: initiative.metadata.regionSlug } : {}),
      ...(initiative.metadata.communitySlug
        ? { communitySlug: initiative.metadata.communitySlug }
        : {}),
    },
    createdAt: initiative.createdAt,
    updatedAt: initiative.updatedAt,
    lifecyclePhase: initiative.lifecyclePhase,
    status: initiative.status,
    visibility: initiative.visibility.policy,
    publiclyProjected,
    publicUrl: publiclyProjected
      ? `/initiatives/public/${encodeURIComponent(initiative.initiativeId)}`
      : null,
    lifecycleStages: buildLifecycleStages({
      hasDiscussionSignal,
      analysisCount: relationships.analysisCount,
      proposalCount: relationships.proposalCount,
      revisionCount: relationships.revisionCount,
      hasPetition: relationships.petitionStatus !== null,
      decisionSessionCount: relationships.decisionSessionCount,
      collectiveDecisionCount: listDecisionsByInitiative(initiative.initiativeId).length,
      commitmentCount: relationships.commitmentCount,
      trackingCount: relationships.trackingCount,
      officialResponseCount: relationships.officialResponseCount,
      publicImpactCount: relationships.publicImpactCount,
      civicArchiveCount: relationships.civicArchiveCount,
    }),
    relationships,
    integrity: buildIntegrityFindings({
      initiative,
      stewardMissing: steward.missing,
    }),
    adminActions: {
      canHideFromPublic,
      canRestorePublicVisibility,
    },
  };
}

export { assertAdminUser as assertAdminUserForInitiatives };
