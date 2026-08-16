"use client";

import Link from "next/link";

import type { AuthUserPublic } from "@hu/types";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { AdminCapabilityGap } from "./AdminCapabilityGap";
import { AdminPanelNavigation } from "./AdminPanelNavigation";
import { AdminViewsNavigation } from "./AdminViewsNavigation";

import "./admin-panel.css";

interface AdminViewsInsightsSectionProps {
  user: AuthUserPublic;
}

/**
 * Insights retains honest capability gaps for web analytics.
 * Operational Overview metrics live only on Admin Overview (Pack 04).
 */
export function AdminViewsInsightsSection({ user: _user }: AdminViewsInsightsSectionProps) {
  return (
    <div className="admin-panel">
      <AdminPanelNavigation />
      <AdminViewsNavigation />

      <ProfileSection title="Insights">
        <p className="hu-body admin-panel__note">
          Civic and operational aggregates are canonical on{" "}
          <Link className="admin-panel__link" href="/admin">
            Admin Overview
          </Link>
          . This surface does not duplicate Operational Overview totals.
        </p>
      </ProfileSection>

      <AdminCapabilityGap
        title="Historical trends / all-time Views / Visitors"
        message="Time-series Views, Visitors, and monthly/yearly web analytics are not persisted."
        details={[
          "Membership growth time-series dimensions are typed as future-only and not implemented.",
          "No chart library or historical analytics API exists in the repository.",
        ]}
      />

      <AdminCapabilityGap
        title="Traffic geography / referrers / sessions"
        message="Page views, visitors, sessions, referrers, and traffic geography are not collected."
        details={[
          "No sitewide analytics ingestion pipeline exists yet.",
          "Do not treat invented zeros as real traffic metrics.",
        ]}
      />
    </div>
  );
}
