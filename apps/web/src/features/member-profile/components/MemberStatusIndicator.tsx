/**
 * Shared honorary Member status indicator for public profile hero and Membership preview.
 * Presentation-only — callers decide visibility (real projection vs previewMemberStatus).
 */
import {
  MEMBER_STATUS_INDICATOR_BADGE_SRC,
  MEMBER_STATUS_INDICATOR_LABEL,
} from "../member-status-indicator.constants";

import "./member-status-indicator.css";

export {
  MEMBER_STATUS_INDICATOR_BADGE_SRC,
  MEMBER_STATUS_INDICATOR_LABEL,
} from "../member-status-indicator.constants";

export interface MemberStatusIndicatorProps {
  className?: string;
}

export function MemberStatusIndicator({ className }: MemberStatusIndicatorProps) {
  const classes = className
    ? `member-status-indicator ${className}`
    : "member-status-indicator";

  return (
    <div className={classes} data-member-status-indicator="true">
      {/* Visible "Member" label carries the accessible name; badge is decorative. */}
      <img
        className="member-status-indicator__badge"
        src={MEMBER_STATUS_INDICATOR_BADGE_SRC}
        alt=""
        aria-hidden="true"
        width={48}
        height={48}
        decoding="async"
      />
      <span className="member-status-indicator__label">{MEMBER_STATUS_INDICATOR_LABEL}</span>
    </div>
  );
}
