"use client";

import { useCallback, useEffect, useState } from "react";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { formatAuthFormError } from "../../../lib/api-client";
import { fetchAdminSearchPerformance } from "../admin-seo-search-performance-api";
import {
  SEARCH_PERFORMANCE_PERIOD_OPTIONS,
  SEARCH_PERFORMANCE_PROVIDERS,
  SEARCH_PROVIDER_LABELS,
  type AdminSearchPerformanceResponse,
  type SearchPerformancePeriod,
} from "../admin-seo-search-performance-model";
import { AdminSeoSearchProviderPanel } from "./AdminSeoSearchProviderPanel";

import "./admin-insights.css";
import "./admin-traffic.css";
import "./admin-seo-diagnostics.css";
import "./admin-seo-search-performance.css";

/** SEO-12B.2 — Admin → SEO → Search performance (real Google and Bing data only). */
export function AdminSeoSearchPerformanceView() {
  const [period, setPeriod] = useState<SearchPerformancePeriod>("28d");
  const [data, setData] = useState<AdminSearchPerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchAdminSearchPerformance(period)
      .then((response) => {
        if (!cancelled) {
          setData(response);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setData(null);
          setError(formatAuthFormError(reason));
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
  }, [period, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return (
    <div className="admin-seo-console__panel admin-seo-search">
      <p className="hu-body admin-panel__note">
        Search results data reported by Google Search Console and Bing Webmaster Tools. The two
        providers are shown separately and never added together. Days without a provider value show
        as No data, not zero.
      </p>

      <div className="admin-traffic__period" role="group" aria-label="Search performance period">
        <span className="admin-traffic__period-label">Period</span>
        <div className="admin-traffic__period-options">
          {SEARCH_PERFORMANCE_PERIOD_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={
                period === option.id
                  ? "admin-traffic__period-btn admin-traffic__period-btn--active"
                  : "admin-traffic__period-btn"
              }
              aria-pressed={period === option.id}
              onClick={() => setPeriod(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="hu-caption admin-panel__note" role="status">
          Loading search performance…
        </p>
      ) : null}

      {error ? (
        <div className="admin-traffic__unavailable" role="alert">
          <p>Search performance could not be loaded: {error}</p>
          <button type="button" className="hu-tab-control admin-publishing__tab" onClick={retry}>
            Try again
          </button>
        </div>
      ) : null}

      {data && !error ? (
        <div aria-busy={loading}>
          {!data.syncEnabled ? (
            <p className="hu-caption admin-panel__note">
              The daily sync is turned off on this API service, so no new data is collected.
            </p>
          ) : null}
          {SEARCH_PERFORMANCE_PROVIDERS.map((provider) => (
            <ProfileSection
              key={provider}
              id={`seo-search-${provider}`}
              title={SEARCH_PROVIDER_LABELS[provider]}
            >
              <AdminSeoSearchProviderPanel
                view={data.providers[provider]}
                syncEnabled={data.syncEnabled}
              />
            </ProfileSection>
          ))}
        </div>
      ) : null}
    </div>
  );
}
