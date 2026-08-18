import type {
  Initiative,
  PublicInitiativeDiscussionSummary,
  PublicInitiativeExperienceProjection,
  PublicInitiativeLifecycleRecordItem,
  PublicInitiativeLifecycleStageContent,
  PublicInitiativeOptionalStageDiagnostic,
  PublicInitiativeOptionalStageDiagnostics,
  PublicInitiativeProjection,
  PublicInitiativeRelatedCivicRecord,
  PublicInitiativeWithVersionHistory,
} from "@hu/types";
import {
  INITIATIVE_SUPPORT_TRANSPARENCY_NOTE,
  PUBLIC_INITIATIVE_EXPERIENCE_STAGES as EXPERIENCE_STAGES,
  resolveInitiativeCoverMedia,
  resolveInitiativeLifecycleProfile,
} from "@hu/types";

import { settleOptionalLifecycleLookup } from "../../shared/lifecycle/optional-lifecycle-lookup.js";
import { logger } from "../../shared/observability/logger.js";
import { buildLifecycleNavigation } from "./public-initiative-experience-lifecycle-nav.js";

export {
  buildLifecycleNavigation,
  resolveCurrentStageIdFromPublicationMetadata,
  resolveExperienceStageFromHash,
} from "./public-initiative-experience-lifecycle-nav.js";
import { listPublicCivicAccountabilitiesForInitiative } from "../civic-accountability/civic-accountability.projection.js";
import { listPublicCivicActionPackagesForInitiative } from "../civic-action-package/civic-action-package.projection.js";
import { listPublicDecisionSessionsForInitiative } from "../decision-session/public-decision-session.projection.js";
import { buildInitiativeDiscussionSummary } from "../initiative-comments/initiative-comment.service.js";
import { attachCollaborationStateToComments } from "../initiative-discussion-collaboration/initiative-discussion-collaboration.service.js";
import {
  getInitiativeSupportStatistics,
  recordInitiativeView,
} from "../initiative-support/initiative-support.service.js";
import { resolveStewardCollaborativeAnalysisLifecycleProgress } from "../initiative-collaborative-analysis/initiative-collaborative-analysis-lifecycle-progress.js";
import { toPublicInitiativeCollaborativeAnalysisListItem } from "../initiative-collaborative-analysis/public-initiative-collaborative-analysis.projection.js";
import { listPublicInitiativeCollectiveDecisionsForInitiative } from "../initiative-collective-decision/public-initiative-collective-decision.projection.js";
import { listPublicInitiativeImplementationCommitmentsForInitiative } from "../initiative-implementation-commitment/public-initiative-implementation-commitment.projection.js";
import { listPublicInitiativeImplementationTrackingsForInitiative } from "../initiative-implementation-tracking/public-initiative-implementation-tracking.projection.js";
import { listPublicInitiativeImprovementProposals } from "../initiative-improvement-proposal/public-initiative-improvement-proposal.projection.js";
import { listPublicInitiativePublicImpactsForInitiative } from "../initiative-public-impact/public-initiative-public-impact.projection.js";
import { getPublicInitiativeVersionHistory } from "../initiative-version-revision/public-initiative-version-revision.projection.js";
import { filterLifecycleProgressRevisions } from "../../shared/lifecycle/lifecycle-progress-revision.js";
import { createInitialInitiativeVersionRevision } from "../initiative-version-revision/initiative-version-revision.service.js";
import { getLatestArchiveVersionByInitiativeId } from "../initiative-civic-archive-lifecycle/initiative-civic-archive-version.store.js";
import { getPackageByInitiativeId as getOfficialResponsePackageByInitiativeId } from "../initiative-official-response-lifecycle/initiative-official-response-package.store.js";
import { listResponsesByInitiativeId as listLifecycleOfficialResponsesByInitiativeId } from "../initiative-official-response-lifecycle/initiative-official-response-package.store.js";
import { getReportByInitiativeId as getPublicImpactReportByInitiativeId } from "../initiative-public-impact-lifecycle/initiative-public-impact-report.store.js";
import { listPublicOfficialResponsesForInitiative } from "../official-response/official-response.projection.js";
import { getPetitionByInitiativeId } from "../petition/petition.store.js";
import { toPublicPetitionProjection } from "../petition/public-petition.projection.js";
import { getDiscussionCompletionByInitiativeId } from "../initiative-discussion-lifecycle/initiative-discussion-completion.store.js";
import { listPublishedCollectionsByInitiative } from "../initiative-improvement-proposals-stage/initiative-improvement-proposals-stage.store.js";
import { getLatestPublishedPublicCivicArchiveForInitiative } from "../public-civic-archive/public-civic-archive.projection.js";
import { resolvePublicGeography } from "../../shared/format-public-geography.js";
import { getKnownInitiativeCommunity } from "./initiative-communities.js";
import { isInitiativeEligibleForPublicProjection } from "./initiative-public-projection.access.js";
import { toWorldInitiativeCardProjection } from "./initiative-world-initiatives.projection.js";
import { findRelatedInitiativesForInitiative } from "../community-intelligence/index.js";
import { listInitiatives } from "./initiative.store.js";
import { toPublicInitiativeProjection } from "./public-initiative.projection.js";
import { buildCollectiveParticipationJourney } from "../collective-participation-journey/collective-participation-journey.service.js";

