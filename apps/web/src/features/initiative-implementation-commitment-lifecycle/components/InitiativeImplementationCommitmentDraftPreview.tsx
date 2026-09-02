"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { InitiativeImplementationCommitmentLifecycleDraft } from "@hu/types";

import { getInitiativeImplementationCommitmentWorkspace } from "../api";

import "./initiative-implementation-commitment-stage-workspace.css";

function ListSection({ title, items }: { title: string; items: readonly string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="iic-public__section">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function InitiativeImplementationCommitmentDraftPreview({
  initiativeId,
}: {
  readonly initiativeId: string;
}) {
  const t = useTranslations("initiativeExperience");
  const [draft, setDraft] = useState<InitiativeImplementationCommitmentLifecycleDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const workspace = await getInitiativeImplementationCommitmentWorkspace(initiativeId);
        if (!cancelled) {
          setDraft(workspace.draft);
        }
      } catch {
        if (!cancelled) {
          setError(t("author.commitment.preview.loadFailed"));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initiativeId, t]);

  if (error) {
    return <p className="iic-source-panel__empty">{error}</p>;
  }

  if (!draft) {
    return <p className="iic-source-panel__empty">{t("author.commitment.preview.loading")}</p>;
  }

  return (
    <article className="iic-public" aria-label={t("author.commitment.preview.aria")}>
      <p className="iic-public__meta">{t("author.commitment.preview.meta")}</p>
      <section className="iic-public__section">
        <h3>{draft.title || t("author.commitment.preview.untitled")}</h3>
        <p>{draft.summary}</p>
      </section>
      {draft.candidates.map((candidate, index) => (
        <section className="iic-public__section" key={candidate.candidateId}>
          <h3>
            {t("author.commitment.actionHeading", {
              number: index + 1,
              action: candidate.approvedAction,
            })}
          </h3>
          <p>{candidate.description}</p>
          <p className="iic-public__meta">
            {t("author.commitment.preview.rolePriorityTimeline", {
              role: candidate.suggestedResponsibleRole,
              priority: candidate.priority,
              timeline: candidate.suggestedTimeline || t("author.commitment.preview.notSet"),
            })}
          </p>
          <ListSection
            title={t("author.commitment.sections.requiredResources")}
            items={candidate.requiredResources}
          />
          <ListSection
            title={t("author.commitment.sections.relatedRisks")}
            items={candidate.relatedRisks}
          />
          <ListSection
            title={t("author.commitment.sections.references")}
            items={candidate.references}
          />
        </section>
      ))}
    </article>
  );
}
