import type {
  Initiative,
  InitiativeLifecyclePresentationStatus,
  InitiativeLifecycleSourceKind,
  InitiativeLifecycleSourceSnapshotItem,
  InitiativeLifecycleSourceSnapshotSummary,
  InitiativeLifecycleStageId,
} from "@hu/types";

import { listAnalysesByInitiativeAndAuthor } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import { buildInitiativeAnalysisSourceSnapshot } from "../initiative-collaborative-analysis/initiative-analysis-source-snapshot.service.js";
import { buildInitiativeProposalIntelligenceSnapshot } from "../initiative-improvement-proposals-stage/initiative-proposal-intelligence.service.js";
import { listPublicInitiativeCollectiveDecisionsForInitiative } from "../initiative-collective-decision/public-initiative-collective-decision.projection.js";
import { listPublicInitiativeImplementationCommitmentsForInitiative } from "../initiative-implementation-commitment/public-initiative-implementation-commitment.projection.js";
import { listPublicInitiativeImplementationTrackingsForInitiative } from "../initiative-implementation-tracking/public-initiative-implementation-tracking.projection.js";
import { listPublicInitiativeImprovementProposalsCollections } from "../initiative-improvement-proposals-stage/public-initiative-improvement-proposals-stage.projection.js";
import { listPublicInitiativePublicImpactsForInitiative } from "../initiative-public-impact/public-initiative-public-impact.projection.js";
import { buildInitiativeRevisionIntelligenceSnapshot } from "../initiative-version-revision/initiative-revision-intelligence.service.js";
import { getPublicInitiativeVersionHistory } from "../initiative-version-revision/public-initiative-version-revision.projection.js";
import { filterLifecycleProgressRevisions } from "../../shared/lifecycle/lifecycle-progress-revision.js";
import { listPublicOfficialResponsesForInitiative } from "../official-response/official-response.projection.js";
import { listPublicDecisionSessionsForInitiative } from "../decision-session/public-decision-session.projection.js";
import { getPetitionByInitiativeId } from "../petition/petition.store.js";
import { toPublicPetitionProjection } from "../petition/public-petition.projection.js";
import { buildInitiativePetitionIntelligenceSnapshot } from "../initiative-petition-lifecycle/initiative-petition-intelligence.service.js";
import { buildInitiativeDecisionSessionIntelligenceSnapshot } from "../initiative-decision-session-lifecycle/initiative-decision-session-intelligence.service.js";
import { buildInitiativeCollectiveDecisionIntelligenceSnapshot } from "../initiative-collective-decision-lifecycle/initiative-collective-decision-intelligence.service.js";
import { buildInitiativeImplementationCommitmentIntelligenceSnapshot } from "../initiative-implementation-commitment-lifecycle/initiative-implementation-commitment-intelligence.service.js";
import { getPackageByInitiativeId } from "../initiative-implementation-commitment-lifecycle/initiative-implementation-commitment-package.store.js";
import { buildInitiativeImplementationTrackingIntelligenceSnapshot } from "../initiative-implementation-tracking-lifecycle/initiative-implementation-tracking-intelligence.service.js";
import { getPackageByInitiativeId as getTrackingPackageByInitiativeId } from "../initiative-implementation-tracking-lifecycle/initiative-implementation-tracking-package.store.js";
import { buildInitiativeOfficialResponseIntelligenceSnapshot } from "../initiative-official-response-lifecycle/initiative-official-response-intelligence.service.js";
import { getPackageByInitiativeId as getOfficialResponsePackageByInitiativeId } from "../initiative-official-response-lifecycle/initiative-official-response-package.store.js";
import { buildInitiativePublicImpactIntelligenceSnapshot } from "../initiative-public-impact-lifecycle/initiative-public-impact-intelligence.service.js";
import { getReportByInitiativeId as getPublicImpactReportByInitiativeId } from "../initiative-public-impact-lifecycle/initiative-public-impact-report.store.js";
import { buildInitiativeCivicArchiveIntelligenceSnapshot } from "../initiative-civic-archive-lifecycle/initiative-civic-archive-intelligence.service.js";
import { getLatestArchiveVersionByInitiativeId } from "../initiative-civic-archive-lifecycle/initiative-civic-archive-version.store.js";
import { getLatestPublishedPublicCivicArchiveForInitiative } from "../public-civic-archive/public-civic-archive.projection.js";
import { getSessionById } from "../decision-session/decision-session.store.js";
import { logger } from "../../shared/observability/logger.js";

