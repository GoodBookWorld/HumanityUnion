import type { MediaUploadResponse } from "@hu/types";

import { API_BASE_URL } from "../../lib/api-client";
import { getStoredAccessToken } from "../auth/auth-token-store";
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

export async function uploadAvatarImage(file: File): Promise<MediaUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/v1/media/avatar`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getStoredAccessToken() ?? ""}`,
    },
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
    headers: {
      Authorization: `Bearer ${getStoredAccessToken() ?? ""}`,
    },
    body: formData,
  });

  return normalizeMediaUploadResponse(await readUploadEnvelope<MediaUploadResponse>(response));
}

export async function deleteUploadedMedia(mediaId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/media/${encodeURIComponent(mediaId)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${getStoredAccessToken() ?? ""}`,
    },
  });

  await readUploadEnvelope(response);
}
