import Image from "next/image";
import { useState } from "react";

import { MEMBER_BADGE_IMAGE_PATH } from "../membership.constants";

import "./member-badge-icon.css";

export type MemberBadgeIconSize = "small" | "medium" | "large" | "feature";

const SIZE_MAP: Record<Exclude<MemberBadgeIconSize, "feature">, number> = {
  small: 24,
  medium: 40,
  large: 64,
};

interface MemberBadgeIconProps {
  size?: MemberBadgeIconSize;
  decorative?: boolean;
  className?: string;
}

export function MemberBadgeIcon({
  size = "medium",
  decorative = false,
  className,
}: MemberBadgeIconProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={
          className
            ? `member-badge-icon member-badge-icon--fallback ${className}`
            : "member-badge-icon member-badge-icon--fallback"
        }
        role={decorative ? undefined : "img"}
        aria-label={decorative ? undefined : "Humanity Union Member Badge"}
        aria-hidden={decorative ? true : undefined}
      >
        HU
      </span>
    );
  }

  if (size === "feature") {
    return (
      <div
        className={
          className
            ? `member-badge-icon member-badge-icon--feature ${className}`
            : "member-badge-icon member-badge-icon--feature"
        }
      >
        <Image
          src={MEMBER_BADGE_IMAGE_PATH}
          alt={decorative ? "" : "Humanity Union Member Badge"}
          width={240}
          height={240}
          className="member-badge-icon__image"
          onError={() => setFailed(true)}
          aria-hidden={decorative ? true : undefined}
        />
      </div>
    );
  }

  const dimension = SIZE_MAP[size];

  return (
    <Image
      src={MEMBER_BADGE_IMAGE_PATH}
      alt={decorative ? "" : "Humanity Union Member Badge"}
      width={dimension}
      height={dimension}
      className={
        className
          ? `member-badge-icon member-badge-icon--${size} ${className}`
          : `member-badge-icon member-badge-icon--${size}`
      }
      onError={() => setFailed(true)}
      aria-hidden={decorative ? true : undefined}
    />
  );
}
