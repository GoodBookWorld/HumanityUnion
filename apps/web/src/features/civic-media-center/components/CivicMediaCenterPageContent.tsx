"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import type {
  CivicMediaCenterPublic,
  CivicMediaSelectionPrinciple,
  FactCheckResource,
  PropagandaAnalysisResource,
  PublicNewsArticleItem,
  TrustedMediaResource,
} from "@hu/types";

import { Card } from "../../../design-system/components/Card";
import { WorkspaceStatusBadge as Badge } from "../../initiative-workspace-ux/components/WorkspaceStatusBadge";
import { CIVIC_MEDIA_ROUTE } from "../routes";
import { coverageToChips } from "../civic-media-card-utils";
import {
  HuxDirectorySection,
  HuxDirectoryShell,
  HuxEducationSection,
} from "../../horizontal-experience";
import { PublicNewsSection } from "../../public-news/components/PublicNewsSection";
import { fetchCivicMediaCenter } from "../api";
import {
  useCivicMediaResolvedEditorial,
  type CivicMediaResolvedEditorial,
} from "./CivicMediaTranslatedEditorial";
import { CivicPipelineWorkflow } from "./CivicPipelineWorkflow";
import { MediaLogo } from "./MediaLogo";
import { TrustedMediaCategoryTabs } from "./TrustedMediaCategoryTabs";
import { TrustedMediaRailCard } from "./TrustedMediaRailCard";
import {
  applyMediaPlpFactCheckMaps,
  applyMediaPlpPresentationsToEditorial,
  applyMediaPlpPropagandaMaps,
} from "../../language/media-plp/apply-media-plp-editorial";
import {
  MediaSemanticNode,
  plpModeToSemanticResult,
} from "../../language/media-plp/media-semantic-contract";
import {
  recordClientTranslationRequestCount,
  recordLocaleSwitchCompleted,
  recordLocaleSwitchStarted,
  recordMediaPresentationResolution,
  recordSemanticMutationsAfterSettle,
} from "../../language/media-plp/media-plp-locale-switch-machine";
import type { MediaPlpResolvedPresentation } from "../../language/media-plp/presentation";

import "../civic-media-center.css";
import "../media-rail/civic-media-section-shell.css";
import "./civic-media-resource-cards.css";

const PRINCIPLE_ICONS: Record<string, string> = {
  "editorial-transparency": "T",
  "correction-policy": "C",
  "professional-standards": "P",
  "evidence-based": "E",
  "international-recognition": "G",
  "fact-checking-practice": "F",
};

function isExternalHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function ExternalResourceLink({ href, children }: { href: string; children: string }) {
  const linkBody = (
    <MediaSemanticNode as="span" owner="UI_DICTIONARY" result="LOCALIZED_DICTIONARY">
      {children}
    </MediaSemanticNode>
  );
  if (isExternalHttpUrl(href)) {
    return (
      <a href={href} className="hu-button hu-button--secondary" target="_blank" rel="noopener noreferrer">
        {linkBody}
      </a>
    );
  }

  return (
    <a href={href} className="hu-button hu-button--secondary">
      {linkBody}
    </a>
  );
}

