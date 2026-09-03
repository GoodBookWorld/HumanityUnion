"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { PublicDecisionSessionProjection } from "@hu/types";

import { getPublicDecisionSession } from "../../decision-session/api";
import { CivicPublicTranslatedSection, stableJsonForDisplay } from "../../language";

import "./initiative-decision-session-stage-workspace.css";

function ListSection({ title, items }: { title: string; items: readonly string[] | undefined }) {
  if (!items || items.length === 0) {
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

interface InitiativeDecisionSessionPublicResultProps {
  readonly sessionId: string;
  readonly isPreview?: boolean;
}

export function InitiativeDecisionSessionPublicResult({
  sessionId,
  isPreview = false,
}: InitiativeDecisionSessionPublicResultProps) {
  const t = useTranslations("initiativeExperience");
  const [projection, setProjection] = useState<PublicDecisionSessionProjection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await getPublicDecisionSession(sessionId);
        if (!cancelled) {
          setProjection(result);
        }
      } catch {
        if (!cancelled) {
          setError(t("author.decisionSession.public.loadFailed"));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, t]);

  if (error) {
    return <p className="ids-source-panel__empty">{error}</p>;
  }

  if (!projection) {
    return <p className="ids-source-panel__empty">{t("author.decisionSession.public.loading")}</p>;
  }

  const structured = projection.structuredContent;

  return (
    <article className="ids-public" aria-label={t("author.decisionSession.public.aria")}>
      {isPreview ? (
        <p className="ids-public__meta">{t("author.decisionSession.public.previewMeta")}</p>
      ) : null}
      <section className="ids-public__section">
        {/* Pack 08I.9 — warm civic translation; do not prefer raw English fields. */}
        <CivicPublicTranslatedSection
          sourceKind="decision_session"
          sourceRecordId={projection.sessionId}
          fallbackFields={{
            title: projection.title,
            purpose: structured?.decisionContext || projection.purpose,
            decisionQuestion: projection.decisionQuestion,
            structuredContent: structured
              ? stableJsonForDisplay({
                  decisionContext: structured.decisionContext,
                  objectives: structured.objectives,
                  options: structured.options,
                  supportingArguments: structured.supportingArguments,
                  risks: structured.risks,
                  dependencies: structured.dependencies,
                  requiredResources: structured.requiredResources,
                  suggestedTimeline: structured.suggestedTimeline,
                  suggestedParticipants: structured.suggestedParticipants,
                  suggestedResponsibleRoles: structured.suggestedResponsibleRoles,
                  unresolvedQuestions: structured.unresolvedQuestions,
                })
              : "",
          }}
        />
        <p className="ids-public__meta">
          {t("author.decisionSession.public.publishedMeta", {
            date: projection.publishedAt,
            steward: projection.stewardDisplayName,
          })}
        </p>
      </section>

      <ListSection title={t("author.decisionSession.sections.objectives")} items={structured?.objectives} />
      <ListSection title={t("author.decisionSession.sections.options")} items={structured?.options} />
      <ListSection
        title={t("author.decisionSession.sections.arguments")}
        items={structured?.supportingArguments}
      />
      <ListSection title={t("author.decisionSession.sections.risks")} items={structured?.risks} />
      <ListSection
        title={t("author.decisionSession.sections.requiredResources")}
        items={structured?.requiredResources}
      />

      {structured?.suggestedTimeline ? (
        <section className="ids-public__section">
          <h3>{t("author.decisionSession.sections.timeline")}</h3>
          <p>{structured.suggestedTimeline}</p>
        </section>
      ) : null}

      <ListSection
        title={t("author.decisionSession.sections.roles")}
        items={structured?.suggestedResponsibleRoles}
      />

      {projection.traceability ? (
        <section className="ids-public__section">
          <h3>{t("author.decisionSession.sections.traceability")}</h3>
          <p>
            {t("author.decisionSession.public.traceabilityFromPetition", {
              petitionId: projection.traceability.petitionId,
              petitionVersion: projection.traceability.petitionVersion,
              revisionClause: projection.traceability.revisionId
                ? t("author.decisionSession.public.revisionClause", {
                    revisionId: projection.traceability.revisionId,
                    revisionVersion: projection.traceability.revisionVersion,
                  })
                : "",
              participants: projection.traceability.participantSignatures,
              members: projection.traceability.memberSignatures,
              visitors: projection.traceability.visitorSignals,
            })}
          </p>
        </section>
      ) : projection.relatedPetitionContext ? (
        <section className="ids-public__section">
          <h3>{t("author.decisionSession.sections.supportingPetition")}</h3>
          <p>
            {t("author.decisionSession.public.supportingPetitionSummary", {
              title: projection.relatedPetitionContext.title,
              participants: projection.relatedPetitionContext.participantSignatures,
              members: projection.relatedPetitionContext.memberSignatures,
              visitors: projection.relatedPetitionContext.visitorSignals,
            })}
          </p>
        </section>
      ) : null}
    </article>
  );
}
