"use client";

import { useState } from "react";

import { PUBLIC_NEWS_FALLBACK_IMAGE } from "./NewsArticleImage";

interface PublicNewsCardImageProps {
  title: string;
  imageUrl?: string;
}

export function PublicNewsCardImage({ title, imageUrl }: PublicNewsCardImageProps) {
  const [useFallback, setUseFallback] = useState(!imageUrl);

  const src = useFallback || !imageUrl ? PUBLIC_NEWS_FALLBACK_IMAGE : imageUrl;
  const alt = useFallback || !imageUrl ? "" : title;

  return (
    <img
      src={src}
      alt={alt}
      aria-hidden={useFallback || !imageUrl ? true : undefined}
      className="public-news-card__image"
      width={640}
      height={360}
      loading="lazy"
      decoding="async"
      onError={() => {
        if (!useFallback) {
          setUseFallback(true);
        }
      }}
    />
  );
}
