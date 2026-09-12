/**
 * Shared public Improvement Proposal ID extraction for warm discovery pages.
 * Keeps only proposalId scalars — never the full CT field bag.
 */

const PUBLIC_PROPOSAL_STATUSES = new Set([
  "published",
  "included_in_revision",
  "keep_for_later",
  "not_applicable",
]);

export function extractPublicImprovementProposalIds(
  proposals: readonly { readonly proposalId: string; readonly status: string }[],
): string[] {
  const ids: string[] = [];
  for (const proposal of proposals) {
    if (!PUBLIC_PROPOSAL_STATUSES.has(proposal.status)) {
      continue;
    }
    const id = proposal.proposalId.trim();
    if (id) {
      ids.push(id);
    }
  }
  return ids;
}

/** Collections per discovery page for staging warm --kinds=improvement_proposal. */
export const IMPROVEMENT_PROPOSAL_WARM_COLLECTION_PAGE_SIZE = 50;
