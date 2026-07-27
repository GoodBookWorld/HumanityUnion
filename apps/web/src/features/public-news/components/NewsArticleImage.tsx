"use client";

import { useState } from "react";

export const PUBLIC_NEWS_FALLBACK_IMAGE = "/images/initiatives/initiative-default.webp";

export interface NewsArticleImageProps {
  title: string;
  imageUrl?: string | null;
  className?: string;
}

export function NewsArticleImage({ title, imageUrl, className }: NewsArticleImageProps) {
  const [useFallback, setUseFallback] = useState(!imageUrl);

  const src = useFallback || !imageUrl ? PUBLIC_NEWS_FALLBACK_IMAGE : imageUrl;
  const alt = useFallback || !imageUrl ? "" : title;

  return (
    <img
      src={src}
      alt={alt}
      aria-hidden={useFallback || !imageUrl ? true : undefined}
      className={className ? `public-news-image ${className}` : "public-news-image"}
      width={640}
      height={360}
      loading="lazy"
      onError={() => {
        if (!useFallback) {
          setUseFallback(true);
        }
      }}
    />
  );
}
