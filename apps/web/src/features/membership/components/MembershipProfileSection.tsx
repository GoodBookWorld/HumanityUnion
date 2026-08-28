"use client";

import type { MembershipMePayload } from "@hu/types";
import type { MemberProfile, MemberProfilePrivacySettings } from "@hu/types";
import { useEffect, useState } from "react";

import { ProfileField } from "../../../components/member/ProfileField";
import { ProfileSection } from "../../../components/member/ProfileSection";
import { Button } from "../../../design-system/components/Button";
import { formatAuthFormError } from "../../../lib/api-client";
import {
  getMyMemberProfile,
  getMyMemberProfilePrivacy,
} from "../../member-profile/member-profile-api";
import { getMembershipMe } from "../membership-api";
import {
  formatMembershipApplicationStatus,
  formatMembershipContributionStatus,
  formatMembershipJourneySummary,
} from "../membership-labels";
import { formatMemberSince, isActiveMembershipStatus } from "../membership-formatters";

import { MemberBadgeIcon } from "./MemberBadgeIcon";
import { MembershipCohortBadge } from "./MembershipCohortBadge";
import { MembershipFactsTiles, type MembershipFactTile } from "./MembershipFactsTiles";
import { MembershipPublicDisplayPreview } from "./MembershipPublicDisplayPreview";
import { MembershipPublicVisibilityControl } from "./MembershipPublicVisibilityControl";
import { MembershipTimeline } from "./MembershipTimeline";
import "./membership-page.css";
import "./membership-success-page.css";

export function MembershipProfileSection() {
  const [payload, setPayload] = useState<MembershipMePayload | null>(null);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [privacy, setPrivacy] = useState<MemberProfilePrivacySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([getMembershipMe(), getMyMemberProfile(), getMyMemberProfilePrivacy()])
      .then(([membershipResult, profileResult, privacyResult]) => {
        if (!cancelled) {
          setPayload(membershipResult);
          setProfile(profileResult);
          setPrivacy(privacyResult);
          setError(null);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(formatAuthFormError(loadError));
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
  }, []);

  if (loading) {
    return (
      <ProfileSection title="Membership">
        <p>Loading Membership status...</p>
      </ProfileSection>
    );
  }

  if (error || !payload || !profile || !privacy) {
    return (
      <ProfileSection title="Membership">
        <p>{error ?? "Membership status is unavailable."}</p>
      </ProfileSection>
    );
  }

  const { membership } = payload;
  const isActiveMember = isActiveMembershipStatus(membership.status);
  const applicationStarted = membership.applicationStatus !== "not_started";
  const contributionReached =
    isActiveMember ||
    membership.status === "application_completed" ||
    membership.status === "pending_payment";

  const membershipTiles: MembershipFactTile[] = [
    {
      id: "current-status",
      label: "Current status",
      value: membership.cohortLabel,
      tone: "pale-blue",
    },
  ];

  if (applicationStarted) {
    membershipTiles.push({
      id: "application-status",
      label: "Application status",
      value: formatMembershipApplicationStatus(membership.applicationStatus),
      tone: "pale-amber",
    });
  }

  if (isActiveMember) {
    membershipTiles.push({
      id: "member-number",
      label: "Member Number",
      value: membership.memberNumber ?? "—",
      tone: "pale-green",
    });
    membershipTiles.push({
      id: "member-since",
      label: "Member Since",
      value: formatMemberSince(membership.memberSince),
      tone: "pale-violet",
    });
  }

  if (contributionReached) {
    membershipTiles.push({
      id: "contribution",
      label: "Contribution",
      value: formatMembershipContributionStatus(membership.status),
      tone: "pale-cyan",
    });
  }

  return (
    <ProfileSection title="Membership">
      <div className="membership-profile-section__badge-row">
        {isActiveMember ? (
          <div className="membership-active-member-row">
            <MembershipCohortBadge cohortLabel="Member" />
            <MemberBadgeIcon size="medium" decorative />
          </div>
        ) : (
          <MembershipCohortBadge cohortLabel="Participant" />
        )}
      </div>
      <MembershipFactsTiles tiles={membershipTiles} ariaLabel="Membership status facts" />
      <ProfileField
        label="Journey progress"
        value={formatMembershipJourneySummary(payload.timeline)}
      />
      <div className="membership-profile-section__timeline">
        <MembershipTimeline steps={payload.timeline} compact />
      </div>
      <MembershipPublicVisibilityControl
        privacy={privacy}
        isActiveMember={isActiveMember}
        onUpdated={setPrivacy}
      />
      <MembershipPublicDisplayPreview
        displayName={profile.displayName}
        publicName={profile.publicName}
        avatarUrl={profile.avatarUrl}
        membershipPubliclyVisible={privacy.membershipPubliclyVisible}
        isActiveMember={isActiveMember}
        memberNumber={
          privacy.membershipPubliclyVisible ? membership.memberNumber ?? undefined : undefined
        }
        previewMemberStatus={!isActiveMember}
      />
      <p className="membership-profile-section__note">
        Membership confirms voluntary support for Humanity Union. It does not change voting power or
        grant identity verification.
      </p>
      {isActiveMember ? (
        <Button href="/membership/success" variant="primary">
          View Membership Success
        </Button>
      ) : (
        <Button href="/membership" variant="primary">
          Open Membership
        </Button>
      )}
    </ProfileSection>
  );
}
