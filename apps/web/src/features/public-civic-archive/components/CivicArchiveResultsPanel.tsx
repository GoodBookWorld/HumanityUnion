import { getCountryLabel, getRegionLabel } from "@hu/geography";
import {
  CIVIC_ARCHIVE_IDLE_INSTRUCTION,
  CIVIC_ARCHIVE_NO_MATCH_MESSAGE,
  type CivicArchiveAppliedFilters,
  type CivicArchiveResultsStatus,
} from "../civic-archive-query";
import type { CivicArchiveLifecycleRecord } from "@hu/types";

import { CivicArchiveHorizontalResults } from "./CivicArchiveHorizontalResults";

import "./civic-archive-results.css";

interface CivicArchiveResultsPanelProps {
  records: CivicArchiveLifecycleRecord[];
  total: number;
  appliedFilters: CivicArchiveAppliedFilters;
  status: CivicArchiveResultsStatus;
  onClearFilters: () => void;
  onAdjustSearch: () => void;
}

function formatOutcomeStatusLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function ActiveFilterChips({ filters }: { filters: CivicArchiveAppliedFilters }) {
  const chips = [
    filters.q ? { key: "q", label: filters.q } : null,
    filters.countryCode
      ? {
          key: "countryCode",
          label: getCountryLabel(filters.countryCode) ?? filters.countryCode,
        }
      : null,
    filters.regionId && filters.countryCode
      ? {
          key: "regionId",
          label: getRegionLabel(filters.countryCode, filters.regionId) ?? filters.regionId,
        }
      : null,
    filters.cityCommunityId ? { key: "cityCommunityId", label: filters.cityCommunityId } : null,
    filters.activityArea ? { key: "activityArea", label: filters.activityArea } : null,
    filters.archiveYear ? { key: "archiveYear", label: String(filters.archiveYear) } : null,
    filters.outcomeStatus
      ? { key: "outcomeStatus", label: formatOutcomeStatusLabel(filters.outcomeStatus) }
      : null,
  ].filter((chip): chip is { key: string; label: string } => Boolean(chip));

  if (chips.length === 0) {
    return null;
  }

  return (
    <ul className="civic-archive-page__filter-chips" aria-label="Active archive filters">
      {chips.map((chip) => (
        <li key={chip.key}>
          <span className="civic-archive-page__filter-chip">{chip.label}</span>
        </li>
      ))}
    </ul>
  );
}

export function CivicArchiveResultsPanel({
  records,
  total,
  appliedFilters,
  status,
  onClearFilters,
  onAdjustSearch,
}: CivicArchiveResultsPanelProps) {
  const showResultCount = status === "success" || status === "empty";
  const showFilterChips = status === "success" || status === "empty" || status === "loading";

  return (
    <section
      id="civic-archive-results"
      className="civic-archive-page__results"
      aria-labelledby="civic-archive-results-title"
      aria-busy={status === "loading" || undefined}
    >
      <header className="civic-archive-page__results-header">
        <h2
          id="civic-archive-results-title"
          className="civic-archive-page__results-title"
          tabIndex={-1}
        >
          Civic Archive Results
        </h2>
        {showResultCount ? (
          <p className="civic-archive-page__results-count" aria-live="polite">
            {total} result{total === 1 ? "" : "s"}
          </p>
        ) : null}
        {showFilterChips ? <ActiveFilterChips filters={appliedFilters} /> : null}
      </header>

      <div className="civic-archive-page__results-body">
        {status === "idle" ? (
          <div className="civic-archive-page__results-state civic-archive-page__results-state--idle">
            <p>{CIVIC_ARCHIVE_IDLE_INSTRUCTION}</p>
          </div>
        ) : null}

        {status === "error" ? (
          <div className="civic-archive-page__results-state" role="alert">
            <h3>The Civic Archive is temporarily unavailable.</h3>
            <p>Please check that the API is running and try again.</p>
            <button
              type="button"
              className="hu-button hu-button--secondary"
              onClick={onAdjustSearch}
            >
              Try Again
            </button>
          </div>
        ) : null}

        {status === "loading" ? <CivicArchiveHorizontalResults records={[]} loading /> : null}

        {status === "empty" ? (
          <div className="civic-archive-page__results-state">
            <p>{CIVIC_ARCHIVE_NO_MATCH_MESSAGE}</p>
            <div className="hu-form-actions">
              <button
                type="button"
                className="hu-button hu-button--secondary"
                onClick={onClearFilters}
              >
                Clear Filters
              </button>
              <button
                type="button"
                className="hu-button hu-button--primary"
                onClick={onAdjustSearch}
              >
                Adjust Search
              </button>
            </div>
          </div>
        ) : null}

        {status === "success" ? <CivicArchiveHorizontalResults records={records} /> : null}
      </div>
    </section>
  );
}

export function CivicArchiveResultsPanelSkeleton() {
  return (
    <section
      id="civic-archive-results"
      className="civic-archive-page__results"
      aria-busy="true"
      aria-label="Loading civic archive results"
    >
      <header className="civic-archive-page__results-header">
        <h2 className="civic-archive-page__results-title">Civic Archive Results</h2>
      </header>
      <div className="civic-archive-page__results-body">
        <div className="civic-archive-page__results-state civic-archive-page__results-state--idle">
          <p>{CIVIC_ARCHIVE_IDLE_INSTRUCTION}</p>
        </div>
      </div>
    </section>
  );
}
