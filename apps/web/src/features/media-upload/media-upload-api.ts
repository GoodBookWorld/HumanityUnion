import type { InitiativeCoverMedia, MediaUploadResponse } from "@hu/types";

import { API_BASE_URL } from "../../lib/api-client";
import { resolveMediaUrl } from "./media-url";

async function readUploadEnvelope<T>(response: Response): Promise<T> {
  const body = (await response.json()) as {
    success: boolean;
    data: T;
    message: string;
  };

  if (!response.ok || !body.success) {
    throw new Error(body.message || "Media upload failed.");
  }

  return body.data;
}

function normalizeMediaUploadResponse(record: MediaUploadResponse): MediaUploadResponse {
  return {
    ...record,
    mediaUrl: resolveMediaUrl(record.mediaUrl) ?? record.mediaUrl,
  };
}

/** Pack 07 — cookie credentials only (no Bearer from Web Storage). */
const credentialedFetchInit = {
  credentials: "include" as const,
};

export async function uploadAvatarImage(file: File): Promise<MediaUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/v1/media/avatar`, {
    method: "POST",
    ...credentialedFetchInit,
    body: formData,
  });

  return normalizeMediaUploadResponse(await readUploadEnvelope<MediaUploadResponse>(response));
}

export async function uploadInitiativeImage(
  initiativeId: string,
  file: File,
): Promise<MediaUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("initiativeId", initiativeId);

  const response = await fetch(`${API_BASE_URL}/api/v1/media/initiative-image`, {
    method: "POST",
    ...credentialedFetchInit,
    body: formData,
  });

  return normalizeMediaUploadResponse(await readUploadEnvelope<MediaUploadResponse>(response));
}

/** Publishing Workspace Pack 05 — Blog cover image upload (purpose blog-image). */
export async function uploadBlogImage(file: File): Promise<MediaUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/v1/media/blog-image`, {
    method: "POST",
    ...credentialedFetchInit,
    body: formData,
  });

  return normalizeMediaUploadResponse(await readUploadEnvelope<MediaUploadResponse>(response));
}

/**
 * UX Evolution Pack 03 Part 6 — validates and canonicalizes an approved
 * external video link (YouTube/Vimeo). The backend never fetches the URL
 * itself; it only parses it against a fixed provider allowlist.
 */
export async function submitInitiativeVideoLink(
  initiativeId: string,
  url: string,
): Promise<InitiativeCoverMedia> {
  const response = await fetch(`${API_BASE_URL}/api/v1/media/initiative-video-link`, {
    method: "POST",
    ...credentialedFetchInit,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ initiativeId, url }),
  });

  return readUploadEnvelope<InitiativeCoverMedia>(response);
}

export async function deleteUploadedMedia(mediaId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/media/${encodeURIComponent(mediaId)}`, {
    method: "DELETE",
    ...credentialedFetchInit,
  });

  await readUploadEnvelope(response);
}
