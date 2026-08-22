"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

function resolveActionHeading(input: {
  scope: CountryDiscoveryScope;
  countryName: string;
  regionLabel: string;
  communityLabel: string;
}): string {
  if (input.scope === "city" && input.communityLabel) {
    return `${input.communityLabel} Civic Action`;
  }

  if (input.scope === "region" && input.regionLabel) {
    return `${input.regionLabel} Civic Action`;
  }

  return "Country Action";
}

function resolveRailTitles(scope: CountryDiscoveryScope): {
  initiatives: string;
  elections: string;
} {
  if (scope === "city") {
    return { initiatives: "City Initiatives", elections: "City Elections" };
  }

  if (scope === "region") {
    return { initiatives: "Region Initiatives", elections: "Region Elections" };
  }

  return { initiatives: "Country Initiatives", elections: "Country Elections" };
}

function resolveEmptyPlaceName(input: {
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
  const scope = resolveCountryDiscoveryScope({ regionCode, communityCode });
  const heading = resolveActionHeading({
    scope,
    countryName,
    regionLabel,
    communityLabel,
  });
  const railTitles = resolveRailTitles(scope);
  const placeName = resolveEmptyPlaceName({
    scope,
    countryName,
    regionLabel,
    communityLabel,
  });

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
        <p className="country-civic-action__eyebrow">COUNTRY ACTION</p>
        <h2 id="country-civic-action-heading">{heading}</h2>
        <p className="country-civic-action__description">
          {scope === "country"
            ? `Public civic activity connected to ${countryName}.`
            : `Public civic activity in ${placeName}.`}
        </p>
        {error ? (
          <p className="country-civic-action__error" role="status">
            Civic activity is temporarily unavailable for this geography.
          </p>
        ) : null}
      </header>

      <HuxDiscoverySection
        sectionId={`${sectionIdBase}-initiatives`}
        surfaceStyle="grouped"
        title={railTitles.initiatives}
        label={railTitles.initiatives.toLowerCase()}
        items={initiatives}
        getItemKey={(initiative) => initiative.initiativeId}
        renderItem={(initiative) => <CountryInitiativeRailCard initiative={initiative} />}
        emptyState={
          <p className="country-civic-action__empty" role="status">
            {loading
              ? "Loading initiatives…"
              : `No initiatives found in ${placeName}.`}
          </p>
        }
        footerAction={
          initiatives.length > 0 ? (
            <Link href={`${viewAllHref}&lifecycleProfile=STANDARD`}>
              View all {railTitles.initiatives.toLowerCase()}
            </Link>
          ) : undefined
        }
      />

      <HuxDiscoverySection
        sectionId={`${sectionIdBase}-elections`}
        surfaceStyle="grouped"
        title={railTitles.elections}
        label={railTitles.elections.toLowerCase()}
        items={elections}
        getItemKey={(initiative) => initiative.initiativeId}
        renderItem={(initiative) => <CountryElectionRailCard initiative={initiative} />}
        emptyState={
          <p className="country-civic-action__empty" role="status">
            {loading ? "Loading elections…" : `No elections found in ${placeName}.`}
          </p>
        }
        footerAction={
          elections.length > 0 ? (
            <Link href={`${viewAllHref}&lifecycleProfile=PUBLIC_CHOICE`}>
              View all {railTitles.elections.toLowerCase()}
            </Link>
          ) : undefined
        }
      />
    </section>
  );
}
