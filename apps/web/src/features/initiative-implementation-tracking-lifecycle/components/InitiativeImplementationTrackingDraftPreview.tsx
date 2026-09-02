"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { InitiativeImplementationTrackingLifecycleDraft } from "@hu/types";

import { getInitiativeImplementationTrackingWorkspace } from "../api";

import "./initiative-implementation-tracking-stage-workspace.css";

function ListSection({ title, items }: { title: string; items: readonly string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="iit-public__section">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function InitiativeImplementationTrackingDraftPreview({
  initiativeId,
}: {
  readonly initiativeId: string;
}) {
  const t = useTranslations("initiativeExperience");
  const [draft, setDraft] = useState<InitiativeImplementationTrackingLifecycleDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const workspace = await getInitiativeImplementationTrackingWorkspace(initiativeId);
        if (!cancelled) {
          setDraft(workspace.draft);
        }
      } catch {
        if (!cancelled) {
          setError(t("author.tracking.preview.loadFailed"));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initiativeId, t]);

  if (error) {
    return <p className="iit-source-panel__empty">{error}</p>;
  }

  if (!draft) {
    return <p className="iit-source-panel__empty">{t("author.tracking.preview.loading")}</p>;
  }

  return (
    <article className="iit-public" aria-label={t("author.tracking.preview.aria")}>
      <p className="iit-public__meta">{t("author.tracking.preview.meta")}</p>
      <section className="iit-public__section">
        <h3>{draft.title || t("author.tracking.preview.untitled")}</h3>
        <p>{draft.summary}</p>
      </section>
      {draft.candidates.map((candidate, index) => (
        <section className="iit-public__section" key={candidate.candidateId}>
          <h3>
            {t("author.tracking.preview.actionHeading", {
              number: index + 1,
              action: candidate.approvedAction,
            })}
          </h3>
          <p className="iit-public__meta">
            {t("author.tracking.preview.statusProgressTarget", {
              status: candidate.currentStatus,
              progress: candidate.progress,
              target: candidate.targetDate ?? t("author.tracking.preview.notSet"),
            })}
          </p>
          <ListSection
            title={t("author.tracking.sections.dependencies")}
            items={candidate.dependencies}
          />
          <ListSection title={t("author.tracking.sections.obstacles")} items={candidate.obstacles} />
          <ListSection
            title={t("author.tracking.sections.evidenceReferences")}
            items={candidate.evidenceReferences}
          />
        </section>
      ))}
    </article>
  );
}
