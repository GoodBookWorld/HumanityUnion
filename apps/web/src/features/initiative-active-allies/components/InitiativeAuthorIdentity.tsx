"use client";

import Link from "next/link";

import { HumanityAvatar } from "../../../design-system/components/HumanityAvatar";

import "./initiative-active-allies-widget.css";

export interface InitiativeAuthorIdentityProps {
  readonly displayName: string;
  readonly avatarUrl?: string | null;
  readonly profileUrl?: string | null;
  /** Optional role line (e.g. Author) — only when the surface already uses that vocabulary. */
  readonly roleLabel?: string | null;
  readonly className?: string;
  readonly avatarSize?: number;
}

/**
 * Shared Author/Ally identity chrome: avatar + name (+ optional role),
 * using the existing `iaa-widget__identity` presentation. Profile navigation
 * only when a canonical public profile URL is provided.
 */
export function InitiativeAuthorIdentity({
  displayName,
  avatarUrl,
  profileUrl,
  roleLabel,
  className,
  avatarSize = 36,
}: InitiativeAuthorIdentityProps) {
  const identityContent = (
    <>
      <HumanityAvatar
        className="iaa-widget__avatar"
        avatarUrl={avatarUrl ?? undefined}
        size={avatarSize}
        alt=""
      />
      <span className="iaa-widget__identity-text">
        <span className="iaa-widget__name">{displayName}</span>
        {roleLabel ? <span className="iaa-widget__role">{roleLabel}</span> : null}
      </span>
    </>
  );

  const classes = ["iaa-widget__identity", className].filter(Boolean).join(" ");

  if (profileUrl) {
    return (
      <Link className={classes} href={profileUrl}>
        {identityContent}
      </Link>
    );
  }

  return <span className={classes}>{identityContent}</span>;
}
