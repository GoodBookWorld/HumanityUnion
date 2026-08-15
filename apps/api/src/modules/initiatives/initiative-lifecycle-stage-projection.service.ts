import type {
  Initiative,
  InitiativeLifecycleAiCapabilities,
  InitiativeLifecycleAuthorAction,
  InitiativeLifecycleStageId,
  InitiativeLifecycleStageMetadata,
  InitiativeLifecycleStageNeighbor,
  InitiativeLifecycleStageProjection,
} from "@hu/types";
import {
  getInitiativeLifecycleStageDefinition,
  getNextInitiativeLifecycleStageId,
  getPreviousInitiativeLifecycleStageId,
} from "@hu/types";

import { findAlly } from "../initiative-discussion-collaboration/initiative-ally.store.js";
import { resolveInitiativeLifecyclePresentationMode } from "../../shared/initiative-lifecycle-stage/initiative-lifecycle-author-mode.js";
import {
  buildInitiativeLifecycleSourceSnapshotSummary,
  buildInitiativeLifecycleStageAdapterResult,
} from "./initiative-lifecycle-stage-adapter.js";
import { listAnalysesByInitiativeAndAuthor } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import { listCollectionsByInitiativeAndAuthor } from "../initiative-improvement-proposals-stage/initiative-improvement-proposals-stage.store.js";
import { getRevisionDraftByInitiativeId } from "../initiative-version-revision/initiative-version-revision.store.js";
import { getInitiativePetitionDraftByInitiativeId } from "../initiative-petition-lifecycle/initiative-petition-draft.store.js";
import { getInitiativeDecisionSessionDraftByInitiativeId } from "../initiative-decision-session-lifecycle/initiative-decision-session-draft.store.js";
import { getInitiativeCollectiveDecisionLifecycleDraftByInitiativeId } from "../initiative-collective-decision-lifecycle/initiative-collective-decision-lifecycle-draft.store.js";
import { getInitiativeImplementationCommitmentLifecycleDraftByInitiativeId } from "../initiative-implementation-commitment-lifecycle/initiative-implementation-commitment-lifecycle-draft.store.js";
import { getInitiativeImplementationTrackingLifecycleDraftByInitiativeId } from "../initiative-implementation-tracking-lifecycle/initiative-implementation-tracking-lifecycle-draft.store.js";
import { getInitiativeOfficialResponseLifecycleDraftByInitiativeId } from "../initiative-official-response-lifecycle/initiative-official-response-lifecycle-draft.store.js";
import { getInitiativePublicImpactLifecycleDraftByInitiativeId } from "../initiative-public-impact-lifecycle/initiative-public-impact-lifecycle-draft.store.js";
import { getInitiativeCivicArchiveLifecycleDraftByInitiativeId } from "../initiative-civic-archive-lifecycle/initiative-civic-archive-lifecycle-draft.store.js";

/**
 * Initiative Lifecycle — Part A Completion Part 2: selected-stage
 * projection boundary.
 *
 * Query shape for one request: exactly one Initiative lookup (done by the
 * caller/route before this is invoked), at most one Active-Ally lookup
 * (skipped entirely for the Author and for guests), and exactly one
 * stage-domain adapter call (Part 3). This function never fetches all
 * twelve lifecycle stages — that remains the full
 * `buildPublicInitiativeExperienceProjection` aggregate's job, used only by
 * the overview/lifecycle-nav surfaces that genuinely need every stage's
 * record count at once.
 */

const NO_AI_CAPABILITIES: InitiativeLifecycleAiCapabilities = {
  canGenerateDraft: false,
  canRegenerateSection: false,
  canImproveWording: false,
  canIdentifyGaps: false,
  canIdentifyContradictions: false,
  canSummarize: false,
  canExplain: false,
  canAnswerQuestions: false,
};

/**
 * Collaborative Analysis — first stage with callable Lifecycle AI Assist
 * operations (Generate / Improve / Summarize / Explain / Answer) behind
 * `LifecycleAiProvider`. Deterministic draft generation remains available
 * separately; AI suggestions never auto-apply or auto-publish.
 */
const ANALYSIS_AI_CAPABILITIES: InitiativeLifecycleAiCapabilities = {
  canGenerateDraft: true,
  canRegenerateSection: true,
  canImproveWording: true,
  canIdentifyGaps: true,
  canIdentifyContradictions: true,
  canSummarize: true,
  canExplain: true,
  canAnswerQuestions: true,
};

/** Later stages keep deterministic Generate; LLM assist ops land per stage pack. */
const STAGE_BUILDER_ONLY_AI_CAPABILITIES: InitiativeLifecycleAiCapabilities = {
  canGenerateDraft: true,
  canRegenerateSection: false,
  canImproveWording: false,
  canIdentifyGaps: false,
  canIdentifyContradictions: false,
  canSummarize: false,
  canExplain: false,
  canAnswerQuestions: false,
};

