"use client";

import type { CountryAffiliationPublic } from "@hu/types";

import { resolveMediaUrl } from "../../media-upload/media-url";

import "./country-affiliation-cards.css";

interface CountryAffiliationCardProps {
  entry: CountryAffiliationPublic;
  toneIndex?: number;
}

/**
 * Pack 10C — real Team/Partner card.
 * Missing image uses a clean neutral media plate (no visible initials fallback block).
 */
export function CountryAffiliationCard({ entry, toneIndex = 0 }: CountryAffiliationCardProps) {
  const imageSrc = resolveMediaUrl(entry.imageUrl) ?? entry.imageUrl;
  const isPartner = entry.entryType === "PARTNER";
  const toneClass = `country-affiliation-card--tone-${toneIndex % 5}`;

  return (
    <article
      className={`country-affiliation-card ${
        isPartner ? "country-affiliation-card--partner" : "country-affiliation-card--team"
      } ${toneClass}`}
    >
      <div className="country-affiliation-card__media" aria-hidden="true">
        {imageSrc ? (
          <img
            className="country-affiliation-card__image"
            src={imageSrc}
            alt=""
            width={isPartner ? 96 : 72}
            height={isPartner ? 64 : 72}
            onError={(event) => {
              event.currentTarget.remove();
            }}
          />
        ) : null}
      </div>
      <div className="country-affiliation-card__body">
        <h3 className="country-affiliation-card__name">{entry.name}</h3>
        {entry.roleOrPosition ? (
          <p className="country-affiliation-card__role">{entry.roleOrPosition}</p>
        ) : null}
        <div className="country-affiliation-card__actions">
          {entry.email ? (
            <a className="country-affiliation-card__link" href={`mailto:${entry.email}`}>
              Email
            </a>
          ) : null}
          {entry.websiteUrl ? (
            <a
              className="country-affiliation-card__link"
              href={entry.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Website
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

interface CountryAffiliationPlaceholderCardProps {
  variant: "team" | "partner";
  toneIndex?: number;
}

/** Presentation-only empty slot — never persisted, not interactive for Visitors. */
export function CountryAffiliationPlaceholderCard({
  variant,
  toneIndex = 0,
}: CountryAffiliationPlaceholderCardProps) {
  const toneClass = `country-affiliation-card--tone-${toneIndex % 5}`;

  return (
    <article
      className={`country-affiliation-card country-affiliation-card--placeholder country-affiliation-card--${variant} ${toneClass}`}
      aria-hidden="true"
    >
      <div className="country-affiliation-card__media country-affiliation-card__media--empty" />
      <div className="country-affiliation-card__body">
        <span className="country-affiliation-card__placeholder-line" />
        <span className="country-affiliation-card__placeholder-line country-affiliation-card__placeholder-line--short" />
      </div>
    </article>
  );
}
