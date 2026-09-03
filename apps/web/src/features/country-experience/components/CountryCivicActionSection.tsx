"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { WorldInitiativeCardProjection } from "@hu/types";

import { buildSearchUrlForGeographyScope } from "../../../data/geography/helpers";
import { HuxDiscoverySection } from "../../horizontal-experience";
import { fetchCountryInitiatives } from "../country-experience-api";
import {
  resolveCountryDiscoveryScope,
  type CountryDiscoveryScope,
} from "../country-discovery-entity-types";
import { CountryElectionRailCard } from "./CountryElectionRailCard";
import { CountryInitiativeRailCard } from "./CountryInitiativeRailCard";

export interface CountryCivicActionSectionProps {
  countryCode: string;
  countryName: string;
  regionCode: string;
  regionLabel: string;
  communityCode: string;
  communityLabel: string;
}

function resolvePlaceName(input: {
  scope: CountryDiscoveryScope;
  countryName: string;
  regionLabel: string;
  communityLabel: string;
}): string {
  if (input.scope === "city" && input.communityLabel) {
    return input.communityLabel;
  }

  if (input.scope === "region" && input.regionLabel) {
    return input.regionLabel;
  }

  return input.countryName;
}

export function CountryCivicActionSection({
  countryCode,
  countryName,
  regionCode,
  regionLabel,
  communityCode,
  communityLabel,
}: CountryCivicActionSectionProps) {
  const t = useTranslations("publicGeo.country.action");
  const scope = resolveCountryDiscoveryScope({ regionCode, communityCode });
  const placeName = resolvePlaceName({
    scope,
    countryName,
    regionLabel,
    communityLabel,
  });

  const heading =
    scope === "country"
      ? t("countryTitle")
      : t("scopedTitle", { placeName });

  const railTitles =
    scope === "city"
      ? {
          initiatives: t("rails.cityInitiatives"),
          elections: t("rails.cityElections"),
        }
      : scope === "region"
        ? {
            initiatives: t("rails.regionInitiatives"),
            elections: t("rails.regionElections"),
          }
        : {
            initiatives: t("rails.countryInitiatives"),
            elections: t("rails.countryElections"),
          };

  const [initiatives, setInitiatives] = useState<WorldInitiativeCardProjection[]>([]);
  const [elections, setElections] = useState<WorldInitiativeCardProjection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const query = {
      regionCode: regionCode || undefined,
      communityCode: communityCode || undefined,
    };

    void Promise.all([
      fetchCountryInitiatives(countryCode, { ...query, lifecycleProfile: "STANDARD" }),
      fetchCountryInitiatives(countryCode, { ...query, lifecycleProfile: "PUBLIC_CHOICE" }),
    ])
      .then(([standardItems, publicChoiceItems]) => {
        if (cancelled) {
          return;
        }

        setInitiatives(standardItems);
        setElections(publicChoiceItems);
        setError(false);
      })
      .catch(() => {
        if (!cancelled) {
          setInitiatives([]);
          setElections([]);
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [countryCode, regionCode, communityCode]);

  const viewAllHref = buildSearchUrlForGeographyScope({
    countrySlug: countryCode,
    regionSlug: regionCode || undefined,
    communitySlug: communityCode || undefined,
  });

  const sectionIdBase = `country-action-${countryCode.toLowerCase()}-${scope}`;

  return (
    <section
      className="country-experience-dynamic__section country-civic-action"
      aria-labelledby="country-civic-action-heading"
      aria-busy={loading}
    >
      <header className="country-civic-action__header">
        <p className="country-civic-action__eyebrow">{t("eyebrow")}</p>
        <h2 id="country-civic-action-heading">{heading}</h2>
        <p className="country-civic-action__description">
          {scope === "country"
            ? t("descriptionCountry", { countryName })
            : t("descriptionScoped", { placeName })}
        </p>
        {error ? (
          <p className="country-civic-action__error" role="status">
            {t("unavailable")}
          </p>
        ) : null}
      </header>

      <HuxDiscoverySection
        sectionId={`${sectionIdBase}-initiatives`}
        surfaceStyle="grouped"
        title={railTitles.initiatives}
        label={railTitles.initiatives}
        items={initiatives}
        getItemKey={(initiative) => initiative.initiativeId}
        renderItem={(initiative) => <CountryInitiativeRailCard initiative={initiative} />}
        emptyState={
          <p className="country-civic-action__empty" role="status">
            {loading
              ? t("loadingInitiatives")
              : t("emptyInitiatives", { placeName })}
          </p>
        }
        footerAction={
          initiatives.length > 0 ? (
            <Link href={`${viewAllHref}&lifecycleProfile=STANDARD`}>
              {t("viewAll", { rail: railTitles.initiatives })}
            </Link>
          ) : undefined
        }
      />

      <HuxDiscoverySection
        sectionId={`${sectionIdBase}-elections`}
        surfaceStyle="grouped"
        title={railTitles.elections}
        label={railTitles.elections}
        items={elections}
        getItemKey={(initiative) => initiative.initiativeId}
        renderItem={(initiative) => <CountryElectionRailCard initiative={initiative} />}
        emptyState={
          <p className="country-civic-action__empty" role="status">
            {loading ? t("loadingElections") : t("emptyElections", { placeName })}
          </p>
        }
        footerAction={
          elections.length > 0 ? (
            <Link href={`${viewAllHref}&lifecycleProfile=PUBLIC_CHOICE`}>
              {t("viewAll", { rail: railTitles.elections })}
            </Link>
          ) : undefined
        }
      />
    </section>
  );
}
