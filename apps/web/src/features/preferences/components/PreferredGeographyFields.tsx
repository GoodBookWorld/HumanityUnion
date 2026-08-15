"use client";

import type { ParticipationPreferences } from "@hu/types";
import { useEffect, useMemo, useState } from "react";

import {
  buildPreferredCityCommunityLabel,
  buildPreferredRegionLabel,
  fetchCommunitiesByRegion,
  formatPreferredCityCommunityId,
  formatPreferredRegionId,
  GEOGRAPHY_COUNTRIES,
  getRegionsForCountry,
  parsePreferredCityCommunityId,
  parsePreferredRegionId,
  sanitizeParticipationGeography,
  toGeographyCommunityOptions,
} from "@hu/geography";
import { Button } from "../../../design-system/components/Button";
import {
  GeographySearchSelect,
  OTHER_REGION_SLUG,
} from "../../../design-system/components/GeographySearchSelect";
import { GeographyMultiSelect } from "../../../design-system/components/GeographyMultiSelect";
import { HuFeedbackMessage } from "../../../design-system/components/HuFeedbackMessage";

interface PreferredGeographyFieldsProps {
  participationPreferences: ParticipationPreferences;
  onChange: (next: ParticipationPreferences) => void;
}

function toggleValue(values: string[], value: string, checked: boolean): string[] {
  if (checked) {
    return values.includes(value) ? values : [...values, value];
  }

  return values.filter((entry) => entry !== value);
}

