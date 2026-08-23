"use client";

import { useEffect, useState } from "react";

import type { AuthUserPublic, TrafficAdminReport, TrafficPeriod } from "@hu/types";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { fetchAdminTrafficReport } from "../../traffic-analytics/traffic-analytics-api";
import { AdminPanelNavigation } from "./AdminPanelNavigation";
import { AdminViewsNavigation } from "./AdminViewsNavigation";

import "./admin-panel.css";
import "./admin-traffic.css";

interface AdminViewsTrafficSectionProps {
  user: AuthUserPublic;
}

const PERIODS: readonly { id: TrafficPeriod; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
] as const;

export function AdminViewsTrafficSection({ user: _user }: AdminViewsTrafficSectionProps) {
  const [period, setPeriod] = useState<TrafficPeriod>("7d");
  const [report, setReport] = useState<TrafficAdminReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setUnavailable(false);

    void fetchAdminTrafficReport(period)
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

  return (
    <div className="admin-panel">
      <AdminPanelNavigation />
      <AdminViewsNavigation />

      <ProfileSection title="Traffic">
        <div className="admin-traffic__period" role="group" aria-label="Traffic period">
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
            Loading traffic analytics…
          </p>
        ) : null}

        {unavailable ? (
          <p className="admin-traffic__unavailable" role="alert">
            Analytics unavailable
          </p>
        ) : null}

        {!loading && !unavailable && report ? (
          <>
            <h3 className="admin-traffic__section-title">Summary</h3>
            <p className="hu-caption admin-panel__note">{report.summary.periodLabel} (UTC)</p>
            <ul className="admin-traffic__summary" aria-label="Traffic summary">
              <li className="admin-traffic__card">
                <p className="admin-traffic__card-label">Views</p>
                <p className="admin-traffic__card-value">{report.summary.views}</p>
              </li>
              <li className="admin-traffic__card admin-traffic__card--alt">
                <p className="admin-traffic__card-label">Visitors</p>
                <p className="admin-traffic__card-value">{report.summary.visitors}</p>
              </li>
              <li className="admin-traffic__card">
                <p className="admin-traffic__card-label">Sessions</p>
                <p className="admin-traffic__card-value">{report.summary.sessions}</p>
              </li>
            </ul>

            <h3 className="admin-traffic__section-title">Most viewed pages</h3>
            {report.topPages.length === 0 ? (
              <p className="hu-caption">No analytics collected for this period.</p>
            ) : (
              <div className="admin-traffic__table-wrap">
                <table className="admin-traffic__table">
                  <thead>
                    <tr>
                      <th scope="col">Page</th>
                      <th scope="col">Views</th>
                      <th scope="col">Visitors</th>
                      <th scope="col">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.topPages.map((row) => (
                      <tr key={row.path}>
                        <td>{row.path}</td>
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
              <p className="hu-caption">No analytics collected for this period.</p>
            ) : (
              <div className="admin-traffic__table-wrap">
                <table className="admin-traffic__table">
                  <thead>
                    <tr>
                      <th scope="col">Referrer</th>
                      <th scope="col">Views</th>
                      <th scope="col">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.referrers.map((row) => (
                      <tr key={`${row.referrerType}:${row.host ?? ""}`}>
                        <td>{row.label}</td>
                        <td>{row.views}</td>
                        <td>{row.sharePercent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h3 className="admin-traffic__section-title">Geography</h3>
            {report.geography.length === 0 ? (
              <p className="hu-caption">No analytics collected for this period.</p>
            ) : (
              <div className="admin-traffic__table-wrap">
                <table className="admin-traffic__table">
                  <thead>
                    <tr>
                      <th scope="col">Country</th>
                      <th scope="col">Views</th>
                      <th scope="col">Visitors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.geography.map((row) => (
                      <tr key={row.countryCode ?? "unknown"}>
                        <td>{row.countryLabel}</td>
                        <td>{row.views}</td>
                        <td>{row.visitors}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
      </ProfileSection>
    </div>
  );
}
