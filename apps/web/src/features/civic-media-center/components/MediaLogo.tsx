"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("civicMediaPublic");
  const [imageFailed, setImageFailed] = useState(false);

  if (logoUrl && !imageFailed) {
    return (
      <img
        src={logoUrl}
        alt={t("logoAlt", { name })}
        className={imageClassName}
        width={width}
        height={height}
        onError={() => setImageFailed(true)}
        data-hu-semantic-owner="UI_DICTIONARY"
      />
    );
  }

  return (
    <span className={className} aria-hidden="true">
      {logoLabel}
    </span>
  );
}
