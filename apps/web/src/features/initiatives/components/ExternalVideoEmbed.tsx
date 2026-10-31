"use client";

import type { BlogExternalVideoProvider } from "@hu/types";
import { buildExternalVideoEmbedUrl } from "@hu/types";

import "./external-video-embed.css";

interface ExternalVideoEmbedProps {
  provider: BlogExternalVideoProvider;
  providerVideoId: string;
  title: string;
  className?: string;
  /**
   * Set only after the reader pressed Play: requests playback with the
   * provider's `autoplay=1` and delegates the `autoplay` permission.
   */
  autoplay?: boolean;
}

const PLAYER_PERMISSIONS = "encrypted-media; picture-in-picture";

/** YouTube, Vimeo, and the Integrity Media embed all read `autoplay=1`. */
export function withRequestedPlayback(src: string): string {
  const url = new URL(src);
  url.searchParams.set("autoplay", "1");
  return url.toString();
}

/**
 * UX Evolution Pack 03 Part 6 — the only place an Initiative cover video is
 * ever rendered. The `src` always comes from `buildExternalVideoEmbedUrl`
 * (a fixed, platform-controlled template for an allowlisted provider); no
 * user-supplied HTML or iframe code is ever used. `sandbox` restricts the
 * framed document to script execution and its own origin only — it can
 * never access this page's origin, storage, or DOM. Controls are the
 * provider's default (enabled); autoplay is requested only through
 * `autoplay`, after a user action.
 */
export function ExternalVideoEmbed({
  provider,
  providerVideoId,
  title,
  className,
  autoplay = false,
}: ExternalVideoEmbedProps) {
  const embedUrl = buildExternalVideoEmbedUrl(provider, providerVideoId);
  const src = autoplay ? withRequestedPlayback(embedUrl) : embedUrl;

  return (
    <iframe
      className={
        className ? `external-video-embed ${className}` : "external-video-embed"
      }
      src={src}
      title={title}
      loading={autoplay ? "eager" : "lazy"}
      sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
      allow={autoplay ? `autoplay; ${PLAYER_PERMISSIONS}` : PLAYER_PERMISSIONS}
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
    />
  );
}
