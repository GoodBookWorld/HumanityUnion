import { parseExternalVideoUrl, type BlogExternalVideo } from "@hu/types";

/**
 * Accept a stored provider and video id only when the canonical parser
 * reproduces that same identity. Anything else is treated as unavailable.
 */
export function storedExternalVideo(
  value:
    | {
        source?: string;
        provider?: string;
        providerVideoId?: string;
      }
    | null
    | undefined,
): BlogExternalVideo | undefined {
  if (!value || value.source !== "integrity-media") {
    return undefined;
  }
  if (typeof value.providerVideoId !== "string" || !value.providerVideoId) {
    return undefined;
  }
  const canonical =
    value.provider === "youtube"
      ? `https://www.youtube.com/watch?v=${value.providerVideoId}`
      : value.provider === "vimeo"
        ? `https://vimeo.com/${value.providerVideoId}`
        : value.provider === "integrity-media"
          ? `https://integrity.website/embed/videos/${value.providerVideoId}`
          : "";
  if (!canonical) {
    return undefined;
  }
  const parsed = parseExternalVideoUrl(canonical, { allowIntegrityMedia: true });
  if (
    !parsed ||
    parsed.provider !== value.provider ||
    parsed.providerVideoId !== value.providerVideoId
  ) {
    return undefined;
  }
  return {
    source: "integrity-media",
    provider: parsed.provider,
    providerVideoId: parsed.providerVideoId,
  };
}
