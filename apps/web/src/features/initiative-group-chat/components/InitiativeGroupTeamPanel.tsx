"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { InitiativeActiveAlliesProjection } from "@hu/types";

import { HumanityAvatar } from "../../../design-system/components/HumanityAvatar";
import { ApiRequestError } from "../../../lib/api-client";
import { getInitiativeActiveAlliesTeam } from "../../initiative-active-allies/api";

interface InitiativeGroupTeamPanelProps {
  initiativeId: string;
}

type LoadState = "loading" | "ready" | "error";

/**
 * Communication UX Pack 03.9 Part 5 — compact "Selected Initiative Team"
 * roster: the Initiative Author and every current active Ally, at a
 * glance. Reuses the exact same `getInitiativeActiveAlliesTeam` read the
 * Collaboration Channel's own participants list and the Active Allies
 * widget already use — never a second Ally projection.
 */
export function InitiativeGroupTeamPanel({ initiativeId }: InitiativeGroupTeamPanelProps) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [team, setTeam] = useState<InitiativeActiveAlliesProjection | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    setTeam(null);

    getInitiativeActiveAlliesTeam(initiativeId)
      .then((projection) => {
        if (cancelled) {
          return;
        }
        setTeam(projection);
        setLoadState("ready");
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setErrorMessage(
          error instanceof ApiRequestError ? error.message : "Unable to load this Initiative's Team.",
        );
        setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [initiativeId]);

  if (loadState === "loading") {
    return (
      <section className="igc-team-panel" aria-label="Selected Initiative Team">
        <h3 className="igc-team-panel__title">Initiative Team</h3>
        <p className="igc-team-panel__status" role="status">
          Loading Team…
        </p>
      </section>
    );
  }

  if (loadState === "error" || !team) {
    return (
      <section className="igc-team-panel" aria-label="Selected Initiative Team">
        <h3 className="igc-team-panel__title">Initiative Team</h3>
        <p className="igc-team-panel__status igc-team-panel__status--error" role="alert">
          {errorMessage ?? "Unable to load this Initiative's Team."}
        </p>
      </section>
    );
  }

  const entries = [team.author, ...team.allies];

  return (
    <section className="igc-team-panel" aria-label="Selected Initiative Team">
      <h3 className="igc-team-panel__title">
        Initiative Team <span className="igc-team-panel__count">({entries.length})</span>
      </h3>
      <ul className="igc-team-panel__list">
        {entries.map((entry, index) => (
          <li key={entry.participantId ?? `${entry.displayName}-${index}`} className="igc-team-panel__row">
            {entry.profileUrl ? (
              <Link href={entry.profileUrl} className="igc-team-panel__identity">
                <HumanityAvatar avatarUrl={entry.avatarUrl} size={24} alt="" />
                <span className="igc-team-panel__name">{entry.displayName}</span>
              </Link>
            ) : (
              <span className="igc-team-panel__identity">
                <HumanityAvatar avatarUrl={entry.avatarUrl} size={24} alt="" />
                <span className="igc-team-panel__name">{entry.displayName}</span>
              </span>
            )}
            <span className="igc-team-panel__role">{entry.role === "author" ? "Author" : "Ally"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
