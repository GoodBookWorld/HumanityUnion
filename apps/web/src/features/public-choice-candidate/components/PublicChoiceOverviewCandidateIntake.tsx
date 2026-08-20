"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { PublicChoiceCandidatePublicProjection } from "@hu/types";
import { resolvePublicChoiceBallotMode } from "@hu/types";

import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { getPublicInitiative } from "../../initiatives/api";
import { resolveMediaUrl } from "../../media-upload/media-url";
import { listPublicChoiceCandidates } from "../api";
import { PublicChoiceCandidateSubmitPanel } from "./PublicChoiceCandidateSubmitPanel";

import "../../public-initiative-experience/public-initiative-experience.css";

interface PublicChoiceOverviewCandidateIntakeProps {
  initiativeId: string;
  /** When true, open the add-candidate form immediately (hash / CTA). */
  openSubmitInitially?: boolean;
  onOpenSubmitConsumed?: () => void;
  /** After successful create — navigate to Collective Decision voting. */
  onSubmittedNavigateToCollectiveDecision?: () => void;
}

/**
 * Pack 03 — SELECT_ONE Overview candidate intake.
 * One permanent Add candidate row; form opens without reload.
 */
export function PublicChoiceOverviewCandidateIntake({
  initiativeId,
  openSubmitInitially = false,
  onOpenSubmitConsumed,
  onSubmittedNavigateToCollectiveDecision,
}: PublicChoiceOverviewCandidateIntakeProps) {
  const authStatus = useClientAuthStatus();
  const authenticated = authStatus === "authenticated";
  const [candidates, setCandidates] = useState<PublicChoiceCandidatePublicProjection[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "hidden" | "error">("loading");
  const [showSubmit, setShowSubmit] = useState(false);
  const [resultsExpired, setResultsExpired] = useState(false);

  const reload = useCallback(async () => {
    setLoadState("loading");
    try {
      const initiative = await getPublicInitiative(initiativeId);
      const mode = resolvePublicChoiceBallotMode(initiative.metadata.ballotMode);
      if (mode !== "SELECT_ONE_CANDIDATE") {
        setLoadState("hidden");
        return;
      }
      setResultsExpired(Boolean(initiative.metadata.publicChoiceResultsExpiredAt));
      const listed = await listPublicChoiceCandidates(initiativeId);
      setCandidates(listed);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, [initiativeId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (openSubmitInitially) {
      setShowSubmit(true);
      onOpenSubmitConsumed?.();
    }
  }, [openSubmitInitially, onOpenSubmitConsumed]);

  function openSubmitForm(): void {
    setShowSubmit(true);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "#add-candidate");
    }
  }

  async function handleSubmitted(): Promise<void> {
    setShowSubmit(false);
    await reload();
    onSubmittedNavigateToCollectiveDecision?.();
  }

  if (loadState === "hidden") {
    return null;
  }

  if (loadState === "loading") {
    return <p className="pie-overview-candidates__status">Loading candidates…</p>;
  }

  if (loadState === "error") {
    return (
      <p className="pie-overview-candidates__status" role="alert">
        Candidates could not be loaded.
      </p>
    );
  }

  const registerHref = `/register?returnTo=${encodeURIComponent(
    `/initiatives/public/${encodeURIComponent(initiativeId)}#add-candidate`,
  )}`;

  return (
    <section
      className="pie-overview-candidates"
      aria-labelledby="pie-overview-candidates-title"
    >
      <h2 id="pie-overview-candidates-title">Candidates</h2>
      <p className="pie-overview-candidates__lead">
        Add candidates for this election. Voting happens on Collective Decision.
      </p>

      <ul className="pie-overview-candidates__list">
        {candidates.map((candidate) => {
          const photo = resolveMediaUrl(candidate.photoUrl);
          const nameBlock = (
            <>
              {photo ? (
                <img
                  className="pie-overview-candidates__photo"
                  src={photo}
                  alt=""
                  width={48}
                  height={48}
                />
              ) : (
                <span className="pie-overview-candidates__photo pie-overview-candidates__photo--empty" />
              )}
              <span className="pie-overview-candidates__name">{candidate.name}</span>
            </>
          );

          return (
            <li key={candidate.candidateId} className="pie-election-results__row">
              {candidate.campaignPageUrl ? (
                <a
                  className="pie-overview-candidates__identity"
                  href={candidate.campaignPageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {nameBlock}
                </a>
              ) : (
                <div className="pie-overview-candidates__identity">{nameBlock}</div>
              )}
            </li>
          );
        })}

        {!resultsExpired ? (
          <li className="pie-election-results__row pie-election-results__row--add">
            {authenticated ? (
              <button
                type="button"
                className="pie-overview-candidates__add"
                onClick={openSubmitForm}
              >
                + Add candidate
              </button>
            ) : (
              <Link className="pie-overview-candidates__add" href={registerHref}>
                + Add candidate
              </Link>
            )}
          </li>
        ) : null}
      </ul>

      {showSubmit && authenticated ? (
        <PublicChoiceCandidateSubmitPanel
          initiativeId={initiativeId}
          onSubmitted={() => void handleSubmitted()}
          onCancel={() => setShowSubmit(false)}
        />
      ) : null}
    </section>
  );
}
