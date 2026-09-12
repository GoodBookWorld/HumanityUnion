"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import type {
  DecisionSessionStructuredContent,
  LanguageCode,
  PublicDecisionSessionProjection,
} from "@hu/types";
import { DEFAULT_PLATFORM_LANGUAGE, isCompleteLocalizedProseBag } from "@hu/types";

import { getPublicDecisionSession } from "../../decision-session/api";
import { stableJsonForDisplay } from "../../language/civic-translation-field-meta";
import { resolvePublicContentDisplayLanguage } from "../../language/resolve-public-content-display-language";
import { resolveTranslatedContent } from "../../language/translation-api";
import { usePublicContentReadingContext } from "../../language/use-public-content-reading-context";
import { TranslatedContentView } from "../../language/components/TranslatedContentView";
import {
  selectDecisionSessionStructuredForDisplay,
} from "../decision-session-structured-display";

import "./initiative-decision-session-stage-workspace.css";

const DS_CT_FIELDS = [
  "title",
  "purpose",
  "decisionQuestion",
  "structuredContent",
] as const;

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

function buildCanonicalFallbackFields(
  projection: PublicDecisionSessionProjection,
): Record<string, string> {
  const structured = projection.structuredContent;
  return {
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
  };
}

interface InitiativeDecisionSessionPublicResultProps {
  readonly sessionId: string;
  readonly isPreview?: boolean;
}

/**
 * Public Decision Session result — CT drives title/purpose/question and nested
 * structured lists as one coherent presentation (no canonical dual-render).
 */
export function InitiativeDecisionSessionPublicResult({
  sessionId,
  isPreview = false,
}: InitiativeDecisionSessionPublicResultProps) {
  const t = useTranslations("initiativeExperience");
  const locale = useLocale();
  const readingContext = usePublicContentReadingContext();
  const displayLanguage = resolvePublicContentDisplayLanguage(locale);

  const [projection, setProjection] = useState<PublicDecisionSessionProjection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [originalFields, setOriginalFields] = useState<Record<string, string>>({});
  const [presentationMode, setPresentationMode] = useState<"original" | "localized">(
    "original",
  );
  const [activeLanguage, setActiveLanguage] = useState<LanguageCode>(DEFAULT_PLATFORM_LANGUAGE);
  const [originalLanguage, setOriginalLanguage] =
    useState<LanguageCode>(DEFAULT_PLATFORM_LANGUAGE);
  const [canViewOriginal, setCanViewOriginal] = useState(false);
  const [isMachineTranslated, setIsMachineTranslated] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [structured, setStructured] = useState<DecisionSessionStructuredContent | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await getPublicDecisionSession(sessionId);
        if (!cancelled) {
          setProjection(result);
          setError(null);
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

  useEffect(() => {
    if (!projection) {
      return;
    }

    const fallback = buildCanonicalFallbackFields(projection);
    setFields(fallback);
    setOriginalFields(fallback);
    setPresentationMode("original");
    setActiveLanguage(DEFAULT_PLATFORM_LANGUAGE);
    setIsMachineTranslated(false);
    setCanViewOriginal(false);
    setStructured(projection.structuredContent);

    if (!readingContext.ready) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const resolved = await resolveTranslatedContent({
          sourceKind: "decision_session",
          sourceRecordId: projection.sessionId,
          language: displayLanguage,
        });
        if (cancelled) {
          return;
        }

        const original = resolved.originalContent;
        const localized = resolved.content;
        const complete =
          resolved.presentationMode !== "original" &&
          resolved.activeLanguage === displayLanguage &&
          isCompleteLocalizedProseBag({
            originalFields: original,
            localizedFields: localized,
            requiredFields: DS_CT_FIELDS,
          });

        if (!complete) {
          setFields(original);
          setOriginalFields(original);
          setActiveLanguage(resolved.originalLanguage);
          setOriginalLanguage(resolved.originalLanguage);
          setCanViewOriginal(false);
          setIsMachineTranslated(false);
          setIsStale(resolved.isStale);
          setPresentationMode("original");
          setStructured(
            selectDecisionSessionStructuredForDisplay({
              localizationComplete: false,
              localizedStructuredJson: null,
              canonicalStructured: projection.structuredContent,
            }),
          );
          return;
        }

        setFields(localized);
        setOriginalFields(original);
        setActiveLanguage(resolved.activeLanguage);
        setOriginalLanguage(resolved.originalLanguage);
        setCanViewOriginal(resolved.canViewOriginal || resolved.canViewTranslation);
        setIsMachineTranslated(resolved.isMachineTranslated);
        setIsStale(resolved.isStale);
        setPresentationMode("localized");
        setStructured(
          selectDecisionSessionStructuredForDisplay({
            localizationComplete: true,
            localizedStructuredJson: localized.structuredContent,
            canonicalStructured: projection.structuredContent,
          }),
        );
      } catch {
        if (!cancelled) {
          setFields(fallback);
          setOriginalFields(fallback);
          setPresentationMode("original");
          setIsMachineTranslated(false);
          setStructured(projection.structuredContent);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projection, readingContext.ready, displayLanguage]);

  if (error) {
    return <p className="ids-source-panel__empty">{error}</p>;
  }

  if (!projection) {
    return <p className="ids-source-panel__empty">{t("author.decisionSession.public.loading")}</p>;
  }

  const displayBag = presentationMode === "localized" ? fields : originalFields;
  const proseFields: Array<{ key: "title" | "purpose" | "decisionQuestion"; label: string }> = [
    { key: "title", label: t("author.decisionSession.fields.title") },
    { key: "purpose", label: t("author.decisionSession.fields.context") },
    { key: "decisionQuestion", label: t("author.decisionSession.fields.question") },
  ];

  return (
    <article
      className="ids-public"
      aria-label={t("author.decisionSession.public.aria")}
      data-hu-presentation-mode={presentationMode}
    >
      {isPreview ? (
        <p className="ids-public__meta">{t("author.decisionSession.public.previewMeta")}</p>
      ) : null}
      <section className="ids-public__section">
        {proseFields.map(({ key, label }) => {
          const value = displayBag[key]?.trim() ?? "";
          const original = originalFields[key] ?? "";
          if (!value && !original) {
            return null;
          }
          return (
            <div key={key} className="hu-public-translated-field">
              <h4>{label}</h4>
              <TranslatedContentView
                content={value.length > 0 ? value : original}
                originalContent={original}
                activeLanguage={activeLanguage}
                originalLanguage={originalLanguage}
                canViewOriginal={presentationMode === "localized" && canViewOriginal}
                isMachineTranslated={presentationMode === "localized" && isMachineTranslated}
                isStale={isStale}
              />
            </div>
          );
        })}
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