const PROPOSAL_AI_CAPABILITIES = STAGE_BUILDER_ONLY_AI_CAPABILITIES;
const REVISION_AI_CAPABILITIES = STAGE_BUILDER_ONLY_AI_CAPABILITIES;
const PETITION_AI_CAPABILITIES = STAGE_BUILDER_ONLY_AI_CAPABILITIES;
const DECISION_SESSION_AI_CAPABILITIES = STAGE_BUILDER_ONLY_AI_CAPABILITIES;
const COLLECTIVE_DECISION_AI_CAPABILITIES = STAGE_BUILDER_ONLY_AI_CAPABILITIES;
const COMMITMENT_AI_CAPABILITIES = STAGE_BUILDER_ONLY_AI_CAPABILITIES;
const TRACKING_AI_CAPABILITIES = STAGE_BUILDER_ONLY_AI_CAPABILITIES;
const OFFICIAL_RESPONSE_AI_CAPABILITIES = STAGE_BUILDER_ONLY_AI_CAPABILITIES;
const PUBLIC_IMPACT_AI_CAPABILITIES = STAGE_BUILDER_ONLY_AI_CAPABILITIES;
const ARCHIVE_AI_CAPABILITIES = STAGE_BUILDER_ONLY_AI_CAPABILITIES;

function buildNeighbor(stageId: InitiativeLifecycleStageId | null): InitiativeLifecycleStageNeighbor | null {
  if (!stageId) {
    return null;
  }

  const definition = getInitiativeLifecycleStageDefinition(stageId);

  if (!definition) {
    return null;
  }

  return { stageId: definition.stageId, label: definition.label, hash: definition.hash };
}

/**
 * Part 7 — standard Author action model, honestly staged for Part A: only
 * `open_public_preview` (a real, client-side-only capability today, Part 9)
 * and `continue_to_next_stage` (pure navigation) are `"available"`. Every
 * drafting/publishing action is `"unavailable"` with an explanatory
 * description rather than a button that performs nothing — each stage's
 * own implementation pack (Part B onward) is what wires a real editor and
 * flips these to `"available"`.
 */
/**
 * Initiative Lifecycle — Part B extends this for `stageId === "analysis"`,
 * and Part D extends it identically for `stageId === "proposal"`:
 * `generate_draft`/`save_draft`/`publish` become real, available actions
 * (each stage's own Editor wires its own handlers directly — this array is
 * informational status, not itself the interactive control). Every other
 * stage keeps Part A's honest "not yet implemented" state.
 */
function buildAuthorActions(input: {
  readonly isAuthorWorkspaceStage: boolean;
  readonly hasNextStage: boolean;
  readonly isDraftCapableStage?: boolean;
  readonly hasDraft?: boolean;
}): readonly InitiativeLifecycleAuthorAction[] {
  if (!input.isAuthorWorkspaceStage) {
    return [];
  }

  const notYetImplemented = "Available once this stage's workspace is implemented.";
  const isDraftCapable = input.isDraftCapableStage ?? false;

  const actions: InitiativeLifecycleAuthorAction[] = [
    {
      actionId: "generate_draft",
      label: "Generate Draft",
      state: isDraftCapable ? "available" : "unavailable",
      description: isDraftCapable
        ? "Builds a structured draft from the collected Source Snapshot."
        : notYetImplemented,
    },
    {
      actionId: "save_draft",
      label: "Save Draft",
      state: isDraftCapable ? (input.hasDraft ? "available" : "unavailable") : "unavailable",
      description:
        isDraftCapable && !input.hasDraft ? "Generate or create a draft first." : notYetImplemented,
    },
    {
      actionId: "open_public_preview",
      label: "Public Preview",
      state: "available",
      description: "Preview how this stage will look to the public once published.",
    },
    {
      actionId: "publish",
      label: "Publish",
      state: isDraftCapable ? (input.hasDraft ? "available" : "unavailable") : "unavailable",
      description:
        isDraftCapable && !input.hasDraft ? "Generate or create a draft first." : notYetImplemented,
    },
    {
      actionId: "continue_to_next_stage",
      label: "Continue to Next Stage",
      state: input.hasNextStage ? "available" : "unavailable",
    },
  ];

  return actions;
}

