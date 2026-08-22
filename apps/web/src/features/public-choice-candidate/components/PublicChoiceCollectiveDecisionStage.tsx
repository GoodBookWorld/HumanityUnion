"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  InitiativeDecisionSelectOneAggregates,
  PublicChoiceCandidatePublicProjection,
  PublicInitiativeCollectiveDecisionProjection,
} from "@hu/types";
import {
  publicChoiceElectionVotingStatusLabel,
  resolvePublicChoiceElectionVotingStatus,
} from "@hu/types";

import { buildInitiativeExperienceHref } from "../../initiative-owner-studio/initiative-experience-routes";
import { downloadPublicChoiceResultsPdf } from "../../public-choice-results-retention/api";
import {
  createZeroSelectOneAggregates,
  loadPublicChoiceElectionResultSurface,
} from "../public-choice-election-result-surface";
import { usePublicChoiceElectionRefresh } from "../public-choice-election-refresh";
import { PublicChoiceElectionResultsBoard } from "./PublicChoiceElectionResultsBoard";

import "../../public-initiative-experience/public-initiative-experience.css";

interface PublicChoiceCollectiveDecisionStageProps {
  initiativeId: string;
}

/**
 * Fix 05 / 07C — PUBLIC_CHOICE Collective Decision for every viewer role.
 * Always the shared election results board — never STANDARD Author Workspace
 * or the generic public Collective Decision page presentation.
 */
export function PublicChoiceCollectiveDecisionStage({
  initiativeId,
}: PublicChoiceCollectiveDecisionStageProps) {
  const [decision, setDecision] = useState<PublicInitiativeCollectiveDecisionProjection | null>(
    null,
  );
  const [candidates, setCandidates] = useState<PublicChoiceCandidatePublicProjection[]>([]);
  const [selectOneAggregates, setSelectOneAggregates] =
    useState<InitiativeDecisionSelectOneAggregates>(() => createZeroSelectOneAggregates([]));
  const [electionName, setElectionName] = useState("Election");
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [downloadBusy, setDownloadBusy] = useState(false);
  const loadGenerationRef = useRef(0);

  const reload = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    try {
      const surface = await loadPublicChoiceElectionResultSurface(initiativeId);
      if (generation !== loadGenerationRef.current) {
        return;
      }

      setElectionName(
        surface.initiative?.metadata.communityAssociation?.trim() ||
          surface.initiative?.title ||
          "Election",
      );
      setCandidates(surface.candidates);
      setDecision(surface.decision);
      setSelectOneAggregates(surface.selectOneAggregates);
      setLoadState("ready");
    } catch {
      if (generation !== loadGenerationRef.current) {
        return;
      }
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

  return (
    <section className="pie-pc-cd-stage" aria-labelledby="pie-pc-cd-title">
      <header className="pie-pc-cd-stage__header">
        <h2 id="pie-pc-cd-title">Election Results</h2>
        <p className="pie-pc-cd-stage__subtitle">Collective Decision · {electionName}</p>
        <p className="pie-election-results__status" role="status">
          Election status: {publicChoiceElectionVotingStatusLabel(votingStatus)}
        </p>
      </header>

      {!decision && candidates.length === 0 ? (
        <p className="pie-election-results__status">
          Results appear when the election ballot is published.
        </p>
      ) : (
        <PublicChoiceElectionResultsBoard
          initiativeId={initiativeId}
          candidates={candidates}
          aggregates={selectOneAggregates}
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