function summarizeText(text: string, maxLength = 220): string {
  const normalized = text.trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const truncated = normalized.slice(0, maxLength - 1);
  const lastSpace = truncated.lastIndexOf(" ");

  return `${(lastSpace > 80 ? truncated.slice(0, lastSpace) : truncated).trimEnd()}…`;
}

function resolveGeography(initiative: Initiative) {
  const metadata = initiative.metadata;
  const community = getKnownInitiativeCommunity(metadata.communitySlug);
  const activityArea =
    metadata.activityArea === "Other" && metadata.activityAreaOther
      ? metadata.activityAreaOther
      : metadata.activityArea;

  const resolved = resolvePublicGeography({
    countryCode: metadata.countrySlug ?? community?.countrySlug,
    regionCode: metadata.regionSlug ?? community?.regionSlug,
    communitySlug: metadata.communitySlug,
    regionLabel: metadata.region,
    communityAssociation: metadata.communityAssociation,
  });

  return {
    country: resolved.country,
    region: resolved.region,
    city: resolved.city,
    activityArea,
    label: resolved.label,
  };
}

/**
 * UX Evolution Pack 02.4 Part 4 — `publicInitiative` is now always passed in
 * rather than re-fetched here, so the Lifecycle "Initiative" stage record's
 * `authorDisplayName` and the Overview panel's `stewardDisplayName` are
 * guaranteed (by construction, not just by coincidence of identical inputs)
 * to come from the exact same resolved value within a single request.
 */
/**
 * Exported (in addition to its internal call site) so a focused test can
 * assert the Part 4 invariant directly: the Lifecycle "Initiative" stage
 * record's `authorDisplayName` always equals the `publicInitiative` passed
 * in — see `public-initiative-experience-author-consistency.test.ts`.
 */
