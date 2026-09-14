"use client";

import type { MembershipMePayload } from "@hu/types";
import type { MemberProfile, MemberProfilePrivacySettings } from "@hu/types";
import { useTranslations } from "next-intl";
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
  membershipApplicationStatusLabelKey,
  membershipContributionStatusLabelKey,
  membershipJourneyCompletedCount,
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
  const t = useTranslations("membershipPublic");
  const tProfile = useTranslations("memberProfile");
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
      <ProfileSection title={t("pageTitle")}>
        <p>{tProfile("loadingMembership")}</p>
      </ProfileSection>
    );
  }

  if (error || !payload || !profile || !privacy) {
    return (
      <ProfileSection title={t("pageTitle")}>
        <p>{error ?? tProfile("membershipUnavailable")}</p>
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
  const cohortSemantic = isActiveMember ? "Member" : membership.cohortLabel;
  const cohortDisplayLabel =
    cohortSemantic === "Member" ? t("status.memberCohort") : t("status.participantCohort");
  const journeyCompleted = membershipJourneyCompletedCount(payload.timeline);

  const membershipTiles: MembershipFactTile[] = [
    {
      id: "current-status",
      label: t("status.currentStatus"),
      value: cohortDisplayLabel,
      tone: "pale-blue",
    },
  ];

  if (applicationStarted) {
    const applicationKey = membershipApplicationStatusLabelKey(membership.applicationStatus);
    membershipTiles.push({
      id: "application-status",
      label: t("status.applicationStatus"),
      value: t(`labels.applicationStatus.${applicationKey}`),
      tone: "pale-amber",
    });
  }

  if (isActiveMember) {
    membershipTiles.push({
      id: "member-number",
      label: t("status.memberNumber"),
      value: membership.memberNumber ?? "—",
      tone: "pale-green",
    });
    membershipTiles.push({
      id: "member-since",
      label: t("status.memberSince"),
      value: formatMemberSince(membership.memberSince),
      tone: "pale-violet",
    });
  }

  if (contributionReached) {
    const contributionKey = membershipContributionStatusLabelKey(membership.status);
    membershipTiles.push({
      id: "contribution",
      label: t("status.contribution"),
      value: t(`labels.contributionStatus.${contributionKey}`),
      tone: "pale-cyan",
    });
  }

  return (
    <ProfileSection title={t("pageTitle")}>
      <div className="membership-profile-section__badge-row">
        {isActiveMember ? (
          <div className="membership-active-member-row">
            <MembershipCohortBadge
              cohortLabel="Member"
              displayLabel={t("status.memberCohort")}
            />
            <MemberBadgeIcon size="medium" decorative />
          </div>
        ) : (
          <MembershipCohortBadge
            cohortLabel={membership.cohortLabel}
            displayLabel={cohortDisplayLabel}
          />
        )}
      </div>
      <MembershipFactsTiles tiles={membershipTiles} ariaLabel={t("status.ariaFacts")} />
      <ProfileField
        label={tProfile("journeyProgress")}
        value={t("labels.journeySummary", {
          completed: journeyCompleted,
          total: payload.timeline.length,
        })}
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
      <p className="membership-profile-section__note">{tProfile("membershipNote")}</p>
      {isActiveMember ? (
        <Button href="/membership/success" variant="primary">
          {tProfile("viewMembershipSuccess")}
        </Button>
      ) : (
        <Button href="/membership" variant="primary">
          {tProfile("openMembership")}
        </Button>
      )}
    </ProfileSection>
  );
}
