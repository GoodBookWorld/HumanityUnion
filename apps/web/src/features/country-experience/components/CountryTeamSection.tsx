"use client";

import { useEffect, useState } from "react";

import type { CountryAffiliationPublic } from "@hu/types";

import { fetchCountryAffiliations } from "../country-experience-api";
import { CountryAffiliationCard } from "./CountryAffiliationCard";

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

  if (entries.length === 0) {
    return null;
  }

  return (
    <section
      className="country-experience-dynamic__section country-affiliation-section"
      aria-labelledby="country-team-title"
    >
      <h2 id="country-team-title">Our Team</h2>
      <p className="country-affiliation-section__intro">
        People supporting Humanity Union activity in {countryName}.
      </p>
      <ul className="country-affiliation-grid">
        {entries.map((entry) => (
          <li key={entry.entryId}>
            <CountryAffiliationCard entry={entry} />
          </li>
        ))}
      </ul>
    </section>
  );
}
