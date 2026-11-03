"use client";

import { useEffect, useState } from "react";

import type { AdminSeoViewId } from "../admin-seo-console-model";
import { fetchAdminSearchPerformance } from "../admin-seo-search-performance-api";
import {
  formatSearchCount,
  formatSearchCtr,
  formatSearchDayRange,
  formatSearchPosition,
  summarizeSearchVisibility,
  type SearchVisibilitySummary,
} from "../admin-seo-search-performance-model";
import { AdminSeoRadialIndicator } from "./AdminSeoRadialIndicator";

import "./admin-seo-diagnostics.css";
import "./admin-seo-search-performance.css";

export type SearchVisibilityState =
  | { readonly kind: "loading" }
  | { readonly kind: "error" }
  | { readonly kind: "ready"; readonly summary: SearchVisibilitySummary };

interface AdminSeoSearchVisibilityCardProps {
  onNavigate?: (view: AdminSeoViewId) => void;
}

/** SEO-12B.2 — Overview "Search visibility" from the 28-day search performance response. */
export function AdminSeoSearchVisibilityCard({ onNavigate }: AdminSeoSearchVisibilityCardProps) {
  const [state, setState] = useState<SearchVisibilityState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void fetchAdminSearchPerformance("28d")
      .then((response) => {
        if (!cancelled) {
          setState({ kind: "ready", summary: summarizeSearchVisibility(response) });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ kind: "error" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <SearchVisibilityCardContent state={state} onNavigate={onNavigate} />;
}

export function SearchVisibilityCardContent({
  state,
  onNavigate,
}: {
  state: SearchVisibilityState;
  onNavigate?: (view: AdminSeoViewId) => void;
}) {
  const summary = state.kind === "ready" ? state.summary : null;
  const anyData = summary?.anyData ?? false;

  return (
    <section
      className={
        anyData
          ? "admin-seo-overview__card admin-seo-visibility admin-seo-visibility--figures"
          : "admin-seo-overview__card admin-seo-visibility"
      }
      aria-labelledby="seo-visibility-title"
      aria-busy={state.kind === "loading"}
    >
      {anyData ? null : (
        <AdminSeoRadialIndicator label="Search visibility" percent={null} size="large" />
      )}
      <div>
        <h2 className="admin-seo-overview__card-title" id="seo-visibility-title">
          Search visibility
        </h2>
        {state.kind === "loading" ? (
          <p className="admin-seo-overview__note" role="status">
            Loading search performance…
          </p>
        ) : null}
        {state.kind === "error" ? (
          <p className="admin-seo-overview__note">
            No data. Search performance could not be loaded. No visibility figure is estimated.
          </p>
        ) : null}
        {summary && !anyData ? (
          <p className="admin-seo-overview__note">
            No data. Google Search Console and Bing Webmaster Tools have not reported search
            statistics yet. No visibility figure is estimated.
          </p>
        ) : null}
        {summary ? (
          <ul className="admin-seo-overview__facts admin-seo-visibility__providers">
            {summary.providers.map((provider) => (
              <li key={provider.provider}>
                <strong>{provider.label}</strong>{" "}
                <span
                  className={`admin-seo-diagnostics__badge admin-seo-diagnostics__badge--${provider.status.badge}`}
                >
                  {provider.status.label}
                </span>
                {provider.kpis ? (
                  <span className="admin-seo-visibility__figures">
                    {formatSearchCount(provider.kpis.clicks)} clicks ·{" "}
                    {formatSearchCount(provider.kpis.impressions)} impressions · CTR{" "}
                    {formatSearchCtr(provider.kpis.ctr)}
                    {provider.kpis.ctrSource === "calculated" ? " (calculated)" : ""} · Position{" "}
                    {formatSearchPosition(provider.kpis.position)}
                    <span className="admin-seo-visibility__range">
                      {formatSearchDayRange(provider.kpis.startDay, provider.kpis.endDay)}
                    </span>
                  </span>
                ) : (
                  <span className="admin-seo-visibility__figures">No data</span>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        {anyData ? (
          <p className="admin-seo-overview__note">
            Reported by each provider separately; Google and Bing figures are not combined and no
            visibility percentage is calculated.
          </p>
        ) : null}
        {onNavigate ? (
          <button
            type="button"
            className="hu-tab-control admin-publishing__tab"
            onClick={() => onNavigate("search-performance")}
          >
            Open Search performance
          </button>
        ) : null}
      </div>
    </section>
  );
}