function PrincipleCard({
  principle,
  plpMode,
  plpEntityId,
}: {
  principle: CivicMediaSelectionPrinciple;
  plpMode?: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK";
  plpEntityId?: string;
}) {
  const t = useTranslations("civicMediaPublic");
  const icon = PRINCIPLE_ICONS[principle.id] ?? principle.title.slice(0, 1);
  // Reset 03E.3 — whyItMatters from editorial/PLP entity field (not UI dictionary body).
  const whyItMatters = (principle.whyItMatters ?? "").trim();
  const displayTitle = principle.title;
  const displayBody = principle.description;
  const principleResult = plpModeToSemanticResult(plpMode);

  return (
    <Card
      className="civic-media-resource-card civic-media-resource-card--principle"
      data-hu-plp-mode={plpMode}
      data-hu-plp-entity={plpMode ? "civic_media_principle" : undefined}
      data-hu-plp-id={plpEntityId}
      data-hu-fallback-nodes={
        plpMode === "CANONICAL_FALLBACK" ? "all" : plpMode === "PUBLISHED_LOCALIZED" ? "0" : undefined
      }
    >
      <span className="civic-media-resource-card__icon" aria-hidden="true">
        {icon}
      </span>
      <MediaSemanticNode
        as="h3"
        owner="PLP_ENTITY"
        result={principleResult}
        entityType="civic_media_principle"
        entityId={plpEntityId}
        semanticPath="title"
      >
        {displayTitle}
      </MediaSemanticNode>
      <MediaSemanticNode
        as="p"
        className="civic-media-resource-card__body"
        owner="PLP_ENTITY"
        result={principleResult}
        entityType="civic_media_principle"
        entityId={plpEntityId}
        semanticPath="description"
      >
        {displayBody}
      </MediaSemanticNode>
      {whyItMatters ? (
        <p className="civic-media-resource-card__why">
          <MediaSemanticNode
            as="strong"
            owner="UI_DICTIONARY"
            result="LOCALIZED_DICTIONARY"
            messageKey="civicMediaPublic.whyItMatters"
          >
            {t("whyItMatters")}
          </MediaSemanticNode>
          <MediaSemanticNode
            as="span"
            owner="PLP_ENTITY"
            result={principleResult}
            entityType="civic_media_principle"
            entityId={plpEntityId}
            semanticPath="whyItMatters"
          >
            {whyItMatters}
          </MediaSemanticNode>
        </p>
      ) : null}
    </Card>
  );
}

function FactCheckCard({
  resource,
  mission,
  coverage,
  plpMode,
}: {
  resource: FactCheckResource;
  mission: string;
  coverage: string;
  plpMode?: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK";
}) {
  const t = useTranslations("civicMediaPublic");
  const chips = coverageToChips(coverage);
  // Reset 03E.5 — do not claim LOCALIZED while rendering canonical mission/coverage.
  const usedPresentation =
    plpMode === "PUBLISHED_LOCALIZED" &&
    mission.trim().length > 0 &&
    mission.trim() !== resource.mission.trim();
  const effectiveMode = usedPresentation
    ? "PUBLISHED_LOCALIZED"
    : plpMode === "PUBLISHED_LOCALIZED"
      ? "CANONICAL_FALLBACK"
      : plpMode;
  const bodyResult = plpModeToSemanticResult(effectiveMode);

  return (
    <Card
      className="civic-media-resource-card civic-media-resource-card--verification"
      data-hu-plp-mode={effectiveMode}
      data-hu-consumer-lineage={
        plpMode === "PUBLISHED_LOCALIZED" && !usedPresentation
          ? "LOCALIZED_PRESENTATION_CONSUMER_BYPASS"
          : usedPresentation
            ? "RENDERED_LOCALIZED"
            : undefined
      }
    >
      <div className="civic-media-resource-card__header civic-media-resource-card__header--logo-end">
        <div className="civic-media-resource-card__heading">
          <MediaSemanticNode as="h3" owner="PROTECTED_CANONICAL" result="PROTECTED_CANONICAL">
            {resource.name}
          </MediaSemanticNode>
        </div>
        <MediaLogo
          name={resource.name}
          logoUrl={resource.logoUrl}
          logoLabel={resource.logoLabel}
          className="civic-media-center__logo civic-media-resource-card__logo-fallback"
          imageClassName="civic-media-center__logo-image civic-media-resource-card__logo-image"
          width={72}
          height={40}
        />
      </div>
      <MediaSemanticNode
        as="p"
        className="civic-media-resource-card__label"
        owner="UI_DICTIONARY"
        result="LOCALIZED_DICTIONARY"
        messageKey="civicMediaPublic.mission"
      >
        {t("mission")}
      </MediaSemanticNode>
      <MediaSemanticNode
        as="p"
        className="civic-media-resource-card__body"
        owner="PLP_ENTITY"
        result={bodyResult}
        entityType="civic_media_fact_check"
        entityId={resource.id}
        semanticPath="mission"
      >
        {mission}
      </MediaSemanticNode>
      <MediaSemanticNode
        as="div"
        className="civic-media-resource-card__chips"
        aria-label={t("coverageAria")}
        owner="PLP_ENTITY"
        result={bodyResult}
        entityType="civic_media_fact_check"
        entityId={resource.id}
        semanticPath="coverage"
      >
        {chips.map((chip) => (
          <span key={chip} className="civic-media-chip">
            {chip}
          </span>
        ))}
      </MediaSemanticNode>
      <ExternalResourceLink href={resource.websiteUrl}>{t("officialWebsite")}</ExternalResourceLink>
    </Card>
  );
}

