"use client";

import type { ParticipationPreferences } from "@hu/types";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("preferences");
  const tGeo = useTranslations("initiativeExperience");
  const [regionCountryCode, setRegionCountryCode] = useState("");
  const [regionCode, setRegionCode] = useState("");
  const [communityOptions, setCommunityOptions] = useState<{ slug: string; label: string }[]>([]);
  const [communitiesLoading, setCommunitiesLoading] = useState(false);
  const [communitiesDeliveryFailed, setCommunitiesDeliveryFailed] = useState(false);
  const [communityStructuredCount, setCommunityStructuredCount] = useState(0);
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
      setCommunitiesDeliveryFailed(false);
      setCommunityStructuredCount(0);
      return;
    }

    let cancelled = false;
    setCommunitiesLoading(true);
    setCommunitiesDeliveryFailed(false);

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

        setCommunitiesDeliveryFailed(false);
        const flattened = groups.flat();
        setCommunityStructuredCount(flattened.length);
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
          setCommunitiesDeliveryFailed(true);
          setCommunityOptions([]);
          setCommunityStructuredCount(0);
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
      setCleanupMessage(t("geography.cleanupMessage"));
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
    ? t("geography.selectRegionFirst")
    : communitiesLoading
      ? tGeo("manage.geography.loadingCities")
      : communitiesDeliveryFailed
        ? tGeo("manage.geography.cityDeliveryFailure")
        : communityStructuredCount === 0
          ? tGeo("manage.geography.noCities")
          : t("geography.citiesMultiRegionHelp", { count: communityStructuredCount });

  return (
    <>
      <div className="preferences-workspace__field">
        <GeographyMultiSelect
          id="preferences-preferred-countries"
          label={t("geography.preferredCountries")}
          helperText={t("geography.preferredCountriesHelp")}
          values={preferredCountryIds}
          options={GEOGRAPHY_COUNTRIES}
          onChange={handlePreferredCountriesChange}
          placeholder={t("geography.searchCountries")}
        />
      </div>

      <div className="preferences-workspace__field">
        <span className="preferences-workspace__field-label">{t("geography.preferredRegions")}</span>
        <GeographySearchSelect
          id="preferences-preferred-region-country"
          label={t("geography.country")}
          value={regionCountryCode}
          options={countryOptions}
          onChange={(nextCountry) => {
            setRegionCountryCode(nextCountry);
            setRegionCode("");
          }}
        />
        <GeographySearchSelect
          id="preferences-preferred-region"
          label={t("geography.administrativeRegion")}
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
          {t("geography.addPreferredRegion")}
        </Button>
        {selectedRegionEntries.length > 0 ? (
          <ul className="preferences-workspace__region-list">
            {selectedRegionEntries.map((region) => (
              <li key={region.id}>
                {region.label}
                <button type="button" onClick={() => handleRemovePreferredRegion(region.id)}>
                  {t("geography.remove")}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="preferences-workspace__helper">{t("geography.noRegionsSelected")}</p>
        )}
      </div>

      <div className="preferences-workspace__field">
        <GeographyMultiSelect
          id="preferences-preferred-cities"
          label={t("geography.preferredCities")}
          helperText={citiesHelperText}
          values={preferredCityCommunityIds}
          options={communityOptions}
          onChange={handlePreferredCitiesChange}
          disabled={
            citiesDisabled ||
            communitiesLoading ||
            communitiesDeliveryFailed ||
            (communityStructuredCount === 0 && !communitiesLoading)
          }
          placeholder={tGeo("manage.geography.citySearchPlaceholder")}
          noMatchMessage={tGeo("manage.geography.noCityMatches")}
        />
      </div>

      {cleanupMessage ? (
        <HuFeedbackMessage variant="warning" title={t("geography.cleanupTitle")}>
          {cleanupMessage}
        </HuFeedbackMessage>
      ) : null}
    </>
  );
}
