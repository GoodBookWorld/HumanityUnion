"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { PublicInitiativeCollaborativeAnalysisProjection } from "@hu/types";

import { PublicTranslatedFields } from "../../language";
import { getPublicInitiativeAnalysis } from "../api";
import { InitiativeAnalysisReactionWidget } from "./InitiativeAnalysisReactionWidget";

import "./initiative-collaborative-analysis-workspace.css";

interface InitiativeCollaborativeAnalysisPublicResultProps {
  readonly analysisId: string;
  /**
   * True in Public Preview — Section 7: "editing disabled ... result
   * shown exactly as visitors will see it". The body fields render
   * identically either way; only the Reaction widget itself is replaced
   * with a read-only count display, so previewing can never record a
   * real reaction.
   */
  readonly isPreview?: boolean;
}

/**
 * Initiative Lifecycle — Part B, Section 8/9 (Public Result / Reaction
 * Model). Pack 02: published body fields resolve through provider-backed
 * translation when available.
 *
 * Pack 02G 08D.4 — field-label / loading / preview-reaction chrome via
 * author.analysis.*; civic body values remain canonical / translated
 * content (never UI dictionaries). Interactive ReactionWidget left for
 * public-path localization.
 */
export function InitiativeCollaborativeAnalysisPublicResult({
  analysisId,
  isPreview = false,
}: InitiativeCollaborativeAnalysisPublicResultProps) {
  const t = useTranslations("initiativeExperience");
  const [projection, setProjection] = useState<PublicInitiativeCollaborativeAnalysisProjection | null>(
    null,
  );
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setProjection(null);
    setLoadFailed(false);

    getPublicInitiativeAnalysis(analysisId)
      .then((result) => {
        if (!cancelled) {
          setProjection(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [analysisId]);

  if (loadFailed) {
    return <p className="lsw-result__placeholder">{t("author.analysis.public.loadFailed")}</p>;
  }

  if (!projection) {
    return <p className="lsw-result__placeholder">{t("author.analysis.public.loading")}</p>;
  }

  return (
    <div className="ica-public-result">
      <PublicTranslatedFields
        sourceKind="collaborative_analysis"
        sourceRecordId={analysisId}
        fieldOrder={[
          "title",
          "summary",
          "supportingEvidence",
          "risks",
          "openQuestions",
          "suggestedImprovements",
          "references",
        ]}
        fieldLabels={{
          title: t("author.analysis.fields.title"),
          summary: t("author.analysis.fields.summary"),
          supportingEvidence: t("author.analysis.fields.supportingEvidence"),
          risks: t("author.analysis.fields.risks"),
          openQuestions: t("author.analysis.fields.openQuestions"),
          suggestedImprovements: t("author.analysis.fields.suggestedImprovements"),
          references: t("author.analysis.fields.references"),
        }}
        fallbackFields={{
          title: projection.title,
          summary: projection.summary,
          supportingEvidence: projection.supportingEvidence,
          risks: projection.risks,
          openQuestions: projection.openQuestions ?? "",
          suggestedImprovements: projection.suggestedImprovements,
          references: projection.references,
        }}
      />

      <div className="ica-public-result__field">
        <h4>{t("author.analysis.fields.author")}</h4>
        <p>{projection.authorDisplayName}</p>
      </div>

      {isPreview ? (
        <section className="ica-reaction" aria-label={t("author.analysis.preview.reactionAria")}>
          <p className="ica-reaction__title">{t("author.analysis.preview.reactionTitle")}</p>
          <p className="ica-reaction__note">
            {t("author.analysis.preview.reactionNotePublished", {
              support: projection.reactionSummary.support,
              doNotSupport: projection.reactionSummary.doNotSupport,
            })}
          </p>
        </section>
      ) : (
        <InitiativeAnalysisReactionWidget
          analysisId={analysisId}
          reactionSummary={projection.reactionSummary}
          onReactionSummaryChange={(summary) =>
            setProjection((current) => (current ? { ...current, reactionSummary: summary } : current))
          }
        />
      )}
    </div>
  );
}
