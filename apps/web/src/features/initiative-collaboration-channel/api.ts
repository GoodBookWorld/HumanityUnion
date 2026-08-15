import type {
  InitiativeCollaborationChannelHistoryResult,
  InitiativeCollaborationChannelReadState,
  InitiativeCollaborationChannelSummary,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export type {
  InitiativeCollaborationChannelHistoryResult,
  InitiativeCollaborationChannelMessageView,
  InitiativeCollaborationChannelReadState,
  InitiativeCollaborationChannelSummary,
} from "@hu/types";

/**
 * Communication UX Pack 03.5 — the Initiative Collaboration Channel's web
 * client. Completely independent from `direct-messaging/api.ts` (Part 1):
 * a different base path (`/api/v1/public/initiatives/:initiativeId
 * /collaboration-channel/...`), a different persistence domain, and every
 * call requires authentication (Part 2 — never a guest-safe read, unlike
 * the Active Allies team endpoint this feature sits beside).
 */
function channelBasePath(initiativeId: string): string {
  return `/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/collaboration-channel`;
}

export async function getInitiativeCollaborationChannelSummary(
  initiativeId: string,
): Promise<InitiativeCollaborationChannelSummary> {
  return apiRequest<InitiativeCollaborationChannelSummary>(`${channelBasePath(initiativeId)}/summary`);
}

export async function listInitiativeCollaborationChannelHistory(
  initiativeId: string,
  before?: { createdAt: string; messageId: string },
): Promise<InitiativeCollaborationChannelHistoryResult> {
  const query = before
    ? `?beforeCreatedAt=${encodeURIComponent(before.createdAt)}&beforeMessageId=${encodeURIComponent(before.messageId)}`
    : "";

  return apiRequest<InitiativeCollaborationChannelHistoryResult>(
    `${channelBasePath(initiativeId)}/messages${query}`,
  );
}

export async function sendInitiativeCollaborationChannelMessage(
  initiativeId: string,
  text: string,
): Promise<InitiativeCollaborationChannelHistoryResult["messages"][number]> {
  return apiRequest<InitiativeCollaborationChannelHistoryResult["messages"][number]>(
    `${channelBasePath(initiativeId)}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    },
  );
}

export async function markInitiativeCollaborationChannelRead(
  initiativeId: string,
): Promise<InitiativeCollaborationChannelReadState> {
  return apiRequest<InitiativeCollaborationChannelReadState>(`${channelBasePath(initiativeId)}/read`, {
    method: "POST",
  });
}
