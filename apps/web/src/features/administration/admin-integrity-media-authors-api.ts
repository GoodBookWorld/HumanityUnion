import { apiRequest } from "../../lib/api-client";
import {
  buildAdminIntegrityMediaAuthorHistoryPath,
  buildAdminIntegrityMediaAuthorReadPath,
  buildAdminIntegrityMediaAuthorReplyTargetPath,
  buildAdminIntegrityMediaAuthorsPath,
  findIntegrityMediaAuthorDirectoryRow,
  isIntegrityMediaAuthorReplyMessageId,
  type IntegrityMediaAuthorDirectoryPage,
  type IntegrityMediaAuthorHistoryPage,
  type IntegrityMediaAuthorListState,
  type IntegrityMediaAuthorMessageDelivery,
  type IntegrityMediaAuthorMessageRequest,
  type IntegrityMediaAuthorRow,
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

/**
 * Resolve one accepted reply to its directory row. The browser supplies only
 * the message id. A miss, rejection, or identity mismatch opens nothing.
 */
export async function resolveAdminIntegrityMediaAuthorReply(
  messageId: string,
): Promise<IntegrityMediaAuthorRow | null> {
  if (!isIntegrityMediaAuthorReplyMessageId(messageId)) {
    return null;
  }

  try {
    const identity = await apiRequest<{ memberId?: string }>(
      buildAdminIntegrityMediaAuthorReplyTargetPath(messageId),
    );
    const memberId = identity.memberId?.trim() ?? "";
    if (!memberId) {
      return null;
    }
    const row = await findIntegrityMediaAuthorDirectoryRow(memberId, (query) =>
      listAdminIntegrityMediaAuthors(query),
    );
    return row?.memberId === memberId ? row : null;
  } catch {
    return null;
  }
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
