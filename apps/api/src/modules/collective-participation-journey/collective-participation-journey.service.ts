/**
 * Phase 05 — Collective Participation Journey projection service.
 *
 * Derives past/available/next from:
 * - LifecycleProfile + published stage progress (Phase 02 resolver authority)
 * - Participant Action ledger (petition / votes)
 * - Domain stores (comments, support) where ledger consumers are not yet wired
 *
 * Soft-fails optional lookups; never advances lifecycle.
 */

import type {
  CollectiveParticipationAvailableAction,
  CollectiveParticipationJourney,
  CollectiveParticipationJourneySummary,
  CollectiveParticipationPastAction,
  Initiative,
  InitiativeLifecycleStageId,
} from "@hu/types";
import {
  getInitiativeLifecycleStageDefinition,
  isLifecycleStageApplicableToProfile,
  resolveInitiativeLifecycleProfile,
  resolveInitiativeLifecycleState,
} from "@hu/types";

import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { settleOptionalLifecycleLookup } from "../../shared/lifecycle/optional-lifecycle-lookup.js";
import { logger } from "../../shared/observability/logger.js";
import { listApprovedInitiativeComments } from "../initiative-comments/initiative-comment.service.js";
import { listPublicInitiativeCollectiveDecisionsForInitiative } from "../initiative-collective-decision/public-initiative-collective-decision.projection.js";
import { findAlly } from "../initiative-discussion-collaboration/initiative-ally.store.js";
import { findInitiativeDecisionVoteByDecisionAndParticipant } from "../initiative-decision-vote/persistence/initiative-decision-vote.repository.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { getInitiativeSupportStatistics } from "../initiative-support/initiative-support.service.js";
import {
  listParticipantActionsByParticipantAndInitiative,
  listParticipantActionsByParticipantId,
} from "../participant-action/infrastructure/participant-action.repository.js";
import type { ParticipantActionRecord } from "../participant-action/domain/participant-action.types.js";
import { findSignatureByPetitionAndMember } from "../petition/persistence/petition-signature.repository.js";
import { getPetitionByInitiativeId } from "../petition/petition.store.js";
import { buildInitiativeShellDeepLink } from "./initiative-shell-deep-link.js";
import { resolveNextMeaningfulParticipationAction } from "./resolve-next-meaningful-participation-action.js";

function stageLabel(stageId: InitiativeLifecycleStageId): string {
  return getInitiativeLifecycleStageDefinition(stageId)?.label ?? stageId;
}

function emptyJourney(input: {
  initiative: Initiative;
  participantId: string | null;
  viewerIsSteward: boolean;
}): CollectiveParticipationJourney {
  const lifecycleProfile = resolveInitiativeLifecycleProfile(input.initiative.lifecycleProfile);
  const state = resolveInitiativeLifecycleState({
    lifecycleProfile,
    publishedStageCounts: { initiative: 1 },
  });

  return {
    initiativeId: input.initiative.initiativeId,
    participantId: input.participantId,
    lifecycleProfile,
    currentStageId: state.currentStageId,
    currentStageLabel: stageLabel(state.currentStageId),
    pastActions: [],
    availableActions: [],
    nextAction: null,
    activeAlly: false,
    viewerIsSteward: input.viewerIsSteward,
    generatedAt: new Date().toISOString(),
  };
}

function projectLedgerPastActions(
  initiativeId: string,
  records: readonly ParticipantActionRecord[],
): CollectiveParticipationPastAction[] {
  const past: CollectiveParticipationPastAction[] = [];

  const voteRecords = records.filter(
    (record) =>
      record.actionType === "initiative_decision_vote_cast" ||
      record.actionType === "initiative_decision_vote_changed",
  );
  // Collapse cast+changed into one civic participation (latest wins).
  if (voteRecords.length > 0) {
    const latest = voteRecords[0]!;
    const choice =
      latest.metadata?.kind === "initiative_decision_vote_cast"
        ? latest.metadata.choice
        : latest.metadata?.kind === "initiative_decision_vote_changed"
          ? latest.metadata.newChoice
          : "vote";
    const changed = voteRecords.some((record) => record.actionType === "initiative_decision_vote_changed");
    past.push({
      actionType: "decision_vote",
      stageId: "collective_decision",
      occurredAt: latest.occurredAt,
      statusLabel: changed ? `Voted (${String(choice)}; updated)` : `Voted (${String(choice)})`,
      deepLink: buildInitiativeShellDeepLink(initiativeId, "collective_decision"),
      source: "participant_action_ledger",
      updateable: true,
    });
  }

  for (const record of records) {
    if (record.actionType === "petition_signed") {
      past.push({
        actionType: "petition_signature",
        stageId: "petition",
        occurredAt: record.occurredAt,
        statusLabel: "Signed petition",
        deepLink: buildInitiativeShellDeepLink(initiativeId, "petition"),
        source: "participant_action_ledger",
      });
    }
  }

  return past;
}

