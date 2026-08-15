import type {
  InitiativeComment,
  InitiativeProposalCandidateRef,
  InitiativeProposalGroup,
  InitiativeProposalIntelligenceSnapshot,
} from "@hu/types";

import { listApprovedInitiativeComments } from "../initiative-comments/index.js";
import { getInitiativeCommentReactionSummaries } from "../initiative-comment-reactions/index.js";
import { listProposalCandidatesByCommentIds } from "../initiative-discussion-collaboration/initiative-proposal-candidate.store.js";
import { listAnalysesByInitiativeAndAuthor } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";

/**
 * Initiative Lifecycle — Part D, Section 2/3 (Automatic Proposal
 * Collection / Proposal Intelligence).
 *
 * Every field here reads EXISTING persisted data only — the same
 * "no invented information" discipline as
 * `initiative-analysis-source-snapshot.service.ts` (Part B). Grouping is
 * plain deterministic keyword-overlap clustering (Jaccard similarity over
 * a stopword-filtered token set) — never AI, never semantic reasoning.
 *
 * N+1 avoidance mirrors Part B exactly: one page-loop over approved
 * comments, then exactly two batched lookups keyed by the resulting
 * comment-id list (`getInitiativeCommentReactionSummaries`,
 * `listProposalCandidatesByCommentIds`) — never one query per comment.
 */

const MAX_COMMENT_PAGES = 10;
const COMMENT_PAGE_SIZE = 40;
const MIN_TOKEN_LENGTH = 4;
const EXCERPT_MAX_LENGTH = 160;
const MAX_CANDIDATES = 50;
const MAX_OPEN_QUESTIONS = 10;
const GROUP_SIMILARITY_THRESHOLD = 0.32;

const STOPWORDS = new Set([
  "this", "that", "these", "those", "with", "from", "have", "will", "would",
  "could", "should", "there", "their", "about", "which", "because", "just",
  "also", "into", "than", "then", "when", "what", "where", "your", "them",
  "they", "were", "been", "being", "does", "doesn", "cannot", "really",
  "very", "some", "such", "more", "most", "much", "many", "make", "made",
  "like", "want", "need", "think", "know", "even", "still", "well", "good",
  "bad", "here", "over", "only", "other", "another", "each", "every",
  "propose", "proposal", "proposing", "suggest", "suggestion", "please",
]);

const CATEGORY_KEYWORDS: ReadonlyArray<{ readonly category: string; readonly keywords: readonly string[] }> = [
  { category: "Funding", keywords: ["fund", "funding", "budget", "cost", "money", "financ", "grant"] },
  { category: "Timeline", keywords: ["deadline", "schedule", "timeline", "delay", "time", "date", "sooner", "faster"] },
  { category: "Accessibility", keywords: ["access", "disability", "accessib", "inclusive", "inclusion"] },
  { category: "Communication", keywords: ["communicat", "transparen", "inform", "update", "notify", "report"] },
  { category: "Governance", keywords: ["governance", "process", "decision", "vote", "rule", "policy"] },
  { category: "Implementation", keywords: ["implement", "execut", "deliver", "resource", "staff", "capacity"] },
];

function safely<T>(operation: () => Promise<T>, fallback: T, label: string): Promise<T> {
  return operation().catch((error) => {
    console.warn(`[initiative-proposal-intelligence] ${label} unavailable: ${String(error)}`);
    return fallback;
  });
}

function buildDiscussionUrl(initiativeId: string): string {
  return `/initiatives/public/${encodeURIComponent(initiativeId)}#discussion`;
}

function buildExcerpt(body: string): string {
  const trimmed = body.trim();
  return trimmed.length > EXCERPT_MAX_LENGTH ? `${trimmed.slice(0, EXCERPT_MAX_LENGTH - 1)}…` : trimmed;
}

function tokenize(body: string): Set<string> {
  return new Set(
    body
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(word)),
  );
}

function jaccardSimilarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let intersection = 0;

  for (const token of left) {
    if (right.has(token)) {
      intersection += 1;
    }
  }

  const union = left.size + right.size - intersection;

  return union === 0 ? 0 : intersection / union;
}

function classifyCategory(tokens: Set<string>): string {
  for (const entry of CATEGORY_KEYWORDS) {
    for (const token of tokens) {
      if (entry.keywords.some((keyword) => token.startsWith(keyword) || keyword.startsWith(token))) {
        return entry.category;
      }
    }
  }

  return "General";
}

interface CandidateWorkingRecord {
  readonly ref: InitiativeProposalCandidateRef;
  readonly tokens: Set<string>;
}

interface WorkingGroup {
  readonly groupId: string;
  readonly members: CandidateWorkingRecord[];
  readonly representativeTokens: Set<string>;
}

/**
 * Greedy single-pass clustering: each candidate joins the first existing
 * group whose representative (first member) meets the similarity
 * threshold; otherwise it starts a new group. Deterministic given a
 * stable input order (candidates are processed in comment-creation
 * order), so re-running Generate against unchanged Discussion data always
 * reproduces the same grouping.
 */
