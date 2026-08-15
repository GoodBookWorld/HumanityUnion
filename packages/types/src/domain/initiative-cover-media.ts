/**
 * UX Evolution Pack 03 — Initiative Cover Media.
 *
 * Expands the legacy single `InitiativeMetadata.imageUrl` field into a small,
 * explicit media model that also supports an approved external video link.
 * Raw video *file* upload (`video_upload`) is modeled here for forward
 * compatibility but is intentionally never produced by any current API route
 * or UI action — see `apps/api/src/modules/media-upload/media-upload.validation.ts`
 * and the Pack 03 final report for why (no malware scanning, transcoding, or
 * quarantine infrastructure exists yet).
 */
export type InitiativeCoverMediaType = "image" | "video_upload" | "video_external";

/**
 * `pending` / `replacement_requested` are modeled for forward compatibility
 * with a future asynchronous scanning pipeline. Today every check this
 * platform can actually perform (file signature, size, dimensions, allowed
 * external-provider URL parsing) is synchronous and deterministic, so media
 * only ever lands in `approved` (all checks passed) — a hard validation
 * failure is rejected at request time and never persisted at all.
 */
export type InitiativeCoverMediaVerificationStatus =
  | "pending"
  | "approved"
  | "replacement_requested"
  | "rejected";

export type InitiativeCoverMediaExternalProvider = "youtube" | "vimeo";

export interface InitiativeCoverMedia {
  type: InitiativeCoverMediaType;
  url: string;
  thumbnailUrl?: string;
  mimeType?: string;
  /** Only present when `type` is `video_external`. */
  provider?: InitiativeCoverMediaExternalProvider;
  /** Only present when `type` is `video_external`. */
  providerVideoId?: string;
  verificationStatus: InitiativeCoverMediaVerificationStatus;
  /**
   * Internal only — never returned by any public projection. See
   * `resolveInitiativeCoverMedia`, which always strips this field.
   */
  verificationReasonCode?: string;
  createdAt?: string;
}

interface CoverMediaCompatSource {
  coverMedia?: InitiativeCoverMedia;
  imageUrl?: string;
}

/**
 * The single "what should currently be shown" rule, shared by every public
 * projection (API) and by the owner's own Workspace card (client), so the
 * two can never disagree about what counts as approved:
 *
 * 1. An approved `coverMedia` entry always wins, with its internal-only
 *    `verificationReasonCode` stripped — a public projection must never
 *    receive that field, however it was constructed.
 * 2. Otherwise, fall back to the legacy `imageUrl` string (every Initiative
 *    created before Pack 03 only ever has this field) as a synthesized
 *    `image` entry, so existing initiatives keep rendering with zero
 *    migration.
 * 3. Otherwise `undefined` — callers already fall back to the existing
 *    default placeholder image.
 *
 * Pending / rejected / replacement-requested media is deliberately never
 * returned here: "must not be publicly displayed" is enforced once, in this
 * function, rather than re-implemented at every render call site.
 */
export function resolveInitiativeCoverMedia(
  metadata: CoverMediaCompatSource,
): InitiativeCoverMedia | undefined {
  const coverMedia = metadata.coverMedia;

  if (coverMedia && coverMedia.verificationStatus === "approved") {
    const { verificationReasonCode: _internalOnly, ...publicSafe } = coverMedia;
    return publicSafe;
  }

  if (metadata.imageUrl) {
    return {
      type: "image",
      url: metadata.imageUrl,
      verificationStatus: "approved",
    };
  }

  return undefined;
}

export interface ParsedExternalVideoUrl {
  provider: InitiativeCoverMediaExternalProvider;
  providerVideoId: string;
  canonicalUrl: string;
}

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);
const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID_PATTERN = /^\d+$/;

function extractYouTubeVideoId(url: URL): string | null {
  const host = url.hostname.toLowerCase();

  if (host === "youtu.be") {
    return url.pathname.slice(1).split("/")[0] || null;
  }

  if (url.pathname === "/watch") {
    return url.searchParams.get("v");
  }

  if (url.pathname.startsWith("/embed/")) {
    return url.pathname.slice("/embed/".length).split("/")[0] || null;
  }

  if (url.pathname.startsWith("/shorts/")) {
    return url.pathname.slice("/shorts/".length).split("/")[0] || null;
  }

  return null;
}

function extractVimeoVideoId(url: URL): string | null {
  const segments = url.pathname.split("/").filter(Boolean);

  if (url.hostname.toLowerCase() === "player.vimeo.com") {
    const videoIndex = segments.indexOf("video");
    return videoIndex !== -1 ? (segments[videoIndex + 1] ?? null) : null;
  }

  return segments.length > 0 ? (segments[segments.length - 1] ?? null) : null;
}

/**
 * Accepts only HTTPS URLs on an explicit provider allowlist (Part 6/8): no
 * arbitrary host is ever fetched or embedded, and only a canonical
 * provider + video id is extracted — never arbitrary iframe/embed HTML.
 * Deterministic and side-effect free (no network access), so it is safe to
 * run both in the browser (optimistic validation) and on the server
 * (authoritative validation) from the exact same implementation.
 */
export function parseExternalVideoUrl(rawUrl: string): ParsedExternalVideoUrl | null {
  const trimmed = rawUrl.trim();

  if (!trimmed) {
    return null;
  }

  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") {
    return null;
  }

  const host = parsed.hostname.toLowerCase();

  if (YOUTUBE_HOSTS.has(host)) {
    const videoId = extractYouTubeVideoId(parsed);

    if (!videoId || !YOUTUBE_ID_PATTERN.test(videoId)) {
      return null;
    }

    return {
      provider: "youtube",
      providerVideoId: videoId,
      canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    };
  }

  if (VIMEO_HOSTS.has(host)) {
    const videoId = extractVimeoVideoId(parsed);

    if (!videoId || !VIMEO_ID_PATTERN.test(videoId)) {
      return null;
    }

    return {
      provider: "vimeo",
      providerVideoId: videoId,
      canonicalUrl: `https://vimeo.com/${videoId}`,
    };
  }

  return null;
}

/**
 * Fixed, platform-controlled embed URL templates (Part 6) — never built from
 * user-supplied HTML. Uses privacy-enhanced/no-cookie domains where the
 * provider offers them.
 */
export function buildExternalVideoEmbedUrl(
  provider: InitiativeCoverMediaExternalProvider,
  providerVideoId: string,
): string {
  const encodedId = encodeURIComponent(providerVideoId);

  if (provider === "youtube") {
    return `https://www.youtube-nocookie.com/embed/${encodedId}?rel=0&modestbranding=1`;
  }

  return `https://player.vimeo.com/video/${encodedId}?title=0&byline=0`;
}
