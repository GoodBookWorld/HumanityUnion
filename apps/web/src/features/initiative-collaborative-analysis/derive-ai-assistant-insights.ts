import type {
  InitiativeAnalysisSourceArgument,
  InitiativeAnalysisSourceCommentRef,
  InitiativeAnalysisSourceSnapshot,
} from "@hu/types";

/**
 * Initiative Lifecycle — Part B, Section 6 (AI Assistant Sidebar).
 *
 * Every field here is a deterministic derivation of the already-fetched
 * `InitiativeAnalysisSourceSnapshot` — no AI chat, no external call, no
 * invented category. This mirrors the same "structural signal, honestly
 * labelled" approach as the backend Draft Builder
 * (`initiative-analysis-draft-builder.ts`):
 *
 *  - `missingEvidence`   — which source categories are still empty.
 *  - `possibleContradictions` — a purely mechanical signal: a most-discussed
 *    topic whose keyword appears in BOTH a highly-Helpful comment excerpt
 *    AND a highly-Not-Helpful comment excerpt — i.e. the same subject drew
 *    both strong support and strong pushback. This is text-overlap
 *    detection, never semantic reasoning, and is labelled as such.
 *  - `unansweredQuestions` — reuses `openQuestions` verbatim (this
 *    codebase's comment model has no reply-thread/answered flag to check
 *    against, so "unanswered" here means "not yet addressed in a
 *    published Analysis", not a verified reply-count).
 *  - `proposalCoverage`   — a plain ratio of proposal-marked comments to
 *    total comments.
 */
export interface AiAssistantInsights {
  readonly sourcesUsedSummary: string;
  readonly missingEvidence: readonly string[];
  readonly repeatedArguments: readonly InitiativeAnalysisSourceArgument[];
  readonly possibleContradictions: readonly {
    readonly topic: string;
    readonly argument: InitiativeAnalysisSourceCommentRef;
    readonly concern: InitiativeAnalysisSourceCommentRef;
  }[];
  readonly unansweredQuestions: readonly InitiativeAnalysisSourceCommentRef[];
  readonly proposalCoverage: {
    readonly proposalCount: number;
    readonly commentCount: number;
    readonly percentage: number;
  };
}

function mentionsTopic(excerpt: string, topic: string): boolean {
  return excerpt.toLowerCase().includes(topic.toLowerCase());
}

export function deriveAiAssistantInsights(
  snapshot: InitiativeAnalysisSourceSnapshot,
): AiAssistantInsights {
  const missingEvidence: string[] = [];

  if (snapshot.repeatedArguments.length === 0) {
    missingEvidence.push("No Helpful-marked comments to cite as supporting arguments yet.");
  }

  if (snapshot.repeatedConcerns.length === 0) {
    missingEvidence.push("No Not-Helpful-marked comments to cite as concerns yet.");
  }

  if (snapshot.proposalCandidates.length === 0) {
    missingEvidence.push("No comments have been marked as proposal candidates yet.");
  }

  if (snapshot.openQuestions.length === 0) {
    missingEvidence.push("No open questions have been raised in Discussion yet.");
  }

  const possibleContradictions = snapshot.mostDiscussedTopics.flatMap((topicItem) => {
    const argument = snapshot.repeatedArguments.find((item) => mentionsTopic(item.excerpt, topicItem.topic));
    const concern = snapshot.repeatedConcerns.find((item) => mentionsTopic(item.excerpt, topicItem.topic));

    if (!argument || !concern) {
      return [];
    }

    return [{ topic: topicItem.topic, argument, concern }];
  });

  const commentCount = snapshot.discussionStatistics.commentCount;
  const proposalCount = snapshot.proposalCandidates.length;

  return {
    sourcesUsedSummary:
      commentCount > 0
        ? `${commentCount} Discussion comment${commentCount === 1 ? "" : "s"}, ${proposalCount} proposal-marked, ${snapshot.activeAlliesCount} Active Ally${snapshot.activeAlliesCount === 1 ? "" : "ies"}, ${snapshot.readyToCollaborateCount} ready to collaborate.`
        : "No sources collected yet.",
    missingEvidence,
    repeatedArguments: snapshot.repeatedArguments,
    possibleContradictions,
    unansweredQuestions: snapshot.openQuestions,
    proposalCoverage: {
      proposalCount,
      commentCount,
      percentage: commentCount > 0 ? Math.round((proposalCount / commentCount) * 100) : 0,
    },
  };
}
