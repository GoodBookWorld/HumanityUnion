import type { InitiativeAnalysisSourceSnapshot } from "@hu/types";

/**
 * Initiative Lifecycle — Part B, Section 4: AI Draft Pipeline.
 *
 * NO external AI provider is called here. This is a pure, deterministic
 * function: same snapshot in, same draft out, every time. It exists behind
 * a small provider-neutral seam (`AnalysisDraftProvider`) specifically so a
 * future Gemini-backed implementation can be swapped in later (Part
 * 17/out-of-scope for this task) without touching any caller — the caller
 * only ever depends on `AnalysisDraftProvider`, never on
 * `deterministicAnalysisDraftProvider` directly... except the one default
 * wiring point below, mirroring the existing
 * `WORKSPACE_ASSISTANT_PROVIDER`-style factory pattern already used
 * elsewhere in this codebase for swappable providers.
 *
 * Section mapping (Section 4's generated sections -> Section 5's editor
 * fields — the existing domain's field names are reused verbatim, per
 * "reuse existing domains", with one new additive field `openQuestions`):
 *
 *   Summary                     -> summary
 *   Key Supporting Arguments    -> supportingEvidence
 *   Key Concerns                -> risks
 *   Open Questions              -> openQuestions
 *   Areas Requiring Clarification -> suggestedImprovements
 *   Proposal References         -> references
 */
export interface AnalysisDraftContent {
  readonly title: string;
  readonly summary: string;
  readonly supportingEvidence: string;
  readonly risks: string;
  readonly openQuestions: string;
  readonly suggestedImprovements: string;
  readonly references: string;
}

export interface AnalysisDraftProviderInput {
  readonly initiativeTitle: string;
  readonly snapshot: InitiativeAnalysisSourceSnapshot;
}

export interface AnalysisDraftProvider {
  readonly providerId: string;
  generateDraft(input: AnalysisDraftProviderInput): Promise<AnalysisDraftContent>;
}

function bulletList(lines: readonly string[], emptyLabel: string): string {
  return lines.length > 0 ? lines.map((line) => `- ${line}`).join("\n") : emptyLabel;
}

function buildSummary(input: AnalysisDraftProviderInput): string {
  const { discussionStatistics, activeAlliesCount, readyToCollaborateCount, proposalCandidates } =
    input.snapshot;

  if (discussionStatistics.commentCount === 0) {
    return (
      `No Discussion activity has been collected for "${input.initiativeTitle}" yet. ` +
      "This summary will update automatically once participants begin commenting."
    );
  }

  return (
    `This analysis is based on ${discussionStatistics.commentCount} discussion comment` +
    `${discussionStatistics.commentCount === 1 ? "" : "s"} for "${input.initiativeTitle}" ` +
    `(${discussionStatistics.helpfulCount} marked Helpful, ${discussionStatistics.notHelpfulCount} marked Not Helpful), ` +
    `${proposalCandidates.length} proposal-marked contribution${proposalCandidates.length === 1 ? "" : "s"}, ` +
    `${activeAlliesCount} Active ${activeAlliesCount === 1 ? "Ally" : "Allies"}, and ` +
    `${readyToCollaborateCount} participant${readyToCollaborateCount === 1 ? "" : "s"} ready to collaborate.`
  );
}

function buildSupportingEvidence(input: AnalysisDraftProviderInput): string {
  return bulletList(
    input.snapshot.repeatedArguments.map(
      (item) => `"${item.excerpt}" — ${item.authorDisplayName} (${item.helpfulCount} Helpful)`,
    ),
    "No discussion comments have received Helpful reactions yet.",
  );
}

function buildRisks(input: AnalysisDraftProviderInput): string {
  return bulletList(
    input.snapshot.repeatedConcerns.map(
      (item) => `"${item.excerpt}" — ${item.authorDisplayName} (${item.notHelpfulCount} Not Helpful)`,
    ),
    "No discussion comments have been identified as concerns yet.",
  );
}

function buildOpenQuestions(input: AnalysisDraftProviderInput): string {
  return bulletList(
    input.snapshot.openQuestions.map((item) => `"${item.excerpt}" — ${item.authorDisplayName}`),
    "No open questions identified in the discussion yet.",
  );
}

function buildAreasRequiringClarification(input: AnalysisDraftProviderInput): string {
  const topics = input.snapshot.mostDiscussedTopics;

  if (topics.length === 0) {
    return "No repeated discussion themes have emerged yet to recommend clarification on.";
  }

  return bulletList(
    topics
      .slice(0, 5)
      .map((topic) => `Consider clarifying the Initiative's position on "${topic.topic}" (mentioned ${topic.mentionCount} times).`),
    "No repeated discussion themes have emerged yet to recommend clarification on.",
  );
}

function buildProposalReferences(input: AnalysisDraftProviderInput): string {
  return bulletList(
    input.snapshot.proposalCandidates.map(
      (item) => `"${item.excerpt}" — ${item.authorDisplayName} (see Discussion)`,
    ),
    "No proposal-marked discussion contributions exist yet.",
  );
}

async function generateDeterministicDraft(input: AnalysisDraftProviderInput): Promise<AnalysisDraftContent> {
  return {
    title: `Collaborative Analysis: ${input.initiativeTitle}`,
    summary: buildSummary(input),
    supportingEvidence: buildSupportingEvidence(input),
    risks: buildRisks(input),
    openQuestions: buildOpenQuestions(input),
    suggestedImprovements: buildAreasRequiringClarification(input),
    references: buildProposalReferences(input),
  };
}

export const deterministicAnalysisDraftProvider: AnalysisDraftProvider = {
  providerId: "deterministic-v1",
  generateDraft: generateDeterministicDraft,
};

/**
 * The one resolution point every caller uses. Today this always returns
 * the deterministic provider (no `ANALYSIS_DRAFT_PROVIDER` env var is wired
 * yet — Part B's out-of-scope list explicitly excludes Gemini
 * integration). A future pack can add an env-based switch here exactly
 * like `resolveWorkspaceAssistantProvider` does, without touching any
 * caller of `generateAnalysisDraft`.
 */
export function resolveAnalysisDraftProvider(): AnalysisDraftProvider {
  return deterministicAnalysisDraftProvider;
}

export async function generateAnalysisDraft(
  input: AnalysisDraftProviderInput,
): Promise<AnalysisDraftContent> {
  const provider = resolveAnalysisDraftProvider();
  return provider.generateDraft(input);
}
