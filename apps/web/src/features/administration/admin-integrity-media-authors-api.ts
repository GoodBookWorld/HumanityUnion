import { apiRequest } from "../../lib/api-client";
import {
  buildAdminIntegrityMediaAuthorHistoryPath,
  buildAdminIntegrityMediaAuthorReadPath,
  buildAdminIntegrityMediaAuthorsPath,
  type IntegrityMediaAuthorDirectoryPage,
  type IntegrityMediaAuthorHistoryPage,
  type IntegrityMediaAuthorListState,
  type IntegrityMediaAuthorMessageDelivery,
  type IntegrityMediaAuthorMessageRequest,
} from "./admin-integrity-media-authors-model";

export interface ListAdminIntegrityMediaAuthorsQuery {
  state?: IntegrityMediaAuthorListState;
  limit?: number;
  offset?: number;
}

export async function listAdminIntegrityMediaAuthors(
  query: ListAdminIntegrityMediaAuthorsQuery = {},
): Promise<IntegrityMediaAuthorDirectoryPage> {
  return apiRequest<IntegrityMediaAuthorDirectoryPage>(buildAdminIntegrityMediaAuthorsPath(query));
}

export async function listAdminIntegrityMediaAuthorHistory(
  memberId: string,
  query: { limit: number; cursor?: string },
): Promise<IntegrityMediaAuthorHistoryPage> {
  return apiRequest<IntegrityMediaAuthorHistoryPage>(
    buildAdminIntegrityMediaAuthorHistoryPath(memberId, query),
  );
}

export async function sendAdminIntegrityMediaAuthorMessage(
  memberId: string,
  input: IntegrityMediaAuthorMessageRequest,
): Promise<IntegrityMediaAuthorMessageDelivery> {
  return apiRequest<IntegrityMediaAuthorMessageDelivery>(
    `/api/v1/admin/integrity-media/authors/${encodeURIComponent(memberId)}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export async function markAdminIntegrityMediaAuthorMessagesRead(
  memberId: string,
  messageIds: readonly string[],
): Promise<{ markedCount: number; unreadMessageCount: number }> {
  return apiRequest<{ markedCount: number; unreadMessageCount: number }>(
    buildAdminIntegrityMediaAuthorReadPath(memberId),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageIds }),
    },
  );
}

export async function sendAdminIntegrityMediaAuthorChat(
  memberId: string,
  input: { body: string },
): Promise<IntegrityMediaAuthorMessageDelivery> {
  return apiRequest<IntegrityMediaAuthorMessageDelivery>(
    `/api/v1/admin/integrity-media/authors/${encodeURIComponent(memberId)}/chat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}
