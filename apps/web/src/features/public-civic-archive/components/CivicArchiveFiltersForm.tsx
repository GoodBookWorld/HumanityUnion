"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";

import {
  fetchCommunitiesByRegion,
  toGeographyCountryOptions,
  toGeographyRegionOptions,
} from "@hu/geography";
import { GeographySearchSelect } from "../../../design-system/components/GeographySearchSelect";
import { INITIATIVE_ACTIVITY_AREA_OPTIONS } from "../../initiatives/initiative-activity-areas";
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
  const [communityOptions, setCommunityOptions] = useState<Array<{ slug: string; label: string }>>(
    [],
  );
  const [archiveYearError, setArchiveYearError] = useState<string | null>(null);

  const countryOptions = useMemo(() => toGeographyCountryOptions(), []);
  const regionOptions = useMemo(
    () =>
      draftFilters.countryCode ? toGeographyRegionOptions(draftFilters.countryCode, false) : [],
    [draftFilters.countryCode],
  );

  useEffect(() => {
    if (!draftFilters.countryCode) {
      setCommunityOptions([]);
      return;
    }

    if (draftFilters.regionId) {
      void fetchCommunitiesByRegion(draftFilters.countryCode, draftFilters.regionId)
        .then((communities) =>
          setCommunityOptions(
            communities.map((entry) => ({
              slug: entry.code,
              label: entry.name,
            })),
          ),
        )
        .catch(() => setCommunityOptions([]));
      return;
    }

    const regions = toGeographyRegionOptions(draftFilters.countryCode, false);

    void Promise.all(
      regions.map((regionOption) =>
        fetchCommunitiesByRegion(draftFilters.countryCode, regionOption.slug).then((communities) =>
          communities.map((entry) => ({
            slug: entry.code,
            label: `${entry.name} (${regionOption.label})`,
          })),
        ),
      ),
    )
      .then((groups) => {
        const unique = new Map<string, { slug: string; label: string }>();

        for (const group of groups.flat()) {
          unique.set(group.slug, group);
        }

        setCommunityOptions([...unique.values()]);
      })
      .catch(() => setCommunityOptions([]));
  }, [draftFilters.countryCode, draftFilters.regionId]);

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
          <span>Search</span>
          <input
            ref={searchFieldRef}
            className="hu-form-control"
            value={draftFilters.q}
            onChange={(event) => updateDraft({ q: event.target.value })}
            placeholder="Search archive records"
          />
        </label>
        <div className="hu-form-actions">
          <button type="submit" className="hu-button hu-button--primary">
            Search
          </button>
          <button type="button" className="hu-button hu-button--secondary" onClick={onClearFilters}>
            Clear Filters
          </button>
        </div>
      </div>

      {emptySearchFeedback ? (
        <p className="civic-archive-page__empty-search-feedback" role="status">
          {emptySearchFeedback}
        </p>
      ) : null}

      <div className="civic-archive-page__filters-row civic-archive-page__filters-row--geography">
        <GeographySearchSelect
          id="civic-archive-country"
          label="Country"
          value={draftFilters.countryCode}
          options={countryOptions}
          onChange={handleCountryChange}
          placeholder="Search countries"
        />
        <GeographySearchSelect
          id="civic-archive-region"
          label="Region"
          value={draftFilters.regionId}
          options={regionOptions}
          onChange={handleRegionChange}
          disabled={!draftFilters.countryCode}
          placeholder="Search regions"
          helperText={!draftFilters.countryCode ? "Select a country first." : undefined}
        />
        <GeographySearchSelect
          id="civic-archive-community"
          label="City / Community"
          value={draftFilters.cityCommunityId}
          options={communityOptions}
          onChange={(value) => updateDraft({ cityCommunityId: value })}
          disabled={!draftFilters.countryCode}
          placeholder="Search cities and communities"
          helperText={!draftFilters.countryCode ? "Select a country first." : undefined}
        />
      </div>

      <div className="civic-archive-page__filters-row civic-archive-page__filters-row--filters">
        <label>
          <span>Activity area</span>
          <select
            className="hu-form-control"
            value={draftFilters.activityArea}
            onChange={(event) => updateDraft({ activityArea: event.target.value })}
          >
            <option value="">All activity areas</option>
            {INITIATIVE_ACTIVITY_AREA_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Archive year</span>
          <input
            className="hu-form-control"
            value={draftFilters.archiveYear}
            onChange={(event) => {
              updateDraft({ archiveYear: event.target.value });
              setArchiveYearError(null);
            }}
            placeholder="YYYY"
            inputMode="numeric"
            aria-invalid={archiveYearError ? true : undefined}
          />
          {archiveYearError ? (
            <span className="civic-archive-page__field-error">{archiveYearError}</span>
          ) : null}
        </label>
        <label>
          <span>Outcome status</span>
          <select
            className="hu-form-control"
            value={draftFilters.outcomeStatus}
            onChange={(event) => updateDraft({ outcomeStatus: event.target.value })}
          >
            <option value="">All outcomes</option>
            <option value="completed">Completed</option>
            <option value="partially_implemented">Partially implemented</option>
            <option value="concluded_without_implementation">
              Concluded without implementation
            </option>
            <option value="cancelled">Cancelled</option>
            <option value="superseded">Superseded</option>
          </select>
        </label>
      </div>
    </form>
  );
}
