import { PRODUCTION_MEDIA_PUBLIC_BASE_URL } from "./constants.js";

export type MediaHostClassification =
  | "production_public"
  | "staging_public"
  | "relative_api"
  | "other_https"
  | "unknown";

export type ExtractedMediaReference = {
  postId: string;
  source: "coverMedia" | "socialImage" | "content_img";
  mediaId: string | null;
  mediaUrl: string | null;
  hostClassification: MediaHostClassification;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function classifyMediaUrlHost(url: string | null | undefined): MediaHostClassification {
  if (!url?.trim()) return "unknown";
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("/api/v1/media/files/")) return "relative_api";
  if (lower.startsWith(PRODUCTION_MEDIA_PUBLIC_BASE_URL)) return "production_public";
  if (/media-staging\.huws\.org/i.test(lower)) return "staging_public";
  if (lower.startsWith("https://") || lower.startsWith("http://")) return "other_https";
  return "unknown";
}

/** Extract storageKey from /api/v1/media/files/{key} or trailing path of public URL. */
export function storageKeyFromMediaUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
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
  return {
    postId,
    source,
    mediaId,
    mediaUrl,
    hostClassification: classifyMediaUrlHost(mediaUrl),
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
    refs.push({
      postId: post.postId,
      source: "content_img",
      mediaId: null,
      mediaUrl,
      hostClassification: classifyMediaUrlHost(mediaUrl),
    });
  }
  return refs;
}

export function summarizeMediaReferences(refs: readonly ExtractedMediaReference[]): {
  totalReferences: number;
  bySource: Record<string, number>;
  byHostClassification: Record<MediaHostClassification, number>;
} {
  const bySource: Record<string, number> = {};
  const byHostClassification: Record<MediaHostClassification, number> = {
    production_public: 0,
    staging_public: 0,
    relative_api: 0,
    other_https: 0,
    unknown: 0,
  };
  for (const ref of refs) {
    bySource[ref.source] = (bySource[ref.source] ?? 0) + 1;
    byHostClassification[ref.hostClassification] += 1;
  }
  return {
    totalReferences: refs.length,
    bySource,
    byHostClassification,
  };
}
