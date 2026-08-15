"use client";

import type { AuthUserPublic } from "@hu/types";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { AdminCapabilityGap } from "./AdminCapabilityGap";
import { AdminPanelNavigation } from "./AdminPanelNavigation";
import { AdminViewsNavigation } from "./AdminViewsNavigation";

import "./admin-panel.css";

interface AdminViewsSubscribersSectionProps {
  user: AuthUserPublic;
}

export function AdminViewsSubscribersSection({ user: _user }: AdminViewsSubscribersSectionProps) {
  return (
    <div className="admin-panel">
      <AdminPanelNavigation />
      <AdminViewsNavigation />

      <ProfileSection title="Subscribers">
        <p className="hu-body">
          Humanity Union has no canonical newsletter or email-subscriber domain model.
          <strong> Subscriber is not Participant</strong>, and{" "}
          <strong>Subscriber is not Member</strong>.
        </p>
        <p className="hu-caption admin-panel__note">
          Participants are registered civic accounts. Members are Participants with confirmed
          Membership Contribution. Marketing email / newsletters remain deferred in the email
          infrastructure foundation.
        </p>
      </ProfileSection>

      <AdminCapabilityGap
        title="Subscriber totals / status / engagement"
        message="No subscriber collection, opt-in list, or newsletter engagement metrics exist."
        details={[
          "Do not map Participants or Members into a Subscriber table.",
          "Follow-up requires an explicit subscription domain and privacy-reviewed collection.",
        ]}
      />
    </div>
  );
}
