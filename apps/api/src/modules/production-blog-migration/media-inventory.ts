import { PRODUCTION_MEDIA_PUBLIC_BASE_URL } from "./constants.js";

/**
 * Ownership / host classification for Blog media references.
 *
 * Structured coverMedia / socialImage with a canonical mediaId always win over
 * URL host (including *.r2.dev staging public URLs).
 *
 * - canonical_media_id — structured field with mediaId (R2 inventory via media_upload_records)
 * - production_public / staging_public / relative_api — URL-only canonical HU media
 * - external_https_preserve — HTML (or URL-only) external HTTPS; leave unchanged; never R2-copy
 * - unknown — malformed / unclassifiable
 */
export type MediaHostClassification =
  | "canonical_media_id"
  | "production_public"
  | "staging_public"
  | "relative_api"
  | "external_https_preserve"
  | "unknown";

export type ExtractedMediaReference = {
  postId: string;
  source: "coverMedia" | "socialImage" | "content_img";
  mediaId: string | null;
  mediaUrl: string | null;
  hostClassification: MediaHostClassification;
  /** Safe hostname only for external preserves (never full URL in reports). */
  externalHost: string | null;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function isCanonicalHuMediaUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("/api/v1/media/files/")) return true;
  if (lower.startsWith(PRODUCTION_MEDIA_PUBLIC_BASE_URL.toLowerCase())) return true;
  if (/^https?:\/\/media-staging\.huws\.org\//i.test(trimmed)) return true;
  if (/^https?:\/\/[^/]+\/api\/v1\/media\/files\//i.test(trimmed)) return true;
  return false;
}

/** URL-host classification only — never used to demote a structured mediaId. */
export function classifyMediaUrlHost(url: string | null | undefined): MediaHostClassification {
  if (!url?.trim()) return "unknown";
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("/api/v1/media/files/")) return "relative_api";
  if (lower.startsWith(PRODUCTION_MEDIA_PUBLIC_BASE_URL.toLowerCase())) {
    return "production_public";
  }
  if (/^https?:\/\/media-staging\.huws\.org\//i.test(trimmed)) return "staging_public";
  if (/^https?:\/\/[^/]+\/api\/v1\/media\/files\//i.test(trimmed)) return "relative_api";
  if (lower.startsWith("https://") || lower.startsWith("http://")) {
    return "external_https_preserve";
  }
  return "unknown";
}

export function extractSafeExternalHost(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const parsed = new URL(url.trim());
    return parsed.hostname || null;
  } catch {
    return null;
  }
}

/**
 * True when this reference is legacy external HTTPS with no canonical mediaId.
 * Structured cover/social with mediaId are never external preserves.
 */
export function isExternalHttpsPreserveReference(ref: ExtractedMediaReference): boolean {
  return ref.hostClassification === "external_https_preserve" && !ref.mediaId;
}

/**
 * Extract storageKey only from canonical HU media URLs.
 * External HTTPS URLs must return null (never invent a storageKey from i0.wp.com paths).
 */
export function storageKeyFromMediaUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  if (!isCanonicalHuMediaUrl(url)) return null;
  const trimmed = url.trim();
  const apiMatch = trimmed.match(/\/api\/v1\/media\/files\/(.+)$/i);
  if (apiMatch?.[1]) {
    return decodeURIComponent(apiMatch[1].replace(/^\/+/, ""));
  }
  try {
    const parsed = new URL(trimmed);
    const path = parsed.pathname.replace(/^\/+/, "");
    return path || null;
  } catch {
    return null;
  }
}

/**
 * Structured coverMedia / socialImage: mediaId evidence always classifies as
 * canonical_media_id — host (*.r2.dev, etc.) must never demote ownership.
 */
function extractCoverLike(
  postId: string,
  source: "coverMedia" | "socialImage",
  value: unknown,
): ExtractedMediaReference | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const mediaId = asString(record.mediaId);
  const mediaUrl = asString(record.mediaUrl);
  if (!mediaId && !mediaUrl) return null;

  if (mediaId) {
    return {
      postId,
      source,
      mediaId,
      mediaUrl,
      hostClassification: "canonical_media_id",
      externalHost: null,
    };
  }

  // URL-only structured field (no mediaId) — classify by host.
  const hostClassification = classifyMediaUrlHost(mediaUrl);
  return {
    postId,
    source,
    mediaId: null,
    mediaUrl,
    hostClassification,
    externalHost:
      hostClassification === "external_https_preserve"
        ? extractSafeExternalHost(mediaUrl)
        : null,
  };
}

const IMG_SRC_RE = /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;

export function extractMediaReferencesFromPost(post: {
  postId: string;
  coverMedia?: unknown;
  optimization?: { socialImage?: unknown } | null;
  content?: unknown;
}): ExtractedMediaReference[] {
  const refs: ExtractedMediaReference[] = [];
  const cover = extractCoverLike(post.postId, "coverMedia", post.coverMedia);
  if (cover) refs.push(cover);
  const social = extractCoverLike(
    post.postId,
    "socialImage",
    post.optimization && typeof post.optimization === "object"
      ? (post.optimization as { socialImage?: unknown }).socialImage
      : null,
  );
  if (social) refs.push(social);

  const content = asString(post.content) ?? "";
  let match: RegExpExecArray | null;
  IMG_SRC_RE.lastIndex = 0;
  while ((match = IMG_SRC_RE.exec(content)) !== null) {
    const mediaUrl = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (!mediaUrl) continue;
    const hostClassification = classifyMediaUrlHost(mediaUrl);
    refs.push({
      postId: post.postId,
      source: "content_img",
      mediaId: null,
      mediaUrl,
      hostClassification,
      externalHost:
        hostClassification === "external_https_preserve"
          ? extractSafeExternalHost(mediaUrl)
          : null,
    });
  }
  return refs;
}

export function summarizeMediaReferences(refs: readonly ExtractedMediaReference[]): {
  totalReferences: number;
  bySource: Record<string, number>;
  byHostClassification: Record<MediaHostClassification, number>;
  externalHttpsPreserveCount: number;
  externalHttpsHosts: string[];
  canonicalStructuredMediaCount: number;
} {
  const bySource: Record<string, number> = {};
  const byHostClassification: Record<MediaHostClassification, number> = {
    canonical_media_id: 0,
    production_public: 0,
    staging_public: 0,
    relative_api: 0,
    external_https_preserve: 0,
    unknown: 0,
  };
  const hostSet = new Set<string>();
  for (const ref of refs) {
    bySource[ref.source] = (bySource[ref.source] ?? 0) + 1;
    byHostClassification[ref.hostClassification] += 1;
    if (isExternalHttpsPreserveReference(ref) && ref.externalHost) {
      hostSet.add(ref.externalHost);
    }
  }
  return {
    totalReferences: refs.length,
    bySource,
    byHostClassification,
    externalHttpsPreserveCount: [...refs].filter(isExternalHttpsPreserveReference).length,
    externalHttpsHosts: [...hostSet].sort(),
    canonicalStructuredMediaCount: byHostClassification.canonical_media_id,
  };
}
