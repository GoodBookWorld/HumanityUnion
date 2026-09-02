"use client";

import { useState, type RefObject } from "react";
import { useTranslations } from "next-intl";

import { CitySelect, CountrySelect, RegionSelect } from "../../geography-integrity";
import { INITIATIVE_ACTIVITY_AREA_OPTIONS } from "../../initiatives/initiative-activity-areas";
import { resolveActivityAreaDisplayLabel } from "../../public-initiative-experience/initiative-experience-i18n";
import { type CivicArchiveDraftFilters, validateArchiveYearInput } from "../civic-archive-query";

interface CivicArchiveFiltersFormProps {
  draftFilters: CivicArchiveDraftFilters;
  onDraftChange: (next: CivicArchiveDraftFilters) => void;
  onSearch: () => void;
  onClearFilters: () => void;
  emptySearchFeedback?: string | null;
  searchFieldRef?: RefObject<HTMLInputElement | null>;
}

export function CivicArchiveFiltersForm({
  draftFilters,
  onDraftChange,
  onSearch,
  onClearFilters,
  emptySearchFeedback = null,
  searchFieldRef,
}: CivicArchiveFiltersFormProps) {
  const t = useTranslations("initiativeExperience");
  const [archiveYearError, setArchiveYearError] = useState<string | null>(null);

  function updateDraft(patch: Partial<CivicArchiveDraftFilters>): void {
    onDraftChange({ ...draftFilters, ...patch });
  }

  function handleCountryChange(nextCountry: string): void {
    onDraftChange({
      ...draftFilters,
      countryCode: nextCountry,
      regionId: "",
      cityCommunityId: "",
    });
  }

  function handleRegionChange(nextRegion: string): void {
    onDraftChange({
      ...draftFilters,
      regionId: nextRegion,
      cityCommunityId: "",
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const yearError = validateArchiveYearInput(draftFilters.archiveYear);
    setArchiveYearError(yearError);

    if (yearError) {
      return;
    }

    onSearch();
  }

  return (
    <form className="civic-archive-page__filters" onSubmit={handleSubmit}>
      <div className="civic-archive-page__filters-primary">
        <label className="civic-archive-page__search-field">
          <span>{t("civicArchivePublic.filters.search")}</span>
          <input
            ref={searchFieldRef}
            className="hu-form-control"
            value={draftFilters.q}
            onChange={(event) => updateDraft({ q: event.target.value })}
            placeholder={t("civicArchivePublic.filters.searchPlaceholder")}
          />
        </label>
        <div className="hu-form-actions civic-archive-page__filter-actions">
          <button type="submit" className="hu-button hu-button--primary">
            {t("civicArchivePublic.filters.submit")}
          </button>
          <button type="button" className="hu-button hu-button--secondary" onClick={onClearFilters}>
            {t("civicArchivePublic.filters.clearFilters")}
          </button>
        </div>
      </div>

      {emptySearchFeedback ? (
        <p className="civic-archive-page__empty-search-feedback" role="status">
          {emptySearchFeedback}
        </p>
      ) : null}

      <div className="civic-archive-page__filters-row civic-archive-page__filters-row--geography">
        <CountrySelect
          id="civic-archive-country"
          value={draftFilters.countryCode}
          onChange={handleCountryChange}
        />
        <RegionSelect
          id="civic-archive-region"
          countryCode={draftFilters.countryCode}
          value={draftFilters.regionId}
          includeOther={false}
          onChange={handleRegionChange}
        />
        <CitySelect
          id="civic-archive-community"
          countryCode={draftFilters.countryCode}
          regionCode={draftFilters.regionId}
          value={draftFilters.cityCommunityId}
          includeOther={false}
          onChange={(value) => updateDraft({ cityCommunityId: value })}
        />
      </div>

      <div className="civic-archive-page__filters-row civic-archive-page__filters-row--filters">
        <label>
          <span>{t("civicArchivePublic.filters.activityArea")}</span>
          <select
            className="hu-form-control"
            value={draftFilters.activityArea}
            onChange={(event) => updateDraft({ activityArea: event.target.value })}
          >
            <option value="">{t("civicArchivePublic.filters.allActivityAreas")}</option>
            {INITIATIVE_ACTIVITY_AREA_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {resolveActivityAreaDisplayLabel(option, t)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t("civicArchivePublic.filters.archiveYear")}</span>
          <input
            className="hu-form-control"
            value={draftFilters.archiveYear}
            onChange={(event) => {
              updateDraft({ archiveYear: event.target.value });
              setArchiveYearError(null);
            }}
            placeholder={t("civicArchivePublic.filters.yearPlaceholder")}
            inputMode="numeric"
            aria-invalid={archiveYearError ? true : undefined}
          />
          {archiveYearError ? (
            <span className="civic-archive-page__field-error">{archiveYearError}</span>
          ) : null}
        </label>
        <label>
          <span>{t("civicArchivePublic.filters.outcomeStatus")}</span>
          <select
            className="hu-form-control"
            value={draftFilters.outcomeStatus}
            onChange={(event) => updateDraft({ outcomeStatus: event.target.value })}
          >
            <option value="">{t("civicArchivePublic.filters.allOutcomes")}</option>
            <option value="completed">{t("civicArchivePublic.outcomes.completed")}</option>
            <option value="partially_implemented">
              {t("civicArchivePublic.outcomes.partially_implemented")}
            </option>
            <option value="concluded_without_implementation">
              {t("civicArchivePublic.outcomes.concluded_without_implementation")}
            </option>
            <option value="cancelled">{t("civicArchivePublic.outcomes.cancelled")}</option>
            <option value="superseded">{t("civicArchivePublic.outcomes.superseded")}</option>
          </select>
        </label>
      </div>
    </form>
  );
}
