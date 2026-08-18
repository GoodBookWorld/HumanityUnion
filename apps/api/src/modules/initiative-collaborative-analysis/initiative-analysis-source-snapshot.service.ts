import type {
  InitiativeAnalysisSourceArgument,
  InitiativeAnalysisSourceCommentRef,
  InitiativeAnalysisSourceConcern,
  InitiativeAnalysisSourceProposalCandidate,
  InitiativeAnalysisSourceSnapshot,
  InitiativeAnalysisSourceTopic,
  InitiativeComment,
} from "@hu/types";

import { listApprovedInitiativeComments } from "../initiative-comments/index.js";
import { getInitiativeCommentReactionSummaries } from "../initiative-comment-reactions/index.js";
import {
  listActiveAlliesForInitiative,
  listCollaborationParticipantsForInitiative,
} from "../initiative-discussion-collaboration/index.js";
import { listProposalCandidatesByCommentIds } from "../initiative-discussion-collaboration/initiative-proposal-candidate.store.js";

/**
 * Initiative Lifecycle — Part B, Section 2/3/6: Automatic Source
 * Collection.
 *
 * Every number/list here reads EXISTING persisted data only — no AI, no
 * invented categorization. See the field-by-field derivation notes on
 * `InitiativeAnalysisSourceSnapshot` in `@hu/types`.
 *
 * Resilience: several upstream stores (Allies, Proposal Candidates) are
 * Mongo-only with no memory-mode fallback. A misconfigured/unavailable
 * dependency must never break the whole Collaborative Analysis workspace —
 * each source is fetched independently and defaults to an honest "0 / none
 * collected" rather than throwing, matching the "no invented information"
 * rule (an unavailable count is reported as absent, never guessed).
 */

const MAX_COMMENT_PAGES = 10;
const COMMENT_PAGE_SIZE = 40;
const MIN_TOPIC_WORD_LENGTH = 4;
const MIN_TOPIC_MENTIONS = 2;
const TOP_TOPICS_LIMIT = 8;
const TOP_ARGUMENTS_LIMIT = 5;
const TOP_CONCERNS_LIMIT = 5;
const MAX_OPEN_QUESTIONS = 10;
const MAX_PROPOSAL_CANDIDATES = 20;
const EXCERPT_MAX_LENGTH = 160;

const STOPWORDS = new Set([
  "this", "that", "these", "those", "with", "from", "have", "will", "would",
  "could", "should", "there", "their", "about", "which", "because", "just",
  "also", "into", "than", "then", "when", "what", "where", "your", "them",
  "they", "were", "been", "being", "does", "doesn", "cannot", "really",
  "very", "some", "such", "more", "most", "much", "many", "make", "made",
  "like", "want", "need", "think", "know", "even", "still", "well", "good",
  "bad", "here", "over", "only", "other", "another", "each", "every",
]);

function safely<T>(operation: () => Promise<T>, fallback: T, label: string): Promise<T> {
  return operation().catch((error) => {
    console.warn(`[initiative-analysis-source-snapshot] ${label} unavailable: ${String(error)}`);
    return fallback;
  });
}

function buildDiscussionPanelUrl(initiativeId: string): string {
  return `/initiatives/public/${encodeURIComponent(initiativeId)}#discussion`;
}

/**
 * Canonical per-comment deep link: opens Discussion Center and targets
 * `#comment-{commentId}` (stable DOM id on the public Initiative shell).
 */
export function buildDiscussionCommentUrl(initiativeId: string, commentId: string): string {
  return `/initiatives/public/${encodeURIComponent(initiativeId)}#comment-${encodeURIComponent(commentId)}`;
}

function buildExcerpt(body: string): string {
  const trimmed = body.trim();
  return trimmed.length > EXCERPT_MAX_LENGTH ? `${trimmed.slice(0, EXCERPT_MAX_LENGTH - 1)}…` : trimmed;
}

function toCommentRef(comment: InitiativeComment, initiativeId: string): InitiativeAnalysisSourceCommentRef {
  return {
    commentId: comment.commentId,
    excerpt: buildExcerpt(comment.body),
    authorDisplayName: comment.authorDisplayName,
    discussionUrl: buildDiscussionCommentUrl(initiativeId, comment.commentId),
  };
}

function tokenize(body: string): string[] {
  return body
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= MIN_TOPIC_WORD_LENGTH && !STOPWORDS.has(word));
}