export async function buildStageRecords(
  initiative: Initiative,
  publicInitiative: PublicInitiativeProjection,
  /**
   * Performance Recovery Task — optional pre-fetched version history. The
   * caller (`buildPublicInitiativeExperienceProjection`) also needs the
   * initiative's version history for its own `revisionHistory` field; when
   * it passes its already-fetched result here, this function reuses it
   * instead of issuing a second, redundant lookup for the exact same data.
   * Omitting it (as the existing focused test does) simply falls back to
   * fetching it directly, so this parameter is purely an optimization, not
   * a behavior change.
   */
  precomputedVersionHistory?: PublicInitiativeWithVersionHistory,
): Promise<{
  records: Map<string, PublicInitiativeLifecycleRecordItem[]>;
  optionalStageDiagnostics: PublicInitiativeOptionalStageDiagnostics;
  inProgressStageIds: readonly string[];
}> {
  const initiativeId = initiative.initiativeId;
  const records = new Map<string, PublicInitiativeLifecycleRecordItem[]>();
  const optionalStageDiagnostics: {
    petition?: PublicInitiativeOptionalStageDiagnostic;
    civicArchive?: PublicInitiativeOptionalStageDiagnostic;
  } = {};

  records.set("initiative", [
    {
      recordId: initiativeId,
      title: initiative.title,
      summary: summarizeText(initiative.description, 320),
      status: initiative.status,
      updatedAt: initiative.updatedAt,
      authorDisplayName: publicInitiative.stewardDisplayName,
    },
  ]);

  // Discussion reuses the Center-tab civic surface — completion is an explicit
  // Author marker (Phase 04), never inferred from visiting #discussion.
  const discussionCompletion = getDiscussionCompletionByInitiativeId(initiativeId);
  records.set(
    "discussion",
    discussionCompletion
      ? [
          {
            recordId: discussionCompletion.completionId,
            title: "Discussion completed",
            summary: "The Author marked Discussion complete for lifecycle progression.",
            status: "Completed",
            updatedAt: discussionCompletion.completedAt,
            publicHref: `/initiatives/public/${encodeURIComponent(initiativeId)}#discussion`,
          },
        ]
      : [],
  );

  // Collaborative Analysis lifecycle progress is steward-canonical (same
  // authority as the stage adapter / Public Preview presentationStatus).
  const analysisProgress = resolveStewardCollaborativeAnalysisLifecycleProgress(
    initiativeId,
    initiative.stewardId,
  );
  const analyses = await Promise.all(
    analysisProgress.published.map((analysis) => toPublicInitiativeCollaborativeAnalysisListItem(analysis)),
  );

  const [
    legacyProposals,
    publishedProposalCollections,
    versionHistory,
    petitionLookup,
    collectiveDecisions,
    commitments,
    trackings,
    publicImpacts,
    archiveLookup,
  ] = await Promise.all([
    listPublicInitiativeImprovementProposals(initiativeId),
    listPublishedCollectionsByInitiative(initiativeId),
    precomputedVersionHistory ?? getPublicInitiativeVersionHistory(initiativeId),
    settleOptionalLifecycleLookup("petition_by_initiative", getPetitionByInitiativeId(initiativeId), null),
    listPublicInitiativeCollectiveDecisionsForInitiative(initiativeId),
    listPublicInitiativeImplementationCommitmentsForInitiative(initiativeId),
    listPublicInitiativeImplementationTrackingsForInitiative(initiativeId),
    listPublicInitiativePublicImpactsForInitiative(initiativeId),
    settleOptionalLifecycleLookup(
      "civic_archive_by_initiative",
      getLatestPublishedPublicCivicArchiveForInitiative(initiativeId),
      null,
    ),
  ]);

  optionalStageDiagnostics.petition = toOptionalStageDiagnostic(petitionLookup.classification);
  optionalStageDiagnostics.civicArchive = toOptionalStageDiagnostic(archiveLookup.classification);

  records.set(
    "analysis",
    analyses.map((analysis) => ({
      recordId: analysis.analysisId,
      title: analysis.title,
      summary: analysis.summary,
      updatedAt: analysis.publishedAt,
      publicHref: `/initiative-analyses/public/${encodeURIComponent(analysis.analysisId)}`,
      authorDisplayName: analysis.authorDisplayName,
      detail: `Version ${analysis.initiativeVersion}`,
    })),
  );

  records.set(
    "proposal",
    publishedProposalCollections.length > 0
      ? publishedProposalCollections.map((collection) => ({
          recordId: collection.collectionId,
          title: "Improvement Proposals collection",
          summary: `${collection.proposals.filter((proposal) => proposal.status === "published").length} published proposal(s)`,
          status: collection.status,
          updatedAt: collection.publishedAt ?? collection.updatedAt,
          publicHref: `/initiatives/public/${encodeURIComponent(initiativeId)}#improvement-proposals`,
        }))
      : legacyProposals.map((proposal) => ({
          recordId: proposal.proposalId,
          title: `${proposal.targetSection}: ${proposal.proposedChange}`,
          status: proposal.status.replaceAll("_", " "),
          updatedAt: proposal.decidedAt ?? proposal.updatedAt,
          publicHref: `/improvement-proposals/public/${encodeURIComponent(proposal.proposalId)}`,
          authorDisplayName: proposal.authorDisplayName,
        })),
  );

  records.set(
    "revision",
    filterLifecycleProgressRevisions(versionHistory.revisions).map((revision) => ({
      recordId: revision.revisionId,
      title: `Version ${revision.version}`,
      summary: revision.revisionSummary,
      status: revision.isCurrent ? "Current" : "Published",
      updatedAt: revision.publishedAt,
      publicHref: `/initiatives/public/${encodeURIComponent(initiativeId)}/revisions/${revision.version}`,
      authorDisplayName: revision.authorDisplayName,
    })),
  );

  const petition = petitionLookup.value;
  let petitionProjection = null;
  if (petition && !petitionLookup.degraded) {
    const projectionLookup = await settleOptionalLifecycleLookup(
      "petition_public_projection",
      toPublicPetitionProjection(petition),
      null,
    );
    if (projectionLookup.degraded) {
      optionalStageDiagnostics.petition = {
        health: "unavailable",
        reasonCode: "infrastructure_failure",
      };
    } else {
      petitionProjection = projectionLookup.value;
      if (petitionProjection) {
        optionalStageDiagnostics.petition = { health: "ok" };
      }
    }
  }

  records.set(
    "petition",
    petitionProjection
      ? [
          {
            recordId: petitionProjection.petitionIdentity.petitionId,
            title: petitionProjection.petitionIdentity.title,
            summary: petitionProjection.petitionSummary.purpose,
            status: petitionProjection.petitionIdentity.lifecycleStatus,
            updatedAt:
              petitionProjection.petitionSummary.publishedAt ??
              petitionProjection.petitionSummary.opensAt ??
              initiative.updatedAt,
            publicHref: `/petitions/public/${encodeURIComponent(petitionProjection.petitionIdentity.petitionId)}`,
          },
        ]
      : [],
  );

  records.set(
    "decision_session",
    listPublicDecisionSessionsForInitiative(initiativeId).map((session) => ({
      recordId: session.sessionId,
      title: session.title,
      status: session.status,
      updatedAt: session.closesAt,
      publicHref: `/decision-sessions/public/${encodeURIComponent(session.sessionId)}`,
    })),
  );

  records.set(
    "collective_decision",
    collectiveDecisions.map((decision) => ({
      recordId: decision.decisionId,
      title: decision.question,
      summary: decision.outcomeSummary,
      status: decision.status,
      updatedAt: decision.closedAt ?? decision.closesAt,
      publicHref: `/collective-decisions/public/${encodeURIComponent(decision.decisionId)}`,
    })),
  );

  records.set(
    "commitment",
    commitments.map((commitment) => ({
      recordId: commitment.commitmentId,
      title: commitment.title,
      summary: commitment.summary,
      status: commitment.status,
      updatedAt:
        commitment.publishedAt ??
        commitment.completedAt ??
        commitment.expectedStartDate ??
        initiative.updatedAt,
      publicHref: `/initiative-implementation-commitments/public/${encodeURIComponent(commitment.commitmentId)}`,
      authorDisplayName: commitment.authorDisplayName,
    })),
  );

  records.set(
    "tracking",
    trackings.map((tracking) => ({
      recordId: tracking.trackingId,
      title: tracking.summary,
      status: tracking.status,
      updatedAt: tracking.activatedAt ?? tracking.completedAt ?? initiative.updatedAt,
      publicHref: `/implementation-tracking/public/${encodeURIComponent(tracking.trackingId)}`,
      authorDisplayName: tracking.authorDisplayName,
      detail: tracking.currentStage,
    })),
  );

  const capOfficialResponses = listPublicOfficialResponsesForInitiative(initiativeId).map(
    (response) => ({
      recordId: response.responseId,
      title: response.subject,
      summary: response.summary,
      status: response.verificationState,
      updatedAt: response.publishedAt ?? response.receivedAt,
      publicHref: `/official-responses/public/${encodeURIComponent(response.responseId)}`,
    }),
  );
  const lifecycleOfficialPackage = getOfficialResponsePackageByInitiativeId(initiativeId);
  const lifecycleOfficialResponses = lifecycleOfficialPackage
    ? listLifecycleOfficialResponsesByInitiativeId(initiativeId).map((response) => ({
        recordId: response.responseId,
        title: response.subject,
        summary: response.summary,
        status: response.verificationStatus,
        updatedAt: response.publishedAt ?? response.receivedAt,
        publicHref: `/initiatives/public/${encodeURIComponent(initiativeId)}#official-responses`,
      }))
    : [];

  // Published package with zero responses (explicit No Response) must still
  // count as a completed Official Responses stage so Public Impact unlocks.
  const lifecycleOfficialNavRecords =
    lifecycleOfficialResponses.length > 0
      ? lifecycleOfficialResponses
      : lifecycleOfficialPackage
        ? [
            {
              recordId: lifecycleOfficialPackage.packageId,
              title: lifecycleOfficialPackage.title,
              summary:
                lifecycleOfficialPackage.outcomeKind === "no_official_response_received"
                  ? lifecycleOfficialPackage.noResponseDetail?.note ||
                    "No official response received"
                  : lifecycleOfficialPackage.summary,
              status:
                lifecycleOfficialPackage.outcomeKind === "no_official_response_received"
                  ? "no_official_response_received"
                  : "published",
              updatedAt: lifecycleOfficialPackage.publishedAt,
              publicHref: `/initiatives/public/${encodeURIComponent(initiativeId)}#official-responses`,
            },
          ]
        : [];

  // Prefer Part K lifecycle Official Response package for progression.
  // Cap02 official responses remain SAFE_COMPATIBILITY display fallback only.
  records.set(
    "official_response",
    lifecycleOfficialNavRecords.length > 0 ? lifecycleOfficialNavRecords : capOfficialResponses,
  );

  const lifecyclePublicImpactReport = getPublicImpactReportByInitiativeId(initiativeId);
  // Prefer Part L Public Impact Report for progression; TASK-033 is fallback only.
  records.set(
    "public_impact",
    lifecyclePublicImpactReport
      ? [
          {
            recordId: lifecyclePublicImpactReport.reportId,
            title: lifecyclePublicImpactReport.title,
            summary: lifecyclePublicImpactReport.sections[0]?.body,
            status: lifecyclePublicImpactReport.status,
            updatedAt: lifecyclePublicImpactReport.publishedAt,
            publicHref: `/initiatives/public/${encodeURIComponent(initiativeId)}#public-impact`,
          },
        ]
      : publicImpacts.map((impact) => ({
          recordId: impact.impactId,
          title: impact.title,
          summary: impact.observedImpact,
          status: impact.status,
          updatedAt: impact.publishedAt ?? impact.verifiedAt ?? initiative.updatedAt,
          publicHref: `/public-impact/${encodeURIComponent(impact.impactId)}`,
          authorDisplayName: impact.authorDisplayName,
        })),
  );

  const archive = archiveLookup.value;
  if (archiveLookup.classification === "PRESENT" && archive) {
    optionalStageDiagnostics.civicArchive = { health: "ok" };
  }

  const lifecycleArchiveVersion = getLatestArchiveVersionByInitiativeId(initiativeId);
  // Canonical progression counts Author Part M Archive only.
  // TASK-037 public-civic-archive remains KEEP_PUBLIC_HISTORY via optional
  // diagnostics / Cap02 display — never advances experience.currentStageId.
  records.set(
    "archive",
    lifecycleArchiveVersion
      ? [
          {
            recordId: lifecycleArchiveVersion.archiveVersionId,
            title: lifecycleArchiveVersion.finalArchiveTitle,
            summary: lifecycleArchiveVersion.finalSummary,
            status: "archived",
            updatedAt: lifecycleArchiveVersion.publishedAt,
            publicHref: lifecycleArchiveVersion.publicUrlPath,
          },
        ]
      : [],
  );

  return {
    records,
    optionalStageDiagnostics: optionalStageDiagnostics as PublicInitiativeOptionalStageDiagnostics,
    // Draft without a published public result → In Progress for every viewer.
    inProgressStageIds:
      analysisProgress.hasDraft && analysisProgress.published.length === 0 ? (["analysis"] as const) : [],
  };
}

