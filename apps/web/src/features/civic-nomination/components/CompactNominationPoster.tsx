"use client";

import Link from "next/link";

import type { PublicCivicNominationListItem } from "@hu/types";

import {
  EXPERTISE_AREA_LABELS,
  INSTITUTION_ROLE_LABELS,
  civicNominationPosterPath,
  formatCountrySlug,
} from "../constants";

interface CompactNominationPosterProps {
  nomination: PublicCivicNominationListItem;
}

export function CompactNominationPoster({ nomination }: CompactNominationPosterProps) {
  const displayName = nomination.nomineeDisplayName ?? nomination.nomineeName;

  return (
    <article className="civic-nomination-compact-poster">
      <header className="civic-nomination-compact-poster__header">
        <h3 className="civic-nomination-compact-poster__name">{displayName}</h3>
        <p className="civic-nomination-compact-poster__role">
          {INSTITUTION_ROLE_LABELS[nomination.institutionRole]}
        </p>
        <p className="civic-nomination-compact-poster__country">
          {formatCountrySlug(nomination.countrySlug)}
        </p>
      </header>

      <div className="civic-nomination-compact-poster__tags" aria-label="Expertise areas">
        {nomination.expertiseAreas.map((area) => (
          <span key={area} className="civic-nomination-compact-poster__tag">
            {EXPERTISE_AREA_LABELS[area]}
          </span>
        ))}
      </div>

      <div className="civic-nomination-compact-poster__votes" aria-label="Votes">
        <p className="civic-nomination-compact-poster__votes-label">Votes</p>
        <p className="civic-nomination-compact-poster__votes-status">
          Transparent support voting coming soon
        </p>
      </div>

      <Link
        href={civicNominationPosterPath(nomination.nominationId)}
        className="civic-nomination-compact-poster__link"
      >
        View Full Poster →
      </Link>
    </article>
  );
}
