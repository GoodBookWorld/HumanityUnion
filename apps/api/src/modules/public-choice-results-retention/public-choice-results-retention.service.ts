import type {
  Initiative,
  InitiativeCollectiveDecision,
  InitiativeDecisionBallotAggregates,
  PublicChoiceCandidatePublicProjection,
} from "@hu/types";
import {
  PUBLIC_CHOICE_COMMUNITY_RESULTS_DISCLAIMER,
  computePublicChoiceResultsExpireAt,
  resolveInitiativeLifecycleProfile,
  resolvePublicChoiceBallotMode,
  resolvePublicChoiceVotingCloseAt,
  toPublicChoiceCandidatePublicProjection,
} from "@hu/types";

import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { getInitiativeById, updateInitiative } from "../initiatives/initiative.store.js";
import { computePublicChoiceBallotAggregatesForDecision } from "../initiative-decision-vote/initiative-decision-vote.service.js";
import {
  stampInitiativeDecisionVoteExpireAtForDecision,
  deleteInitiativeDecisionVotesAndHistoryForDecision,
} from "../initiative-decision-vote/persistence/initiative-decision-vote.repository.js";
import {
  deletePublicChoiceCandidatesByInitiativeForTests,
  listPublicChoiceCandidatesByInitiative,
  stampPublicChoiceCandidateExpireAtForInitiative,
} from "../public-choice-candidate/persistence/public-choice-candidate.repository.js";
import type { PublicChoiceResultsSnapshot } from "./public-choice-results-snapshot.mongo-document.js";
import {
  deletePublicChoiceResultsSnapshotsByInitiative,
  findPublicChoiceResultsSnapshotByDecision,
  listExpiredPublicChoiceResultsSnapshots,
  upsertPublicChoiceResultsSnapshot,
} from "./public-choice-results-snapshot.repository.js";

function geographyLabel(initiative: Initiative): string {
  const parts = [
    initiative.metadata.communityAssociation,
    initiative.metadata.region,
    initiative.metadata.countrySlug,
  ].filter((part): part is string => Boolean(part?.trim()));
  return parts.join(" · ") || "—";
}

export function buildPublicChoiceResultsSnapshotId(decisionId: string): string {
  return `public-choice-results-snapshot:${decisionId}`;
}

/**
 * Freeze temporary Final Results at voting close.
 * Does not delete shared media — only stores public candidate projection URLs.
 */
export async function freezePublicChoiceResultsSnapshot(input: {
  initiative: Initiative;
  decision: InitiativeCollectiveDecision;
  votingCloseAt: string;
}): Promise<PublicChoiceResultsSnapshot | null> {
  if (!isMongoConfigured()) {
    return null;
  }

  const expiresAt = computePublicChoiceResultsExpireAt(input.votingCloseAt);
  const ballotMode = resolvePublicChoiceBallotMode(input.initiative.metadata.ballotMode);
  const ballotAggregates = await computePublicChoiceBallotAggregatesForDecision(
    input.decision.decisionId,
    input.initiative,
  );
  const candidates = (await listPublicChoiceCandidatesByInitiative(input.initiative.initiativeId)).map(
    (candidate) => toPublicChoiceCandidatePublicProjection(candidate),
  );

  const totalEffectiveVoters =
    ballotAggregates.ballotMode === "SELECT_ONE_CANDIDATE"
      ? ballotAggregates.totalEffectiveVoters
      : ballotAggregates.total.totalVotes;

  const snapshot: PublicChoiceResultsSnapshot = {
    snapshotId: buildPublicChoiceResultsSnapshotId(input.decision.decisionId),
    initiativeId: input.initiative.initiativeId,
    decisionId: input.decision.decisionId,
    ballotMode,
    electionTitle:
      input.initiative.metadata.communityAssociation?.trim() || input.initiative.title,
    electionDescription: input.initiative.description,
    geographyLabel: geographyLabel(input.initiative),
    votingCloseAt: input.votingCloseAt,
    expiresAt,
    totalEffectiveVoters,
    ballotAggregates,
    candidates,
    publicUrlPath: `/initiatives/public/${encodeURIComponent(input.initiative.initiativeId)}/election`,
    disclaimer: PUBLIC_CHOICE_COMMUNITY_RESULTS_DISCLAIMER,
    frozenAt: new Date().toISOString(),
  };

  await upsertPublicChoiceResultsSnapshot(snapshot);
  await stampInitiativeDecisionVoteExpireAtForDecision(input.decision.decisionId, expiresAt);
  await stampPublicChoiceCandidateExpireAtForInitiative(input.initiative.initiativeId, expiresAt);

  updateInitiative(input.initiative.initiativeId, {
    metadata: {
      ...input.initiative.metadata,
      publicChoiceResultsExpireAt: expiresAt,
    },
  });

  // Clear any prior tombstone if re-freezing (should be rare).
  const refreshed = getInitiativeById(input.initiative.initiativeId);
  if (refreshed?.metadata.publicChoiceResultsExpiredAt) {
    const metadata = { ...refreshed.metadata };
    delete metadata.publicChoiceResultsExpiredAt;
    metadata.publicChoiceResultsExpireAt = expiresAt;
    updateInitiative(input.initiative.initiativeId, { metadata });
  }

  return snapshot;
}

