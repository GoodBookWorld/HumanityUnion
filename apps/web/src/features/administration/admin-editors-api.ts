import type {
  AdminEditorDirectoryItem,
  AdminEditorDirectoryResponse,
  AdminEditorMutationResult,
  AdminEditorSummary,
  AssignEditorGrantInput,
  EditorGrantStatus,
  UpdateEditorGrantInput,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function fetchAdminEditorSummary(): Promise<AdminEditorSummary> {
  return apiRequest<AdminEditorSummary>("/api/v1/admin/editors/summary");
}

export async function listAdminEditors(query: {
  status?: EditorGrantStatus;
  limit?: number;
  offset?: number;
} = {}): Promise<AdminEditorDirectoryResponse> {
  const params = new URLSearchParams();
  if (query.status) {
    params.set("status", query.status);
  }
  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }
  if (query.offset !== undefined) {
    params.set("offset", String(query.offset));
  }
  const suffix = params.toString();
  return apiRequest<AdminEditorDirectoryResponse>(
    `/api/v1/admin/editors${suffix ? `?${suffix}` : ""}`,
  );
}

export async function getAdminEditor(editorGrantId: string): Promise<AdminEditorDirectoryItem> {
  return apiRequest<AdminEditorDirectoryItem>(`/api/v1/admin/editors/${editorGrantId}`);
}

export async function assignAdminEditor(
  body: AssignEditorGrantInput,
): Promise<AdminEditorMutationResult> {
  return apiRequest<AdminEditorMutationResult>("/api/v1/admin/editors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function updateAdminEditor(
  editorGrantId: string,
  body: UpdateEditorGrantInput,
): Promise<AdminEditorMutationResult> {
  return apiRequest<AdminEditorMutationResult>(`/api/v1/admin/editors/${editorGrantId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function activateAdminEditor(
  editorGrantId: string,
): Promise<AdminEditorMutationResult> {
  return apiRequest<AdminEditorMutationResult>(
    `/api/v1/admin/editors/${editorGrantId}/activate`,
    { method: "POST" },
  );
}

export async function deactivateAdminEditor(
  editorGrantId: string,
): Promise<AdminEditorMutationResult> {
  return apiRequest<AdminEditorMutationResult>(
    `/api/v1/admin/editors/${editorGrantId}/deactivate`,
    { method: "POST" },
  );
}
