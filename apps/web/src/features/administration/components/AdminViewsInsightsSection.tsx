"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { AuthUserPublic, TrafficInsightsPeriod, TrafficInsightsReport } from "@hu/types";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { fetchAdminTrafficInsights } from "../../traffic-analytics/traffic-analytics-api";
import { AdminPanelNavigation } from "./AdminPanelNavigation";
import { AdminViewsNavigation } from "./AdminViewsNavigation";
import { TrafficInsightsTrendChart } from "./TrafficInsightsTrendChart";

import "./admin-panel.css";
import "./admin-traffic.css";
import "./admin-insights.css";

interface AdminViewsInsightsSectionProps {
  user: AuthUserPublic;
}

const PERIODS: readonly { id: TrafficInsightsPeriod; label: string }[] = [
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
  { id: "12m", label: "12 months" },
  { id: "all", label: "All time" },
] as const;

function formatCollectionStart(iso: string | null): string {
  if (!iso) {
    return "Traffic recorded since analytics collection began";
  }
  const date = new Date(iso);
  const label = date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `Traffic recorded since ${label}`;
}

function formatChange(input: {
  percent: number | null;
  isNew: boolean;
}): string {
  if (input.isNew) {
    return "New activity";
  }
  if (input.percent === null) {
    return "—";
  }
  if (input.percent === 0) {
    return "0%";
  }
  const arrow = input.percent > 0 ? "↑" : "↓";
  return `${arrow} ${Math.abs(input.percent)}%`;
}

