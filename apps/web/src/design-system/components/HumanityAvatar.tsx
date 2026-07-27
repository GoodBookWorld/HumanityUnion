"use client";

import { useState } from "react";

import { resolveAvatarUrl } from "../../features/media-upload/media-url";

import "./humanity-avatar.css";

interface HumanityAvatarProps {
  avatarUrl?: string | null;
  alt?: string;
  size?: number;
  className?: string;
}

export function HumanityAvatar({ avatarUrl, alt = "", size = 40, className }: HumanityAvatarProps) {
  const [failed, setFailed] = useState(false);
  const resolvedUrl = failed ? resolveAvatarUrl(null) : resolveAvatarUrl(avatarUrl);
  const classes = ["humanity-avatar", className].filter(Boolean).join(" ");

  return (
    <img
      className={classes}
      src={resolvedUrl}
      alt={alt}
      width={size}
      height={size}
      onError={() => setFailed(true)}
    />
  );
}