function buildMostDiscussedTopics(comments: readonly InitiativeComment[]): InitiativeAnalysisSourceTopic[] {
  const counts = new Map<string, number>();

  for (const comment of comments) {
    for (const word of tokenize(comment.body)) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .filter(([, mentionCount]) => mentionCount >= MIN_TOPIC_MENTIONS)
    .sort((left, right) => right[1] - left[1])
    .slice(0, TOP_TOPICS_LIMIT)
    .map(([topic, mentionCount]) => ({ topic, mentionCount }));
}

async function collectAllApprovedComments(initiativeId: string): Promise<InitiativeComment[]> {
  const collected: InitiativeComment[] = [];
  let offset = 0;

  for (let page = 0; page < MAX_COMMENT_PAGES; page += 1) {
    const result = await listApprovedInitiativeComments({
      initiativeId,
      limit: COMMENT_PAGE_SIZE,
      offset,
    });

    collected.push(...result.comments);

    if (!result.hasMore) {
      break;
    }

    offset += COMMENT_PAGE_SIZE;
  }

  return collected;
}

export async function buildInitiativeAnalysisSourceSnapshot(
  initiativeId: string,
): Promise<InitiativeAnalysisSourceSnapshot> {
  const discussionUrl = buildDiscussionPanelUrl(initiativeId);

  const [comments, activeAllies, collaborationResult] = await Promise.all([
    safely(() => collectAllApprovedComments(initiativeId), [], "discussion comments"),
    safely(() => listActiveAlliesForInitiative(initiativeId), [], "active allies"),
    safely(
      () => listCollaborationParticipantsForInitiative(initiativeId, null),
      { participants: [], isViewerInitiativeSteward: false },
      "collaboration participants",
    ),
  ]);

  const commentIds = comments.map((comment) => comment.commentId);

  const [reactionSummaries, proposalCandidatesByComment] = await Promise.all([
    safely(
      () => getInitiativeCommentReactionSummaries({ commentIds }),
      new Map(),
      "comment reaction summaries",
    ),
    safely(
      () => listProposalCandidatesByCommentIds(commentIds),
      new Map(),
      "proposal candidates",
    ),
  ]);

  let helpfulCount = 0;
  let notHelpfulCount = 0;
  const openQuestions: InitiativeAnalysisSourceCommentRef[] = [];
  const argumentCandidates: Array<{ comment: InitiativeComment; helpfulCount: number }> = [];
  const concernCandidates: Array<{ comment: InitiativeComment; notHelpfulCount: number }> = [];
  const proposalCandidates: InitiativeAnalysisSourceProposalCandidate[] = [];

  for (const comment of comments) {
    const summary = reactionSummaries.get(comment.commentId) ?? {
      likes: 0,
      dislikes: 0,
      currentUserReaction: "none" as const,
    };
    helpfulCount += summary.likes;
    notHelpfulCount += summary.dislikes;

    if (comment.body.trim().endsWith("?")) {
      openQuestions.push(toCommentRef(comment, initiativeId));
    } else {
      argumentCandidates.push({ comment, helpfulCount: summary.likes });
      concernCandidates.push({ comment, notHelpfulCount: summary.dislikes });
    }

    const candidate = proposalCandidatesByComment.get(comment.commentId);

    if (candidate) {
      proposalCandidates.push({
        ...toCommentRef(comment, initiativeId),
        candidateId: candidate.candidateId,
      });
    }
  }

  const repeatedArguments: InitiativeAnalysisSourceArgument[] = argumentCandidates
    .filter((entry) => entry.helpfulCount > 0)
    .sort((left, right) => right.helpfulCount - left.helpfulCount)
    .slice(0, TOP_ARGUMENTS_LIMIT)
    .map((entry) => ({
      ...toCommentRef(entry.comment, initiativeId),
      helpfulCount: entry.helpfulCount,
    }));

  const repeatedConcerns: InitiativeAnalysisSourceConcern[] = concernCandidates
    .filter((entry) => entry.notHelpfulCount > 0)
    .sort((left, right) => right.notHelpfulCount - left.notHelpfulCount)
    .slice(0, TOP_CONCERNS_LIMIT)
    .map((entry) => ({
      ...toCommentRef(entry.comment, initiativeId),
      notHelpfulCount: entry.notHelpfulCount,
    }));

  const readyToCollaborateCount = collaborationResult.participants.filter(
    (participant) => participant.status === "interest_pending",
  ).length;

  return {
    initiativeId,
    generatedAt: new Date().toISOString(),
    discussionStatistics: {
      commentCount: comments.length,
      helpfulCount,
      notHelpfulCount,
    },
    mostDiscussedTopics: buildMostDiscussedTopics(comments),
    openQuestions: openQuestions.slice(0, MAX_OPEN_QUESTIONS),
    repeatedArguments,
    repeatedConcerns,
    proposalCandidates: proposalCandidates.slice(0, MAX_PROPOSAL_CANDIDATES),
    activeAlliesCount: activeAllies.length,
    readyToCollaborateCount,
    discussionUrl,
    isEmpty:
      comments.length === 0 && activeAllies.length === 0 && collaborationResult.participants.length === 0,
  };
}
