"use client";

import { useState } from "react";

import { PUBLIC_NEWS_FALLBACK_IMAGE } from "./NewsArticleImage";

interface PublicNewsCardImageProps {
  title: string;
  imageUrl?: string;
}

/**
 * The article image to render, or null for the fallback: only absolute HTTPS URLs,
 * and never a URL that already failed to load. Tracking the failed URL (not a flag)
 * means a new image for the same card is tried again.
 */
export function resolvePublicNewsCardImageSrc(
  imageUrl: string | null | undefined,
  failedSrc: string | null,
): string | null {
  if (!imageUrl || imageUrl === failedSrc) {
    return null;
  }
  try {
    return new URL(imageUrl).protocol === "https:" ? imageUrl : null;
  } catch {
    return null;
  }
}

export function PublicNewsCardImage({ title, imageUrl }: PublicNewsCardImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const articleSrc = resolvePublicNewsCardImageSrc(imageUrl, failedSrc);
  const src = articleSrc ?? PUBLIC_NEWS_FALLBACK_IMAGE;
  const alt = articleSrc ? title : "";

  return (
    <img
      src={src}
      alt={alt}
      aria-hidden={articleSrc ? undefined : true}
      className="public-news-card__image"
      width={640}
      height={360}
      loading="lazy"
      decoding="async"
      onError={() => {
        if (articleSrc) {
          setFailedSrc(articleSrc);
        }
      }}
    />
  );
}
