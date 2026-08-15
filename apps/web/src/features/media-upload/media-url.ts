import { API_BASE_URL } from "../../lib/api-client";

export const DEFAULT_AVATAR_URL = "/brand/humanity-default-avatar.svg";

function isSameOriginStaticAssetPath(path: string): boolean {
  return (
    path.startsWith("/brand/") ||
    path.startsWith("/icons/") ||
    path.startsWith("/illustrations/") ||
    path.startsWith("/images/")
  );
}

export function resolveMediaUrl(mediaUrl?: string | null): string | undefined {
  if (!mediaUrl?.trim()) {
    return undefined;
  }

  const trimmed = mediaUrl.trim();

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  // Brand/icon assets are served by the Web origin — never rewrite to the API host.
  // (API workspace-identity may return the default `/brand/...` avatar path.)
  if (isSameOriginStaticAssetPath(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    return `${API_BASE_URL}${trimmed}`;
  }

  return trimmed;
}

export function resolveAvatarUrl(avatarUrl?: string | null): string {
  return resolveMediaUrl(avatarUrl) ?? DEFAULT_AVATAR_URL;
}
