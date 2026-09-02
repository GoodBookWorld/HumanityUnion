"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import type {
  InitiativeDecisionBallotAggregates,
  InitiativeLifecycleProfile,
  PublicChoiceBallotMode,
  PublicChoiceCandidatePublicProjection,
  PublicInitiativeCollectiveDecisionProjection,
  PublicInitiativeProjection,
} from "@hu/types";
import {
  resolveInitiativeLifecycleProfile,
  resolvePublicChoiceBallotMode,
  resolvePublicChoiceElectionVotingStatus,
} from "@hu/types";

import { resolveMediaUrl } from "../../media-upload/media-url";
import { loadPublicChoiceElectionResultSurface } from "../../public-choice-candidate/public-choice-election-result-surface";
import { usePublicChoiceElectionRefresh } from "../../public-choice-candidate/public-choice-election-refresh";

interface PublicChoiceElectionSidebarWidgetProps {
  initiativeId: string;
  lifecycleProfile?: InitiativeLifecycleProfile | string | null;
}

function sortSelectOneCandidates(
  candidates: PublicChoiceCandidatePublicProjection[],
  aggregates: InitiativeDecisionBallotAggregates | undefined,
): Array<PublicChoiceCandidatePublicProjection & { votes: number }> {
  const tallies =
    aggregates?.ballotMode === "SELECT_ONE_CANDIDATE"
      ? new Map(aggregates.candidates.map((item) => [item.candidateId, item.count]))
      : new Map<string, number>();

  return [...candidates]
    .map((candidate) => ({
      ...candidate,
      votes: tallies.get(candidate.candidateId) ?? 0,
    }))
    .sort((a, b) => {
      if (b.votes !== a.votes) {
        return b.votes - a.votes;
      }
      return a.candidateId.localeCompare(b.candidateId);
    });
}

/**
 * Pack 02A / Fix 07C — sidebar Candidates widget.
 * Consumes the same canonical live aggregate as CD / Election while OPEN.
 */