async function loadPublishedStageCounts(initiativeId: string): Promise<Record<string, number>> {
  // Lightweight counts for resolver — soft-fail each optional domain.
  const counts: Record<string, number> = { initiative: 1 };

  const { getDiscussionCompletionByInitiativeId } = await import(
    "../initiative-discussion-lifecycle/initiative-discussion-completion.store.js"
  );
  if (getDiscussionCompletionByInitiativeId(initiativeId)) {
    counts.discussion = 1;
  }

  try {
    const { listPublicInitiativeCollaborativeAnalyses } = await import(
      "../initiative-collaborative-analysis/public-initiative-collaborative-analysis.projection.js"
    );
    const analyses = await listPublicInitiativeCollaborativeAnalyses(initiativeId);
    if (analyses.length > 0) {
      counts.analysis = analyses.length;
    }
  } catch {
    /* soft */
  }

  try {
    const { listPublishedCollectionsByInitiative } = await import(
      "../initiative-improvement-proposals-stage/initiative-improvement-proposals-stage.store.js"
    );
    const collections = await listPublishedCollectionsByInitiative(initiativeId);
    if (collections.length > 0) {
      counts.proposal = collections.length;
    }
  } catch {
    /* soft */
  }

  try {
    const { getPublicInitiativeVersionHistory } = await import(
      "../initiative-version-revision/public-initiative-version-revision.projection.js"
    );
    const history = await getPublicInitiativeVersionHistory(initiativeId);
    if (history.revisions.length > 0) {
      counts.revision = history.revisions.length;
    }
  } catch {
    /* soft */
  }

  const petitionLookup = await settleOptionalLifecycleLookup(
    "journey_petition",
    getPetitionByInitiativeId(initiativeId),
    null,
  );
  if (petitionLookup.value && petitionLookup.value.status !== "Draft") {
    counts.petition = 1;
  }

  try {
    const decisions = await listPublicInitiativeCollectiveDecisionsForInitiative(initiativeId);
    if (decisions.some((decision) => decision.status === "closed" || decision.status === "opened")) {
      counts.collective_decision = decisions.filter(
        (decision) => decision.status === "closed" || decision.status === "opened",
      ).length;
    }
  } catch {
    /* soft */
  }

  try {
    const { getLatestPublishedPublicCivicArchiveForInitiative } = await import(
      "../public-civic-archive/public-civic-archive.projection.js"
    );
    const archive = await getLatestPublishedPublicCivicArchiveForInitiative(initiativeId);
    if (archive) {
      counts.archive = 1;
    }
  } catch {
    /* soft */
  }

  return counts;
}

