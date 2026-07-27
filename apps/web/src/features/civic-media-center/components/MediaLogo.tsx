"use client";

import { useState } from "react";

interface MediaLogoProps {
  name: string;
  logoUrl?: string;
  logoLabel: string;
  className?: string;
  imageClassName?: string;
  width?: number;
  height?: number;
}

export function MediaLogo({
  name,
  logoUrl,
  logoLabel,
  className = "",
  imageClassName = "",
  width = 48,
  height = 48,
}: MediaLogoProps) {
  const [imageFailed, setImageFailed] = useState(false);

  if (logoUrl && !imageFailed) {
    return (
      <img
        src={logoUrl}
        alt={`${name} logo`}
        className={imageClassName}
        width={width}
        height={height}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <span className={className} aria-hidden="true">
      {logoLabel}
    </span>
  );
}
