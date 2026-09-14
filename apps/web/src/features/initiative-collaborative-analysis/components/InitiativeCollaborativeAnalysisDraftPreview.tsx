"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { InitiativeCollaborativeAnalysis } from "@hu/types";

import { getMyCurrentInitiativeAnalysis } from "../api";
import { presentCollaborativeAnalysisForAuthorEditor } from "../collaborative-analysis-author-presentation";
import { InitiativeCollaborativeAnalysisContentFields } from "./InitiativeCollaborativeAnalysisContentFields";

import "./initiative-collaborative-analysis-workspace.css";

/**
 * Initiative Lifecycle — Part B, Section 7 (Public Preview).
 *
 * "Preview uses exactly the same renderer ... result shown exactly as
 * visitors will see it." The Author's Preview action must work on a
 * draft that has never been published yet — that is the entire point
 * of previewing before Publish — so this renders the Author's own
 * current (unpublished) draft through the identical
 * `InitiativeCollaborativeAnalysisContentFields` body used by the real
 * `InitiativeCollaborativeAnalysisPublicResult`, self-fetched the same
 * way `InitiativeCollaborativeAnalysisAuthorWorkspace` already does
 * (Part 23 self-fetch convention — no lifting draft state up through
 * the shared shell).
 *
 * Once an Analysis has actually been published, Preview renders
 * `InitiativeCollaborativeAnalysisPublicResult` instead (see
 * `PublicInitiativeCenterPanel`) — this component only covers the
 * "nothing published yet" gap that the shell's generic Upcoming
 * boundary otherwise leaves empty.
 *
 * Pack 02G 08D.4 — preview chrome via author.analysis.preview.*;
 * draft body values remain canonical English presentation (03C.5A —
 * lifecycle tokens composed before render; never raw `{lifecycleStage:...}`).
 */
export function InitiativeCollaborativeAnalysisDraftPreview({ initiativeId }: { readonly initiativeId: string }) {
  const t = useTranslations("initiativeExperience");
  const [analysis, setAnalysis] = useState<InitiativeCollaborativeAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);

    getMyCurrentInitiativeAnalysis(initiativeId)
      .then((result) => {
        if (!cancelled) {
          setAnalysis(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initiativeId]);

  if (loadFailed) {
    return <p className="lsw-result__placeholder">{t("author.analysis.preview.loadFailed")}</p>;
  }

  if (loading) {
    return <p className="lsw-result__placeholder">{t("author.analysis.preview.loading")}</p>;
  }

  if (!analysis) {
    return <p className="lsw-result__placeholder">{t("author.analysis.preview.empty")}</p>;
  }

  const presented = presentCollaborativeAnalysisForAuthorEditor(analysis);

  return (
    <div className="ica-public-result">
      <InitiativeCollaborativeAnalysisContentFields
        title={presented.title}
        summary={presented.summary}
        supportingEvidence={presented.supportingEvidence}
        risks={presented.risks}
        openQuestions={presented.openQuestions}
        suggestedImprovements={presented.suggestedImprovements}
        references={presented.references}
      />
      <div className="ica-public-result__field">
        <h4>{t("author.analysis.fields.author")}</h4>
        <p>{t("author.analysis.preview.authorYou")}</p>
      </div>

      <section className="ica-reaction" aria-label={t("author.analysis.preview.reactionAria")}>
        <p className="ica-reaction__title">{t("author.analysis.preview.reactionTitle")}</p>
        <p className="ica-reaction__note">{t("author.analysis.preview.reactionNoteDraft")}</p>
      </section>
    </div>
  );
}
