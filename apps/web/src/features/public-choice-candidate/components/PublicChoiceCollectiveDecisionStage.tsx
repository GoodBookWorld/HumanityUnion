"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  PublicChoiceCandidatePublicProjection,
  PublicInitiativeCollectiveDecisionProjection,
} from "@hu/types";
import {
  isPublicChoiceCandidateElectionBallot,
  publicChoiceElectionVotingStatusLabel,
  resolvePublicChoiceElectionVotingStatus,
} from "@hu/types";

import {
  getPublicInitiativeCollectiveDecision,
  listPublicInitiativeCollectiveDecisions,
} from "../../initiative-collective-decision/api";
import { getPublicInitiative } from "../../initiatives/api";
import { buildInitiativeExperienceHref } from "../../initiative-owner-studio/initiative-experience-routes";
import { downloadPublicChoiceResultsPdf } from "../../public-choice-results-retention/api";
import { listPublicChoiceCandidates } from "../api";
import { usePublicChoiceElectionRefresh } from "../public-choice-election-refresh";
import { PublicChoiceElectionResultsBoard } from "./PublicChoiceElectionResultsBoard";

import "../../public-initiative-experience/public-initiative-experience.css";

interface PublicChoiceCollectiveDecisionStageProps {
  initiativeId: string;
}

/**
 * Fix 05 — PUBLIC_CHOICE Collective Decision for every viewer role.
 * Always the shared election results board — never STANDARD Author Workspace.
 */
export function PublicChoiceCollectiveDecisionStage({
  initiativeId,
}: PublicChoiceCollectiveDecisionStageProps) {
  const [decision, setDecision] = useState<PublicInitiativeCollectiveDecisionProjection | null>(
    null,
  );
  const [candidates, setCandidates] = useState<PublicChoiceCandidatePublicProjection[]>([]);
  const [electionName, setElectionName] = useState("Election");
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [downloadBusy, setDownloadBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [initiative, listed, candidateList] = await Promise.all([
        getPublicInitiative(initiativeId),
        listPublicInitiativeCollectiveDecisions(initiativeId),
        listPublicChoiceCandidates(initiativeId).catch(() => []),
      ]);

      setElectionName(
        initiative.metadata.communityAssociation?.trim() || initiative.title || "Election",
      );
      setCandidates(candidateList);

      if (!isPublicChoiceCandidateElectionBallot(initiative.metadata.ballotMode)) {
        setDecision(null);
        setLoadState("ready");
        return;
      }

      const opened =
        listed.decisions.find((item) => item.status === "opened") ?? listed.decisions[0] ?? null;
      if (!opened) {
        setDecision(null);
        setLoadState("ready");
        return;
      }

      const detail = await getPublicInitiativeCollectiveDecision(opened.decisionId);
      setDecision(detail);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, [initiativeId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  usePublicChoiceElectionRefresh(initiativeId, reload);

  async function handleDownload(): Promise<void> {
    if (!decision || downloadBusy) {
      return;
    }
    setDownloadBusy(true);
    try {
      await downloadPublicChoiceResultsPdf(initiativeId, decision.decisionId);
    } finally {
      setDownloadBusy(false);
    }
  }

  if (loadState === "loading") {
    return <p className="pie-election-results__status">Loading election results…</p>;
  }

  if (loadState === "error") {
    return (
      <p className="pie-overview-candidates__error" role="alert">
        Election results could not be loaded.
      </p>
    );
  }

  const votingStatus = resolvePublicChoiceElectionVotingStatus({
    decisionStatus: decision?.status,
    openedAt: decision?.openedAt,
    closesAt: decision?.closesAt,
    closedAt: decision?.closedAt,
    resultsExpiredAt: decision?.resultsRetention?.resultsExpiredAt,
    resultsRetentionStatus: decision?.resultsRetention?.status,
  });
  const votingOpen = votingStatus === "OPEN";
  const resultsExpired = votingStatus === "EXPIRED";
  const resultsLabel = votingOpen
    ? "CURRENT RESULTS"
    : resultsExpired
      ? "RESULTS"
      : decision?.status === "closed" ||
          decision?.resultsRetention?.status === "results_available"
        ? "FINAL RESULTS"
        : "RESULTS";
  const downloadAvailable =
    Boolean(decision?.resultsRetention?.downloadAvailable) && !resultsExpired;
  const overviewHref = buildInitiativeExperienceHref(initiativeId);
  const emptySelectOne = {
    ballotMode: "SELECT_ONE_CANDIDATE" as const,
    candidates: [],
    abstain: 0,
    abstainPercentage: 0,
    totalEffectiveVoters: 0,
    participationBreakdown: {
      visitors: 0,
      participants: 0,
      members: 0,
      totalEffectiveVoters: 0,
      visitorPercentage: 0,
      participantPercentage: 0,
      memberPercentage: 0,
    },
  };
  const aggregates =
    decision?.ballotAggregates?.ballotMode === "SELECT_ONE_CANDIDATE"
      ? decision.ballotAggregates
      : emptySelectOne;

  return (
    <section className="pie-pc-cd-stage" aria-labelledby="pie-pc-cd-title">
      <header className="pie-pc-cd-stage__header">
        <h2 id="pie-pc-cd-title">Election Results</h2>
        <p className="pie-pc-cd-stage__subtitle">Collective Decision · {electionName}</p>
        <p className="pie-election-results__status" role="status">
          Election status: {publicChoiceElectionVotingStatusLabel(votingStatus)}
        </p>
      </header>

      {!decision ? (
        <p className="pie-election-results__status">
          Results appear when the election ballot is published.
        </p>
      ) : (
        <PublicChoiceElectionResultsBoard
          initiativeId={initiativeId}
          candidates={candidates}
          aggregates={aggregates}
          resultsLabel={resultsLabel}
          votingOpen={votingOpen}
          electionStatus={publicChoiceElectionVotingStatusLabel(votingStatus)}
          downloadAvailable={downloadAvailable}
          onDownload={() => {
            void handleDownload();
          }}
          downloadBusy={downloadBusy}
          voteHref={`${overviewHref}#overview`}
        />
      )}

      {votingOpen ? (
        <p className="pie-election-results__status">
          Select or recall your candidate on{" "}
          <a href={`${overviewHref}#overview`}>Overview</a>.
        </p>
      ) : null}
    </section>
  );
}
