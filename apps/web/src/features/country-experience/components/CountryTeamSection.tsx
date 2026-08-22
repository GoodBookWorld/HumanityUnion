"use client";

import { useEffect, useState } from "react";

import type { CountryAffiliationPublic } from "@hu/types";

import { buildAffiliationPresentationSlots } from "../country-affiliation-presentation";
import { fetchCountryAffiliations } from "../country-experience-api";
import {
  CountryAffiliationCard,
  CountryAffiliationPlaceholderCard,
} from "./CountryAffiliationCard";

import "./country-affiliation-cards.css";

interface CountryTeamSectionProps {
  countryCode: string;
  countryName: string;
}

export function CountryTeamSection({ countryCode, countryName }: CountryTeamSectionProps) {
  const [entries, setEntries] = useState<CountryAffiliationPublic[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchCountryAffiliations(countryCode, "TEAM_MEMBER")
      .then((items) => {
        if (!cancelled) {
          setEntries(items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEntries([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [countryCode]);

  if (!loaded) {
    return null;
  }

  const slots = buildAffiliationPresentationSlots(entries);

  return (
    <section
      className="country-experience-dynamic__section country-affiliation-section"
      aria-labelledby="country-team-title"
    >
      <h2 id="country-team-title">Our Team</h2>
      <p className="country-affiliation-section__intro">
        People supporting Humanity Union activity in {countryName}.
      </p>
      <div className="country-affiliation-rail" role="list" aria-label={`Our Team in ${countryName}`}>
        {slots.map((slot) =>
          slot.kind === "entry" ? (
            <div key={slot.entry.entryId} className="country-affiliation-rail__item" role="listitem">
              <CountryAffiliationCard entry={slot.entry} toneIndex={slot.toneIndex} />
            </div>
          ) : (
            <div
              key={`team-placeholder-${slot.placeholderIndex}`}
              className="country-affiliation-rail__item"
              role="presentation"
            >
              <CountryAffiliationPlaceholderCard variant="team" toneIndex={slot.toneIndex} />
            </div>
          ),
        )}
      </div>
    </section>
  );
}
