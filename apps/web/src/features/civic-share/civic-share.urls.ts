import type { CivicSharePayload } from "./civic-share.types";

export function resolveAbsoluteCivicShareUrl(url: string, origin?: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  const base =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL ?? "");

  if (!base) {
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  }

  try {
    return new URL(trimmed.startsWith("/") ? trimmed : `/${trimmed}`, base).toString();
  } catch {
    return trimmed;
  }
}

export function buildFacebookShareUrl(absoluteUrl: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(absoluteUrl)}`;
}

export function buildXShareUrl(absoluteUrl: string, text?: string): string {
  const params = new URLSearchParams();
  params.set("url", absoluteUrl);
  const trimmed = text?.trim();
  if (trimmed) {
    params.set("text", trimmed);
  }
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

export function buildLinkedInShareUrl(absoluteUrl: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(absoluteUrl)}`;
}

export function buildMailtoShareUrl(payload: CivicSharePayload, absoluteUrl: string): string {
  const subject = payload.title.trim() || "Humanity Union";
  const bodyLines = [
    payload.optionalText?.trim() || `Shared from Humanity Union: ${payload.title}`,
    "",
    absoluteUrl,
  ];
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join("\n"))}`;
}

export function buildWebShareData(
  payload: CivicSharePayload,
  absoluteUrl: string,
): ShareData {
  return {
    title: payload.title,
    text: payload.optionalText?.trim() || payload.title,
    url: absoluteUrl,
  };
}

export function canUseWebShareApi(
  navigatorLike: { share?: unknown; canShare?: (data: ShareData) => boolean } | null | undefined,
  data: ShareData,
): boolean {
  if (!navigatorLike || typeof navigatorLike.share !== "function") {
    return false;
  }

  if (typeof navigatorLike.canShare === "function") {
    try {
      return navigatorLike.canShare(data);
    } catch {
      return true;
    }
  }

  return true;
}
