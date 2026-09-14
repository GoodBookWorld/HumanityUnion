"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { InitiativeLifecycleArchiveDocument } from "@hu/types";
import { INITIATIVE_LIFECYCLE_ARCHIVE_DISCLAIMER } from "@hu/types";

import { getInitiativeCivicArchiveWorkspace } from "../api";
import { InitiativeCivicArchiveDocumentRenderer } from "./InitiativeCivicArchiveDocumentRenderer";
import { InitiativeCivicArchiveShareToolbar } from "./InitiativeCivicArchiveShareToolbar";

import "./initiative-civic-archive-stage-workspace.css";

export function InitiativeCivicArchiveDraftPreview({
  initiativeId,
}: {
  readonly initiativeId: string;
}) {
  const t = useTranslations("initiativeExperience");
  const [document, setDocument] = useState<InitiativeLifecycleArchiveDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const workspace = await getInitiativeCivicArchiveWorkspace(initiativeId);
        const draft = workspace.draft;

        if (!draft) {
          if (!cancelled) {
            setError(t("author.archive.preview.empty"));
          }
          return;
        }

        if (!cancelled) {
          setDocument({
            documentKind: "initiative_lifecycle_archive",
            archiveVersionId: null,
            archiveVersion: null,
            initiativeId: draft.initiativeId,
            initiativeTitle: workspace.intelligenceSnapshot.initiativeTitle,
            initiativeDescription: workspace.intelligenceSnapshot.initiativeDescription,
            finalArchiveTitle: draft.finalArchiveTitle,
            finalSummary: draft.finalSummary,
            lessonsLearned: draft.lessonsLearned,
            knowledgeContribution: draft.knowledgeContribution,
            stewardDisplayName: null,
            publishedAt: null,
            publicUrlPath: `/initiatives/public/${encodeURIComponent(initiativeId)}#civic-archive`,
            disclaimer: INITIATIVE_LIFECYCLE_ARCHIVE_DISCLAIMER,
            isDraftPreview: true,
            timeline: draft.timeline,
            sections: draft.sections.map((section) => {
              if (section.sectionId === "lessons_learned" && draft.lessonsLearned.trim()) {
                return { ...section, body: draft.lessonsLearned };
              }
              if (
                section.sectionId === "knowledge_contribution" &&
                draft.knowledgeContribution.trim()
              ) {
                return { ...section, body: draft.knowledgeContribution };
              }
              return section;
            }),
            participationStatistics: draft.participationStatistics,
            completeness: draft.completeness,
            traceability: null,
            citations: draft.sections.flatMap((section) => section.sourceRecordIds),
          });
        }
      } catch {
        if (!cancelled) {
          setError(t("author.archive.preview.loadFailed"));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initiativeId, t]);

  if (error) {
    return <p className="ica-source-panel__empty">{error}</p>;
  }

  if (!document) {
    return <p className="ica-source-panel__empty">{t("author.archive.preview.loading")}</p>;
  }

  return (
    <>
      <InitiativeCivicArchiveShareToolbar initiativeId={initiativeId} mode="preview" />
      <InitiativeCivicArchiveDocumentRenderer
        document={document}
        metaLabel={t("author.archive.preview.meta")}
      />
    </>
  );
}
