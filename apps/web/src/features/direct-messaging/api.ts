import type {
  DirectConversationDetail,
  DirectConversationListResponse,
  DirectMessageListResponse,
  DirectMessageProjection,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";
import type { WorkspaceHomeAlliesSummary } from "../workspace-home/workspace-home-api";

export type {
  DirectConversationDetail,
  DirectConversationListResponse,
  DirectConversationParticipantProjection,
  DirectConversationSharedContext,
  DirectConversationSummary,
  DirectMessageListResponse,
  DirectMessageProjection,
} from "@hu/types";

/**
 * Communication UX Pack 03.2 Part 2 — the single "open or create Direct
 * Conversation with Participant" boundary every entry point (public
 * profile, Workspace Ally card, and any future Initiative Active Allies
 * widget) calls through. A Participant may be identified either by their
 * public `publicName` or by their `participantId` — an Ally is not
 * required to have a public profile — but never both; the server resolves
 * whichever is given into the real Participant and re-checks Privacy
 * itself (frontend state is not authority).
 */
export interface DirectConversationTarget {
  publicName?: string;
  participantId?: string;
}

export async function openOrCreateDirectConversation(
  target: DirectConversationTarget,
): Promise<DirectConversationDetail> {
  return apiRequest<DirectConversationDetail>("/api/v1/direct-messages/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(target),
  });
}

export async function fetchMyDirectConversations(): Promise<DirectConversationListResponse> {
  return apiRequest<DirectConversationListResponse>("/api/v1/direct-messages/conversations");
}

export async function fetchDirectConversation(conversationId: string): Promise<DirectConversationDetail> {
  return apiRequest<DirectConversationDetail>(
    `/api/v1/direct-messages/conversations/${encodeURIComponent(conversationId)}`,
  );
}

export async function fetchOlderDirectMessages(
  conversationId: string,
  beforeMessageId: string,
): Promise<DirectMessageListResponse> {
  return apiRequest<DirectMessageListResponse>(
    `/api/v1/direct-messages/conversations/${encodeURIComponent(conversationId)}/messages?before=${encodeURIComponent(beforeMessageId)}`,
  );
}

export async function sendDirectMessage(
  conversationId: string,
  text: string,
  clientMessageId: string,
): Promise<DirectMessageProjection> {
  return apiRequest<DirectMessageProjection>(
    `/api/v1/direct-messages/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, clientMessageId }),
    },
  );
}

export async function markDirectConversationRead(conversationId: string): Promise<void> {
  await apiRequest<{ ok: boolean }>(
    `/api/v1/direct-messages/conversations/${encodeURIComponent(conversationId)}/read`,
    { method: "POST" },
  );
}

/**
 * Communication UX Pack 03.3.1 Part 3/4 — powers the Workspace Messages
 * "Active Allies" panel. Calls the dedicated `GET /home/allies` route,
 * which reuses the exact same `buildAlliesSummary` aggregation as the
 * Workspace Home "Allies" widget (no duplicate service/projection/query),
 * without the cost of loading the entire unrelated `WorkspaceHomeState`.
 */
export async function fetchActiveAllies(): Promise<WorkspaceHomeAlliesSummary> {
  return apiRequest<WorkspaceHomeAlliesSummary>("/api/v1/workspace/home/allies");
}
