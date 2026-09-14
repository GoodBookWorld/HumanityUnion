import type { InitiativePetitionDraft, InitiativePetitionIntelligenceSnapshot } from "@hu/types";

import type { PetitionSidebarAdvisory } from "../initiative-lifecycle-stage-workspace/sidebar-advisory-contract";

/**
 * Initiative Lifecycle — Part F, Section 3/4 (Petition Intelligence /
 * Petition Assistant).
 *
 * Every field here is a deterministic derivation of the already-fetched
 * `InitiativePetitionIntelligenceSnapshot` plus the Author's own current
 * draft — no AI chat, no external call, no invented category. Mirrors
 * `derive-revision-ai-assistant-insights.ts` (Part E): the Assistant only
 * ever surfaces clarity/neutrality/public-readability gaps, missing
 * context, and consistency with Revision/Analysis that are directly
 * observable from persisted data, and NEVER edits automatically (Section
 * 4 — the Author always confirms changes, enforced server-side, not
 * merely hidden here).
 *
 * Pack 02G Task 08E.8c: Web-owned deterministic advisory meaning is encoded
 * as language-neutral descriptors. API consistency-check detail remains
 * opaque pass-through data and is never converted into Web advisory codes.
 */
export interface PetitionAiAssistantInsights {
  readonly sourcesSummary: PetitionSidebarAdvisory;
  /** API opaque consistency warnings — detail/label stay raw. */
  readonly consistencyWarnings: InitiativePetitionIntelligenceSnapshot["consistencyChecks"];
  readonly clarityWarnings: readonly PetitionSidebarAdvisory[];
  readonly missingContextWarnings: readonly PetitionSidebarAdvisory[];
  readonly analysisAlignment: PetitionSidebarAdvisory;
}

function countWords(value: string): number {
  return value.trim().length === 0 ? 0 : value.trim().split(/\s+/).length;
}

export function derivePetitionAiAssistantInsights(
  snapshot: InitiativePetitionIntelligenceSnapshot,
  draft: InitiativePetitionDraft | null,
): PetitionAiAssistantInsights {
  const clarityWarnings: PetitionSidebarAdvisory[] = [];
  const missingContextWarnings: PetitionSidebarAdvisory[] = [];

  if (draft) {
    if (!draft.title.trim()) {
      clarityWarnings.push({
        code: "petition.clarity.title_empty",
        severity: "warning",
        civic: { petitionFieldIds: ["title"] },
      });
    }

    if (countWords(draft.requestStatement) < 8) {
      clarityWarnings.push({
        code: "petition.clarity.request_statement_short",
        severity: "warning",
        civic: { petitionFieldIds: ["requestStatement"] },
      });
    }

    if (!draft.expectedOutcome.trim()) {
      clarityWarnings.push({
        code: "petition.clarity.expected_outcome_empty",
        severity: "warning",
        civic: { petitionFieldIds: ["expectedOutcome"] },
      });
    }

    if (!draft.supportingContext.trim()) {
      missingContextWarnings.push({
        code: "petition.context.supporting_context_empty",
        severity: "warning",
        civic: { petitionFieldIds: ["supportingContext"] },
      });
    }

    if (draft.keyArguments.filter((argument) => argument.trim().length > 0).length === 0) {
      missingContextWarnings.push({
        code: "petition.context.key_arguments_empty",
        severity: "warning",
        civic: { petitionFieldIds: ["keyArguments"] },
      });
    }
  }

  const sourcesSummary: PetitionSidebarAdvisory = snapshot.revisionReference
    ? {
        code: "petition.sources.summary",
        severity: "info",
        params: {
          version: snapshot.revisionReference.version,
          proposalCount: snapshot.proposalReferences.length,
        },
      }
    : {
        code: "petition.sources.empty",
        severity: "info",
      };

  const analysisAlignment: PetitionSidebarAdvisory = snapshot.analysisReference
    ? {
        code: "petition.alignment.with_analysis",
        severity: "info",
        civic: { title: snapshot.analysisReference.title },
      }
    : {
        code: "petition.alignment.no_analysis",
        severity: "info",
      };

  return {
    sourcesSummary,
    consistencyWarnings: snapshot.consistencyChecks.filter((check) => check.status === "warning"),
    clarityWarnings,
    missingContextWarnings,
    analysisAlignment,
  };
}
