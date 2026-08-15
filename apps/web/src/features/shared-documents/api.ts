import type { SharedDocumentContextRef, SharedDocumentListResult, SharedDocumentView } from "@hu/types";

import { API_BASE_URL, apiRequest, ApiRequestError } from "../../lib/api-client";

export type {
  SharedDocumentContextRef,
  SharedDocumentContextType,
  SharedDocumentListResult,
  SharedDocumentUploaderIdentity,
  SharedDocumentVerificationStatus,
  SharedDocumentView,
} from "@hu/types";

/**
 * Communication UX Pack 03.7 Part 1 — one unified Shared Documents module;
 * the only thing that differs between Direct Conversations, the
 * Collaboration Channel, and Collaboration Sessions is this one base
 * path, resolved from the same discriminated `SharedDocumentContextRef`
 * the backend uses. Every other function below is context-agnostic.
 */
function sharedDocumentsBasePath(context: SharedDocumentContextRef): string {
  switch (context.contextType) {
    case "direct_conversation":
      return `/api/v1/direct-messages/conversations/${encodeURIComponent(context.conversationId)}/documents`;
    case "collaboration_channel":
      return `/api/v1/public/initiatives/${encodeURIComponent(context.initiativeId)}/collaboration-channel/documents`;
    case "collaboration_session":
      return `/api/v1/public/initiatives/${encodeURIComponent(context.initiativeId)}/collaboration-sessions/${encodeURIComponent(context.sessionId)}/documents`;
    case "official_response":
      return `/api/v1/public/initiatives/${encodeURIComponent(context.initiativeId)}/official-responses/${encodeURIComponent(context.responseId)}/documents`;
  }
}

function sharedDocumentPath(context: SharedDocumentContextRef, documentId: string): string {
  return `${sharedDocumentsBasePath(context)}/${encodeURIComponent(documentId)}`;
}

export async function listSharedDocuments(context: SharedDocumentContextRef): Promise<SharedDocumentListResult> {
  return apiRequest<SharedDocumentListResult>(sharedDocumentsBasePath(context));
}

/**
 * Part 13/16 — multipart upload bypasses the JSON-only `apiRequest`
 * wrapper (mirrors `media-upload-api.ts`'s established convention: the
 * browser must set its own `multipart/form-data` boundary, which
 * `apiRequest` never does).
 */
async function readSharedDocumentEnvelope<T>(response: Response): Promise<T> {
  let body: { success: boolean; data: T; message: string } | null = null;

  try {
    body = (await response.json()) as { success: boolean; data: T; message: string };
  } catch {
    // fall through to the generic error below
  }

  if (!response.ok || !body?.success) {
    throw new ApiRequestError(
      body?.message || "The Humanity Union service returned an unexpected response. Please try again shortly.",
      response.status,
    );
  }

  return body.data;
}

export async function uploadSharedDocument(
  context: SharedDocumentContextRef,
  file: File,
): Promise<SharedDocumentView> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}${sharedDocumentsBasePath(context)}`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  return readSharedDocumentEnvelope<SharedDocumentView>(response);
}

/** Part 9 — replacing a file never overwrites it; the server always creates a new immutable version. */
export async function replaceSharedDocument(
  context: SharedDocumentContextRef,
  documentId: string,
  file: File,
): Promise<SharedDocumentView> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}${sharedDocumentPath(context, documentId)}`, {
    method: "PUT",
    credentials: "include",
    body: formData,
  });

  return readSharedDocumentEnvelope<SharedDocumentView>(response);
}

export async function removeSharedDocument(context: SharedDocumentContextRef, documentId: string): Promise<void> {
  await apiRequest<null>(sharedDocumentPath(context, documentId), { method: "DELETE" });
}

/**
 * Part 8 — every download is a protected, authorized fetch (never a bare
 * `<a href>` to a public URL). Pack 07: HttpOnly cookie credentials.
 */
export async function downloadSharedDocument(
  context: SharedDocumentContextRef,
  documentId: string,
  fileName: string,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${sharedDocumentPath(context, documentId)}/download`, {
    credentials: "include",
  });

  if (!response.ok) {
    let message = "Unable to download this document. Please try again.";

    try {
      const body = (await response.json()) as { message?: string };
      message = body.message || message;
    } catch {
      // non-JSON error body; keep the generic message
    }

    throw new ApiRequestError(message, response.status);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}
