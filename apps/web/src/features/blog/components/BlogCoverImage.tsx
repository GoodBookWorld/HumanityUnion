"use client";

import { useState } from "react";

import { resolveMediaUrl } from "../../media-upload/media-url";

export const BLOG_COVER_FALLBACK = "/brand/initiative-placeholder.svg";

export interface BlogCoverImageProps {
  title: string;
  imageUrl?: string | null;
  /** Pack 05 — prefer Author-provided cover alt text when available. */
  altText?: string | null;
  className?: string;
  priority?: boolean;
}

export function BlogCoverImage({
  title,
  imageUrl,
  altText,
  className,
  priority,
}: BlogCoverImageProps) {
  const resolved = resolveMediaUrl(imageUrl);
  const [useFallback, setUseFallback] = useState(!resolved);
  const src = useFallback || !resolved ? BLOG_COVER_FALLBACK : resolved;
  const decorative = useFallback || !resolved;
  const accessibleAlt = (altText?.trim() || title).trim();

  return (
    <img
      src={src}
      alt={decorative ? "" : accessibleAlt}
      aria-hidden={decorative ? true : undefined}
      className={className ? `blog-cover-image ${className}` : "blog-cover-image"}
      width={960}
      height={540}
      loading={priority ? "eager" : "lazy"}
      onError={() => {
        if (!useFallback) {
          setUseFallback(true);
        }
      }}
    />
  );
}
