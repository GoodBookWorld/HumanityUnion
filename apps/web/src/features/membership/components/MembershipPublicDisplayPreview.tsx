import { HumanityAvatar } from "../../../design-system/components/HumanityAvatar";
import { Card } from "../../../design-system/components/Card";

import { MemberBadgeIcon } from "./MemberBadgeIcon";
import { MembershipCohortBadge } from "./MembershipCohortBadge";

interface MembershipPublicDisplayPreviewProps {
  displayName: string;
  avatarUrl?: string;
  visible: boolean;
  memberNumber?: string | null;
}

export function MembershipPublicDisplayPreview({
  displayName,
  avatarUrl,
  visible,
  memberNumber,
}: MembershipPublicDisplayPreviewProps) {
  return (
    <Card className="membership-public-preview">
      <p className="membership-public-visibility__description">
        Public profile preview {visible ? "(Member status visible)" : "(Member status hidden)"}
      </p>
      <div className="membership-public-preview__header">
        <HumanityAvatar alt={displayName} avatarUrl={avatarUrl} size={48} />
        <div className="membership-public-preview__meta">
          <p className="membership-public-preview__name">{displayName}</p>
          {visible ? (
            <>
              <div className="membership-active-member-row">
                <MembershipCohortBadge cohortLabel="Member" />
                <MemberBadgeIcon size="small" decorative />
              </div>
              {memberNumber ? (
                <p className="membership-public-preview__number">{memberNumber}</p>
              ) : null}
            </>
          ) : (
            <MembershipCohortBadge cohortLabel="Participant" />
          )}
        </div>
      </div>
    </Card>
  );
}
