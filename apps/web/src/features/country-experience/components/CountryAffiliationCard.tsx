"use client";

import type { CountryAffiliationPublic } from "@hu/types";

import { resolveMediaUrl } from "../../media-upload/media-url";

import "./country-affiliation-cards.css";

interface CountryAffiliationCardProps {
  entry: CountryAffiliationPublic;
}

export function CountryAffiliationCard({ entry }: CountryAffiliationCardProps) {
  const imageSrc = resolveMediaUrl(entry.imageUrl) ?? entry.imageUrl;
  const isPartner = entry.entryType === "PARTNER";
  const initials = entry.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <article
      className={`country-affiliation-card${isPartner ? " country-affiliation-card--partner" : " country-affiliation-card--team"}`}
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
              event.currentTarget.style.display = "none";
              const fallback = event.currentTarget.nextElementSibling;
              if (fallback instanceof HTMLElement) {
                fallback.hidden = false;
              }
            }}
          />
        ) : null}
        <span className="country-affiliation-card__fallback" hidden={Boolean(imageSrc)}>
          {initials || "?"}
        </span>
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
