"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

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
} from "@hu/types";

import {
  getPublicInitiativeCollectiveDecision,
  listPublicInitiativeCollectiveDecisions,
} from "../../initiative-collective-decision/api";
import { isCollectiveDecisionVotingWindowOpen } from "../../initiative-collective-decision-lifecycle/collective-decision-voting";
import { getPublicInitiative } from "../../initiatives/api";
import { resolveMediaUrl } from "../../media-upload/media-url";
import { listPublicChoiceCandidates } from "../../public-choice-candidate/api";

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
 * Pack 02A — sidebar Election / Candidates widget.
 * Order contract: after Initiative Support, before remaining widgets.
 * STANDARD: not rendered.
 */
export function PublicChoiceElectionSidebarWidget({
  initiativeId,
  lifecycleProfile,
}: PublicChoiceElectionSidebarWidgetProps) {
  const isPublicChoice =
    resolveInitiativeLifecycleProfile(lifecycleProfile) === "PUBLIC_CHOICE";

  const [initiative, setInitiative] = useState<PublicInitiativeProjection | null>(null);
  const [candidates, setCandidates] = useState<PublicChoiceCandidatePublicProjection[]>([]);
  const [decision, setDecision] = useState<PublicInitiativeCollectiveDecisionProjection | null>(
    null,
  );

  const reload = useCallback(async () => {
    if (!isPublicChoice) {
      return;
    }

    try {
      const [publicInitiative, candidateList, listed] = await Promise.all([
        getPublicInitiative(initiativeId),
        listPublicChoiceCandidates(initiativeId).catch(() => []),
        listPublicInitiativeCollectiveDecisions(initiativeId),
      ]);
      setInitiative(publicInitiative);
      setCandidates(candidateList);

      const opened =
        listed.decisions.find((item) => item.status === "opened") ?? listed.decisions[0] ?? null;
      if (opened) {
        setDecision(await getPublicInitiativeCollectiveDecision(opened.decisionId));
      } else {
        setDecision(null);
      }
    } catch {
      setInitiative(null);
      setCandidates([]);
      setDecision(null);
    }
  }, [initiativeId, isPublicChoice]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const ballotMode: PublicChoiceBallotMode = resolvePublicChoiceBallotMode(
    decision?.ballotMode ?? initiative?.metadata.ballotMode,
  );

  const electionName =
    initiative?.metadata.communityAssociation?.trim() || initiative?.title || "Election";
  const electionHref = `/initiatives/public/${encodeURIComponent(initiativeId)}/election`;
  const votingOpen = decision ? isCollectiveDecisionVotingWindowOpen(decision) : false;
  const ranked = useMemo(
    () => sortSelectOneCandidates(candidates, decision?.ballotAggregates),
    [candidates, decision?.ballotAggregates],
  );

  if (!isPublicChoice || !initiative) {
    return null;
  }

  const aggregates = decision?.ballotAggregates;

  return (
    <section className="pie-election" aria-labelledby="pie-election-title">
      <h2 id="pie-election-title" className="pie-election__title">
        {ballotMode === "SELECT_ONE_CANDIDATE" ? "Candidates" : "Election"}
      </h2>
      <p className="pie-election__name">{electionName}</p>
      <p className="pie-election__link">
        <Link className="hu-button hu-button--primary pie-election__cta" href={electionHref}>
          View election
        </Link>
      </p>

      {ballotMode === "SELECT_ONE_CANDIDATE" ? (
        <>
          {votingOpen ? (
            <p className="pie-election__status" role="status">
              CURRENT RESULTS
            </p>
          ) : decision?.status === "closed" ? (
            <p className="pie-election__status" role="status">
              FINAL RESULTS
            </p>
          ) : null}
          {ranked.length === 0 ? (
            <p className="pie-election__empty">No candidates listed yet.</p>
          ) : (
            <ol className="pie-election__ranking">
              {ranked.map((candidate) => {
                const photo = resolveMediaUrl(candidate.photoUrl);
                return (
                  <li key={candidate.candidateId}>
                    {photo ? (
                      <img src={photo} alt="" width={32} height={32} />
                    ) : null}
                    <span>{candidate.name}</span>
                    <strong>{candidate.votes}</strong>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      ) : (
        <ul className="pie-election__ternary" aria-label="Support / Oppose results">
          <li>
            <span>Support</span>
            <strong>
              {aggregates?.ballotMode === "SUPPORT_OPPOSE"
                ? aggregates.total.support
                : (decision?.statistics.supportCount ?? 0)}
            </strong>
          </li>
          <li>
            <span>Do not support</span>
            <strong>
              {aggregates?.ballotMode === "SUPPORT_OPPOSE"
                ? aggregates.total.doNotSupport
                : (decision?.statistics.doNotSupportCount ?? 0)}
            </strong>
          </li>
          <li>
            <span>Abstain</span>
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
