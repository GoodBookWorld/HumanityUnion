import { apiRequest } from "../../lib/api-client";
import {
  buildAdminIntegrityMediaAuthorsPath,
  type IntegrityMediaAuthorDirectoryPage,
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
