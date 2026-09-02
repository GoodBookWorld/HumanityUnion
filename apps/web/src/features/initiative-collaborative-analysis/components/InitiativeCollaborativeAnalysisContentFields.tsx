"use client";

import { useTranslations } from "next-intl";

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
 *
 * Pack 02G 08D.4 — field heading chrome via author.analysis.fields.*;
 * field body values remain canonical civic content.
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
  const t = useTranslations("initiativeExperience");

  return (
    <>
      <div className="ica-public-result__field">
        <h4>{t("author.analysis.fields.title")}</h4>
        <p>{title}</p>
      </div>
      <div className="ica-public-result__field">
        <h4>{t("author.analysis.fields.summary")}</h4>
        <p>{summary}</p>
      </div>
      <div className="ica-public-result__field">
        <h4>{t("author.analysis.fields.supportingEvidence")}</h4>
        <p>{supportingEvidence}</p>
      </div>
      <div className="ica-public-result__field">
        <h4>{t("author.analysis.fields.risks")}</h4>
        <p>{risks}</p>
      </div>
      {openQuestions ? (
        <div className="ica-public-result__field">
          <h4>{t("author.analysis.fields.openQuestions")}</h4>
          <p>{openQuestions}</p>
        </div>
      ) : null}
      <div className="ica-public-result__field">
        <h4>{t("author.analysis.fields.suggestedImprovements")}</h4>
        <p>{suggestedImprovements}</p>
      </div>
      <div className="ica-public-result__field">
        <h4>{t("author.analysis.fields.references")}</h4>
        <p>{references}</p>
      </div>
    </>
  );
}
