import { API_BASE_URL } from "../../lib/api-client";

export const DEFAULT_AVATAR_URL = "/brand/humanity-default-avatar.svg";

export function resolveMediaUrl(mediaUrl?: string | null): string | undefined {
  if (!mediaUrl?.trim()) {
    return undefined;
  }

  const trimmed = mediaUrl.trim();

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
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
