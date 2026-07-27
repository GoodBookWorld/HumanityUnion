"use client";

import { useState } from "react";

import { resolveMediaUrl } from "../../media-upload/media-url";

import "./initiative-image.css";

export const INITIATIVE_FALLBACK_IMAGE = "/images/initiatives/initiative-default.webp";

export interface InitiativeImageProps {
  title: string;
  imageUrl?: string | null;
  className?: string;
  loading?: "lazy" | "eager";
  decorative?: boolean;
}

export function InitiativeImage({
  title,
  imageUrl,
  className,
  loading = "lazy",
  decorative = false,
}: InitiativeImageProps) {
  const resolvedImageUrl = resolveMediaUrl(imageUrl);
  const [useFallback, setUseFallback] = useState(!resolvedImageUrl);

  const src = useFallback ? INITIATIVE_FALLBACK_IMAGE : resolvedImageUrl;
  const alt = useFallback ? (decorative ? "" : `Illustration for ${title}`) : title;

  return (
    <img
      src={src}
      alt={alt}
      className={className ? `initiative-image ${className}` : "initiative-image"}
      width={320}
      height={180}
      loading={loading}
      onError={() => {
        if (!useFallback) {
          setUseFallback(true);
        }
      }}
    />
  );
}
