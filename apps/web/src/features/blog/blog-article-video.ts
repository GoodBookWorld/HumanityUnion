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

export type BlogArticleMediaPoster =
  | { kind: "cover" }
  | { kind: "youtube-thumbnail"; url: string };

/**
 * One visual block per article. Without a playable video the cover renders as
 * before. With a video, the cover (or the YouTube thumbnail) is a poster that
 * mounts the player on click; with no poster the player renders directly.
 */
export type BlogArticleMediaPlan =
  | { kind: "cover" }
  | { kind: "video"; video: ParsedBlogExternalVideoUrl; poster: BlogArticleMediaPoster | null };

export function planBlogArticleMedia(input: {
  hasCoverImage: boolean;
  video?: BlogExternalVideo | null;
}): BlogArticleMediaPlan {
  const video = input.video ? acceptedBlogExternalVideo(input.video) : null;
  if (!video) {
    return { kind: "cover" };
  }
  if (input.hasCoverImage) {
    return { kind: "video", video, poster: { kind: "cover" } };
  }
  if (video.provider === "youtube") {
    return {
      kind: "video",
      video,
      poster: {
        kind: "youtube-thumbnail",
        url: `https://img.youtube.com/vi/${encodeURIComponent(video.providerVideoId)}/hqdefault.jpg`,
      },
    };
  }
  return { kind: "video", video, poster: null };
}