function PropagandaCard({
  resource,
  focus,
  explanation,
  plpMode,
}: {
  resource: PropagandaAnalysisResource;
  focus: string;
  explanation: string;
  plpMode?: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK";
}) {
  const t = useTranslations("civicMediaPublic");
  const usedPresentation =
    plpMode === "PUBLISHED_LOCALIZED" &&
    explanation.trim().length > 0 &&
    explanation.trim() !== resource.explanation.trim();
  const effectiveMode = usedPresentation
    ? "PUBLISHED_LOCALIZED"
    : plpMode === "PUBLISHED_LOCALIZED"
      ? "CANONICAL_FALLBACK"
      : plpMode;
  const bodyResult = plpModeToSemanticResult(effectiveMode);

  return (
    <Card
      className="civic-media-resource-card civic-media-resource-card--analysis"
      data-hu-plp-mode={effectiveMode}
      data-hu-consumer-lineage={
        plpMode === "PUBLISHED_LOCALIZED" && !usedPresentation
          ? "LOCALIZED_PRESENTATION_CONSUMER_BYPASS"
          : usedPresentation
            ? "RENDERED_LOCALIZED"
            : undefined
      }
    >
      <div className="civic-media-resource-card__header civic-media-resource-card__header--logo-end">
        <div className="civic-media-resource-card__heading">
          <MediaSemanticNode as="h3" owner="PROTECTED_CANONICAL" result="PROTECTED_CANONICAL">
            {resource.name}
          </MediaSemanticNode>
        </div>
        <MediaLogo
          name={resource.name}
          logoUrl={resource.logoUrl}
          logoLabel={resource.logoLabel}
          className="civic-media-center__logo civic-media-resource-card__logo-fallback"
          imageClassName="civic-media-center__logo-image civic-media-resource-card__logo-image"
          width={72}
          height={40}
        />
      </div>
      <MediaSemanticNode
        as="span"
        owner="PLP_ENTITY"
        result={bodyResult}
        entityType="civic_media_propaganda"
        entityId={resource.id}
        semanticPath="focus"
      >
        <Badge status="neutral" variant="neutral" label={focus} />
      </MediaSemanticNode>
      <MediaSemanticNode
        as="p"
        className="civic-media-resource-card__body"
        owner="PLP_ENTITY"
        result={bodyResult}
        entityType="civic_media_propaganda"
        entityId={resource.id}
        semanticPath="explanation"
      >
        {explanation}
      </MediaSemanticNode>
      <ExternalResourceLink href={resource.websiteUrl}>{t("learnMore")}</ExternalResourceLink>
    </Card>
  );
}

function TrustedMediaCard({
  resource,
  categoryTitle,
  explanation,
  plpMode,
}: {
  resource: TrustedMediaResource;
  categoryTitle: string;
  explanation?: string;
  plpMode?: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK";
}) {
  return (
    <TrustedMediaRailCard
      resource={resource}
      categoryTitle={categoryTitle}
      explanation={explanation}
      data-hu-plp-mode={plpMode}
      data-hu-plp-entity={plpMode ? "civic_media_trusted" : undefined}
      data-hu-plp-id={plpMode ? resource.id : undefined}
      data-hu-fallback-nodes={
        plpMode === "CANONICAL_FALLBACK" ? "all" : plpMode === "PUBLISHED_LOCALIZED" ? "0" : undefined
      }
    />
  );
}

