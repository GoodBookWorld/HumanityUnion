import { parseExternalVideoUrl, type BlogExternalVideo, type ParsedExternalVideoUrl } from "@hu/types";

/** Returns the canonical player identity, or null when the stored video cannot be shown. */
export function acceptedBlogExternalVideo(video: BlogExternalVideo): ParsedExternalVideoUrl | null {
  const canonical =
    video.provider === "youtube"
      ? `https://www.youtube.com/watch?v=${video.providerVideoId}`
      : video.provider === "vimeo"
        ? `https://vimeo.com/${video.providerVideoId}`
        : "";
  if (!canonical) {
    return null;
  }
  const parsed = parseExternalVideoUrl(canonical);
  if (
    !parsed ||
    parsed.provider !== video.provider ||
    parsed.providerVideoId !== video.providerVideoId
  ) {
    return null;
  }
  return parsed;
}