export function PublicChoiceElectionSidebarWidget({
  initiativeId,
  lifecycleProfile,
}: PublicChoiceElectionSidebarWidgetProps) {
  const t = useTranslations("initiativeExperience");
  const isPublicChoice =
    resolveInitiativeLifecycleProfile(lifecycleProfile) === "PUBLIC_CHOICE";

  const [initiative, setInitiative] = useState<PublicInitiativeProjection | null>(null);
  const [candidates, setCandidates] = useState<PublicChoiceCandidatePublicProjection[]>([]);
  const [decision, setDecision] = useState<PublicInitiativeCollectiveDecisionProjection | null>(
    null,
  );
  const [selectOneAggregates, setSelectOneAggregates] = useState<
    InitiativeDecisionBallotAggregates | undefined
  >(undefined);
  const loadGenerationRef = useRef(0);
  const hasSurfaceRef = useRef(false);

  const reload = useCallback(async () => {
    if (!isPublicChoice) {
      return;
    }

    const generation = ++loadGenerationRef.current;
    try {
      const surface = await loadPublicChoiceElectionResultSurface(initiativeId);
      if (generation !== loadGenerationRef.current) {
        return;
      }
      setInitiative(surface.initiative);
      setCandidates(surface.candidates);
      setDecision(surface.decision);
      setSelectOneAggregates(surface.selectOneAggregates);
      hasSurfaceRef.current = true;
    } catch {
      if (generation !== loadGenerationRef.current) {
        return;
      }
      // Soft path: keep last good tallies if a transient roster/initiative fetch fails.
      if (!hasSurfaceRef.current) {
        setInitiative(null);
        setCandidates([]);
        setDecision(null);
        setSelectOneAggregates(undefined);
      }
    }
  }, [initiativeId, isPublicChoice]);

  useEffect(() => {
    void reload();
  }, [reload]);

  usePublicChoiceElectionRefresh(initiativeId, reload);

  const ballotMode: PublicChoiceBallotMode = resolvePublicChoiceBallotMode(
    decision?.ballotMode ?? initiative?.metadata.ballotMode,
  );

  const electionName =
    initiative?.metadata.communityAssociation?.trim() ||
    initiative?.title ||
    t("sidebar.election.election");
  const electionHref = `/initiatives/public/${encodeURIComponent(initiativeId)}/election`;
  const votingStatus = resolvePublicChoiceElectionVotingStatus({
    decisionStatus: decision?.status,
    openedAt: decision?.openedAt,
    closesAt: decision?.closesAt,
    closedAt: decision?.closedAt,
    resultsExpiredAt: decision?.resultsRetention?.resultsExpiredAt,
    resultsRetentionStatus: decision?.resultsRetention?.status,
  });
  const votingOpen = votingStatus === "OPEN";
  const ranked = useMemo(
    () => sortSelectOneCandidates(candidates, selectOneAggregates),
    [candidates, selectOneAggregates],
  );

  // Fix 07C — still render when initiative GET soft-fails if candidates/results loaded.
  if (!isPublicChoice || (!initiative && candidates.length === 0 && !decision)) {
    return null;
  }

  const aggregates = selectOneAggregates ?? decision?.ballotAggregates;

  return (
    <section className="pie-election" aria-labelledby="pie-election-title">
      <h2 id="pie-election-title" className="pie-election__title">
        {ballotMode === "SELECT_ONE_CANDIDATE"
          ? t("sidebar.election.candidates")
          : t("sidebar.election.election")}
      </h2>
      <p className="pie-election__name">{electionName}</p>
      <p className="pie-election__link">
        <Link className="hu-button hu-button--primary pie-election__cta" href={electionHref}>
          {t("sidebar.election.viewElection")}
        </Link>
      </p>

      {ballotMode === "SELECT_ONE_CANDIDATE" ? (
        <>
          {votingOpen ? (
            <p className="pie-election__status" role="status">
              {t("sidebar.election.currentResults")}
            </p>
          ) : decision?.status === "closed" ? (
            <p className="pie-election__status" role="status">
              {t("sidebar.election.finalResults")}
            </p>
          ) : null}
          {ranked.length === 0 ? (
            <p className="pie-election__empty">{t("sidebar.election.noCandidates")}</p>
          ) : (
            <ol className="pie-election__ranking">
              {ranked.map((candidate) => {
                const photo = resolveMediaUrl(candidate.photoUrl);
                return (
                  <li key={candidate.candidateId}>
                    {photo ? (
                      <img src={photo} alt="" width={32} height={32} />
                    ) : null}
                    <span>
                      {candidate.name}
                      {candidate.isBlocked ? t("sidebar.election.blockedSuffix") : ""}
                    </span>
                    <strong>{candidate.votes}</strong>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      ) : (
        <ul
          className="pie-election__ternary"
          aria-label={t("sidebar.election.resultsAria")}
        >
          <li>
            <span>{t("sidebar.election.support")}</span>
            <strong>
              {aggregates?.ballotMode === "SUPPORT_OPPOSE"
                ? aggregates.total.support
                : (decision?.statistics.supportCount ?? 0)}
            </strong>
          </li>
          <li>
            <span>{t("sidebar.election.doNotSupport")}</span>
            <strong>
              {aggregates?.ballotMode === "SUPPORT_OPPOSE"
                ? aggregates.total.doNotSupport
                : (decision?.statistics.doNotSupportCount ?? 0)}
            </strong>
          </li>
          <li>
            <span>{t("sidebar.election.abstain")}</span>
            <strong>
              {aggregates?.ballotMode === "SUPPORT_OPPOSE"
                ? aggregates.total.abstain
                : (decision?.statistics.abstainCount ?? 0)}
            </strong>
          </li>
        </ul>
      )}
    </section>
  );
}