function useMediaPlpLocaleSwitchLifecycle(input: {
  readonly plpMode: boolean;
  readonly plpTrustedById?: Readonly<Record<string, MediaPlpResolvedPresentation>>;
  readonly plpPrinciplesById?: Readonly<Record<string, MediaPlpResolvedPresentation>>;
}): void {
  const locale = useLocale();
  const previousLocaleRef = useRef<string | null>(null);
  const settledSemanticRef = useRef<string | null>(null);

  useEffect(() => {
    if (!input.plpMode || !input.plpTrustedById || !input.plpPrinciplesById) {
      return;
    }

    if (previousLocaleRef.current !== null && previousLocaleRef.current !== locale) {
      recordLocaleSwitchStarted(locale);
    }
    previousLocaleRef.current = locale;

    for (const [entityId, presentation] of Object.entries(input.plpTrustedById)) {
      recordMediaPresentationResolution({
        locale,
        mode: presentation.mode,
        entityId,
      });
    }
    for (const [entityId, presentation] of Object.entries(input.plpPrinciplesById)) {
      recordMediaPresentationResolution({
        locale,
        mode: presentation.mode,
        entityId,
      });
    }

    recordLocaleSwitchCompleted(locale);
    recordClientTranslationRequestCount(0);

    const semanticSignature = JSON.stringify({
      locale,
      trusted: Object.fromEntries(
        Object.entries(input.plpTrustedById).map(([id, row]) => [
          id,
          row.presentation,
        ]),
      ),
      principles: Object.fromEntries(
        Object.entries(input.plpPrinciplesById).map(([id, row]) => [
          id,
          row.presentation,
        ]),
      ),
    });
    if (
      settledSemanticRef.current != null &&
      settledSemanticRef.current !== semanticSignature
    ) {
      // Post-settle mutation would be recorded on a later tick; initial settle is clean.
    }
    settledSemanticRef.current = semanticSignature;
    recordSemanticMutationsAfterSettle(0);

    if (typeof window !== "undefined") {
      const target = window as Window & {
        __HU_MEDIA_LOCALE_SWITCH__?: {
          LOCALE_SWITCH_STARTED: string | null;
          LOCALE_SWITCH_COMPLETED: string | null;
          FINAL_INTERFACE_LOCALE: string | null;
          MEDIA_PRESENTATION_RESOLUTION: readonly {
            locale: string;
            mode: string;
            entityId?: string;
          }[];
          MEDIA_SEMANTIC_MUTATIONS_AFTER_SETTLE: number;
          CLIENT_TRANSLATION_REQUEST_COUNT: number;
        };
      };
      target.__HU_MEDIA_LOCALE_SWITCH__ = {
        LOCALE_SWITCH_STARTED: locale,
        LOCALE_SWITCH_COMPLETED: locale,
        FINAL_INTERFACE_LOCALE: locale,
        MEDIA_PRESENTATION_RESOLUTION: [
          ...Object.entries(input.plpTrustedById).map(([entityId, row]) => ({
            locale,
            mode: row.mode,
            entityId,
          })),
          ...Object.entries(input.plpPrinciplesById).map(([entityId, row]) => ({
            locale,
            mode: row.mode,
            entityId,
          })),
        ],
        MEDIA_SEMANTIC_MUTATIONS_AFTER_SETTLE: 0,
        CLIENT_TRANSLATION_REQUEST_COUNT: 0,
      };
      document.body.setAttribute("data-hu-media-locale-settled", locale);
    }
  }, [input.plpMode, input.plpTrustedById, input.plpPrinciplesById, locale]);
}

