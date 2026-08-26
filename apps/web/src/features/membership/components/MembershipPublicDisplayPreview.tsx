/**
 * Membership section — public profile header preview with future Member indicator.
 * Reuses public-member-page identity geometry; presentation-only (no domain mutation).
 */
import { HumanityAvatar } from "../../../design-system/components/HumanityAvatar";
import { Card } from "../../../design-system/components/Card";
import { MemberStatusIndicator } from "../../member-profile/components/MemberStatusIndicator";
import { PUBLIC_MEMBER_AVATAR_SIZE_PX } from "../../member-profile/participant-profile-surface-presentation";

import "../../member-profile/components/participant-profile-surface.css";
import "../../member-profile/components/member-status-indicator.css";

interface MembershipPublicDisplayPreviewProps {
  displayName: string;
  publicName?: string;
  avatarUrl?: string;
  /** Privacy caption only — does not control indicator visibility in preview. */
  membershipPubliclyVisible?: boolean;
  /**
   * Presentation-only: show the future Member indicator even when the
   * Participant is not yet an active Member. Never mutates domain status.
   */
  previewMemberStatus?: boolean;
}

export function MembershipPublicDisplayPreview({
  displayName,
  publicName,
  avatarUrl,
  membershipPubliclyVisible = false,
  previewMemberStatus = true,
}: MembershipPublicDisplayPreviewProps) {
  const caption = membershipPubliclyVisible
    ? "Public profile preview (Member status)"
    : "Public profile preview (Member status hidden until public visibility is enabled)";

  return (
    <Card className="membership-public-preview">
      <p className="membership-public-visibility__description">{caption}</p>
      <div
        className="public-member-page membership-public-preview__surface"
        data-membership-public-preview="true"
        data-preview-member-status={previewMemberStatus ? "true" : "false"}
      >
        <header className="public-member-page__hero public-member-page__identity membership-public-preview__hero">
          <div className="public-member-page__hero-backdrop" aria-hidden="true" />
          <div className="public-member-page__hero-content public-member-page__identity-body">
            <HumanityAvatar
              className="public-member-page__avatar"
              alt={displayName}
              avatarUrl={avatarUrl}
              size={PUBLIC_MEMBER_AVATAR_SIZE_PX}
            />
            <div className="public-member-page__identity-main">
              <div className="public-member-page__identity-text">
                <p className="public-member-page__title membership-public-preview__title">
                  {displayName}
                </p>
                {publicName ? (
                  <p className="public-member-page__subtitle">@{publicName}</p>
                ) : null}
              </div>
              {previewMemberStatus ? (
                <MemberStatusIndicator className="public-member-page__member-status" />
              ) : null}
            </div>
          </div>
        </header>
      </div>
    </Card>
  );
}
