"use client";

import { useState } from "react";

import { resolveMediaUrl } from "../../media-upload/media-url";

export const BLOG_COVER_FALLBACK = "/brand/initiative-placeholder.svg";

export interface BlogCoverImageProps {
  title: string;
  imageUrl?: string | null;
  /** Prefer Author-provided cover alt text when available. */
  altText?: string | null;
  className?: string;
  priority?: boolean;
  /**
   * Pack 15A — cover-field preview must not invent alt from article title.
   * Public cards may still fall back to title when no alt is stored.
   */
  allowTitleAsAltFallback?: boolean;
}

export function BlogCoverImage({
  title,
  imageUrl,
  altText,
  className,
  priority,
  allowTitleAsAltFallback = true,
}: BlogCoverImageProps) {
  const resolved = resolveMediaUrl(imageUrl);
  /** Track which src failed so a later Replace URL can recover from fallback. */
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const loadFailed = Boolean(resolved && failedSrc === resolved);
  const useFallback = !resolved || loadFailed;
  const src = useFallback ? BLOG_COVER_FALLBACK : resolved;
  const decorative = useFallback;
  const explicitAlt = altText?.trim() ?? "";
  const accessibleAlt = explicitAlt || (allowTitleAsAltFallback ? title.trim() : "");

  return (
    <img
      key={resolved ?? "blog-cover-empty"}
      src={src}
      alt={decorative ? "" : accessibleAlt}
      aria-hidden={decorative ? true : undefined}
      className={className ? `blog-cover-image ${className}` : "blog-cover-image"}
      width={960}
      height={540}
      loading={priority ? "eager" : "lazy"}
      onError={() => {
        if (resolved && failedSrc !== resolved) {
          setFailedSrc(resolved);
        }
      }}
    />
  );
}
