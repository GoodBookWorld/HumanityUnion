"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { InitiativeDecisionSessionDraft } from "@hu/types";

import { getInitiativeDecisionSessionWorkspace } from "../api";

import "./initiative-decision-session-stage-workspace.css";

function ListSection({ title, items }: { title: string; items: readonly string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="ids-public__section">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function InitiativeDecisionSessionDraftPreview({
  initiativeId,
}: {
  readonly initiativeId: string;
}) {
  const t = useTranslations("initiativeExperience");
  const [draft, setDraft] = useState<InitiativeDecisionSessionDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const workspace = await getInitiativeDecisionSessionWorkspace(initiativeId);
        if (!cancelled) {
          setDraft(workspace.draft);
        }
      } catch {
        if (!cancelled) {
          setError(t("author.decisionSession.preview.loadFailed"));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initiativeId, t]);

  if (error) {
    return <p className="ids-source-panel__empty">{error}</p>;
  }

  if (!draft) {
    return <p className="ids-source-panel__empty">{t("author.decisionSession.preview.loading")}</p>;
  }

  return (
    <article className="ids-public" aria-label={t("author.decisionSession.preview.aria")}>
      <p className="ids-public__meta">{t("author.decisionSession.preview.meta")}</p>
      <section className="ids-public__section">
        <h3>{draft.title || t("author.decisionSession.preview.untitled")}</h3>
        <p>{draft.decisionQuestion}</p>
      </section>
      <section className="ids-public__section">
        <h3>{t("author.decisionSession.sections.context")}</h3>
        <p>{draft.decisionContext || t("author.decisionSession.preview.noContext")}</p>
      </section>
      <ListSection title={t("author.decisionSession.sections.objectives")} items={draft.objectives} />
      <ListSection title={t("author.decisionSession.sections.options")} items={draft.options} />
      <ListSection
        title={t("author.decisionSession.sections.arguments")}
        items={draft.supportingArguments}
      />
      <ListSection title={t("author.decisionSession.sections.risks")} items={draft.risks} />
      <ListSection
        title={t("author.decisionSession.sections.requiredResources")}
        items={draft.requiredResources}
      />
      <section className="ids-public__section">
        <h3>{t("author.decisionSession.sections.timeline")}</h3>
        <p>{draft.suggestedTimeline || t("author.decisionSession.preview.notSet")}</p>
      </section>
      <ListSection
        title={t("author.decisionSession.sections.roles")}
        items={draft.suggestedResponsibleRoles}
      />
    </article>
  );
}