export async function buildInitiativeLifecycleStageProjection(input: {
  readonly initiative: Initiative;
  readonly stageId: InitiativeLifecycleStageId;
  readonly viewerParticipantId: string | null;
}): Promise<InitiativeLifecycleStageProjection | null> {
  const { initiative, stageId } = input;
  const stageDefinition = getInitiativeLifecycleStageDefinition(stageId);

  if (!stageDefinition) {
    return null;
  }

  const isInitiativeAuthor =
    input.viewerParticipantId !== null && input.viewerParticipantId === initiative.stewardId;

  // Single bounded lookup: only needed when the viewer is authenticated and
  // is not already known to be the Author (an Author is never also their
  // own Ally row for this purpose).
  const activeAlly =
    !isInitiativeAuthor && input.viewerParticipantId
      ? await findAlly(initiative.initiativeId, input.viewerParticipantId)
      : null;

  const mode = resolveInitiativeLifecyclePresentationMode({
    initiativeStewardId: initiative.stewardId,
    viewerParticipantId: input.viewerParticipantId,
    stageId,
    isActiveAlly: activeAlly?.status === "active",
  });

  const adapterResult = await buildInitiativeLifecycleStageAdapterResult(stageId, initiative);
  const isAuthorWorkspace = mode.presentationMode === "author_workspace";
  const isAnalysisStage = stageId === "analysis";
  const isProposalStage = stageId === "proposal";
  const isRevisionStage = stageId === "revision";
  const isPetitionStage = stageId === "petition";
  const isDecisionSessionStage = stageId === "decision_session";
  const isCollectiveDecisionStage = stageId === "collective_decision";
  const isCommitmentStage = stageId === "commitment";
  const isTrackingStage = stageId === "tracking";
  const isOfficialResponseStage = stageId === "official_response";
  const isPublicImpactStage = stageId === "public_impact";
  const isArchiveStage = stageId === "archive";
  const isDraftCapableStage =
    isAnalysisStage ||
    isProposalStage ||
    isRevisionStage ||
    isPetitionStage ||
    isDecisionSessionStage ||
    isCollectiveDecisionStage ||
    isCommitmentStage ||
    isTrackingStage ||
    isOfficialResponseStage ||
    isPublicImpactStage ||
    isArchiveStage;

  // Initiative Lifecycle — Part B/D/E/F: only the Author, on a draft-capable
  // stage, needs "my own current draft" — every other viewer/stage
  // combination skips this lookup entirely (Part 17 performance rule).
  const myAnalyses =
    isAnalysisStage && isAuthorWorkspace
      ? listAnalysesByInitiativeAndAuthor(initiative.initiativeId, initiative.stewardId)
      : [];
  const myAnalysisDraft = myAnalyses.find((analysis) => analysis.status === "draft") ?? null;

  const myProposalCollections =
    isProposalStage && isAuthorWorkspace
      ? await listCollectionsByInitiativeAndAuthor(initiative.initiativeId, initiative.stewardId)
      : [];
  const myProposalDraft = myProposalCollections.find((collection) => collection.status === "draft") ?? null;

  const myRevisionDraft =
    isRevisionStage && isAuthorWorkspace ? getRevisionDraftByInitiativeId(initiative.initiativeId) : null;

  // Petition's "draft" is only ever in-progress before the one-shot
  // Publish — `getInitiativePetitionDraftByInitiativeId` already returns
  // `null` once `publishInitiativePetitionStage` deletes it (Section 6),
  // so no extra "is this the un-published one" filtering is needed here,
  // unlike Analysis/Proposal's multi-record `status === "draft"` lookup.
  const myPetitionDraft =
    isPetitionStage && isAuthorWorkspace
      ? getInitiativePetitionDraftByInitiativeId(initiative.initiativeId)
      : null;

  const myDecisionSessionDraft =
    isDecisionSessionStage && isAuthorWorkspace
      ? getInitiativeDecisionSessionDraftByInitiativeId(initiative.initiativeId)
      : null;

  const myCollectiveDecisionDraft =
    isCollectiveDecisionStage && isAuthorWorkspace
      ? getInitiativeCollectiveDecisionLifecycleDraftByInitiativeId(initiative.initiativeId)
      : null;

  const myCommitmentDraft =
    isCommitmentStage && isAuthorWorkspace
      ? getInitiativeImplementationCommitmentLifecycleDraftByInitiativeId(initiative.initiativeId)
      : null;

  const myTrackingDraft =
    isTrackingStage && isAuthorWorkspace
      ? getInitiativeImplementationTrackingLifecycleDraftByInitiativeId(initiative.initiativeId)
      : null;

  const myOfficialResponseDraft =
    isOfficialResponseStage && isAuthorWorkspace
      ? getInitiativeOfficialResponseLifecycleDraftByInitiativeId(initiative.initiativeId)
      : null;

  const myPublicImpactDraft =
    isPublicImpactStage && isAuthorWorkspace
      ? getInitiativePublicImpactLifecycleDraftByInitiativeId(initiative.initiativeId)
      : null;

  const myArchiveDraft =
    isArchiveStage && isAuthorWorkspace
      ? getInitiativeCivicArchiveLifecycleDraftByInitiativeId(initiative.initiativeId)
      : null;

  const myDraft = isAnalysisStage
    ? myAnalysisDraft
    : isProposalStage
      ? myProposalDraft
      : isRevisionStage
        ? myRevisionDraft
        : isPetitionStage
          ? myPetitionDraft
          : isDecisionSessionStage
            ? myDecisionSessionDraft
            : isCollectiveDecisionStage
              ? myCollectiveDecisionDraft
              : isCommitmentStage
                ? myCommitmentDraft
                : isTrackingStage
                  ? myTrackingDraft
                  : isOfficialResponseStage
                    ? myOfficialResponseDraft
                    : isPublicImpactStage
                      ? myPublicImpactDraft
                      : myArchiveDraft;

  const sourceSnapshot = await buildInitiativeLifecycleSourceSnapshotSummary(
    stageId,
    initiative.initiativeId,
    isAuthorWorkspace,
  );

  const metadata: InitiativeLifecycleStageMetadata = {
    initiativeId: initiative.initiativeId,
    stageId,
    presentationStatus: adapterResult.presentationStatus,
    version: adapterResult.version,
    draftUpdatedAt: myDraft?.updatedAt ?? null,
    publishedAt: adapterResult.publishedAt,
    publishedByParticipantId: adapterResult.hasPublicResult ? initiative.stewardId : null,
    sourceSnapshotCreatedAt: isDraftCapableStage ? sourceSnapshot.capturedAt : null,
    hasUnpublishedChanges: Boolean(myDraft),
    canGenerate: isDraftCapableStage && isAuthorWorkspace,
    canEdit: isDraftCapableStage ? Boolean(myDraft) : false,
    canPreview: isAuthorWorkspace,
    canPublish: isDraftCapableStage ? Boolean(myDraft) : false,
    canViewPublicResult: adapterResult.hasPublicResult,
    publishedRecordId: adapterResult.publishedRecordId,
  };

  const nextStageId = getNextInitiativeLifecycleStageId(stageId);
  const previousStageId = getPreviousInitiativeLifecycleStageId(stageId);

  return {
    initiativeId: initiative.initiativeId,
    initiativeTitle: initiative.title,
    stageId,
    stageLabel: stageDefinition.label,
    stageOrder: stageDefinition.order,
    stageHash: stageDefinition.hash,
    viewerRole: mode.viewerRole,
    presentationMode: mode.presentationMode,
    metadata,
    sourceSnapshot,
    authorActions: isAuthorWorkspace
      ? buildAuthorActions({
          isAuthorWorkspaceStage: mode.isAuthorWorkspaceStage,
          hasNextStage: nextStageId !== null,
          isDraftCapableStage,
          hasDraft: Boolean(myDraft),
        })
      : [],
    aiCapabilities:
      isAuthorWorkspace && isAnalysisStage
        ? ANALYSIS_AI_CAPABILITIES
        : isAuthorWorkspace && isProposalStage
          ? PROPOSAL_AI_CAPABILITIES
          : isAuthorWorkspace && isRevisionStage
            ? REVISION_AI_CAPABILITIES
            : isAuthorWorkspace && isPetitionStage
              ? PETITION_AI_CAPABILITIES
              : isAuthorWorkspace && isDecisionSessionStage
                ? DECISION_SESSION_AI_CAPABILITIES
                : isAuthorWorkspace && isCollectiveDecisionStage
                  ? COLLECTIVE_DECISION_AI_CAPABILITIES
                  : isAuthorWorkspace && isCommitmentStage
                    ? COMMITMENT_AI_CAPABILITIES
                    : isAuthorWorkspace && isTrackingStage
                      ? TRACKING_AI_CAPABILITIES
                      : isAuthorWorkspace && isOfficialResponseStage
                        ? OFFICIAL_RESPONSE_AI_CAPABILITIES
                        : isAuthorWorkspace && isPublicImpactStage
                          ? PUBLIC_IMPACT_AI_CAPABILITIES
                          : isAuthorWorkspace && isArchiveStage
                            ? ARCHIVE_AI_CAPABILITIES
                            : NO_AI_CAPABILITIES,
    previousStage: buildNeighbor(previousStageId),
    nextStage: buildNeighbor(nextStageId),
    publicDeepLink: `/initiatives/public/${encodeURIComponent(initiative.initiativeId)}#${stageDefinition.hash}`,
    generatedAt: new Date().toISOString(),
  };
}
