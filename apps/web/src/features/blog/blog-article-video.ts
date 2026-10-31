import {
  parseExternalVideoUrl,
  type BlogExternalVideo,
  type ParsedBlogExternalVideoUrl,
} from "@hu/types";

/** Returns the canonical player identity, or null when the stored video cannot be shown. */
export function acceptedBlogExternalVideo(video: BlogExternalVideo): ParsedBlogExternalVideoUrl | null {
  const canonical =
    video.provider === "youtube"
      ? `https://www.youtube.com/watch?v=${video.providerVideoId}`
      : video.provider === "vimeo"
        ? `https://vimeo.com/${video.providerVideoId}`
        : video.provider === "integrity-media"
          ? `https://integrity.website/embed/videos/${video.providerVideoId}`
          : "";
  if (!canonical) {
    return null;
  }
  const parsed = parseExternalVideoUrl(canonical, { allowIntegrityMedia: true });
  if (
    !parsed ||
    parsed.provider !== video.provider ||
    parsed.providerVideoId !== video.providerVideoId
  ) {
    return null;
  }
  return parsed;
}
