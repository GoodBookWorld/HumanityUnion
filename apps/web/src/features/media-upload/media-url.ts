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

function isUnusableLocalhostMediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
      return false;
    }
    // Browser on a real staging/production host cannot load API-localhost media.
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      return host !== "localhost" && host !== "127.0.0.1";
    }
    // SSR: reject only when the public platform mode is not local development.
    const mode = process.env.NEXT_PUBLIC_PLATFORM_MODE ?? process.env.PLATFORM_MODE ?? "";
    return mode === "staging" || mode === "production" || mode === "beta";
  } catch {
    return false;
  }
}

export function resolveMediaUrl(mediaUrl?: string | null): string | undefined {
  if (!mediaUrl?.trim()) {
    return undefined;
  }

  const trimmed = mediaUrl.trim();

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    if (isUnusableLocalhostMediaUrl(trimmed)) {
      return undefined;
    }
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
