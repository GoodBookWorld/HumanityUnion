"use client";

import type { InitiativeCoverMediaExternalProvider } from "@hu/types";
import { buildExternalVideoEmbedUrl } from "@hu/types";

import "./external-video-embed.css";

interface ExternalVideoEmbedProps {
  provider: InitiativeCoverMediaExternalProvider;
  providerVideoId: string;
  title: string;
  className?: string;
}

/**
 * UX Evolution Pack 03 Part 6 — the only place an Initiative cover video is
 * ever rendered. The `src` always comes from `buildExternalVideoEmbedUrl`
 * (a fixed, platform-controlled template for an allowlisted provider); no
 * user-supplied HTML or iframe code is ever used. `sandbox` restricts the
 * framed document to script execution and its own origin only — it can
 * never access this page's origin, storage, or DOM. Controls are the
 * provider's default (enabled); autoplay is never requested.
 */
export function ExternalVideoEmbed({
  provider,
  providerVideoId,
  title,
  className,
}: ExternalVideoEmbedProps) {
  const src = buildExternalVideoEmbedUrl(provider, providerVideoId);

  return (
    <iframe
      className={
        className ? `external-video-embed ${className}` : "external-video-embed"
      }
      src={src}
      title={title}
      loading="lazy"
      sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
      allow="encrypted-media; picture-in-picture"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
    />
  );
}
