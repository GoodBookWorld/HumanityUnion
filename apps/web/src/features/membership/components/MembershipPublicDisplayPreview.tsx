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
  /** Controls Member Number privacy messaging only — not the Member indicator. */
  membershipPubliclyVisible?: boolean;
  /** True when Membership is already active_member (real public behavior). */
  isActiveMember?: boolean;
  /**
   * Presentation-only: show the future Member indicator before activation.
   * Never mutates domain status. Ignored when `isActiveMember` is true.
   */
  previewMemberStatus?: boolean;
}

function resolvePreviewCaption(input: {
  isActiveMember: boolean;
  membershipPubliclyVisible: boolean;
}): string {
  if (input.isActiveMember) {
    return input.membershipPubliclyVisible
      ? "Public profile: Member status appears automatically, including your Member Number."
      : "Public profile: Member status appears automatically. Your Member Number stays private until you enable it.";
  }

  return "Public profile preview (future Member status)";
}

export function MembershipPublicDisplayPreview({
  displayName,
  publicName,
  avatarUrl,
  membershipPubliclyVisible = false,
  isActiveMember = false,
  previewMemberStatus = true,
}: MembershipPublicDisplayPreviewProps) {
  const showMemberIndicator = isActiveMember || previewMemberStatus;
  const caption = resolvePreviewCaption({
    isActiveMember,
    membershipPubliclyVisible,
  });

  return (
    <Card className="membership-public-preview">
      <p className="membership-public-visibility__description">{caption}</p>
      <div
        className="public-member-page membership-public-preview__surface"
        data-membership-public-preview="true"
        data-preview-member-status={showMemberIndicator ? "true" : "false"}
        data-active-member={isActiveMember ? "true" : "false"}
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
              {showMemberIndicator ? (
                <MemberStatusIndicator className="public-member-page__member-status" />
              ) : null}
            </div>
          </div>
        </header>
      </div>
    </Card>
  );
}
