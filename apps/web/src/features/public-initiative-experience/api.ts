import type {
  InitiativeAlly,
  InitiativeDiscussionProposalCandidate,
  InitiativeSupportSignalKind,
  PublicInitiativeCollaborationParticipantsResult,
  PublicInitiativeDiscussionComment,
  PublicInitiativeExperienceProjection,
  PublicInitiativeSupportStatistics,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function getPublicInitiativeExperience(
  initiativeId: string,
): Promise<PublicInitiativeExperienceProjection> {
  return apiRequest<PublicInitiativeExperienceProjection>(
    `/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/experience`,
  );
}

export interface InitiativeCommentListResponse {
  comments: PublicInitiativeDiscussionComment[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export async function fetchInitiativeComments(
  initiativeId: string,
  offset = 0,
  limit = 40,
): Promise<InitiativeCommentListResponse> {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });

  return apiRequest<InitiativeCommentListResponse>(
    `/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/comments?${params.toString()}`,
  );
}

export async function postInitiativeComment(
  initiativeId: string,
  body: string,
): Promise<PublicInitiativeDiscussionComment> {
  return apiRequest<PublicInitiativeDiscussionComment>(
    `/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/comments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    },
  );
}

export async function updateInitiativeCommentReaction(
  initiativeId: string,
  commentId: string,
  reaction: "like" | "dislike" | "none",
): Promise<{ commentId: string; currentUserReaction: "like" | "dislike" | "none" }> {
  return apiRequest(
    `/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/comments/${encodeURIComponent(commentId)}/reactions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reaction }),
    },
  );
}

export async function markCommentAsProposalCandidate(
  initiativeId: string,
  commentId: string,
): Promise<InitiativeDiscussionProposalCandidate> {
  return apiRequest<InitiativeDiscussionProposalCandidate>(
    `/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/comments/${encodeURIComponent(commentId)}/proposal-candidate`,
    { method: "POST" },
  );
}

export async function expressInitiativeCollaborationInterest(
  initiativeId: string,
): Promise<InitiativeAlly> {
  return apiRequest<InitiativeAlly>(
    `/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/collaboration-interest`,
    { method: "POST" },
  );
}

export async function inviteCommentAuthorToAllies(
  initiativeId: string,
  commentId: string,
): Promise<InitiativeAlly> {
  return apiRequest<InitiativeAlly>(
    `/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/comments/${encodeURIComponent(commentId)}/allies-invitation`,
    { method: "POST" },
  );
}

/** Profile UX Pack 01 Part 2/8 — the Initiative Author's Collaboration working list. */
export async function fetchInitiativeCollaborationParticipants(
  initiativeId: string,
): Promise<PublicInitiativeCollaborationParticipantsResult> {
  return apiRequest<PublicInitiativeCollaborationParticipantsResult>(
    `/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/collaboration-participants`,
  );
}

/** Profile UX Pack 01 Part 5/6 — Initiative Author Accept/Decline of a Participant's own request. */
export async function respondToInitiativeCollaborationInterest(
  initiativeId: string,
  participantId: string,
  response: "accept" | "decline",
): Promise<InitiativeAlly> {
  return apiRequest<InitiativeAlly>(
    `/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/collaboration-interest/${encodeURIComponent(participantId)}/respond`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response }),
    },
  );
}

export async function updateInitiativeSupportSignal(
  initiativeId: string,
  signal: InitiativeSupportSignalKind,
): Promise<PublicInitiativeSupportStatistics & { transparencyNote: string }> {
  return apiRequest(
    `/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/support/signal`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signal }),
    },
  );
}

export async function toggleInitiativeBookmark(
  initiativeId: string,
): Promise<PublicInitiativeSupportStatistics & { transparencyNote: string }> {
  return apiRequest(
    `/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/support/bookmark`,
    { method: "POST" },
  );
}

export async function fetchInitiativeSupportStatistics(
  initiativeId: string,
): Promise<PublicInitiativeSupportStatistics & { transparencyNote: string }> {
  return apiRequest(`/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/support`);
}
