"use client";

import { useState } from "react";

import type { InitiativeCoverMedia } from "@hu/types";

import { resolveMediaUrl } from "../../media-upload/media-url";
import { ExternalVideoEmbed } from "./ExternalVideoEmbed";

import "./initiative-image.css";

export const INITIATIVE_FALLBACK_IMAGE = "/images/initiatives/initiative-default.webp";

export interface InitiativeImageProps {
  title: string;
  /** Legacy prop; ignored when `coverMedia` resolves to a video. */
  imageUrl?: string | null;
  /**
   * UX Evolution Pack 03 — the public-safe, approved-only cover media entry
   * (see `resolveInitiativeCoverMedia`). When omitted, behavior is
   * unchanged from before Pack 03 (plain `imageUrl` rendering).
   */
  coverMedia?: InitiativeCoverMedia;
  className?: string;
  loading?: "lazy" | "eager";
  decorative?: boolean;
  /**
   * Enables click-to-play video (Single Initiative Overview hero, owner
   * edit preview). Card contexts (Initiative cards, `/countries`,
   * `/workspace/initiatives`) leave this `false` (default) and only ever
   * show a static poster + a "Video" badge — never mount an iframe or
   * autoplay inside a small card.
   */
  interactive?: boolean;
}

/** YouTube serves a stable, predictable thumbnail per video id from its own CDN — no backend fetch involved. */
function resolveYouTubePosterUrl(providerVideoId: string): string {
  return `https://img.youtube.com/vi/${encodeURIComponent(providerVideoId)}/hqdefault.jpg`;
}

export function InitiativeImage({
  title,
  imageUrl,
  coverMedia,
  className,
  loading = "lazy",
  decorative = false,
  interactive = false,
}: InitiativeImageProps) {
  const [showPlayer, setShowPlayer] = useState(false);

  const isExternalVideo =
    coverMedia?.type === "video_external" &&
    Boolean(coverMedia.provider) &&
    Boolean(coverMedia.providerVideoId);

  const resolvedStillUrl = resolveMediaUrl(
    coverMedia?.type === "image" ? coverMedia.url : (imageUrl ?? undefined),
  );

  const [useFallback, setUseFallback] = useState(!resolvedStillUrl && !isExternalVideo);

  const combinedClassName = className ? `initiative-image ${className}` : "initiative-image";

  if (isExternalVideo && coverMedia?.provider && coverMedia.providerVideoId) {
    const posterUrl =
      coverMedia.provider === "youtube"
        ? resolveYouTubePosterUrl(coverMedia.providerVideoId)
        : undefined;

    if (interactive && showPlayer) {
      return (
        <ExternalVideoEmbed
          provider={coverMedia.provider}
          providerVideoId={coverMedia.providerVideoId}
          title={title}
          className={combinedClassName}
        />
      );
    }

    return (
      <div className={`${combinedClassName} initiative-image--video-poster`}>
        <img
          src={posterUrl ?? INITIATIVE_FALLBACK_IMAGE}
          alt={decorative ? "" : `Video preview for ${title}`}
          className="initiative-image__poster-img"
          loading={loading}
        />
        <span className="initiative-image__video-badge" aria-hidden="true">
          ▶
        </span>
        {interactive ? (
          <button
            type="button"
            className="initiative-image__play-button"
            onClick={() => setShowPlayer(true)}
            aria-label={`Play video: ${title}`}
          >
            <span aria-hidden="true">▶</span> Play video
          </button>
        ) : null}
      </div>
    );
  }

  const src = useFallback ? INITIATIVE_FALLBACK_IMAGE : resolvedStillUrl;
  const alt = useFallback ? (decorative ? "" : `Illustration for ${title}`) : title;

  return (
    <img
      src={src}
      alt={alt}
      className={combinedClassName}
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
