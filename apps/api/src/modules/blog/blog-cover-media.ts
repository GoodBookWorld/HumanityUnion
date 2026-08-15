import type { BlogCoverMedia } from "@hu/types";

import { findMediaRecordByUrl, getMediaRecordById } from "../media-upload/media-upload.service.js";
import { isPlatformMediaUrl } from "../media-upload/media-upload.validation.js";
import { BlogValidationError } from "./blog.errors.js";

const MAX_COVER_ALT_TEXT = 200;

function normalizeCoverAltText(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new BlogValidationError("coverMedia.altText must be a string.");
  }

  const altText = value.trim().replace(/\s+/g, " ");
  if (altText.length > MAX_COVER_ALT_TEXT) {
    throw new BlogValidationError(
      `coverMedia.altText must be at most ${MAX_COVER_ALT_TEXT} characters.`,
    );
  }

  return altText.length > 0 ? altText : undefined;
}

/**
 * Cover media must reference an existing platform media record (purpose blog-image
 * or other approved image purposes). No arbitrary external blobs on BlogPost.
 *
 * Pack 05 adds optional Author-provided `altText` (never AI-generated here).
 */
export function resolveBlogCoverMedia(input: unknown): BlogCoverMedia | null {
  if (input === undefined || input === null) {
    return null;
  }

  if (typeof input !== "object") {
    throw new BlogValidationError("coverMedia must be an object with mediaId or mediaUrl.");
  }

  const record = input as { mediaId?: unknown; mediaUrl?: unknown; altText?: unknown };
  let media =
    typeof record.mediaId === "string" && record.mediaId.trim()
      ? getMediaRecordById(record.mediaId.trim())
      : undefined;

  if (!media && typeof record.mediaUrl === "string" && record.mediaUrl.trim()) {
    const url = record.mediaUrl.trim();
    if (!isPlatformMediaUrl(url) && !url.includes("/api/v1/media/files/")) {
      throw new BlogValidationError("coverMedia.mediaUrl must reference platform media.");
    }
    media = findMediaRecordByUrl(url);
  }

  if (!media) {
    throw new BlogValidationError("coverMedia must reference an existing media upload.");
  }

  if (media.purpose !== "blog-image" && media.purpose !== "initiative-image") {
    throw new BlogValidationError("coverMedia must use a blog-image or initiative-image upload.");
  }

  const altText = normalizeCoverAltText(record.altText);

  return {
    mediaId: media.mediaId,
    mediaUrl: media.mediaUrl,
    ...(altText ? { altText } : {}),
  };
}