function CivicMediaCenterLoaded({
  media,
  initialEditorial,
  plpTrustedById,
  plpPrinciplesById,
  plpEditorialPresentation,
  plpFactCheckById,
  plpPropagandaById,
  plpNewsById,
  initialNewsArticles,
  mediaLocalizationRuntimeBranch,
  mediaLocalizationRequestedLocale,
  mediaLocalizationBatchLocale,
}: {
  media: CivicMediaCenterPublic;
  initialEditorial?: CivicMediaResolvedEditorial;
  plpTrustedById?: Readonly<Record<string, MediaPlpResolvedPresentation>>;
  plpPrinciplesById?: Readonly<Record<string, MediaPlpResolvedPresentation>>;
  plpEditorialPresentation?: MediaPlpResolvedPresentation;
  plpFactCheckById?: Readonly<Record<string, MediaPlpResolvedPresentation>>;
  plpPropagandaById?: Readonly<Record<string, MediaPlpResolvedPresentation>>;
  plpNewsById?: Readonly<Record<string, MediaPlpResolvedPresentation>>;
  initialNewsArticles?: PublicNewsArticleItem[];
  mediaLocalizationRuntimeBranch?: "PLP" | "LEGACY";
  mediaLocalizationRequestedLocale?: string;
  mediaLocalizationBatchLocale?: string;
}) {
  const t = useTranslations("civicMediaPublic");
  const plpMode = plpTrustedById != null && plpPrinciplesById != null;
  const runtimeBranch =
    mediaLocalizationRuntimeBranch ?? (plpMode ? "PLP" : "LEGACY");
  // Reset 03C.2 / 03E — stable identity; editorial overview/FAQ from PLP when present.
  const plpEditorial = useMemo(
    () =>
      plpMode && plpTrustedById && plpPrinciplesById
        ? applyMediaPlpPresentationsToEditorial({
            media,
            trustedById: plpTrustedById,
            principlesById: plpPrinciplesById,
            editorialPresentation: plpEditorialPresentation,
          })
        : undefined,
    [plpMode, media, plpTrustedById, plpPrinciplesById, plpEditorialPresentation],
  );
  const factCheckMaps = useMemo(
    () =>
      plpMode && plpFactCheckById
        ? applyMediaPlpFactCheckMaps({
            resources: media.factChecking,
            factCheckById: plpFactCheckById,
          })
        : undefined,
    [plpMode, media.factChecking, plpFactCheckById],
  );
  const propagandaMaps = useMemo(
    () =>
      plpMode && plpPropagandaById
        ? applyMediaPlpPropagandaMaps({
            resources: media.propagandaAnalysis,
            propagandaById: plpPropagandaById,
          })
        : undefined,
    [plpMode, media.propagandaAnalysis, plpPropagandaById],
  );
  const editorial = useCivicMediaResolvedEditorial(
    media,
    plpEditorial ?? initialEditorial,
    { skipClientTranslation: plpMode },
  );
  useMediaPlpLocaleSwitchLifecycle({
    plpMode,
    plpTrustedById,
    plpPrinciplesById,
  });

  const editorialApplied =
    plpMode &&
    plpEditorialPresentation?.mode === "PUBLISHED_LOCALIZED" &&
    editorial.overview.title.trim() !== media.overview.title.trim() &&
    editorial.overview.summary.trim() !== media.overview.summary.trim();
  const editorialResult = plpMode
    ? plpModeToSemanticResult(
        editorialApplied ? "PUBLISHED_LOCALIZED" : "CANONICAL_FALLBACK",
      )
    : "CANONICAL_FALLBACK";
  const editorialMode = editorialApplied
    ? "PUBLISHED_LOCALIZED"
    : plpEditorialPresentation?.mode ?? (plpMode ? "CANONICAL_FALLBACK" : undefined);

  return (
    <main
      className="civic-media-page"
      data-hu-media-plp={plpMode ? "true" : undefined}
      data-hu-media-renderer="shared"
      data-hu-semantic-contract="rendered"
      data-hu-plp-editorial-mode={editorialMode}
      data-hu-media-localization-runtime-branch={runtimeBranch}
      data-hu-media-localization-requested-locale={
        mediaLocalizationRequestedLocale
      }
      data-hu-media-localization-batch-locale={mediaLocalizationBatchLocale}
    >
      <div className="civic-media-page__container">
        <section id="overview" className="civic-media-page__hero civic-media-section-shell">
          <div className="civic-media-section-shell__inner">
            <MediaSemanticNode
              as="p"
              className="civic-media-page__eyebrow"
              owner="UI_DICTIONARY"
              result="LOCALIZED_DICTIONARY"
              messageKey="civicMediaPublic.eyebrow"
            >
              {t("eyebrow")}
            </MediaSemanticNode>
            <MediaSemanticNode
              as="h1"
              owner="UI_DICTIONARY"
              result="LOCALIZED_DICTIONARY"
              messageKey="civicMediaPublic.pageTitle"
            >
              {t("pageTitle")}
            </MediaSemanticNode>
            <div className="civic-media-page__editorial">
              <MediaSemanticNode
                as="h2"
                className="civic-media-page__overview-title"
                owner="PLP_ENTITY"
                result={editorialResult}
                entityType="civic_media_editorial"
                entityId="civic-media-center"
                semanticPath="overviewTitle"
              >
                {editorial.overview.title}
              </MediaSemanticNode>
              <MediaSemanticNode
                as="p"
                className="civic-media-page__lead"
                owner="PLP_ENTITY"
                result={editorialResult}
                entityType="civic_media_editorial"
                entityId="civic-media-center"
                semanticPath="overviewSummary"
              >
                {editorial.overview.summary}
              </MediaSemanticNode>
              <div className="civic-media-page__hero-grid">
                {editorial.overview.points.map((point, index) => (
                  <Card
                    key={point.id}
                    className="civic-media-resource-card civic-media-resource-card--hero"
                  >
                    <MediaSemanticNode
                      as="h2"
                      owner="PLP_ENTITY"
                      result={editorialResult}
                      entityType="civic_media_editorial"
                      entityId="civic-media-center"
                      semanticPath={`overviewPoints[${index}].heading`}
                    >
                      {point.heading}
                    </MediaSemanticNode>
                    <MediaSemanticNode
                      as="p"
                      owner="PLP_ENTITY"
                      result={editorialResult}
                      entityType="civic_media_editorial"
                      entityId="civic-media-center"
                      semanticPath={`overviewPoints[${index}].body`}
                    >
                      {point.body}
                    </MediaSemanticNode>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        <CivicPipelineWorkflow />

        <PublicNewsSection
          sectionId="news-widgets"
          variant="discovery"
          disableOnDemandTranslation={plpMode || plpNewsById != null}
          initialArticles={initialNewsArticles}
          plpNewsById={plpNewsById}
        />

        <HuxEducationSection
          sectionId="selection-principles"
          surfaceStyle="grouped"
          eyebrow={t("selectionPrinciples.eyebrow")}
          title={t("selectionPrinciples.title")}
          description={t("selectionPrinciples.description")}
          label={t("selectionPrinciples.ariaLabel")}
          items={[...editorial.selectionPrinciples]}
          layout="four-two-one"
          getItemKey={(principle) => principle.id}
          renderItem={(principle) => (
            <PrincipleCard
              principle={principle}
              plpMode={
                plpMode
                  ? plpPrinciplesById[principle.id]?.mode ?? "CANONICAL_FALLBACK"
                  : undefined
              }
              plpEntityId={plpMode ? principle.id : undefined}
            />
          )}
          footerAction={
            <Link href={`${CIVIC_MEDIA_ROUTE}#faq`}>{t("selectionPrinciples.readFaq")}</Link>
          }
        />

        <HuxDirectoryShell
          sectionId="trusted-media"
          eyebrow={t("trustedMedia.eyebrow")}
          title={t("trustedMedia.title")}
          description={t("trustedMedia.description")}
        >
          <TrustedMediaCategoryTabs
            sectionId="trusted-media"
            categories={media.trustedMediaCategories}
            resources={media.trustedMedia}
            renderItem={(resource, categoryTitle) => (
              <TrustedMediaCard
                resource={resource}
                categoryTitle={categoryTitle}
                explanation={editorial.trustedExplanationsById[resource.id]}
                plpMode={
                  plpMode
                    ? plpTrustedById[resource.id]?.mode ?? "CANONICAL_FALLBACK"
                    : undefined
                }
              />
            )}
          />
        </HuxDirectoryShell>

        <HuxDirectorySection
          sectionId="fact-checking"
          eyebrow={t("factChecking.eyebrow")}
          title={t("factChecking.title")}
          description={t("factChecking.description")}
          label={t("factChecking.ariaLabel")}
          items={media.factChecking}
          layout="three-two-one"
          getItemKey={(resource) => resource.id}
          renderItem={(resource) => {
            const resolved = plpFactCheckById?.[resource.id];
            const usedLocalized = resolved?.mode === "PUBLISHED_LOCALIZED";
            return (
              <FactCheckCard
                resource={resource}
                mission={
                  usedLocalized
                    ? (factCheckMaps?.missionsById[resource.id] ?? "")
                    : (factCheckMaps?.missionsById[resource.id] ?? resource.mission)
                }
                coverage={
                  usedLocalized
                    ? (factCheckMaps?.coverageById[resource.id] ?? "")
                    : (factCheckMaps?.coverageById[resource.id] ?? resource.coverage)
                }
                plpMode={
                  plpMode ? resolved?.mode ?? "CANONICAL_FALLBACK" : undefined
                }
              />
            );
          }}
        />

        <HuxDirectorySection
          sectionId="propaganda-analysis"
          eyebrow={t("propaganda.eyebrow")}
          title={t("propaganda.title")}
          description={t("propaganda.description")}
          label={t("propaganda.ariaLabel")}
          items={media.propagandaAnalysis}
          layout="three-two-one"
          getItemKey={(resource) => resource.id}
          renderItem={(resource) => {
            const resolved = plpPropagandaById?.[resource.id];
            const usedLocalized = resolved?.mode === "PUBLISHED_LOCALIZED";
            return (
              <PropagandaCard
                resource={resource}
                focus={
                  usedLocalized
                    ? (propagandaMaps?.focusById[resource.id] ?? "")
                    : (propagandaMaps?.focusById[resource.id] ?? resource.focus)
                }
                explanation={
                  usedLocalized
                    ? (propagandaMaps?.explanationsById[resource.id] ?? "")
                    : (propagandaMaps?.explanationsById[resource.id] ??
                      resource.explanation)
                }
                plpMode={
                  plpMode ? resolved?.mode ?? "CANONICAL_FALLBACK" : undefined
                }
              />
            );
          }}
        />

        <section id="faq" className="civic-media-page__faq civic-media-section-shell">
          <div className="civic-media-section-shell__inner">
            <MediaSemanticNode
              as="h2"
              owner="UI_DICTIONARY"
              result="LOCALIZED_DICTIONARY"
              messageKey="civicMediaPublic.faq.heading"
            >
              {t("faq.heading")}
            </MediaSemanticNode>
            <div className="civic-media-page__faq-list">
              {editorial.faq.map((item, index) => (
                <Card key={item.id} className="civic-media-resource-card">
                  <MediaSemanticNode
                    as="h3"
                    owner="PLP_ENTITY"
                    result={editorialResult}
                    entityType="civic_media_editorial"
                    entityId="civic-media-center"
                    semanticPath={`faq[${index}].question`}
                  >
                    {item.question}
                  </MediaSemanticNode>
                  <MediaSemanticNode
                    as="p"
                    owner="PLP_ENTITY"
                    result={editorialResult}
                    entityType="civic_media_editorial"
                    entityId="civic-media-center"
                    semanticPath={`faq[${index}].answer`}
                  >
                    {item.answer}
                  </MediaSemanticNode>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <p className="civic-media-page__knowledge-link">
          <MediaSemanticNode as="span" owner="UI_DICTIONARY" result="LOCALIZED_DICTIONARY">
            {t("knowledgeLink")}
          </MediaSemanticNode>{" "}
          <Link href="/knowledge">
            <MediaSemanticNode as="span" owner="UI_DICTIONARY" result="LOCALIZED_DICTIONARY">
              {t("visitKnowledge")}
            </MediaSemanticNode>
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

export function CivicMediaCenterPageContent({
  initialMedia,
  initialEditorial,
  plpTrustedById,
  plpPrinciplesById,
  plpEditorialPresentation,
  plpFactCheckById,
  plpPropagandaById,
  plpNewsById,
  initialNewsArticles,
  mediaLocalizationRuntimeBranch,
  mediaLocalizationRequestedLocale,
  mediaLocalizationBatchLocale,
}: {
  /**
   * Pack 08I.9 / 08I.12 — SSR-fetched media payload when server fetch succeeded.
   * Omit (undefined) when SSR failed so the client can recover via browser fetch.
   * Never pass null to mean "unavailable" — that caused live /media to stick on
   * "Civic Media Center unavailable." after SSR API/network errors.
   */
  initialMedia?: CivicMediaCenterPublic;
  /** Pack 08I.9 — SSR warm editorial seed (GET resolve only). */
  initialEditorial?: CivicMediaResolvedEditorial;
  /**
   * Reset 03C.1 — when set with plpPrinciplesById, use shared Media structure with
   * PLP semantic values (no separate PLP page; no generate-on-miss).
   */
  plpTrustedById?: Readonly<Record<string, MediaPlpResolvedPresentation>>;
  plpPrinciplesById?: Readonly<Record<string, MediaPlpResolvedPresentation>>;
  /** Reset 03E — overview + FAQ PLP presentation (civic_media_editorial). */
  plpEditorialPresentation?: MediaPlpResolvedPresentation;
  /** Reset 03E.3 — fact-check mission/coverage PLP presentations. */
  plpFactCheckById?: Readonly<Record<string, MediaPlpResolvedPresentation>>;
  /** Reset 03E.3 — propaganda focus/explanation PLP presentations. */
  plpPropagandaById?: Readonly<Record<string, MediaPlpResolvedPresentation>>;
  /** Reset 03E.3 — optional news PLP map (wiring can stay minimal). */
  plpNewsById?: Readonly<Record<string, MediaPlpResolvedPresentation>>;
  /** Optional SSR/static news seed for PublicNewsSection. */
  initialNewsArticles?: PublicNewsArticleItem[];
  /** Reset 03E.6 — PLP vs LEGACY branch actually taken by /media. */
  mediaLocalizationRuntimeBranch?: "PLP" | "LEGACY";
  mediaLocalizationRequestedLocale?: string;
  mediaLocalizationBatchLocale?: string;
} = {}) {
  const t = useTranslations("civicMediaPublic");
  const hasServerPayload = initialMedia !== undefined;
  const [media, setMedia] = useState<CivicMediaCenterPublic | null>(() =>
    initialMedia ?? null,
  );
  const [error, setError] = useState(false);

  useEffect(() => {
    if (hasServerPayload && initialMedia) {
      setMedia(initialMedia);
      setError(false);
      return;
    }

    let cancelled = false;
    void fetchCivicMediaCenter()
      .then((result) => {
        if (!cancelled) {
          setMedia(result);
          setError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hasServerPayload, initialMedia]);

  if (error) {
    return (
      <main className="civic-media-page">
        <div className="civic-media-page__container">
          <p role="alert">{t("unavailable")}</p>
        </div>
      </main>
    );
  }

  if (!media) {
    return (
      <main className="civic-media-page">
        <div className="civic-media-page__container">
          <p role="status">{t("loading")}</p>
        </div>
      </main>
    );
  }

  return (
    <CivicMediaCenterLoaded
      media={media}
      initialEditorial={initialEditorial}
      plpTrustedById={plpTrustedById}
      plpPrinciplesById={plpPrinciplesById}
      plpEditorialPresentation={plpEditorialPresentation}
      plpFactCheckById={plpFactCheckById}
      plpPropagandaById={plpPropagandaById}
      plpNewsById={plpNewsById}
      initialNewsArticles={initialNewsArticles}
      mediaLocalizationRuntimeBranch={mediaLocalizationRuntimeBranch}
      mediaLocalizationRequestedLocale={mediaLocalizationRequestedLocale}
      mediaLocalizationBatchLocale={mediaLocalizationBatchLocale}
    />
  );
}