/**
 * Initiative Lifecycle — Part A Completion Part 3: presentation adapters.
 *
 * Each of these functions answers ONLY what the shared
 * {@link InitiativeLifecycleStageWorkspace} shell needs — "is there a
 * public result", "what shared presentation status applies", "when was it
 * last published" — by reading the ONE domain already authoritative for
 * that stage. No domain's own status union, persisted fields, or workspace
 * are replaced or duplicated here; a domain may retain states this
 * adapter never sees (e.g. Decision Session's `"cancelled"`, Petition's
 * `"Open"` vs `"Closed"`, Implementation Tracking's `currentStage`).
 *
 * This module intentionally fetches AT MOST one domain's data — the
 * selected stage's — per call, unlike
 * `public-initiative-experience.service.ts#buildStageRecords`, which loads
 * all twelve stages for the full public experience page. Do not extend
 * this module to loop over every stage; that would reintroduce the
 * all-stage-fan-out performance defect this Part is explicitly meant to
 * avoid (Part 2/17).
 */
export interface InitiativeLifecycleStageAdapterResult {
  readonly presentationStatus: InitiativeLifecyclePresentationStatus;
  readonly hasPublicResult: boolean;
  readonly version: number | null;
  readonly publishedAt: string | null;
  /** Initiative Lifecycle — Part B. See {@link InitiativeLifecycleStageMetadata.publishedRecordId}. */
  readonly publishedRecordId: string | null;
}

const EMPTY_RESULT: InitiativeLifecycleStageAdapterResult = {
  presentationStatus: "not_started",
  hasPublicResult: false,
  version: null,
  publishedAt: null,
  publishedRecordId: null,
};

/**
 * CRITICAL ARCHITECTURAL RULE adapter point — `Initiative.lifecyclePhase`
 * (draft → published → projected → archived) is the Initiative record's
 * OWN publication state, never a value of the 12-stage public lifecycle.
 * This is the one place that maps it onto the shared presentation
 * vocabulary for the "Initiative" stage card; it does not touch
 * `Initiative.status` (a separate, still-independent concept — see
 * `STATUS_TO_STAGE` in `public-initiative-experience.service.ts`, which
 * derives the *current stage index*, not a presentation status).
 */
function adaptInitiativeRecordStage(initiative: Initiative): InitiativeLifecycleStageAdapterResult {
  const presentationStatus: InitiativeLifecyclePresentationStatus =
    initiative.lifecyclePhase === "draft"
      ? "draft"
      : initiative.lifecyclePhase === "archived"
        ? "superseded"
        : "published";

  return {
    presentationStatus,
    hasPublicResult: initiative.lifecyclePhase !== "draft",
    version: initiative.revisions.length > 0 ? initiative.revisions.length : null,
    publishedAt:
      initiative.timeline.find((event) => event.eventType === "initiative_published")?.timestamp ?? null,
    publishedRecordId: null,
  };
}

/**
 * Initiative Lifecycle — Part B. Scoped to the Initiative's Author
 * (steward) specifically — NOT "any participant's published analysis" —
 * so the one Analysis this Lifecycle stage treats as canonical is always
 * the Author's own, even though the underlying domain still supports
 * other participants independently publishing their own analyses of the
 * same Initiative (the pre-existing "Collective Intelligence" model,
 * left untouched; those are simply not this stage's canonical artifact).
 */
async function adaptAnalysisStage(initiative: Initiative): Promise<InitiativeLifecycleStageAdapterResult> {
  const authored = listAnalysesByInitiativeAndAuthor(initiative.initiativeId, initiative.stewardId);
  const published = authored
    .filter((analysis) => analysis.status === "published")
    .sort((left, right) => (right.publishedAt ?? "").localeCompare(left.publishedAt ?? ""));
  const latest = published[0] ?? null;

  return latest
    ? {
        presentationStatus: "published",
        hasPublicResult: true,
        version: published.length,
        publishedAt: latest.publishedAt ?? null,
        publishedRecordId: latest.analysisId,
      }
    : EMPTY_RESULT;
}

/**
 * Initiative Lifecycle — Part D. The canonical public result for the
 * "proposal" stage is now the Author's published
 * `InitiativeImprovementProposalsCollection` (Part 1: the structured
 * bridge between Discussion and Revision), NOT the older, still-active
 * `initiative-improvement-proposal` module (participant-submitted
 * proposals with an independent steward decision workflow — left
 * completely untouched, see Part D completion report).
 */
async function adaptProposalStage(initiativeId: string): Promise<InitiativeLifecycleStageAdapterResult> {
  const collections = await listPublicInitiativeImprovementProposalsCollections(initiativeId);
  const latest = collections[0] ?? null;

  return latest
    ? {
        presentationStatus: "published",
        hasPublicResult: true,
        version: latest.version,
        publishedAt: latest.publishedAt,
        publishedRecordId: latest.collectionId,
      }
    : EMPTY_RESULT;
}

