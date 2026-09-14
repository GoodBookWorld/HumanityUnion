"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { InitiativeCollectiveDecisionLifecycleDraft } from "@hu/types";

import { getInitiativeCollectiveDecisionWorkspace } from "../api";

import "./initiative-collective-decision-stage-workspace.css";

function ListSection({ title, items }: { title: string; items: readonly string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="icd-public__section">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function InitiativeCollectiveDecisionDraftPreview({
  initiativeId,
}: {
  readonly initiativeId: string;
}) {
  const t = useTranslations("initiativeExperience");
  const [draft, setDraft] = useState<InitiativeCollectiveDecisionLifecycleDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const workspace = await getInitiativeCollectiveDecisionWorkspace(initiativeId);
        if (!cancelled) {
          setDraft(workspace.draft);
        }
      } catch {
        if (!cancelled) {
          setError(t("author.collectiveDecision.preview.loadFailed"));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initiativeId, t]);

  if (error) {
    return <p className="icd-source-panel__empty">{error}</p>;
  }

  if (!draft) {
    return <p className="icd-source-panel__empty">{t("author.collectiveDecision.preview.loading")}</p>;
  }

  return (
    <article className="icd-public" aria-label={t("author.collectiveDecision.preview.aria")}>
      <p className="icd-public__meta">{t("author.collectiveDecision.preview.meta")}</p>
      <section className="icd-public__section">
        <h3>{draft.title || t("author.collectiveDecision.preview.untitled")}</h3>
        <p>{draft.decisionSummary}</p>
      </section>
      <ListSection
        title={t("author.collectiveDecision.sections.approvedActions")}
        items={draft.approvedActions}
      />
      <ListSection
        title={t("author.collectiveDecision.sections.rejectedAlternatives")}
        items={draft.rejectedAlternatives}
      />
      <ListSection title={t("author.collectiveDecision.sections.roles")} items={draft.responsibleRoles} />
      <ListSection
        title={t("author.collectiveDecision.sections.priorities")}
        items={draft.implementationPriorities}
      />
      <section className="icd-public__section">
        <h3>{t("author.collectiveDecision.sections.timeline")}</h3>
        <p>{draft.implementationTimeline || t("author.collectiveDecision.preview.notSet")}</p>
      </section>
      <section className="icd-public__section">
        <h3>{t("author.collectiveDecision.sections.rationale")}</h3>
        <p>{draft.decisionRationale || t("author.collectiveDecision.preview.noRationale")}</p>
      </section>
      <ListSection title={t("author.collectiveDecision.sections.risks")} items={draft.decisionRisks} />
      <ListSection
        title={t("author.collectiveDecision.sections.criteria")}
        items={draft.successCriteria}
      />
      <ListSection
        title={t("author.collectiveDecision.sections.requiredResources")}
        items={draft.requiredResources}
      />
    </article>
  );
}
