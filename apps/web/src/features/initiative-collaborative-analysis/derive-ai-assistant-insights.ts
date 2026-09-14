import type {
  InitiativeAnalysisSourceArgument,
  InitiativeAnalysisSourceCommentRef,
  InitiativeAnalysisSourceSnapshot,
} from "@hu/types";

import type { AnalysisSidebarAdvisory } from "../initiative-lifecycle-stage-workspace/sidebar-advisory-contract";

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
 *
 * Pack 02G Task 08E.8a: user-visible advisory meaning is encoded as
 * language-neutral descriptors (`AnalysisSidebarAdvisory`). Civic excerpts
 * and topics remain data. Presentation resolves localized prose.
 */
export interface AiAssistantInsights {
  readonly sourcesSummary: AnalysisSidebarAdvisory;
  readonly missingEvidence: readonly AnalysisSidebarAdvisory[];
  readonly repeatedArguments: readonly InitiativeAnalysisSourceArgument[];
  readonly possibleContradictions: readonly {
    readonly advisory: AnalysisSidebarAdvisory;
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
  const missingEvidence: AnalysisSidebarAdvisory[] = [];

  if (snapshot.repeatedArguments.length === 0) {
    missingEvidence.push({
      code: "analysis.missing_helpful_sources",
      severity: "warning",
    });
  }

  if (snapshot.repeatedConcerns.length === 0) {
    missingEvidence.push({
      code: "analysis.missing_not_helpful_sources",
      severity: "warning",
    });
  }

  if (snapshot.proposalCandidates.length === 0) {
    missingEvidence.push({
      code: "analysis.missing_proposal_candidates",
      severity: "warning",
    });
  }

  if (snapshot.openQuestions.length === 0) {
    missingEvidence.push({
      code: "analysis.missing_open_questions",
      severity: "warning",
    });
  }

  const possibleContradictions = snapshot.mostDiscussedTopics.flatMap((topicItem) => {
    const argument = snapshot.repeatedArguments.find((item) =>
      mentionsTopic(item.excerpt, topicItem.topic),
    );
    const concern = snapshot.repeatedConcerns.find((item) =>
      mentionsTopic(item.excerpt, topicItem.topic),
    );

    if (!argument || !concern) {
      return [];
    }

    return [
      {
        advisory: {
          code: "analysis.text_overlap_contradiction" as const,
          severity: "info" as const,
          civic: { subject: topicItem.topic },
        },
        argument,
        concern,
      },
    ];
  });

  const commentCount = snapshot.discussionStatistics.commentCount;
  const proposalCount = snapshot.proposalCandidates.length;

  const sourcesSummary: AnalysisSidebarAdvisory =
    commentCount > 0
      ? {
          code: "analysis.sources.summary",
          severity: "info",
          params: {
            commentCount,
            proposalCount,
            activeAlliesCount: snapshot.activeAlliesCount,
            readyToCollaborateCount: snapshot.readyToCollaborateCount,
          },
        }
      : {
          code: "analysis.sources.empty",
          severity: "info",
        };

  return {
    sourcesSummary,
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
