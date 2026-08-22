"use client";

import { useEffect, useState } from "react";

import type { CountryAffiliationPublic } from "@hu/types";

import { fetchCountryAffiliations } from "../country-experience-api";
import { CountryAffiliationCard } from "./CountryAffiliationCard";

import "./country-affiliation-cards.css";

interface CountryPartnersSectionProps {
  countryCode: string;
  countryName: string;
}

export function CountryPartnersSection({ countryCode, countryName }: CountryPartnersSectionProps) {
  const [entries, setEntries] = useState<CountryAffiliationPublic[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchCountryAffiliations(countryCode, "PARTNER")
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
      aria-labelledby="country-partners-title"
    >
      <h2 id="country-partners-title">Our Partners</h2>
      <p className="country-affiliation-section__intro">
        Organizations collaborating with Humanity Union in {countryName}.
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