export function PreferredGeographyFields({
  participationPreferences,
  onChange,
}: PreferredGeographyFieldsProps) {
  const [regionCountryCode, setRegionCountryCode] = useState("");
  const [regionCode, setRegionCode] = useState("");
  const [communityOptions, setCommunityOptions] = useState<{ slug: string; label: string }[]>([]);
  const [communitiesLoading, setCommunitiesLoading] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);

  const { preferredCountryIds, preferredRegions, preferredCityCommunityIds } =
    participationPreferences;

  const countryOptions = useMemo(() => {
    if (preferredCountryIds.length === 0) {
      return GEOGRAPHY_COUNTRIES;
    }

    const allowed = new Set(preferredCountryIds);
    return GEOGRAPHY_COUNTRIES.filter((country) => allowed.has(country.slug));
  }, [preferredCountryIds]);

  const regionPickerOptions = useMemo(
    () => (regionCountryCode ? getRegionsForCountry(regionCountryCode) : []),
    [regionCountryCode],
  );

  const selectedRegionEntries = useMemo(
    () =>
      preferredRegions.map((regionId) => ({
        id: regionId,
        label: buildPreferredRegionLabel(regionId),
      })),
    [preferredRegions],
  );

  useEffect(() => {
    if (preferredRegions.length === 0) {
      setCommunityOptions([]);
      return;
    }

    let cancelled = false;
    setCommunitiesLoading(true);

    void Promise.all(
      preferredRegions.map(async (regionId) => {
        const parsed =
          parsePreferredRegionId(regionId) ??
          (preferredCountryIds.length === 1
            ? {
                countryCode: preferredCountryIds[0] ?? "",
                regionCode: regionId,
              }
            : null);

        if (!parsed?.countryCode || !parsed.regionCode || parsed.regionCode === OTHER_REGION_SLUG) {
          return [] as {
            slug: string;
            label: string;
            communityName: string;
            countryCode: string;
            regionCode: string;
          }[];
        }

        const communities = await fetchCommunitiesByRegion(parsed.countryCode, parsed.regionCode);
        return toGeographyCommunityOptions(
          parsed.countryCode,
          parsed.regionCode,
          communities,
          false,
        ).map((community) => ({
          slug: formatPreferredCityCommunityId(
            parsed.countryCode,
            parsed.regionCode,
            community.slug,
          ),
          label: community.label,
          communityName: community.label,
          countryCode: parsed.countryCode,
          regionCode: parsed.regionCode,
        }));
      }),
    )
      .then((groups) => {
        if (cancelled) {
          return;
        }

        const flattened = groups.flat();
        const nameCounts = new Map<string, number>();

        for (const option of flattened) {
          const key = option.communityName.trim().toLowerCase();
          nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
        }

        const ambiguousCommunityNames = new Set(
          [...nameCounts.entries()].filter(([, count]) => count > 1).map(([name]) => name),
        );

        const nextOptions = flattened.map((option) => ({
          slug: option.slug,
          label: buildPreferredCityCommunityLabel({
            countryCode: option.countryCode,
            regionCode: option.regionCode,
            communityName: option.communityName,
            ambiguousCommunityNames,
          }),
        }));

        const selectedOptions = preferredCityCommunityIds
          .map((cityCommunityId) => {
            const existing = nextOptions.find((option) => option.slug === cityCommunityId);

            if (existing) {
              return existing;
            }

            const parsed = parsePreferredCityCommunityId(cityCommunityId);

            if (!parsed) {
              return {
                slug: cityCommunityId,
                label: cityCommunityId,
              };
            }

            return {
              slug: cityCommunityId,
              label: buildPreferredCityCommunityLabel({
                countryCode: parsed.countryCode,
                regionCode: parsed.regionCode,
                communityName: parsed.communityCode,
                ambiguousCommunityNames,
              }),
            };
          })
          .filter(
            (option, index, options) =>
              options.findIndex((candidate) => candidate.slug === option.slug) === index,
          );

        setCommunityOptions(
          [...nextOptions, ...selectedOptions].filter(
            (option, index, options) =>
              options.findIndex((candidate) => candidate.slug === option.slug) === index,
          ),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setCommunityOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCommunitiesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [preferredCityCommunityIds, preferredCountryIds, preferredRegions]);

  function applyParticipationChange(next: ParticipationPreferences, showCleanup = true) {
    const sanitized = sanitizeParticipationGeography(next);
    const removedCount = sanitized.removedCityCount + sanitized.removedRegionCount;

    if (showCleanup && removedCount > 0) {
      setCleanupMessage(
        "Some cities were removed because their country or region is no longer selected.",
      );
    }

    onChange(sanitized.participationPreferences);
  }

  function handlePreferredCountriesChange(nextCountryIds: string[]) {
    applyParticipationChange({
      ...participationPreferences,
      preferredCountryIds: nextCountryIds,
    });
  }

  function handleAddPreferredRegion() {
    if (!regionCountryCode || !regionCode || regionCode === OTHER_REGION_SLUG) {
      return;
    }

    applyParticipationChange(
      {
        ...participationPreferences,
        preferredCountryIds: toggleValue(preferredCountryIds, regionCountryCode, true),
        preferredRegions: toggleValue(
          preferredRegions,
          formatPreferredRegionId(regionCountryCode, regionCode),
          true,
        ),
      },
      false,
    );
    setRegionCode("");
  }

  function handleRemovePreferredRegion(regionId: string) {
    applyParticipationChange({
      ...participationPreferences,
      preferredRegions: preferredRegions.filter((entry) => entry !== regionId),
    });
  }

  function handlePreferredCitiesChange(nextCityCommunityIds: string[]) {
    onChange({
      ...participationPreferences,
      preferredCityCommunityIds: nextCityCommunityIds,
    });
  }

  const citiesDisabled = preferredRegions.length === 0;
  const citiesHelperText = citiesDisabled
    ? "Select at least one preferred region to choose Cities / Communities."
    : communitiesLoading
      ? "Loading cities and communities for your selected regions…"
      : communityOptions.length === 0
        ? "No Cities / Communities are available for this region."
        : "Select cities or communities within your preferred regions to receive more locally relevant initiative recommendations and notifications.";

  return (
    <>
      <div className="preferences-workspace__field">
        <GeographyMultiSelect
          id="preferences-preferred-countries"
          label="Preferred Countries"
          helperText="Select countries where you want civic activity recommendations and notifications."
          values={preferredCountryIds}
          options={GEOGRAPHY_COUNTRIES}
          onChange={handlePreferredCountriesChange}
          placeholder="Search countries…"
        />
      </div>

      <div className="preferences-workspace__field">
        <span className="preferences-workspace__field-label">Preferred regions</span>
        <GeographySearchSelect
          id="preferences-preferred-region-country"
          label="Country"
          value={regionCountryCode}
          options={countryOptions}
          onChange={(nextCountry) => {
            setRegionCountryCode(nextCountry);
            setRegionCode("");
          }}
        />
        <GeographySearchSelect
          id="preferences-preferred-region"
          label="Administrative region"
          value={regionCode}
          options={regionPickerOptions}
          onChange={setRegionCode}
          disabled={!regionCountryCode}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={!regionCode || regionCode === OTHER_REGION_SLUG}
          onClick={handleAddPreferredRegion}
        >
          Add preferred region
        </Button>
        {selectedRegionEntries.length > 0 ? (
          <ul className="preferences-workspace__region-list">
            {selectedRegionEntries.map((region) => (
              <li key={region.id}>
                {region.label}
                <button type="button" onClick={() => handleRemovePreferredRegion(region.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="preferences-workspace__helper">No preferred regions selected yet.</p>
        )}
      </div>

      <div className="preferences-workspace__field">
        <GeographyMultiSelect
          id="preferences-preferred-cities"
          label="Preferred Cities / Communities"
          helperText={citiesHelperText}
          values={preferredCityCommunityIds}
          options={communityOptions}
          onChange={handlePreferredCitiesChange}
          disabled={citiesDisabled || communitiesLoading || communityOptions.length === 0}
          placeholder="Search cities or communities…"
        />
      </div>

      {cleanupMessage ? (
        <HuFeedbackMessage variant="warning" title="Geography preferences updated">
          {cleanupMessage}
        </HuFeedbackMessage>
      ) : null}
    </>
  );
}