export async function ensurePublicChoiceResultsFrozenForClosedDecision(input: {
  initiative: Initiative;
  decision: InitiativeCollectiveDecision;
  nowIso?: string;
}): Promise<PublicChoiceResultsSnapshot | null> {
  const votingCloseAt = resolvePublicChoiceVotingCloseAt({
    status: input.decision.status,
    closedAt: input.decision.closedAt,
    closesAt: input.decision.closesAt,
    nowIso: input.nowIso,
  });

  if (!votingCloseAt) {
    return null;
  }

  if (!isMongoConfigured()) {
    return null;
  }

  const existing = await findPublicChoiceResultsSnapshotByDecision(input.decision.decisionId);
  if (existing) {
    return existing;
  }

  return freezePublicChoiceResultsSnapshot({
    initiative: input.initiative,
    decision: input.decision,
    votingCloseAt,
  });
}

/**
 * Purge temporary PUBLIC_CHOICE election data after retention.
 * Does NOT delete Initiative, shared media files, STANDARD data, or Participant records.
 */
export async function purgeExpiredPublicChoiceElectionData(input: {
  initiative: Initiative;
  decisionId: string;
  nowIso?: string;
}): Promise<{ purged: boolean }> {
  if (!isMongoConfigured()) {
    return { purged: false };
  }

  const nowIso = input.nowIso ?? new Date().toISOString();
  const expireAt = input.initiative.metadata.publicChoiceResultsExpireAt;
  if (!expireAt || Date.parse(expireAt) > Date.parse(nowIso)) {
    return { purged: false };
  }

  if (input.initiative.metadata.publicChoiceResultsExpiredAt) {
    return { purged: false };
  }

  await deleteInitiativeDecisionVotesAndHistoryForDecision(input.decisionId);
  // Candidate documents only — never delete shared media assets.
  await deletePublicChoiceCandidatesByInitiativeForTests(input.initiative.initiativeId);
  await deletePublicChoiceResultsSnapshotsByInitiative(input.initiative.initiativeId);

  // Pack 02D — remove recoverable vote choice payloads from Participant Actions + outbox.
  const { deletePublicChoiceVoteParticipantActionsForInitiative } = await import(
    "../participant-action/infrastructure/participant-action.repository.js"
  );
  await deletePublicChoiceVoteParticipantActionsForInitiative(input.initiative.initiativeId);

  const { deleteInitiativeDecisionVoteOutboxForDecision } = await import(
    "../../infrastructure/outbox/outbox.repository.js"
  );
  await deleteInitiativeDecisionVoteOutboxForDecision(input.decisionId);

  const metadata = { ...input.initiative.metadata };
  delete metadata.publicChoiceResultsExpireAt;
  metadata.publicChoiceResultsExpiredAt = nowIso;

  updateInitiative(input.initiative.initiativeId, { metadata });

  return { purged: true };
}

export async function cleanupExpiredPublicChoiceResults(): Promise<{
  purgedInitiatives: number;
  frozenDecisions: number;
}> {
  if (!isMongoConfigured()) {
    return { purgedInitiatives: 0, frozenDecisions: 0 };
  }

  const nowIso = new Date().toISOString();
  let frozenDecisions = 0;

  // Pack 04A — close overdue opened PUBLIC_CHOICE elections (status → closed + freeze).
  try {
    const { closeOverduePublicChoiceElections } = await import(
      "../initiative-collective-decision/initiative-collective-decision.service.js"
    );
    await closeOverduePublicChoiceElections(nowIso);
  } catch {
    // Retention purge still proceeds.
  }

  // Freeze any PUBLIC_CHOICE decision whose voting window has ended but snapshot is missing.
  try {
    const { listDecisions } = await import(
      "../initiative-collective-decision/initiative-collective-decision.store.js"
    );
    for (const decision of listDecisions()) {
      const initiative = getInitiativeById(decision.initiativeId);
      if (
        !initiative ||
        resolveInitiativeLifecycleProfile(initiative.lifecycleProfile) !== "PUBLIC_CHOICE"
      ) {
        continue;
      }
      const before = await findPublicChoiceResultsSnapshotByDecision(decision.decisionId);
      const frozen = await ensurePublicChoiceResultsFrozenForClosedDecision({
        initiative,
        decision,
        nowIso,
      });
      if (frozen && !before) {
        frozenDecisions += 1;
      }
    }
  } catch {
    // Close/download paths still freeze when needed.
  }

  const expired = await listExpiredPublicChoiceResultsSnapshots(nowIso);
  let purgedInitiatives = 0;

  for (const snapshot of expired) {
    const initiative = getInitiativeById(snapshot.initiativeId);
    if (!initiative) {
      await deletePublicChoiceResultsSnapshotsByInitiative(snapshot.initiativeId);
      continue;
    }

    const result = await purgeExpiredPublicChoiceElectionData({
      initiative,
      decisionId: snapshot.decisionId,
      nowIso,
    });
    if (result.purged) {
      purgedInitiatives += 1;
    }
  }

  return { purgedInitiatives, frozenDecisions };
}

export type { InitiativeDecisionBallotAggregates, PublicChoiceCandidatePublicProjection };