function buildGroups(candidates: readonly CandidateWorkingRecord[], discussionUrl: string): InitiativeProposalGroup[] {
  const workingGroups: WorkingGroup[] = [];

  for (const candidate of candidates) {
    const match = workingGroups.find(
      (group) => jaccardSimilarity(group.representativeTokens, candidate.tokens) >= GROUP_SIMILARITY_THRESHOLD,
    );

    if (match) {
      match.members.push(candidate);
      continue;
    }

    workingGroups.push({
      groupId: `proposal-group-${candidate.ref.candidateId}`,
      members: [candidate],
      representativeTokens: candidate.tokens,
    });
  }

  return workingGroups.map((group) => {
    const authorDisplayNames = Array.from(
      new Set(group.members.map((member) => member.ref.authorDisplayName)),
    );
    const totalHelpfulCount = group.members.reduce((sum, member) => sum + member.ref.helpfulCount, 0);
    const category = classifyCategory(group.representativeTokens);

    return {
      groupId: group.groupId,
      representativeExcerpt: group.members[0]!.ref.excerpt,
      category,
      memberCandidateIds: group.members.map((member) => member.ref.candidateId),
      memberCount: group.members.length,
      authorDisplayNames,
      totalHelpfulCount,
      isDuplicateGroup: group.members.length > 1,
      discussionUrl,
    } satisfies InitiativeProposalGroup;
  });
}

/**
 * Testing seam: exposes the deterministic grouping/duplicate-detection/
 * categorization pass on plain `InitiativeProposalCandidateRef[]` input,
 * without requiring the Discussion comment/reaction/candidate stores —
 * mirrors how `initiative-analysis-draft-builder.ts` (Part B) is unit
 * tested directly against hand-built fixtures. Behavior-identical to the
 * internal path used by `buildInitiativeProposalIntelligenceSnapshot`
 * (which tokenizes from the raw, untruncated comment body); this tokenizes
 * from the already-truncated `excerpt` instead, which is equivalent for
 * every fixture short enough to not hit the excerpt length limit.
 */
export function buildProposalGroupsFromCandidates(
  candidates: readonly InitiativeProposalCandidateRef[],
  discussionUrl: string,
): InitiativeProposalGroup[] {
  const working = candidates.map((ref) => ({ ref, tokens: tokenize(ref.excerpt) }));
  return buildGroups(working, discussionUrl);
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

/**
 * The Author's own most recently published Collaborative Analysis, if
 * any — Part 1's "input from Published Collaborative Analysis". A purely
 * informational reference; this never re-derives or duplicates Analysis
 * content.
 */
function resolveAnalysisReference(
  initiativeId: string,
  authorId: string,
): { analysisId: string; title: string } | null {
  const published = listAnalysesByInitiativeAndAuthor(initiativeId, authorId)
    .filter((analysis) => analysis.status === "published")
    .sort((left, right) => (right.publishedAt ?? "").localeCompare(left.publishedAt ?? ""));
  const latest = published[0];

  return latest ? { analysisId: latest.analysisId, title: latest.title } : null;
}

export async function buildInitiativeProposalIntelligenceSnapshot(
  initiativeId: string,
): Promise<InitiativeProposalIntelligenceSnapshot> {
  const discussionUrl = buildDiscussionUrl(initiativeId);
  const initiative = getInitiativeById(initiativeId);

  const comments = await safely(() => collectAllApprovedComments(initiativeId), [], "discussion comments");
  const commentIds = comments.map((comment) => comment.commentId);

  const [reactionSummaries, candidatesByComment] = await Promise.all([
    safely(
      () => getInitiativeCommentReactionSummaries({ commentIds }),
      new Map(),
      "comment reaction summaries",
    ),
    safely(() => listProposalCandidatesByCommentIds(commentIds), new Map(), "proposal candidates"),
  ]);

  const working: CandidateWorkingRecord[] = [];

  for (const comment of comments) {
    const candidate = candidatesByComment.get(comment.commentId);

    if (!candidate) {
      continue;
    }

    const summary = reactionSummaries.get(comment.commentId) ?? {
      likes: 0,
      dislikes: 0,
      currentUserReaction: "none" as const,
    };

    const ref: InitiativeProposalCandidateRef = {
      candidateId: candidate.candidateId,
      commentId: comment.commentId,
      excerpt: buildExcerpt(comment.body),
      authorDisplayName: comment.authorDisplayName,
      discussionUrl,
      helpfulCount: summary.likes,
      notHelpfulCount: summary.dislikes,
      createdAt: candidate.createdAt,
    };

    working.push({ ref, tokens: tokenize(comment.body) });
  }

  const limitedWorking = working.slice(0, MAX_CANDIDATES);
  const groups = buildGroups(limitedWorking, discussionUrl);
  const openProposalQuestions = limitedWorking
    .filter((candidate) => candidate.ref.excerpt.trim().endsWith("?"))
    .map((candidate) => candidate.ref)
    .slice(0, MAX_OPEN_QUESTIONS);

  return {
    initiativeId,
    generatedAt: new Date().toISOString(),
    candidates: limitedWorking.map((candidate) => candidate.ref),
    groups,
    duplicateGroupCount: groups.filter((group) => group.isDuplicateGroup).length,
    openProposalQuestions,
    totalCandidateCount: limitedWorking.length,
    analysisReference: initiative ? resolveAnalysisReference(initiativeId, initiative.stewardId) : null,
    discussionUrl,
    isEmpty: limitedWorking.length === 0,
  };
}
