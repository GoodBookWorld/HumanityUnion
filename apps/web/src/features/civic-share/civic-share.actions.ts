import type { CivicSharePayload } from "./civic-share.types";
import { isCivicSharePayloadPublic } from "./civic-share.types";
import {
  buildFacebookShareUrl,
  buildLinkedInShareUrl,
  buildMailtoShareUrl,
  buildWebShareData,
  buildXShareUrl,
  canUseWebShareApi,
  resolveAbsoluteCivicShareUrl,
} from "./civic-share.urls";

export type CivicShareChannel =
  | "facebook"
  | "x"
  | "linkedin"
  | "email"
  | "instagram"
  | "copy"
  | "native";

export type CivicShareActionResult =
  | { readonly ok: true; readonly channel: CivicShareChannel; readonly detail?: string }
  | { readonly ok: false; readonly channel: CivicShareChannel; readonly reason: string };

function openExternal(url: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function copyCivicShareLink(
  payload: CivicSharePayload,
  origin?: string,
): Promise<CivicShareActionResult> {
  if (!isCivicSharePayloadPublic(payload)) {
    return { ok: false, channel: "copy", reason: "Share is only available for public content." };
  }

  const absoluteUrl = resolveAbsoluteCivicShareUrl(payload.url, origin);

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(absoluteUrl);
      return { ok: true, channel: "copy", detail: "Link copied" };
    }
  } catch {
    // fall through
  }

  return { ok: false, channel: "copy", reason: "Copy unavailable" };
}

export async function shareCivicViaNative(
  payload: CivicSharePayload,
  origin?: string,
): Promise<CivicShareActionResult> {
  if (!isCivicSharePayloadPublic(payload)) {
    return { ok: false, channel: "native", reason: "Share is only available for public content." };
  }

  const absoluteUrl = resolveAbsoluteCivicShareUrl(payload.url, origin);
  const data = buildWebShareData(payload, absoluteUrl);

  if (!canUseWebShareApi(typeof navigator !== "undefined" ? navigator : null, data)) {
    return { ok: false, channel: "native", reason: "Web Share unavailable" };
  }

  try {
    await navigator.share(data);
    return { ok: true, channel: "native" };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, channel: "native", reason: "cancelled" };
    }
    return { ok: false, channel: "native", reason: "Share failed" };
  }
}

export async function shareCivicChannel(
  channel: Exclude<CivicShareChannel, "native">,
  payload: CivicSharePayload,
  origin?: string,
): Promise<CivicShareActionResult> {
  if (!isCivicSharePayloadPublic(payload)) {
    return { ok: false, channel, reason: "Share is only available for public content." };
  }

  const absoluteUrl = resolveAbsoluteCivicShareUrl(payload.url, origin);

  switch (channel) {
    case "facebook":
      openExternal(buildFacebookShareUrl(absoluteUrl));
      return { ok: true, channel };
    case "x":
      openExternal(buildXShareUrl(absoluteUrl, payload.optionalText || payload.title));
      return { ok: true, channel };
    case "linkedin":
      openExternal(buildLinkedInShareUrl(absoluteUrl));
      return { ok: true, channel };
    case "email":
      if (typeof window !== "undefined") {
        window.location.href = buildMailtoShareUrl(payload, absoluteUrl);
      }
      return { ok: true, channel };
    case "instagram": {
      const native = await shareCivicViaNative(payload, origin);
      if (native.ok) {
        return { ok: true, channel: "instagram", detail: "Opened system share" };
      }
      const copied = await copyCivicShareLink(payload, origin);
      if (copied.ok) {
        return {
          ok: true,
          channel: "instagram",
          detail: "Link copied — Instagram cannot be pre-filled from the browser",
        };
      }
      return {
        ok: false,
        channel: "instagram",
        reason: "Instagram is not available in this browser. Copy the link instead.",
      };
    }
    case "copy":
      return copyCivicShareLink(payload, origin);
    default:
      return { ok: false, channel, reason: "Unknown channel" };
  }
}

export function buildPublicInitiativeSharePayload(input: {
  initiativeId: string;
  title: string;
  image?: string;
  optionalText?: string;
  origin?: string;
}): CivicSharePayload {
  const path = `/initiatives/public/${encodeURIComponent(input.initiativeId)}`;
  return {
    url: resolveAbsoluteCivicShareUrl(path, input.origin),
    title: input.title,
    image: input.image,
    optionalText: input.optionalText,
    contentType: "initiative",
    initiativeId: input.initiativeId,
  };
}

export function buildPublicPetitionSharePayload(input: {
  initiativeId: string;
  petitionId: string;
  title: string;
  image?: string;
  optionalText?: string;
  /** Prefer shareReference.url when available and public. */
  shareUrl?: string | null;
  origin?: string;
}): CivicSharePayload {
  const path =
    input.shareUrl?.trim() ||
    `/initiatives/public/${encodeURIComponent(input.initiativeId)}#petition`;

  return {
    url: resolveAbsoluteCivicShareUrl(path, input.origin),
    title: input.title,
    image: input.image,
    optionalText: input.optionalText,
    contentType: "petition",
    initiativeId: input.initiativeId,
    petitionId: input.petitionId,
  };
}
