"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import type {
  InitiativeDecisionSelectOneAggregates,
  PublicChoiceCandidatePublicProjection,
  PublicInitiativeCollectiveDecisionProjection,
} from "@hu/types";
import { resolvePublicChoiceElectionVotingStatus } from "@hu/types";

import { buildInitiativeExperienceHref } from "../../initiative-owner-studio/initiative-experience-routes";
import { resolvePublicChoiceElectionVotingStatusDisplayLabel } from "../../public-initiative-experience/initiative-experience-i18n";
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
  const t = useTranslations("initiativeExperience");
  const [decision, setDecision] = useState<PublicInitiativeCollectiveDecisionProjection | null>(
    null,
  );
  const [candidates, setCandidates] = useState<PublicChoiceCandidatePublicProjection[]>([]);
  const [selectOneAggregates, setSelectOneAggregates] =
    useState<InitiativeDecisionSelectOneAggregates>(() => createZeroSelectOneAggregates([]));
  const [electionName, setElectionName] = useState("");
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
          "",
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
    return <p className="pie-election-results__status">{t("publicChoice.stage.loading")}</p>;
  }

  if (loadState === "error") {
    return (
      <p className="pie-overview-candidates__error" role="alert">
        {t("publicChoice.stage.loadFailed")}
      </p>
    );
  }

  const displayElectionName = electionName.trim() || t("sidebar.election.election");
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
  const electionStatusLabel = resolvePublicChoiceElectionVotingStatusDisplayLabel(
    votingStatus,
    t,
  );
  const resultsLabel = votingOpen
    ? t("author.collectiveDecision.public.resultsCurrent")
    : resultsExpired
      ? t("author.collectiveDecision.public.results")
      : decision?.status === "closed" ||
          decision?.resultsRetention?.status === "results_available"
        ? t("author.collectiveDecision.public.resultsFinal")
        : t("author.collectiveDecision.public.results");
  const downloadAvailable =
    Boolean(decision?.resultsRetention?.downloadAvailable) && !resultsExpired;
  const overviewHref = buildInitiativeExperienceHref(initiativeId);

  return (
    <section className="pie-pc-cd-stage" aria-labelledby="pie-pc-cd-title">
      <header className="pie-pc-cd-stage__header">
        <h2 id="pie-pc-cd-title">{t("publicChoice.stage.title")}</h2>
        <p className="pie-pc-cd-stage__subtitle">
          {t("publicChoice.stage.subtitle", { electionName: displayElectionName })}
        </p>
        <p className="pie-election-results__status" role="status">
          {t("publicChoice.results.electionStatus", { status: electionStatusLabel })}
        </p>
      </header>

      {!decision && candidates.length === 0 ? (
        <p className="pie-election-results__status">{t("publicChoice.stage.emptyPending")}</p>
      ) : (
        <PublicChoiceElectionResultsBoard
          initiativeId={initiativeId}
          candidates={candidates}
          aggregates={selectOneAggregates}
          resultsLabel={resultsLabel}
          votingOpen={votingOpen}
          electionStatus={electionStatusLabel}
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
          {t.rich("author.collectiveDecision.public.selectCandidateOnOverview", {
            overviewLink: (chunks) => <a href={`${overviewHref}#overview`}>{chunks}</a>,
          })}
        </p>
      ) : null}
    </section>
  );
}
