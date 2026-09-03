"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { CountryAffiliationPublic } from "@hu/types";

import { buildAffiliationPresentationSlots } from "../country-affiliation-presentation";
import { fetchCountryAffiliations } from "../country-experience-api";
import {
  CountryAffiliationCard,
  CountryAffiliationPlaceholderCard,
} from "./CountryAffiliationCard";

import "./country-affiliation-cards.css";

interface CountryPartnersSectionProps {
  countryCode: string;
  countryName: string;
}

export function CountryPartnersSection({ countryCode, countryName }: CountryPartnersSectionProps) {
  const t = useTranslations("publicGeo.country.partners");
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

  const slots = buildAffiliationPresentationSlots(entries);

  return (
    <section
      className="country-experience-dynamic__section country-affiliation-section"
      aria-labelledby="country-partners-title"
    >
      <h2 id="country-partners-title">{t("title")}</h2>
      <p className="country-affiliation-section__intro">
        {t("intro", { countryName })}
      </p>
      <div
        className="country-affiliation-rail"
        role="list"
        aria-label={t("aria", { countryName })}
      >
        {slots.map((slot) =>
          slot.kind === "entry" ? (
            <div key={slot.entry.entryId} className="country-affiliation-rail__item" role="listitem">
              <CountryAffiliationCard entry={slot.entry} toneIndex={slot.toneIndex} />
            </div>
          ) : (
            <div
              key={`partner-placeholder-${slot.placeholderIndex}`}
              className="country-affiliation-rail__item"
              role="presentation"
            >
              <CountryAffiliationPlaceholderCard variant="partner" toneIndex={slot.toneIndex} />
            </div>
          ),
        )}
      </div>
    </section>
  );
}