export function AdminViewsInsightsSection({ user: _user }: AdminViewsInsightsSectionProps) {
  const [period, setPeriod] = useState<TrafficInsightsPeriod>("30d");
  const [report, setReport] = useState<TrafficInsightsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setUnavailable(false);

    void fetchAdminTrafficInsights(period)
      .then((data) => {
        if (!cancelled) {
          setReport(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReport(null);
          setUnavailable(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [period]);

  const hasTrendData = Boolean(report?.trend.some((point) => point.views + point.visitors + point.sessions > 0));

  return (
    <div className="admin-panel">
      <AdminPanelNavigation />
      <AdminViewsNavigation />

      <ProfileSection title="Insights">
        <p className="hu-body admin-panel__note">
          Historical analytics from first-party traffic collection. Live short windows also appear
          on{" "}
          <Link className="admin-panel__link" href="/admin/views">
            Views → Traffic
          </Link>
          . Civic operational totals remain on{" "}
          <Link className="admin-panel__link" href="/admin">
            Admin Overview
          </Link>
          .
        </p>

        <div className="admin-traffic__period" role="group" aria-label="Insights period">
          <span className="admin-traffic__period-label">Period</span>
          <div className="admin-traffic__period-options">
            {PERIODS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={
                  period === entry.id
                    ? "admin-traffic__period-btn admin-traffic__period-btn--active"
                    : "admin-traffic__period-btn"
                }
                aria-pressed={period === entry.id}
                onClick={() => setPeriod(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="hu-caption admin-panel__note" role="status">
            Loading traffic insights…
          </p>
        ) : null}

        {unavailable ? (
          <p className="admin-traffic__unavailable" role="alert">
            Analytics unavailable
          </p>
        ) : null}

        {!loading && !unavailable && report ? (
          <>
            <h3 className="admin-traffic__section-title">All-time</h3>
            <p className="hu-caption admin-panel__note">
              {formatCollectionStart(report.allTime.collectionStartedAt)}
            </p>
            <ul className="admin-traffic__summary" aria-label="All-time traffic summary">
              <li className="admin-traffic__card">
                <p className="admin-traffic__card-label">All-time Views</p>
                <p className="admin-traffic__card-value">{report.allTime.views}</p>
              </li>
              <li className="admin-traffic__card admin-traffic__card--alt">
                <p className="admin-traffic__card-label">All-time Visitors</p>
                <p className="admin-traffic__card-value">{report.allTime.visitors}</p>
              </li>
              <li className="admin-traffic__card">
                <p className="admin-traffic__card-label">All-time Sessions</p>
                <p className="admin-traffic__card-value">{report.allTime.sessions}</p>
              </li>
            </ul>

            <h3 className="admin-traffic__section-title">Historical trends</h3>
            <p className="hu-caption admin-panel__note">
              {report.periodLabel}. Trend Visitors are daily unique visitors (not exact multi-day
              uniques). Exact unique Visitors appear under All-time.
              {report.comparison ? (
                <>
                  {" "}
                  · vs previous period: Views{" "}
                  {formatChange({
                    percent: report.comparison.viewsChangePercent,
                    isNew: report.comparison.viewsIsNew,
                  })}
                  , Daily unique visitors{" "}
                  {formatChange({
                    percent: report.comparison.visitorsChangePercent,
                    isNew: report.comparison.visitorsIsNew,
                  })}
                  , Sessions{" "}
                  {formatChange({
                    percent: report.comparison.sessionsChangePercent,
                    isNew: report.comparison.sessionsIsNew,
                  })}
                </>
              ) : null}
            </p>
            {hasTrendData ? (
              <TrafficInsightsTrendChart
                points={report.trend}
                emptyMessage="No traffic analytics have been collected for this period yet."
              />
            ) : (
              <p className="hu-caption">
                No traffic analytics have been collected for this period yet.
              </p>
            )}

            <h3 className="admin-traffic__section-title">Traffic geography</h3>
            {report.geography.length === 0 ? (
              <p className="hu-caption">
                No traffic analytics have been collected for this period yet.
              </p>
            ) : (
              <div className="admin-traffic__table-wrap">
                <table className="admin-traffic__table">
                  <thead>
                    <tr>
                      <th scope="col">Country</th>
                      <th scope="col">Views</th>
                      <th scope="col">Daily unique visitors</th>
                      <th scope="col">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.geography.map((row) => (
                      <tr key={row.countryCode ?? "unknown"}>
                        <td>
                          <div className="admin-insights-bar-row">
                            <span>{row.countryLabel}</span>
                            <span
                              className="admin-insights-bar"
                              style={{ width: `${Math.max(row.sharePercent, 2)}%` }}
                              aria-hidden="true"
                            />
                          </div>
                        </td>
                        <td>{row.views}</td>
                        <td>{row.visitors}</td>
                        <td>{row.sharePercent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h3 className="admin-traffic__section-title">Referrers</h3>
            {report.referrers.length === 0 ? (
              <p className="hu-caption">
                No traffic analytics have been collected for this period yet.
              </p>
            ) : (
              <div className="admin-traffic__table-wrap">
                <table className="admin-traffic__table">
                  <thead>
                    <tr>
                      <th scope="col">Source</th>
                      <th scope="col">Views</th>
                      <th scope="col">Sessions</th>
                      <th scope="col">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.referrers.map((row) => (
                      <tr key={`${row.referrerType}:${row.host ?? ""}`}>
                        <td>{row.label}</td>
                        <td>{row.views}</td>
                        <td>{row.sessions}</td>
                        <td>{row.sharePercent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h3 className="admin-traffic__section-title">Sessions</h3>
            <ul className="admin-traffic__summary admin-insights-sessions" aria-label="Session metrics">
              <li className="admin-traffic__card">
                <p className="admin-traffic__card-label">Total sessions</p>
                <p className="admin-traffic__card-value">{report.sessions.totalSessions}</p>
              </li>
              <li className="admin-traffic__card admin-traffic__card--alt">
                <p className="admin-traffic__card-label">Views per session</p>
                <p className="admin-traffic__card-value">
                  {report.sessions.viewsPerSession ?? "—"}
                </p>
              </li>
            </ul>
            <p className="hu-caption admin-panel__note">
              Session boundary remains 30 minutes of inactivity. Average duration is not shown
              because long-lived aggregates do not store duration sums after raw session expiry.
            </p>
          </>
        ) : null}
      </ProfileSection>
    </div>
  );
}
