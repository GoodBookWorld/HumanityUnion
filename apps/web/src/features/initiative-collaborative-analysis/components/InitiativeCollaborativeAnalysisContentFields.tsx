/**
 * Initiative Lifecycle — Part B, Sections 7/8. The read-only Analysis
 * body — Title, Executive Summary, Supporting Arguments, Concerns, Open
 * Questions, Recommendations, References.
 *
 * Shared by `InitiativeCollaborativeAnalysisPublicResult` (a genuinely
 * published Analysis, Section 8) and `InitiativeCollaborativeAnalysisDraftPreview`
 * (Public Preview of the Author's current unpublished draft, Section 7 —
 * "result shown exactly as visitors will see it") so both render the
 * identical field layout from a single implementation.
 */
export function InitiativeCollaborativeAnalysisContentFields({
  title,
  summary,
  supportingEvidence,
  risks,
  openQuestions,
  suggestedImprovements,
  references,
}: {
  readonly title: string;
  readonly summary: string;
  readonly supportingEvidence: string;
  readonly risks: string;
  readonly openQuestions?: string;
  readonly suggestedImprovements: string;
  readonly references: string;
}) {
  return (
    <>
      <div className="ica-public-result__field">
        <h4>Title</h4>
        <p>{title}</p>
      </div>
      <div className="ica-public-result__field">
        <h4>Executive Summary</h4>
        <p>{summary}</p>
      </div>
      <div className="ica-public-result__field">
        <h4>Supporting Arguments</h4>
        <p>{supportingEvidence}</p>
      </div>
      <div className="ica-public-result__field">
        <h4>Concerns</h4>
        <p>{risks}</p>
      </div>
      {openQuestions ? (
        <div className="ica-public-result__field">
          <h4>Open Questions</h4>
          <p>{openQuestions}</p>
        </div>
      ) : null}
      <div className="ica-public-result__field">
        <h4>Recommendations</h4>
        <p>{suggestedImprovements}</p>
      </div>
      <div className="ica-public-result__field">
        <h4>References</h4>
        <p>{references}</p>
      </div>
    </>
  );
}
