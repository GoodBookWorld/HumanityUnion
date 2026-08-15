"use client";

import type { AuthUserPublic } from "@hu/types";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { AdminCapabilityGap } from "./AdminCapabilityGap";
import { AdminPanelNavigation } from "./AdminPanelNavigation";
import { AdminViewsNavigation } from "./AdminViewsNavigation";

import "./admin-panel.css";

interface AdminViewsTrafficSectionProps {
  user: AuthUserPublic;
}

export function AdminViewsTrafficSection({ user: _user }: AdminViewsTrafficSectionProps) {
  return (
    <div className="admin-panel">
      <AdminPanelNavigation />
      <AdminViewsNavigation />

      <ProfileSection title="Traffic">
        <p className="hu-caption admin-panel__note">
          Web traffic analytics (page views, visitors, sessions, referrers, visitor geography)
          are not collected by Humanity Union today. No third-party analytics provider is
          wired in this pack.
        </p>
      </ProfileSection>

      <AdminCapabilityGap
        title="Views / Visitors / Sessions"
        message="There is no sitewide page-view, visitor, or session analytics ingestion or persistence."
        details={[
          "No page-view event store or time-series API exists.",
          "Auth sessions are not analytics sessions.",
        ]}
      />

      <AdminCapabilityGap
        title="Most viewed pages / Referrers / Geography"
        message="Referrers, UTM sources, and visitor geography are not collected."
        details={[
          "Platform country/region statistics reflect participation profiles, not visitor traffic.",
          "Initiative unique views exist only per Initiative on public experience APIs — not as platform Traffic analytics.",
        ]}
      />
    </div>
  );
}