async function adaptRevisionStage(initiativeId: string): Promise<InitiativeLifecycleStageAdapterResult> {
  const history = await getPublicInitiativeVersionHistory(initiativeId);
  const progressRevisions = filterLifecycleProgressRevisions(history.revisions);
  const current =
    progressRevisions.find((revision) => revision.isCurrent) ?? progressRevisions[0] ?? null;

  return current
    ? {
        presentationStatus: "published",
        hasPublicResult: true,
        version: current.version,
        publishedAt: current.publishedAt,
        // Initiative Lifecycle — Part E. Unlike Analysis/Proposal (keyed by
        // a real generated id), a published Revision is addressed by its
        // Initiative + version number (see the public route
        // `/:initiativeId/revisions/:version`) — this stringified version
        // number is what the web `publicResultSlot` passes straight back
        // into `getPublicInitiativeVersionRevision`, mirroring how
        // `publishedRecordId` is used for the other draft-capable stages.
        publishedRecordId: String(current.version),
      }
    : EMPTY_RESULT;
}

async function adaptPetitionStage(initiativeId: string): Promise<InitiativeLifecycleStageAdapterResult> {
  let petition;
  try {
    petition = await getPetitionByInitiativeId(initiativeId);
  } catch (error) {
    logger.error("initiative_lifecycle_stage_adapter.petition_infrastructure_failure", {
      initiativeId,
      classification: "INFRASTRUCTURE_FAILURE",
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      presentationStatus: "unavailable",
      hasPublicResult: false,
      version: null,
      publishedAt: null,
      publishedRecordId: null,
    };
  }

  if (!petition) {
    return EMPTY_RESULT;
  }

  // Petition retains its own richer publication/signature state
  // (`PetitionState`: Draft/Ready/Published/Open/Closed/Archived) — this
  // adapter only answers whether a public result exists at all.
  let projection;
  try {
    projection = await toPublicPetitionProjection(petition);
  } catch (error) {
    logger.error("initiative_lifecycle_stage_adapter.petition_projection_infrastructure_failure", {
      initiativeId,
      classification: "INFRASTRUCTURE_FAILURE",
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      presentationStatus: "unavailable",
      hasPublicResult: false,
      version: null,
      publishedAt: null,
      publishedRecordId: null,
    };
  }

  if (!projection) {
    return EMPTY_RESULT;
  }

  const isPublic = projection.petitionIdentity.lifecycleStatus !== "Draft";

  return {
    presentationStatus: isPublic ? "published" : "draft",
    hasPublicResult: isPublic,
    version: null,
    publishedAt: projection.petitionSummary.publishedAt ?? projection.petitionSummary.opensAt ?? null,
    // Initiative Lifecycle — Part F. Unlike Analysis/Proposal (a real
    // generated collection/analysis id) and unlike Revision (a version
    // number), Petition supports only one canonical published record per
    // Initiative, addressed directly by its own `petitionId` — this is
    // what the web `publicResultSlot` passes straight into
    // `InitiativePetitionPublicResult`, mirroring how `publishedRecordId`
    // is used for every other draft-capable stage.
    publishedRecordId: isPublic ? projection.petitionIdentity.petitionId : null,
  };
}

async function adaptDecisionSessionStage(
  initiativeId: string,
): Promise<InitiativeLifecycleStageAdapterResult> {
  const sessions = listPublicDecisionSessionsForInitiative(initiativeId);
  const latest = sessions[0] ?? null;

  if (!latest) {
    return EMPTY_RESULT;
  }

  // Initiative Lifecycle — Part G: a published Decision Session is already
  // the public civic document (Section 8). Closed remains public too.
  const session = getSessionById(latest.sessionId);
  const isPublic = latest.status === "published" || latest.status === "closed";

  return {
    presentationStatus: isPublic ? "published" : "ready_for_review",
    hasPublicResult: isPublic,
    version: null,
    publishedAt: session?.publishedAt ?? latest.publishedAt ?? null,
    publishedRecordId: isPublic ? latest.sessionId : null,
  };
}

async function adaptCollectiveDecisionStage(
  initiativeId: string,
): Promise<InitiativeLifecycleStageAdapterResult> {
  const decisions = await listPublicInitiativeCollectiveDecisionsForInitiative(initiativeId);
  const latest = decisions[0] ?? null;

  if (!latest) {
    return EMPTY_RESULT;
  }

  // Initiative Lifecycle — Part H: a closed Collective Decision is the
  // public civic document (Section 6/8) — draft/opened stay in-progress.
  const isPublic = latest.status === "closed";

  return {
    presentationStatus: isPublic ? "published" : "ready_for_review",
    hasPublicResult: isPublic,
    version: null,
    publishedAt: latest.closedAt ?? latest.closesAt ?? null,
    publishedRecordId: isPublic ? latest.decisionId : null,
  };
}

async function adaptCommitmentStage(initiativeId: string): Promise<InitiativeLifecycleStageAdapterResult> {
  // Initiative Lifecycle — Part I: once a Commitment Package has been
  // published, it is the stage's one canonical public result, addressed
  // by `packageId` (mirrors Collective Decision's `decisionId`).
  const publishedPackage = getPackageByInitiativeId(initiativeId);

  if (publishedPackage) {
    return {
      presentationStatus: "published",
      hasPublicResult: true,
      version: publishedPackage.commitmentIds.length,
      publishedAt: publishedPackage.publishedAt,
      publishedRecordId: publishedPackage.packageId,
    };
  }

  // Legacy fallback — commitments created before Part I's Package model
  // (this projection is already public-only, so any returned record is by
  // definition a published public result).
  const commitments = await listPublicInitiativeImplementationCommitmentsForInitiative(initiativeId);
  const latest = commitments[0] ?? null;

  return latest
    ? {
        presentationStatus: "published",
        hasPublicResult: true,
        version: commitments.length,
        publishedAt: latest.publishedAt ?? latest.completedAt ?? null,
        publishedRecordId: latest.commitmentId,
      }
    : EMPTY_RESULT;
}

async function adaptTrackingStage(initiativeId: string): Promise<InitiativeLifecycleStageAdapterResult> {
  // Initiative Lifecycle — Part J: once a Tracking Package has been
  // published, it is the stage's one canonical public result, addressed
  // by `packageId` (mirrors Commitment's `packageId`).
  const publishedPackage = getTrackingPackageByInitiativeId(initiativeId);

  if (publishedPackage) {
    return {
      presentationStatus: "published",
      hasPublicResult: true,
      version: publishedPackage.trackingIds.length,
      publishedAt: publishedPackage.publishedAt,
      publishedRecordId: publishedPackage.packageId,
    };
  }

  // Legacy fallback — Tracking records created before Part J's Package
  // model (this projection is already public-only, so any returned
  // record is by definition a published public result).
  const trackings = await listPublicInitiativeImplementationTrackingsForInitiative(initiativeId);
  const latest = trackings[0] ?? null;

  return latest
    ? {
        presentationStatus: "published",
        hasPublicResult: true,
        version: null,
        publishedAt: latest.activatedAt ?? latest.completedAt ?? null,
        publishedRecordId: null,
      }
    : EMPTY_RESULT;
}

/**
 * Initiative Lifecycle — Part K: once an Official Response Package has
 * been published, it is the stage's one canonical public result,
 * addressed by `packageId` (mirrors Tracking's `packageId`). Falls back to
 * the pre-existing CAP/delivery TASK-041 `OfficialResponse` domain
 * (`listPublicOfficialResponsesForInitiative`) for Initiatives that only
 * ever produced Official Responses through that older, still-independent
 * path — this adapter never mutates or reads private fields of either
 * domain, and Part K leaves the CAP domain completely untouched.
 */
async function adaptOfficialResponseStage(
  initiativeId: string,
): Promise<InitiativeLifecycleStageAdapterResult> {
  const publishedPackage = getOfficialResponsePackageByInitiativeId(initiativeId);

  if (publishedPackage) {
    return {
      presentationStatus: "published",
      hasPublicResult: true,
      version: publishedPackage.responseIds.length,
      publishedAt: publishedPackage.publishedAt,
      publishedRecordId: publishedPackage.packageId,
    };
  }

  const responses = listPublicOfficialResponsesForInitiative(initiativeId);
  const latest = responses[0] ?? null;

  return latest
    ? {
        presentationStatus: "published",
        hasPublicResult: true,
        version: responses.length,
        publishedAt: latest.publishedAt ?? latest.receivedAt ?? null,
        publishedRecordId: null,
      }
    : EMPTY_RESULT;
}

/**
 * Initiative Lifecycle — Part L: once a Public Impact Report has been
 * published, it is the stage's one canonical public result, addressed by
 * `reportId`. Falls back to the pre-existing TASK-033
 * `InitiativePublicImpact` domain (`listPublicInitiativePublicImpactsForInitiative`)
 * for Initiatives that only ever produced Public Impacts through that
 * older, still-independent path — this adapter never mutates either
 * domain, and Part L leaves TASK-033 completely untouched.
 */
async function adaptPublicImpactStage(initiativeId: string): Promise<InitiativeLifecycleStageAdapterResult> {
  const publishedReport = getPublicImpactReportByInitiativeId(initiativeId);

  if (publishedReport) {
    return {
      presentationStatus: "published",
      hasPublicResult: true,
      version: 1,
      publishedAt: publishedReport.publishedAt,
      publishedRecordId: publishedReport.reportId,
    };
  }

  // Legacy fallback — Public Impact records created before Part L's Report
  // model (this projection is already public-only, so any returned
  // record is by definition a published public result).
  const impacts = await listPublicInitiativePublicImpactsForInitiative(initiativeId);
  const latest = impacts[0] ?? null;

  return latest
    ? {
        presentationStatus: "published",
        hasPublicResult: true,
        version: impacts.length,
        publishedAt: latest.publishedAt ?? latest.verifiedAt ?? null,
        publishedRecordId: null,
      }
    : EMPTY_RESULT;
}

async function adaptArchiveStage(initiativeId: string): Promise<InitiativeLifecycleStageAdapterResult> {
  // Prefer Part M versioned lifecycle Archive; fall back to TASK-037 only
  // when no lifecycle version exists (legacy records). Never mutate TASK-037.
  const lifecycleVersion = getLatestArchiveVersionByInitiativeId(initiativeId);

  if (lifecycleVersion) {
    return {
      presentationStatus: "published",
      hasPublicResult: true,
      version: lifecycleVersion.archiveVersion,
      publishedAt: lifecycleVersion.publishedAt,
      publishedRecordId: lifecycleVersion.archiveVersionId,
    };
  }

  const archive = await getLatestPublishedPublicCivicArchiveForInitiative(initiativeId);

  return archive
    ? {
        presentationStatus: "published",
        hasPublicResult: true,
        version: archive.archivedVersion,
        publishedAt: archive.archivedAt ?? null,
        publishedRecordId: null,
      }
    : EMPTY_RESULT;
}

/**
 * The one dispatch point Part 2's projection service calls — exactly one
 * domain lookup for the selected stage, never a fan-out across all twelve.
 */
export async function buildInitiativeLifecycleStageAdapterResult(
  stageId: InitiativeLifecycleStageId,
  initiative: Initiative,
): Promise<InitiativeLifecycleStageAdapterResult> {
  switch (stageId) {
    case "initiative":
      return adaptInitiativeRecordStage(initiative);
    case "discussion": {
      // Progress completion uses the explicit Author completion marker
      // (Phase 04). The Discussion Center tab itself is always the civic surface.
      const { getDiscussionCompletionByInitiativeId } = await import(
        "../initiative-discussion-lifecycle/initiative-discussion-completion.store.js"
      );
      const completion = getDiscussionCompletionByInitiativeId(initiative.initiativeId);
      if (!completion) {
        return initiative.lifecyclePhase === "draft"
          ? EMPTY_RESULT
          : {
              presentationStatus: "draft",
              hasPublicResult: false,
              version: null,
              publishedAt: null,
              publishedRecordId: null,
            };
      }

      return {
        presentationStatus: "published",
        hasPublicResult: true,
        version: 1,
        publishedAt: completion.completedAt,
        publishedRecordId: completion.completionId,
      };
    }
    case "analysis":
      return adaptAnalysisStage(initiative);
    case "proposal":
      return adaptProposalStage(initiative.initiativeId);
    case "revision":
      return adaptRevisionStage(initiative.initiativeId);
    case "petition":
      return adaptPetitionStage(initiative.initiativeId);
    case "decision_session":
      return adaptDecisionSessionStage(initiative.initiativeId);
    case "collective_decision":
      return adaptCollectiveDecisionStage(initiative.initiativeId);
    case "commitment":
      return adaptCommitmentStage(initiative.initiativeId);
    case "tracking":
      return adaptTrackingStage(initiative.initiativeId);
    case "official_response":
      return adaptOfficialResponseStage(initiative.initiativeId);
    case "public_impact":
      return adaptPublicImpactStage(initiative.initiativeId);
    case "archive":
      return adaptArchiveStage(initiative.initiativeId);
    default:
      return EMPTY_RESULT;
  }
}

/**
 * Part 13 — source-snapshot UI boundary. Every stage except Collaborative
 * Analysis (Part B) and Improvement Proposals (Part D) still reports the
 * honest empty placeholder — no source aggregation exists yet for those,
 * per Part 18 scope protection. "analysis"/"proposal" each condense their
 * own real, richer snapshot into this shell-generic shape for the
 * header-level Source Summary section; the fuller detail (topics,
 * arguments, groups, open questions) is fetched separately by the
 * stage-specific Source Snapshot Panel / AI Assistant sidebar.
 */
export async function buildInitiativeLifecycleSourceSnapshotSummary(
  stageId: InitiativeLifecycleStageId,
  initiativeId: string,
  isAuthorWorkspace: boolean,
): Promise<InitiativeLifecycleSourceSnapshotSummary> {
  // Only the Author Workspace view ever renders the Source Summary section
  // (Part A Part 5/6) — building the real aggregation for a Public Mode
  // viewer who will never see it would be wasted work (Part 17).
  if (
    !isAuthorWorkspace ||
    (stageId !== "analysis" &&
      stageId !== "proposal" &&
      stageId !== "revision" &&
      stageId !== "petition" &&
      stageId !== "decision_session" &&
      stageId !== "collective_decision" &&
      stageId !== "commitment" &&
      stageId !== "tracking" &&
      stageId !== "official_response" &&
      stageId !== "public_impact" &&
      stageId !== "archive")
  ) {
    return {
      stageId,
      capturedAt: new Date().toISOString(),
      items: [],
      isEmpty: true,
    };
  }

  if (stageId === "archive") {
    const snapshot = await buildInitiativeCivicArchiveIntelligenceSnapshot(initiativeId);
    const items: InitiativeLifecycleSourceSnapshotItem[] = [
      {
        sourceId: "public-impact-report-reference",
        kind: "member_contribution",
        label: "Published Public Impact Report",
        summary: snapshot.publicImpactReportReference
          ? snapshot.publicImpactReportReference.label
          : "No published Public Impact Report yet",
      },
      {
        sourceId: "completeness",
        kind: "member_contribution",
        label: "Archive Completeness",
        summary: snapshot.completeness.summary,
      },
      {
        sourceId: "participation-statistics",
        kind: "member_contribution",
        label: "Community Participation",
        summary: `${snapshot.participationStatistics.signatureCount} signature(s) · ${snapshot.participationStatistics.supportCount} support · ${snapshot.participationStatistics.activeAllyCount} ally(ies)`,
      },
      {
        sourceId: "consistency-checks",
        kind: "member_contribution",
        label: "Consistency Checks",
        summary: `${snapshot.consistencyChecks.filter((check) => check.status === "warning").length} warning(s) of ${snapshot.consistencyChecks.length}`,
      },
    ];

    return {
      stageId,
      capturedAt: snapshot.generatedAt,
      items,
      isEmpty: snapshot.isEmpty,
    };
  }

  if (stageId === "public_impact") {
    const snapshot = await buildInitiativePublicImpactIntelligenceSnapshot(initiativeId);
    const items: InitiativeLifecycleSourceSnapshotItem[] = [
      {
        sourceId: "official-response-package-reference",
        kind: "member_contribution",
        label: "Published Official Response Package",
        summary: snapshot.officialResponsePackageReference
          ? snapshot.officialResponsePackageReference.title
          : "No published Official Response Package yet",
      },
      {
        sourceId: "tracking-package-reference",
        kind: "member_contribution",
        label: "Published Implementation Tracking Package",
        summary: snapshot.trackingPackageReference
          ? snapshot.trackingPackageReference.title
          : "No published Implementation Tracking Package yet",
      },
      {
        sourceId: "evidence-items",
        kind: "member_contribution",
        label: "Evidence References",
        summary: `${snapshot.evidenceItems.length} evidence reference(s)`,
      },
      {
        sourceId: "participation-statistics",
        kind: "member_contribution",
        label: "Community Participation",
        summary: `${snapshot.participationStatistics.signatureCount} signature(s) · ${snapshot.participationStatistics.supportCount} support · ${snapshot.participationStatistics.activeAllyCount} ally(ies)`,
      },
      {
        sourceId: "consistency-checks",
        kind: "member_contribution",
        label: "Consistency Checks",
        summary: `${snapshot.consistencyChecks.filter((check) => check.status === "warning").length} warning(s) of ${snapshot.consistencyChecks.length}`,
      },
    ];

    return {
      stageId,
      capturedAt: snapshot.generatedAt,
      items,
      isEmpty: snapshot.isEmpty,
    };
  }

  if (stageId === "official_response") {
    const snapshot = await buildInitiativeOfficialResponseIntelligenceSnapshot(initiativeId);
    const items: InitiativeLifecycleSourceSnapshotItem[] = [
      {
        sourceId: "tracking-package-reference",
        kind: "member_contribution",
        label: "Published Implementation Tracking Package",
        summary: snapshot.trackingPackageReference
          ? snapshot.trackingPackageReference.title
          : "No published Implementation Tracking Package yet",
      },
      {
        sourceId: "tracking-records",
        kind: "member_contribution",
        label: "Tracking Records",
        summary: `${snapshot.trackingRecords.length} Tracking Record(s)`,
      },
      {
        sourceId: "active-allies",
        kind: "member_contribution",
        label: "Active Allies",
        summary: `${snapshot.activeAllyCount} active`,
      },
      {
        sourceId: "consistency-checks",
        kind: "member_contribution",
        label: "Consistency Checks",
        summary: `${snapshot.consistencyChecks.filter((check) => check.status === "warning").length} warning(s) of ${snapshot.consistencyChecks.length}`,
      },
    ];

    return {
      stageId,
      capturedAt: snapshot.generatedAt,
      items,
      isEmpty: snapshot.isEmpty,
    };
  }

  if (stageId === "tracking") {
    const snapshot = await buildInitiativeImplementationTrackingIntelligenceSnapshot(initiativeId);
    const items: InitiativeLifecycleSourceSnapshotItem[] = [
      {
        sourceId: "commitment-package-reference",
        kind: "member_contribution",
        label: "Published Commitment Package",
        summary: snapshot.packageReference
          ? snapshot.packageReference.title
          : "No published Commitment Package yet",
      },
      {
        sourceId: "accepted-commitments",
        kind: "member_contribution",
        label: "Accepted Commitments",
        summary: `${snapshot.acceptedCommitments.length} Accepted Commitment(s)`,
      },
      {
        sourceId: "active-allies",
        kind: "member_contribution",
        label: "Active Allies",
        summary: `${snapshot.activeAllyCount} active`,
      },
      {
        sourceId: "consistency-checks",
        kind: "member_contribution",
        label: "Consistency Checks",
        summary: `${snapshot.consistencyChecks.filter((check) => check.status === "warning").length} warning(s) of ${snapshot.consistencyChecks.length}`,
      },
    ];

    return {
      stageId,
      capturedAt: snapshot.generatedAt,
      items,
      isEmpty: snapshot.isEmpty,
    };
  }

  if (stageId === "commitment") {
    const snapshot = await buildInitiativeImplementationCommitmentIntelligenceSnapshot(initiativeId);
    const items: InitiativeLifecycleSourceSnapshotItem[] = [
      {
        sourceId: "collective-decision-reference",
        kind: "member_contribution",
        label: "Published Collective Decision",
        summary: snapshot.decisionReference
          ? snapshot.decisionReference.title
          : "No published Collective Decision yet",
      },
      {
        sourceId: "approved-actions",
        kind: "member_contribution",
        label: "Approved Actions",
        summary: `${snapshot.decisionReference?.approvedActions.length ?? 0} Approved Action(s)`,
      },
      {
        sourceId: "active-allies",
        kind: "member_contribution",
        label: "Active Allies",
        summary: `${snapshot.activeAllyCount} active`,
      },
      {
        sourceId: "consistency-checks",
        kind: "member_contribution",
        label: "Consistency Checks",
        summary: `${snapshot.consistencyChecks.filter((check) => check.status === "warning").length} warning(s) of ${snapshot.consistencyChecks.length}`,
      },
    ];

    return {
      stageId,
      capturedAt: snapshot.generatedAt,
      items,
      isEmpty: snapshot.isEmpty,
    };
  }

  if (stageId === "collective_decision") {
    const snapshot = await buildInitiativeCollectiveDecisionIntelligenceSnapshot(initiativeId);
    const items: InitiativeLifecycleSourceSnapshotItem[] = [
      {
        sourceId: "decision-session-reference",
        kind: "member_contribution",
        label: "Published Decision Session",
        summary: snapshot.decisionSessionReference
          ? snapshot.decisionSessionReference.title
          : "No published Decision Session yet",
      },
      {
        sourceId: "petition-reference",
        kind: "member_contribution",
        label: "Published Petition",
        summary: snapshot.petitionReference
          ? snapshot.petitionReference.title
          : "No published Petition yet",
      },
      {
        sourceId: "revision-reference",
        kind: "member_contribution",
        label: "Published Revision",
        summary: snapshot.revisionReference
          ? `Version ${snapshot.revisionReference.version} — ${snapshot.revisionReference.revisionSummary}`
          : "No published Revision yet",
      },
      {
        sourceId: "consistency-checks",
        kind: "member_contribution",
        label: "Consistency Checks",
        summary: `${snapshot.consistencyChecks.filter((check) => check.status === "warning").length} warning(s) of ${snapshot.consistencyChecks.length}`,
      },
    ];

    return {
      stageId,
      capturedAt: snapshot.generatedAt,
      items,
      isEmpty: snapshot.isEmpty,
    };
  }

  if (stageId === "decision_session") {
    const snapshot = await buildInitiativeDecisionSessionIntelligenceSnapshot(initiativeId);
    const items: InitiativeLifecycleSourceSnapshotItem[] = [
      {
        sourceId: "petition-reference",
        kind: "member_contribution",
        label: "Published Petition",
        summary: snapshot.petitionReference
          ? snapshot.petitionReference.title
          : "No published Petition yet",
      },
      {
        sourceId: "revision-reference",
        kind: "member_contribution",
        label: "Published Revision",
        summary: snapshot.revisionReference
          ? `Version ${snapshot.revisionReference.version} — ${snapshot.revisionReference.revisionSummary}`
          : "No published Revision yet",
      },
      {
        sourceId: "ally-recommendations",
        kind: "member_contribution",
        label: "Active Ally recommendations",
        summary: `${snapshot.allyRecommendations.length} advisory recommendation(s)`,
      },
      {
        sourceId: "consistency-checks",
        kind: "member_contribution",
        label: "Consistency Checks",
        summary: `${snapshot.consistencyChecks.filter((check) => check.status === "warning").length} warning(s) of ${snapshot.consistencyChecks.length}`,
      },
    ];

    return {
      stageId,
      capturedAt: snapshot.generatedAt,
      items,
      isEmpty: snapshot.isEmpty,
    };
  }

  if (stageId === "petition") {
    const snapshot = await buildInitiativePetitionIntelligenceSnapshot(initiativeId);
    const items: InitiativeLifecycleSourceSnapshotItem[] = [
      {
        sourceId: "revision-reference",
        kind: "member_contribution",
        label: "Published Revision",
        summary: snapshot.revisionReference
          ? `Version ${snapshot.revisionReference.version} — ${snapshot.revisionReference.revisionSummary}`
          : "No published Revision yet",
      },
      {
        sourceId: "analysis-reference",
        kind: "member_contribution",
        label: "Published Collaborative Analysis",
        summary: snapshot.analysisReference ? snapshot.analysisReference.title : "No published Analysis yet",
      },
      {
        sourceId: "proposal-references",
        kind: "member_contribution",
        label: "Published Improvement Proposals",
        summary: `${snapshot.proposalReferences.length} accepted proposal(s) referenced`,
      },
      {
        sourceId: "consistency-checks",
        kind: "member_contribution",
        label: "Consistency Checks",
        summary: `${snapshot.consistencyChecks.filter((check) => check.status === "warning").length} warning(s) of ${snapshot.consistencyChecks.length}`,
      },
    ];

    return {
      stageId,
      capturedAt: snapshot.generatedAt,
      items,
      isEmpty: snapshot.isEmpty,
    };
  }

  if (stageId === "revision") {
    const snapshot = await buildInitiativeRevisionIntelligenceSnapshot(initiativeId);
    const items: InitiativeLifecycleSourceSnapshotItem[] = [
      {
        sourceId: "eligible-proposals",
        kind: "member_contribution",
        label: "Published Improvement Proposals",
        summary: `${snapshot.eligibleProposals.length} eligible, ${snapshot.unresolvedProposalIds.length} unresolved`,
        referenceUrl: snapshot.discussionUrl,
      },
      {
        sourceId: "missing-references",
        kind: "member_contribution",
        label: "Missing References",
        summary: `${snapshot.missingReferenceProposalIds.length} included Proposal(s) not yet in a change`,
        referenceUrl: snapshot.discussionUrl,
      },
      {
        sourceId: "conflict-warnings",
        kind: "member_contribution",
        label: "Conflict Warnings",
        summary: `${snapshot.conflictWarnings.length} section(s) with overlapping changes`,
      },
      {
        sourceId: "collaborative-analysis",
        kind: "member_contribution",
        label: "Collaborative Analysis",
        summary: snapshot.analysisReference ? snapshot.analysisReference.title : "No published Analysis yet",
      },
    ];

    return {
      stageId,
      capturedAt: snapshot.generatedAt,
      items,
      isEmpty: snapshot.isEmpty,
    };
  }

  if (stageId === "proposal") {
    const snapshot = await buildInitiativeProposalIntelligenceSnapshot(initiativeId);
    const items: InitiativeLifecycleSourceSnapshotItem[] = [
      {
        sourceId: "proposal-candidates",
        kind: "member_contribution",
        label: "Proposal Candidates",
        summary: `${snapshot.totalCandidateCount} marked from Discussion`,
        referenceUrl: snapshot.discussionUrl,
      },
      {
        sourceId: "proposal-groups",
        kind: "member_contribution",
        label: "Grouped Improvements",
        summary: `${snapshot.groups.length} group(s), ${snapshot.duplicateGroupCount} likely duplicate`,
        referenceUrl: snapshot.discussionUrl,
      },
      {
        sourceId: "open-proposal-questions",
        kind: "member_contribution",
        label: "Open Proposal Questions",
        summary: `${snapshot.openProposalQuestions.length} unresolved`,
        referenceUrl: snapshot.discussionUrl,
      },
    ];

    return {
      stageId,
      capturedAt: snapshot.generatedAt,
      items,
      isEmpty: snapshot.isEmpty,
    };
  }

  const snapshot = await buildInitiativeAnalysisSourceSnapshot(initiativeId);
  const items: InitiativeLifecycleSourceSnapshotItem[] = [
    {
      sourceId: "discussion-comments",
      kind: "member_contribution",
      label: "Discussion Comments",
      summary: `${snapshot.discussionStatistics.commentCount} comment(s) — ${snapshot.discussionStatistics.helpfulCount} helpful, ${snapshot.discussionStatistics.notHelpfulCount} not helpful`,
      referenceUrl: snapshot.discussionUrl,
    },
    {
      sourceId: "proposal-candidates",
      kind: "member_contribution",
      label: "Proposal Candidates",
      summary: `${snapshot.proposalCandidates.length} marked from Discussion`,
      referenceUrl: snapshot.discussionUrl,
    },
    {
      sourceId: "active-allies",
      kind: "member_contribution",
      label: "Active Allies",
      summary: `${snapshot.activeAlliesCount} active`,
    },
    {
      sourceId: "ready-to-collaborate",
      kind: "member_contribution",
      label: "Ready to Collaborate",
      summary: `${snapshot.readyToCollaborateCount} participant(s)`,
    },
  ];

  return {
    stageId,
    capturedAt: snapshot.generatedAt,
    items,
    isEmpty: snapshot.isEmpty,
  };
}

export type { InitiativeLifecycleSourceKind };
