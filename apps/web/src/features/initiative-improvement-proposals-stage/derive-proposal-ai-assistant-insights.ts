import type {
  InitiativeProposalGroup,
  InitiativeProposalIntelligenceSnapshot,
  InitiativeStructuredProposal,
} from "@hu/types";

import type {
  ProposalSidebarAdvisory,
  ProposalSidebarFieldId,
  ProposalTreatmentSuggestionCode,
} from "../initiative-lifecycle-stage-workspace/sidebar-advisory-contract";
import { PROPOSAL_SIDEBAR_FIELD_IDS } from "../initiative-lifecycle-stage-workspace/sidebar-advisory-contract";

/**
 * Initiative Lifecycle — Part D, Section 3/4 (Proposal Intelligence / AI
 * Assistant).
 *
 * Every field here is a deterministic derivation of the already-fetched
 * `InitiativeProposalIntelligenceSnapshot` plus the Author's own current
 * draft proposals — no AI chat, no external call, no invented category.
 * This mirrors `derive-ai-assistant-insights.ts` (Collaborative Analysis,
 * Part B): the assistant only ever surfaces what the deterministic
 * grouping/duplicate-detection pass already found (Part 2/3) — merge
 * suggestions, missing-detail flags, ungrouped candidates — and NEVER
 * decides Accepted/Rejected/Included/Excluded/Priority (Part 4: those
 * remain Author decisions, enforced entirely server-side by the status
 * validators, not merely hidden here).
 *
 * Pack 02G Task 08E.8b: user-visible advisory meaning is encoded as
 * language-neutral descriptors. Missing fields are canonical IDs.
 * Treatment suggestions remain stable codes. Civic titles remain data.
 */
export interface ProposalAiAssistantInsights {
  readonly sourcesSummary: ProposalSidebarAdvisory;
  readonly duplicateGroups: readonly InitiativeProposalGroup[];
  readonly ungroupedCandidateGroups: readonly InitiativeProposalGroup[];
  readonly incompleteProposals: readonly {
    readonly proposal: InitiativeStructuredProposal;
    readonly missingFields: readonly ProposalSidebarFieldId[];
  }[];
  readonly openProposalQuestionCount: number;
  /** Advisory treatment hints — never applied automatically. */
  readonly suggestedTreatments: readonly {
    readonly proposalId: string;
    readonly title: string;
    readonly suggestion: ProposalTreatmentSuggestionCode;
    readonly rationale: ProposalSidebarAdvisory;
  }[];
  readonly neverPublishesAutomatically: true;
}

function findMissingFields(proposal: InitiativeStructuredProposal): ProposalSidebarFieldId[] {
  return PROPOSAL_SIDEBAR_FIELD_IDS.filter((field) => {
    const value = proposal[field];
    return typeof value !== "string" || value.trim().length === 0;
  });
}

function suggestTreatment(proposal: InitiativeStructuredProposal): {
  suggestion: ProposalTreatmentSuggestionCode;
  rationale: ProposalSidebarAdvisory;
} {
  const missing = findMissingFields(proposal);
  if (missing.length > 0) {
    return {
      suggestion: "review",
      rationale: {
        code: "proposal.treatment.rationale.review_incomplete",
        severity: "warning",
        civic: { fieldIds: missing },
      },
    };
  }

  if (proposal.expectedImprovement.trim().length > 40 && proposal.reason.trim().length > 20) {
    return {
      suggestion: "accept",
      rationale: {
        code: "proposal.treatment.rationale.accept_clear",
        severity: "info",
      },
    };
  }

  if (proposal.summary.trim().length > 0 && proposal.reason.trim().length > 0) {
    return {
      suggestion: "partially_accept",
      rationale: {
        code: "proposal.treatment.rationale.partially_accept_limited",
        severity: "info",
      },
    };
  }

  return {
    suggestion: "decline",
    rationale: {
      code: "proposal.treatment.rationale.decline_limited",
      severity: "info",
    },
  };
}

export function deriveProposalAiAssistantInsights(
  snapshot: InitiativeProposalIntelligenceSnapshot,
  draftProposals: readonly InitiativeStructuredProposal[],
): ProposalAiAssistantInsights {
  const backedGroupIds = new Set(
    draftProposals.map((proposal) => proposal.groupId).filter((groupId): groupId is string => groupId !== null),
  );

  const duplicateGroups = snapshot.groups.filter((group) => group.isDuplicateGroup);
  const ungroupedCandidateGroups = snapshot.groups.filter((group) => !backedGroupIds.has(group.groupId));
  const incompleteProposals = draftProposals
    .map((proposal) => ({ proposal, missingFields: findMissingFields(proposal) }))
    .filter((entry) => entry.missingFields.length > 0);

  const undecided = draftProposals.filter(
    (proposal) => proposal.status === "draft" || proposal.status === "ready" || proposal.status === "published",
  );

  const sourcesSummary: ProposalSidebarAdvisory =
    snapshot.totalCandidateCount > 0
      ? {
          code: "proposal.sources.summary",
          severity: "info",
          params: {
            candidateCount: snapshot.totalCandidateCount,
            groupCount: snapshot.groups.length,
            duplicateGroupCount: snapshot.duplicateGroupCount,
          },
        }
      : {
          code: "proposal.sources.empty",
          severity: "info",
        };

  return {
    sourcesSummary,
    duplicateGroups,
    ungroupedCandidateGroups,
    incompleteProposals,
    openProposalQuestionCount: snapshot.openProposalQuestions.length,
    suggestedTreatments: undecided.map((proposal) => {
      const treatment = suggestTreatment(proposal);
      return {
        proposalId: proposal.proposalId,
        title: proposal.title,
        suggestion: treatment.suggestion,
        rationale: treatment.rationale,
      };
    }),
    neverPublishesAutomatically: true,
  };
}
