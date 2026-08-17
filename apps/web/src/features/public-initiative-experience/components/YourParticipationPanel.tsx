"use client";

import Link from "next/link";
import type { CollectiveParticipationJourney } from "@hu/types";

interface YourParticipationPanelProps {
  readonly journey: CollectiveParticipationJourney;
  readonly isAuthorPrimary: boolean;
}

/**
 * Phase 05 — compact "Your Participation" panel inside the Initiative shell.
 * Does not replace Author Mode for stewards.
 */
export function YourParticipationPanel({
  journey,
  isAuthorPrimary,
}: YourParticipationPanelProps) {
  const signedOut = journey.participantId === null;

  return (
    <section className="pie-participation" aria-labelledby="pie-participation-title">
      <h2 id="pie-participation-title" className="pie-participation__title">
        Your Participation
      </h2>

      {isAuthorPrimary ? (
        <p className="pie-participation__note">
          You are the Initiative Author. Author Mode remains primary for lifecycle editing.
          Participant actions below are optional civic participation.
        </p>
      ) : null}

      <p className="pie-participation__stage">
        Current stage: <strong>{journey.currentStageLabel}</strong>
        {journey.activeAlly ? " · Active Ally" : null}
      </p>

      {signedOut ? (
        <p className="pie-participation__empty">
          Sign in to track your contributions and take the next civic action.
        </p>
      ) : journey.pastActions.length === 0 ? (
        <p className="pie-participation__empty">You have not contributed to this Initiative yet.</p>
      ) : (
        <ul className="pie-participation__past">
          {journey.pastActions.slice(0, 5).map((action) => (
            <li key={`${action.actionType}-${action.occurredAt}`}>
              <Link href={action.deepLink}>{action.statusLabel}</Link>
              <span className="pie-participation__meta"> · {action.stageId.replaceAll("_", " ")}</span>
            </li>
          ))}
        </ul>
      )}

      {journey.nextAction ? (
        <div className="pie-participation__next">
          <p className="pie-participation__next-label">Next meaningful action</p>
          <Link className="pie-participation__next-link" href={journey.nextAction.deepLink}>
            {journey.nextAction.label}
          </Link>
          <p className="pie-participation__reason">{journey.nextAction.reason}</p>
        </div>
      ) : (
        <p className="pie-participation__empty">No participant action is available right now.</p>
      )}
    </section>
  );
}
