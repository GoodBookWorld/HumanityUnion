import { randomUUID } from "node:crypto";

import type { InitiativeRevisionChange, InitiativeRevisionIntelligenceSnapshot } from "@hu/types";

import { REVISION_SECTION_LABELS } from "./initiative-revision-intelligence.service.js";

/**
 * Initiative Lifecycle — Part E, Section 3/4 (Intelligent Revision Builder
 * → Revision Assistant seam).
 *
 * Mirrors the provider-independence pattern from
 * `initiative-proposal-draft-builder.ts` (Part D) /
 * `initiative-analysis-draft-builder.ts` (Part B / Part C's "Future AI
 * Providers"): a small interface + one deterministic reference
 * implementation + one resolution function, so a future AI provider can be
 * swapped in later without any caller changing.
 *
 * Deliberately ENRICHING, never replacing (Part 3: "No automatic text
 * replacement"): this returns one new suggested `InitiativeRevisionChange`
 * for every eligible Proposal not already referenced by an existing
 * change, and never touches an existing change's fields. The Author must
 * still explicitly decide whether/how to fold a suggestion's `after` text
 * into the draft's real `title`/`description` (Section 4: "The Assistant
 * never edits automatically. The Author always confirms changes.").
 */
export interface GeneratedRevisionChangeItem {
  readonly section: InitiativeRevisionChange["section"];
  readonly sectionLabel: string;
  readonly before: string;
  readonly after: string;
  readonly proposalIds: readonly string[];
  readonly explanation: string;
}

export interface RevisionDraftProviderInput {
  readonly snapshot: InitiativeRevisionIntelligenceSnapshot;
  /** Proposal ids already referenced by an existing change in the working draft — never re-suggested (Part 3 enrich-only rule). */
  readonly existingReferencedProposalIds: ReadonlySet<string>;
}

export interface RevisionDraftProvider {
  readonly providerId: string;
  generateSuggestedChanges(input: RevisionDraftProviderInput): Promise<GeneratedRevisionChangeItem[]>;
}

function buildSuggestedAddition(summary: string, expectedImprovement: string): string {
  const trimmedImprovement = expectedImprovement.trim();
  return trimmedImprovement ? `${summary.trim()} — ${trimmedImprovement}` : summary.trim();
}

function generateDeterministicRevisionChanges(
  input: RevisionDraftProviderInput,
): GeneratedRevisionChangeItem[] {
  const generated: GeneratedRevisionChangeItem[] = [];
  const baseDescription = input.snapshot.currentDescription;

  for (const proposal of input.snapshot.eligibleProposals) {
    if (proposal.status !== "included_in_revision") {
      // Part 4 — a still-`"published"` (not yet curated) proposal is an
      // "unresolved proposal" the Revision Assistant highlights, not a
      // suggested change the Revision Builder drafts automatically.
      continue;
    }

    if (input.existingReferencedProposalIds.has(proposal.proposalId)) {
      continue;
    }

    const addition = buildSuggestedAddition(proposal.summary, proposal.expectedImprovement);

    generated.push({
      section: "description",
      sectionLabel: REVISION_SECTION_LABELS.description!,
      before: baseDescription,
      after: baseDescription ? `${baseDescription}\n\n${addition}` : addition,
      proposalIds: [proposal.proposalId],
      explanation: `Incorporates Improvement Proposal "${proposal.title}" — ${proposal.reason}`,
    });
  }

  return generated;
}

export const deterministicRevisionDraftProvider: RevisionDraftProvider = {
  providerId: "deterministic-v1",
  generateSuggestedChanges: (input) => Promise.resolve(generateDeterministicRevisionChanges(input)),
};

export function resolveRevisionDraftProvider(): RevisionDraftProvider {
  return deterministicRevisionDraftProvider;
}

export async function generateRevisionChanges(
  input: RevisionDraftProviderInput,
): Promise<GeneratedRevisionChangeItem[]> {
  const provider = resolveRevisionDraftProvider();
  return provider.generateSuggestedChanges(input);
}

/** Converts a freshly generated suggestion into a persistable `InitiativeRevisionChange`, assigning its permanent, stable `changeId`. */
export function toRevisionChange(item: GeneratedRevisionChangeItem, now: string): InitiativeRevisionChange {
  return {
    changeId: `initiative-revision-change-${randomUUID()}`,
    section: item.section,
    sectionLabel: item.sectionLabel,
    before: item.before,
    after: item.after,
    origin: "proposal",
    proposalIds: [...item.proposalIds],
    authorOriginatedReason: null,
    explanation: item.explanation,
    createdAt: now,
    updatedAt: now,
  };
}