export async function buildCollectiveParticipationJourney(input: {
  readonly initiativeId: string;
  readonly participantId: string | null;
}): Promise<CollectiveParticipationJourney | null> {
  const initiative = getInitiativeById(input.initiativeId);
  if (!initiative) {
    return null;
  }

  const viewerIsSteward = Boolean(
    input.participantId && input.participantId === initiative.stewardId,
  );
  const lifecycleProfile = resolveInitiativeLifecycleProfile(initiative.lifecycleProfile);

  let publishedStageCounts: Record<string, number> = { initiative: 1 };
  try {
    publishedStageCounts = await loadPublishedStageCounts(input.initiativeId);
  } catch (error) {
    logger.warn("collective_participation_journey.stage_counts_failed", {
      initiativeId: input.initiativeId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const lifecycleState = resolveInitiativeLifecycleState({
    lifecycleProfile,
    publishedStageCounts,
  });

  const pastActions: CollectiveParticipationPastAction[] = [];
  const availableActions: CollectiveParticipationAvailableAction[] = [];
  let activeAlly = false;

  // Signed-out: opportunity-only, no fabricated history.
  if (!input.participantId) {
    if (isLifecycleStageApplicableToProfile("discussion", lifecycleProfile)) {
      availableActions.push({
        actionType: "discussion_comment",
        stageId: "discussion",
        label: "Join the Discussion",
        eligibility: "requires_sign_in",
        reason: "Sign in to comment.",
        deepLink: buildInitiativeShellDeepLink(input.initiativeId, "discussion"),
      });
    }
    if (isLifecycleStageApplicableToProfile("petition", lifecycleProfile)) {
      availableActions.push({
        actionType: "petition_signature",
        stageId: "petition",
        label: "Sign the Petition",
        eligibility: "requires_sign_in",
        reason: "Sign in to sign.",
        deepLink: buildInitiativeShellDeepLink(input.initiativeId, "petition"),
      });
    }
    if (isLifecycleStageApplicableToProfile("collective_decision", lifecycleProfile)) {
      availableActions.push({
        actionType: "decision_vote",
        stageId: "collective_decision",
        label: "Cast your vote",
        eligibility: "requires_sign_in",
        reason: "Sign in to vote.",
        deepLink: buildInitiativeShellDeepLink(input.initiativeId, "collective_decision"),
      });
    }
    availableActions.push({
      actionType: "support_initiative",
      stageId: "initiative",
      label: "Support this Initiative",
      eligibility: "requires_sign_in",
      reason: "Sign in to support.",
      deepLink: buildInitiativeShellDeepLink(input.initiativeId, "initiative"),
    });

    const nextAction = resolveNextMeaningfulParticipationAction({
      lifecycleProfile,
      currentStageId: lifecycleState.currentStageId,
      pastActions: [],
      availableActions: availableActions.map((action) =>
        action.eligibility === "requires_sign_in"
          ? { ...action, eligibility: "eligible", reason: undefined }
          : action,
      ),
      activeAlly: false,
    });

    return {
      initiativeId: input.initiativeId,
      participantId: null,
      lifecycleProfile,
      currentStageId: lifecycleState.currentStageId,
      currentStageLabel: stageLabel(lifecycleState.currentStageId),
      pastActions: [],
      availableActions,
      nextAction: nextAction
        ? {
            ...nextAction,
            reason: "Sign in to take this action.",
            label: nextAction.label,
          }
        : null,
      activeAlly: false,
      viewerIsSteward: false,
      generatedAt: new Date().toISOString(),
    };
  }

  const participantId = input.participantId;

  // Ledger (canonical for petition + votes)
  if (isMongoConfigured()) {
    const ledgerLookup = await settleOptionalLifecycleLookup(
      "journey_ledger",
      listParticipantActionsByParticipantAndInitiative(participantId, input.initiativeId),
      [],
    );
    if (!ledgerLookup.degraded) {
      pastActions.push(...projectLedgerPastActions(input.initiativeId, ledgerLookup.value ?? []));
    }
  }

  // Domain-derived: discussion comments
  try {
    const comments = await listApprovedInitiativeComments({
      initiativeId: input.initiativeId,
      limit: 200,
      offset: 0,
    });
    const mine = comments.comments.filter((comment) => comment.authorUserId === participantId);
    if (mine.length > 0) {
      const latest = mine.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]!;
      pastActions.push({
        actionType: "discussion_comment",
        stageId: "discussion",
        occurredAt: latest.createdAt,
        statusLabel: mine.length === 1 ? "Commented" : `Commented (${mine.length})`,
        deepLink: buildInitiativeShellDeepLink(input.initiativeId, "discussion"),
        source: "domain_derived",
      });
    }
  } catch (error) {
    logger.warn("collective_participation_journey.comments_failed", {
      initiativeId: input.initiativeId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Domain-derived: support signal (not views/bookmarks)
  try {
    const support = await getInitiativeSupportStatistics({
      initiativeId: input.initiativeId,
      userId: participantId,
    });
    if (support.currentUserSignal === "like" || support.currentUserSignal === "dislike") {
      pastActions.push({
        actionType: "support_initiative",
        stageId: "initiative",
        occurredAt: new Date().toISOString(),
        statusLabel: support.currentUserSignal === "like" ? "Supported" : "Opposed",
        deepLink: buildInitiativeShellDeepLink(input.initiativeId, "initiative"),
        source: "domain_derived",
      });
    } else {
      availableActions.push({
        actionType: "support_initiative",
        stageId: "initiative",
        label: "Support this Initiative",
        eligibility: "eligible",
        deepLink: buildInitiativeShellDeepLink(input.initiativeId, "initiative"),
      });
    }
  } catch {
    availableActions.push({
      actionType: "support_initiative",
      stageId: "initiative",
      label: "Support this Initiative",
      eligibility: "unavailable",
      reason: "Support is temporarily unavailable.",
      deepLink: buildInitiativeShellDeepLink(input.initiativeId, "initiative"),
    });
  }

  // Discussion available
  if (isLifecycleStageApplicableToProfile("discussion", lifecycleProfile)) {
    const alreadyCommented = pastActions.some((action) => action.actionType === "discussion_comment");
    availableActions.push({
      actionType: "discussion_comment",
      stageId: "discussion",
      label: alreadyCommented ? "Continue in Discussion" : "Join the Discussion",
      eligibility: "eligible",
      deepLink: buildInitiativeShellDeepLink(input.initiativeId, "discussion"),
    });
  }

  // Petition
  if (isLifecycleStageApplicableToProfile("petition", lifecycleProfile)) {
    const petitionLookup = await settleOptionalLifecycleLookup(
      "journey_petition_sign",
      getPetitionByInitiativeId(input.initiativeId),
      null,
    );
    const petition = petitionLookup.value;
    const petitionOpen =
      petition &&
      (petition.status === "Open" || petition.status === "Published" || petition.status === "Ready");
    const alreadySigned = pastActions.some((action) => action.actionType === "petition_signature");

    if (!alreadySigned && petition && !petitionLookup.degraded) {
      try {
        const signature = await findSignatureByPetitionAndMember(petition.petitionId, participantId);
        if (signature) {
            pastActions.push({
              actionType: "petition_signature",
              stageId: "petition",
              occurredAt: signature.signedAt,
              statusLabel: "Signed petition",
              deepLink: buildInitiativeShellDeepLink(input.initiativeId, "petition"),
              source: "domain_derived",
            });
        }
      } catch {
        /* soft */
      }
    }

    const signedNow = pastActions.some((action) => action.actionType === "petition_signature");
    if (!isLifecycleStageApplicableToProfile("petition", lifecycleProfile)) {
      /* already gated */
    } else if (signedNow) {
      availableActions.push({
        actionType: "petition_signature",
        stageId: "petition",
        label: "Petition signed",
        eligibility: "already_completed",
        deepLink: buildInitiativeShellDeepLink(input.initiativeId, "petition"),
      });
    } else if (petitionLookup.degraded) {
      availableActions.push({
        actionType: "petition_signature",
        stageId: "petition",
        label: "Sign the Petition",
        eligibility: "unavailable",
        reason: "Petition information is temporarily unavailable.",
        deepLink: buildInitiativeShellDeepLink(input.initiativeId, "petition"),
      });
    } else if (!petition || !petitionOpen) {
      availableActions.push({
        actionType: "petition_signature",
        stageId: "petition",
        label: "Sign the Petition",
        eligibility: "stage_not_open",
        reason: "Petition is not open for signatures yet.",
        deepLink: buildInitiativeShellDeepLink(input.initiativeId, "petition"),
      });
    } else {
      availableActions.push({
        actionType: "petition_signature",
        stageId: "petition",
        label: "Sign the Petition",
        eligibility: "eligible",
        deepLink: buildInitiativeShellDeepLink(input.initiativeId, "petition"),
      });
    }
  }

  // Collective Decision vote
  if (isLifecycleStageApplicableToProfile("collective_decision", lifecycleProfile)) {
    try {
      const decisions = await listPublicInitiativeCollectiveDecisionsForInitiative(input.initiativeId);
      const openDecision = decisions.find((decision) => decision.status === "opened");
      const closedDecision = decisions.find((decision) => decision.status === "closed");
      const target = openDecision ?? closedDecision ?? decisions[0] ?? null;

      if (target) {
        let vote = null;
        try {
          vote = await findInitiativeDecisionVoteByDecisionAndParticipant(
            target.decisionId,
            participantId,
          );
        } catch {
          vote = null;
        }

        if (vote && !pastActions.some((action) => action.actionType === "decision_vote")) {
          pastActions.push({
            actionType: "decision_vote",
            stageId: "collective_decision",
            occurredAt: vote.updatedAt ?? vote.castAt,
            statusLabel: `Voted (${vote.choice})`,
            deepLink: buildInitiativeShellDeepLink(input.initiativeId, "collective_decision"),
            source: "domain_derived",
            updateable: openDecision != null,
          });
        } else if (vote) {
          const voteIndex = pastActions.findIndex((action) => action.actionType === "decision_vote");
          if (voteIndex >= 0) {
            const prior = pastActions[voteIndex]!;
            pastActions[voteIndex] = {
              ...prior,
              updateable: openDecision != null,
            };
          }
        }

        if (openDecision) {
          const hasVote = pastActions.some((action) => action.actionType === "decision_vote");
          availableActions.push({
            actionType: "decision_vote",
            stageId: "collective_decision",
            label: hasVote ? "Review or update your vote" : "Cast your vote",
            eligibility: "eligible",
            deepLink: buildInitiativeShellDeepLink(input.initiativeId, "collective_decision"),
          });
        } else if (closedDecision) {
          availableActions.push({
            actionType: "decision_vote",
            stageId: "collective_decision",
            label: "View decision result",
            eligibility: pastActions.some((a) => a.actionType === "decision_vote")
              ? "already_completed"
              : "stage_not_open",
            reason: "Voting is closed.",
            deepLink: buildInitiativeShellDeepLink(input.initiativeId, "collective_decision"),
          });
        }
      } else {
        availableActions.push({
          actionType: "decision_vote",
          stageId: "collective_decision",
          label: "Cast your vote",
          eligibility: "stage_not_open",
          reason: "Collective Decision is not open yet.",
          deepLink: buildInitiativeShellDeepLink(input.initiativeId, "collective_decision"),
        });
      }
    } catch {
      availableActions.push({
        actionType: "decision_vote",
        stageId: "collective_decision",
        label: "Cast your vote",
        eligibility: "unavailable",
        reason: "Voting information is temporarily unavailable.",
        deepLink: buildInitiativeShellDeepLink(input.initiativeId, "collective_decision"),
      });
    }
  }

  // Active Ally relationship (not pastAction)
  try {
    const ally = await findAlly(input.initiativeId, participantId);
    activeAlly = ally?.status === "active";
  } catch {
    activeAlly = false;
  }

  // Sort past actions newest first
  pastActions.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));

  const nextAction = resolveNextMeaningfulParticipationAction({
    lifecycleProfile,
    currentStageId: lifecycleState.currentStageId,
    pastActions,
    availableActions,
    activeAlly,
  });

  return {
    initiativeId: input.initiativeId,
    participantId,
    lifecycleProfile,
    currentStageId: lifecycleState.currentStageId,
    currentStageLabel: stageLabel(lifecycleState.currentStageId),
    pastActions,
    availableActions,
    nextAction,
    activeAlly,
    viewerIsSteward,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Workspace readiness — list journey summaries for Initiatives where the
 * Participant has ledger history (expand later without a second model).
 */
export async function listCollectiveParticipationJourneySummariesForParticipant(
  participantId: string,
): Promise<CollectiveParticipationJourneySummary[]> {
  if (!isMongoConfigured()) {
    return [];
  }

  const ledgerLookup = await settleOptionalLifecycleLookup(
    "journey_list_ledger",
    listParticipantActionsByParticipantId(participantId),
    [],
  );
  if (ledgerLookup.degraded || !ledgerLookup.value) {
    return [];
  }

  const byInitiative = new Map<string, ParticipantActionRecord[]>();
  for (const record of ledgerLookup.value) {
    const list = byInitiative.get(record.initiativeId) ?? [];
    list.push(record);
    byInitiative.set(record.initiativeId, list);
  }

  const summaries: CollectiveParticipationJourneySummary[] = [];
  for (const [initiativeId] of byInitiative) {
    const journey = await buildCollectiveParticipationJourney({
      initiativeId,
      participantId,
    });
    if (!journey) {
      continue;
    }
    const initiative = getInitiativeById(initiativeId);
    summaries.push({
      initiativeId,
      initiativeTitle: initiative?.title ?? initiativeId,
      lifecycleProfile: journey.lifecycleProfile,
      currentStageId: journey.currentStageId,
      nextAction: journey.nextAction,
      pastActionCount: journey.pastActions.length,
    });
  }

  return summaries;
}

export { emptyJourney };
