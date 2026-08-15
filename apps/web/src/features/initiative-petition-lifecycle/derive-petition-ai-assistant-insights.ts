import type { InitiativePetitionDraft, InitiativePetitionIntelligenceSnapshot } from "@hu/types";

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
 */
export interface PetitionAiAssistantInsights {
  readonly sourcesUsedSummary: string;
  readonly consistencyWarnings: InitiativePetitionIntelligenceSnapshot["consistencyChecks"];
  readonly clarityWarnings: readonly string[];
  readonly missingContextWarnings: readonly string[];
  readonly analysisAlignmentSummary: string;
}

function countWords(value: string): number {
  return value.trim().length === 0 ? 0 : value.trim().split(/\s+/).length;
}

export function derivePetitionAiAssistantInsights(
  snapshot: InitiativePetitionIntelligenceSnapshot,
  draft: InitiativePetitionDraft | null,
): PetitionAiAssistantInsights {
  const clarityWarnings: string[] = [];
  const missingContextWarnings: string[] = [];

  if (draft) {
    if (!draft.title.trim()) {
      clarityWarnings.push("Petition Title is empty.");
    }

    if (countWords(draft.requestStatement) < 8) {
      clarityWarnings.push(
        "Request Statement is very short — it may be too vague for visitors to understand what is being asked.",
      );
    }

    if (!draft.expectedOutcome.trim()) {
      clarityWarnings.push("Expected Outcome is empty.");
    }

    if (!draft.supportingContext.trim()) {
      missingContextWarnings.push(
        "Supporting Context is empty — visitors will see no background information.",
      );
    }

    if (draft.keyArguments.filter((argument) => argument.trim().length > 0).length === 0) {
      missingContextWarnings.push("No Key Arguments provided yet.");
    }
  }

  return {
    sourcesUsedSummary: snapshot.revisionReference
      ? `Built from Version ${snapshot.revisionReference.version} of the Revision, ${snapshot.proposalReferences.length} accepted Proposal(s).`
      : "No published Revision collected yet.",
    consistencyWarnings: snapshot.consistencyChecks.filter((check) => check.status === "warning"),
    clarityWarnings,
    missingContextWarnings,
    analysisAlignmentSummary: snapshot.analysisReference
      ? `Aligned with published Collaborative Analysis: "${snapshot.analysisReference.title}".`
      : "No published Collaborative Analysis to align with yet.",
  };
}