function toOptionalStageDiagnostic(
  classification: "PRESENT" | "ABSENT" | "NOT_CREATED_YET" | "INFRASTRUCTURE_FAILURE",
): PublicInitiativeOptionalStageDiagnostic {
  if (classification === "PRESENT") {
    return { health: "ok" };
  }
  if (classification === "INFRASTRUCTURE_FAILURE") {
    return { health: "unavailable", reasonCode: "infrastructure_failure" };
  }
  return { health: "absent", reasonCode: "not_created_yet" };
}

function buildStageContent(
  stageRecords: Map<string, PublicInitiativeLifecycleRecordItem[]>,
  optionalStageDiagnostics?: PublicInitiativeOptionalStageDiagnostics,
): PublicInitiativeLifecycleStageContent[] {
  const emptyMessages: Record<string, string> = {
    initiative: "Initiative content is available in Overview.",
    discussion: "Discussion continues in the Initiative Discussion tab.",
    analysis: "No Collaborative Analysis has been published yet.",
    proposal: "No improvement proposals have been published yet.",
    revision: "No revisions have been published.",
    petition:
      optionalStageDiagnostics?.petition?.health === "unavailable"
        ? "Petition information is temporarily unavailable."
        : "No petition is linked to this initiative.",
    decision_session: "No decision sessions have been published yet.",
    collective_decision: "No collective decisions have been published yet.",
    commitment: "No implementation commitments have been published yet.",
    tracking: "No implementation tracking records have been published yet.",
    official_response: "No official responses have been published yet.",
    public_impact: "No public impact records have been published yet.",
    archive:
      optionalStageDiagnostics?.civicArchive?.health === "unavailable"
        ? "Civic Archive information is temporarily unavailable."
        : "This initiative has not been archived yet.",
  };

  return EXPERIENCE_STAGES.map((stage) => {
    const stateRecords = stageRecords.get(stage.stageId) ?? [];
    return {
      stageId: stage.stageId,
      records: stateRecords,
      emptyStateMessage: emptyMessages[stage.stageId] ?? "No records are available for this stage.",
    };
  });
}

