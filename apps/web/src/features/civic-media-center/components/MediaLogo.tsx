"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { MediaSemanticNode } from "../../language/media-plp/media-semantic-contract";

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
  const logoAlt = t("logoAlt", { name });

  if (logoUrl && !imageFailed) {
    return (
      <>
        <img
          src={logoUrl}
          alt={logoAlt}
          className={imageClassName}
          width={width}
          height={height}
          onError={() => setImageFailed(true)}
        />
        <MediaSemanticNode
          as="span"
          className="hu-visually-hidden"
          owner="UI_DICTIONARY"
          result="LOCALIZED_DICTIONARY"
          aria-hidden="true"
        >
          {logoAlt}
        </MediaSemanticNode>
      </>
    );
  }

  return (
    <span className={className} aria-hidden="true">
      {logoLabel}
    </span>
  );
}
