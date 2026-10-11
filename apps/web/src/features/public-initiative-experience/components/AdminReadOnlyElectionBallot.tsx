"use client";

import { useTranslations } from "next-intl";

import { resolveMediaUrl } from "../../media-upload/media-url";

/**
 * Preloaded administrator election read.
 * When this value is supplied, election UI must not call public candidate,
 * decision, or results endpoints, and must not offer voting.
 */
export interface AdminReadOnlyElectionBallot {
  readonly electionTitle: string;
  readonly ballotMode: string;
  readonly votingStatus: string;
  readonly decisionId: string | null;
  readonly effectiveVoterCount: number | null;
  readonly candidates: readonly AdminReadOnlyElectionCandidate[];
  /** The administrator detail read failed. Do not fall back to public endpoints. */
  readonly unavailable?: boolean;
}

export interface AdminReadOnlyElectionCandidate {
  readonly candidateId: string;
  readonly name: string;
  readonly photoUrl?: string;
  readonly campaignPageUrl?: string;
  readonly voteCount: number;
  readonly isBlocked: boolean;
  readonly blockLabel?: string | null;
}

export function AdminReadOnlyElectionBallotView({
  ballot,
}: {
  ballot: AdminReadOnlyElectionBallot;
}) {
  const t = useTranslations("initiativeExperience");
  const selectOne = ballot.ballotMode === "SELECT_ONE_CANDIDATE";
  const empty = ballot.candidates.length === 0 && !ballot.decisionId;

  return (
    <section className="pie-election" aria-labelledby="admin-readonly-election-title">
      <h2 id="admin-readonly-election-title" className="pie-election__title">
        {selectOne ? t("sidebar.election.candidates") : t("sidebar.election.election")}
      </h2>
      {ballot.electionTitle ? <p className="pie-election__name">{ballot.electionTitle}</p> : null}
      {ballot.votingStatus ? (
        <p className="pie-election__status" role="status">
          {ballot.votingStatus}
        </p>
      ) : null}
      {ballot.unavailable ? (
        <p className="pie-election__empty" role="status">
          Election details could not be loaded from the administrator record.
        </p>
      ) : empty ? (
        <p className="pie-election__empty" role="status">
          {t("sidebar.election.noCandidates")}
        </p>
      ) : ballot.candidates.length === 0 ? (
        <p className="pie-election__empty" role="status">
          {t("sidebar.election.noCandidates")}
        </p>
      ) : (
        <ol className="pie-election__ranking">
          {ballot.candidates.map((candidate) => {
            const photo = resolveMediaUrl(candidate.photoUrl);
            return (
              <li key={candidate.candidateId}>
                {photo ? <img src={photo} alt="" width={32} height={32} /> : null}
                <span>
                  {candidate.name}
                  {candidate.isBlocked ? t("sidebar.election.blockedSuffix") : ""}
                  {candidate.blockLabel ? ` (${candidate.blockLabel})` : ""}
                </span>
                <strong>{candidate.voteCount}</strong>
              </li>
            );
          })}
        </ol>
      )}
      {ballot.effectiveVoterCount !== null ? (
        <p className="pie-election__status">
          {t("sidebar.election.resultsAria")}: {ballot.effectiveVoterCount}
        </p>
      ) : null}
    </section>
  );
}
