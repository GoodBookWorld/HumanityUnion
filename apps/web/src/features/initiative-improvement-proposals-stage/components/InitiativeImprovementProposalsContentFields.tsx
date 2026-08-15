/**
 * Initiative Lifecycle — Part D, Sections 8/11. The read-only body of one
 * structured proposal — Summary, Description, Reason, Expected
 * Improvement, Supporting Sources, Related Discussion References,
 * Original Author(s).
 *
 * Shared by `InitiativeImprovementProposalsPublicResult` (genuinely
 * published proposals, Section 8) and
 * `InitiativeImprovementProposalsDraftPreview` (Public Preview of the
 * Author's current unpublished draft, Section 11 — "Preview uses the same
 * renderer as Public ... no duplicate renderer") so both render the
 * identical field layout from a single implementation.
 */
export function InitiativeImprovementProposalsContentFields({
  summary,
  description,
  reason,
  expectedImprovement,
  supportingSources,
  relatedDiscussionReferences,
  originalAuthorDisplayNames,
}: {
  readonly summary: string;
  readonly description: string;
  readonly reason: string;
  readonly expectedImprovement: string;
  readonly supportingSources: string;
  readonly relatedDiscussionReferences: string;
  readonly originalAuthorDisplayNames: readonly string[];
}) {
  return (
    <>
      <div className="iip-public-result__field">
        <h4>Summary</h4>
        <p>{summary}</p>
      </div>
      <div className="iip-public-result__field">
        <h4>Description</h4>
        <p>{description}</p>
      </div>
      <div className="iip-public-result__field">
        <h4>Reason</h4>
        <p>{reason}</p>
      </div>
      <div className="iip-public-result__field">
        <h4>Expected Improvement</h4>
        <p>{expectedImprovement}</p>
      </div>
      {supportingSources ? (
        <div className="iip-public-result__field">
          <h4>Supporting Sources</h4>
          <p>{supportingSources}</p>
        </div>
      ) : null}
      {relatedDiscussionReferences ? (
        <div className="iip-public-result__field">
          <h4>Related Discussion References</h4>
          <p>{relatedDiscussionReferences}</p>
        </div>
      ) : null}
      <div className="iip-public-result__field">
        <h4>Original Author(s)</h4>
        <p>
          {originalAuthorDisplayNames.length > 0
            ? originalAuthorDisplayNames.join(", ")
            : "Author-originated (no Discussion source)"}
        </p>
      </div>
    </>
  );
}