function buildRelatedCivicRecords(initiativeId: string): PublicInitiativeRelatedCivicRecord[] {
  const related: PublicInitiativeRelatedCivicRecord[] = [];

  for (const capPackage of listPublicCivicActionPackagesForInitiative(initiativeId)) {
    related.push({
      recordType: "Civic Action Package",
      recordId: capPackage.capId,
      title: capPackage.title,
      status: capPackage.status,
      updatedAt: capPackage.issuedAt,
      publicHref: `/civic-action-packages/public/${encodeURIComponent(capPackage.capId)}`,
    });
  }

  for (const accountability of listPublicCivicAccountabilitiesForInitiative(initiativeId)) {
    related.push({
      recordType: "Civic Accountability",
      recordId: accountability.accountabilityId,
      title: accountability.latestEventTitle ?? `Accountability ${accountability.accountabilityId}`,
      status: accountability.status,
      updatedAt: accountability.updatedAt,
      publicHref: `/civic-accountability/public/${encodeURIComponent(accountability.accountabilityId)}`,
    });
  }

  return related.sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

function selectLatestInitiatives(current: Initiative) {
  const geography = resolveGeography(current);
  const eligible = listInitiatives()
    .filter(
      (initiative) =>
        isInitiativeEligibleForPublicProjection(initiative) &&
        initiative.initiativeId !== current.initiativeId,
    )
    .map((initiative) => {
      let score = 0;
      const itemGeography = resolveGeography(initiative);

      if (itemGeography.activityArea === geography.activityArea) {
        score += 100;
      }

      if (geography.country && itemGeography.country === geography.country) {
        score += 10;
      }

      if (geography.region && itemGeography.region === geography.region) {
        score += 5;
      }

      return { initiative, score };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return (
        new Date(right.initiative.updatedAt).getTime() -
        new Date(left.initiative.updatedAt).getTime()
      );
    })
    .slice(0, 5)
    .map(({ initiative }) => toWorldInitiativeCardProjection(initiative));

  return eligible;
}

export async function buildPublicInitiativeExperienceProjection(input: {
  initiative: Initiative;
  userId?: string | null;
  viewerKey?: string | null;
  /**
   * UX Evolution Pack 02.3 — the viewer's Initiative-scoped participant id
   * (auth `memberId`), distinct from `userId` (the auth account id). Needed
   * to attach per-comment collaboration state (Proposal / Ready to
   * Collaborate / Invite to Allies visibility) to the server-rendered
   * initial comments, exactly as the client-side `/comments` route already
   * does. Optional and additive: omitting it simply yields comments with no
   * collaboration actions, matching prior behavior.
   */
  viewerParticipantId?: string | null;
}): Promise<PublicInitiativeExperienceProjection> {
  const { initiative } = input;
  createInitialInitiativeVersionRevision(initiative, initiative.stewardId);

  if (input.viewerKey) {
    // Fire-and-forget by design (view recording must never delay the
    // experience payload) — but a fire-and-forget call is still a Promise,
    // and an unawaited rejection is an unhandled rejection that can
    // terminate the process (Stability Hotfix: this was the crash site).
    // `recordInitiativeView` is now idempotent for the expected
    // duplicate-view race (see `recordViewMongo`), so anything that still
    // rejects here is a genuine, unexpected failure that must be logged,
    // never silently dropped and never allowed to crash the request.
    void recordInitiativeView({
      initiativeId: initiative.initiativeId,
      viewerKey: input.viewerKey,
    }).catch((error) => {
      logger.error("initiative_view.record_failed", {
        initiativeId: initiative.initiativeId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  // Performance Recovery Task — these four lookups are mutually
  // independent: `toPublicInitiativeProjection`, the initiative's version
  // history, its support statistics, and its discussion summary each
  // depend only on `initiative`/`input`, never on one another's result.
  // Running them concurrently instead of one sequential `await` after
  // another removes real, measured wall-clock latency (confirmed via
  // temporary per-step tracing during this task's investigation) without
  // changing any returned value.
  const [publicInitiative, versionHistory, support, { rawComments, ...discussionSummary }] =
    await Promise.all([
      toPublicInitiativeProjection(initiative),
      getPublicInitiativeVersionHistory(initiative.initiativeId),
      getInitiativeSupportStatistics({
        initiativeId: initiative.initiativeId,
        userId: input.userId ?? null,
        visitorKeyValue: input.userId ? null : (input.viewerKey ?? null),
      }),
      buildInitiativeDiscussionSummary({
        initiativeId: initiative.initiativeId,
        userId: input.userId ?? null,
      }),
    ]);
  const geography = resolveGeography(initiative);
  // `versionHistory` is passed through so `buildStageRecords` reuses this
  // exact result for its "revision" stage instead of fetching it a second
  // time (it was previously fetched twice per request — once here for the
  // top-level `revisionHistory` field, once inside `buildStageRecords`).
  const { records: stageRecords, optionalStageDiagnostics, inProgressStageIds } = await buildStageRecords(
    initiative,
    publicInitiative,
    versionHistory,
  );
  const { stages, currentStageId } = buildLifecycleNavigation(initiative, stageRecords, {
    inProgressStageIds,
  });
  const currentStage = stages.find((stage) => stage.stageId === currentStageId);
  // UX Evolution Pack 02.3 Part 1 diagnosis: `buildInitiativeDiscussionSummary`
  // alone never attached collaboration state, so every server-rendered
  // initial comment had `collaboration` permanently absent and the
  // Proposal / Ready to Collaborate / Invite to Allies controls could never
  // appear on first page load (only a later client-side `/comments` fetch
  // computed them). Mirror the exact same projection step the comments
  // route already performs, so the initial payload and any later refetch
  // are consistent.
  let initialComments = discussionSummary.initialComments;
  try {
    initialComments = await attachCollaborationStateToComments({
      initiativeId: initiative.initiativeId,
      rawComments,
      projectedComments: discussionSummary.initialComments,
      viewerParticipantId: input.viewerParticipantId ?? null,
    });
  } catch (error) {
    logger.warn("public_initiative_experience.collaboration_state_attach_failed", {
      initiativeId: initiative.initiativeId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const discussion: PublicInitiativeDiscussionSummary = {
    ...discussionSummary,
    initialComments,
  };

  const firstPublishedAt =
    initiative.timeline.find((event) => event.eventType === "initiative_published")?.timestamp ??
    initiative.createdAt;

  let participationJourney = undefined;
  try {
    participationJourney = await buildCollectiveParticipationJourney({
      initiativeId: initiative.initiativeId,
      participantId: input.viewerParticipantId ?? null,
    });
  } catch (error) {
    logger.warn("public_initiative_experience.participation_journey_failed", {
      initiativeId: initiative.initiativeId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    initiativeId: initiative.initiativeId,
    hero: {
      title: initiative.title,
      summary: summarizeText(initiative.description),
      activityArea: geography.activityArea,
      geography,
      status: initiative.status,
      currentStageLabel: currentStage?.label ?? "Initiative",
      firstPublishedAt,
      lastUpdatedAt: initiative.updatedAt,
      imageUrl: initiative.metadata.imageUrl,
      imageAltText: initiative.metadata.imageAltText,
      coverMedia: resolveInitiativeCoverMedia(initiative.metadata),
      stewardDisplayName: publicInitiative.stewardDisplayName,
    },
    initiative: publicInitiative,
    currentStageId,
    /** Guidance cursor — same derivation as currentStageId; never locks Author nav. */
    recommendedStageId: currentStageId,
    lifecycleStages: stages,
    stageContent: buildStageContent(stageRecords, optionalStageDiagnostics),
    supportStatistics: {
      ...support,
      transparencyNote: INITIATIVE_SUPPORT_TRANSPARENCY_NOTE,
    },
    revisionHistory: versionHistory,
    relatedCivicRecords: buildRelatedCivicRecords(initiative.initiativeId),
    latestInitiatives: selectLatestInitiatives(initiative),
    relatedInitiatives: (
      await findRelatedInitiativesForInitiative(initiative.initiativeId)
    ).items,
    discussion,
    optionalStageDiagnostics,
    lifecycleProfile: resolveInitiativeLifecycleProfile(initiative.lifecycleProfile),
    viewerIsSteward:
      Boolean(input.viewerParticipantId) &&
      input.viewerParticipantId === initiative.stewardId,
    participationJourney: participationJourney ?? undefined,
    generatedAt: new Date().toISOString(),
  };
}
