import type { InitiativeDiscussionProposalCandidate } from "@hu/types";

import {
  deleteProposalCandidatesByInitiativeIdForTests,
  deleteProposalCandidatesBySourceParticipantIdForTests,
  findProposalCandidateDocumentByCommentId,
  insertProposalCandidateDocument,
  isDuplicateProposalCandidateError,
  listProposalCandidateDocumentsByCommentIds,
  listProposalCandidateDocumentsBySourceParticipantId,
} from "./persistence/initiative-proposal-candidate.repository.js";

/**
 * Durable Mongo-backed store for Discussion -> Improvement Proposal
 * Candidates (UX Evolution Pack 02.1 — Recover Durable Persistence).
 *
 * At most one candidate exists per sourceCommentId — "the same comment
 * cannot create duplicate active Proposal records" (Part 5 / Part 6),
 * now enforced by the database (see
 * `initiative_discussion_proposal_candidates_source_comment_unique` in
 * mongo-indexes.ts), not just an in-memory Map key.
 *
 * This module is a thin facade over `persistence/initiative-proposal
 * -candidate.repository.ts`, preserving the exact function names the
 * service already depends on (Pack 02) — every function is now `async`
 * since a Mongo read/write cannot be synchronous.
 */

export async function findProposalCandidateByCommentId(
  commentId: string,
): Promise<InitiativeDiscussionProposalCandidate | null> {
  return findProposalCandidateDocumentByCommentId(commentId);
}

/**
 * Idempotent: if another concurrent request already created the candidate
 * for this exact comment (a duplicate-key race on `sourceCommentId`), the
 * already-committed candidate is returned instead of the write failing —
 * the database's unique index is the uniqueness authority, not an
 * application-level "does one already exist" check.
 */
export async function createProposalCandidate(
  candidate: InitiativeDiscussionProposalCandidate,
): Promise<InitiativeDiscussionProposalCandidate> {
  try {
    await insertProposalCandidateDocument(candidate);
    return candidate;
  } catch (error) {
    if (isDuplicateProposalCandidateError(error)) {
      const existing = await findProposalCandidateDocumentByCommentId(candidate.sourceCommentId);

      if (existing) {
        return existing;
      }
    }

    throw error;
  }
}

export async function listProposalCandidatesByCommentIds(
  commentIds: readonly string[],
): Promise<Map<string, InitiativeDiscussionProposalCandidate>> {
  return listProposalCandidateDocumentsByCommentIds(commentIds);
}

/**
 * Pack 19C.2B — candidates attributed to the Discussion comment author
 * (`sourceParticipantId`), not the Participant who clicked Proposal.
 */
export async function listProposalCandidatesBySourceParticipantId(
  sourceParticipantId: string,
): Promise<InitiativeDiscussionProposalCandidate[]> {
  return listProposalCandidateDocumentsBySourceParticipantId(sourceParticipantId);
}

/**
 * Pack 19C.2B — one count per distinct `candidateId` for the source Participant.
 */
export function countProposalCandidatesForSourceParticipant(
  candidates: readonly Pick<
    InitiativeDiscussionProposalCandidate,
    "candidateId" | "sourceParticipantId" | "status"
  >[],
  sourceParticipantId: string,
): number {
  const seen = new Set<string>();

  for (const candidate of candidates) {
    if (
      candidate.sourceParticipantId === sourceParticipantId &&
      candidate.status === "candidate"
    ) {
      seen.add(candidate.candidateId);
    }
  }

  return seen.size;
}

/**
 * Test-only, narrowly scoped to one initiative's candidates (Recovery Task
 * 31 Part 19 style: exact selector, no delete-all, no wildcard mode). A
 * no-op when MongoDB is not configured.
 */
export async function resetInitiativeProposalCandidateStoreForTests(
  initiativeId: string,
): Promise<void> {
  await deleteProposalCandidatesByInitiativeIdForTests(initiativeId);
}

export {
  deleteProposalCandidatesBySourceParticipantIdForTests,
};
