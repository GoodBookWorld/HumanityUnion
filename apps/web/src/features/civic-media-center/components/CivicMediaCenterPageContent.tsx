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

import { Badge, Card } from "../../../design-system";
import { CIVIC_MEDIA_ROUTE } from "../routes";
import {
  coverageToChips,
  PRINCIPLE_WHY_IT_MATTERS_IDS,
} from "../civic-media-card-utils";
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
import { applyMediaPlpPresentationsToEditorial } from "../../language/media-plp/apply-media-plp-editorial";
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
  const hasWhy = (PRINCIPLE_WHY_IT_MATTERS_IDS as readonly string[]).includes(principle.id);
  const whyItMatters = hasWhy ? t(`principles.${principle.id}.whyItMatters`) : null;
  // Pack 08J.1 / Reset 03C.1 — principle text from editorial (legacy CT or PLP-applied).
  const displayTitle = principle.title;
  const displayBody = principle.description;

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
        result={plpModeToSemanticResult(plpMode)}
        entityType="civic_media_principle"
        entityId={plpEntityId}
      >
        {displayTitle}
      </MediaSemanticNode>
      <MediaSemanticNode
        as="p"
        className="civic-media-resource-card__body"
        owner="PLP_ENTITY"
        result={plpModeToSemanticResult(plpMode)}
        entityType="civic_media_principle"
        entityId={plpEntityId}
      >
        {displayBody}
      </MediaSemanticNode>
      {whyItMatters ? (
        <p className="civic-media-resource-card__why">
          <MediaSemanticNode as="strong" owner="UI_DICTIONARY" result="LOCALIZED_DICTIONARY">
            {t("whyItMatters")}
          </MediaSemanticNode>
          <MediaSemanticNode as="span" owner="UI_DICTIONARY" result="LOCALIZED_DICTIONARY">
            {whyItMatters}
          </MediaSemanticNode>
        </p>
      ) : null}
    </Card>
  );
}

function FactCheckCard({ resource }: { resource: FactCheckResource }) {
  const t = useTranslations("civicMediaPublic");
  const missionKey = `factChecking.resources.${resource.id}.mission`;
  const coverageKey = `factChecking.resources.${resource.id}.coverage`;
  const mission = t.has(missionKey) ? t(missionKey) : resource.mission;
  const coverage = t.has(coverageKey) ? t(coverageKey) : resource.coverage;
  const chips = coverageToChips(coverage);

  return (
    <Card className="civic-media-resource-card civic-media-resource-card--verification">
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
      >
        {t("mission")}
      </MediaSemanticNode>
      <MediaSemanticNode
        as="p"
        className="civic-media-resource-card__body"
        owner="UI_DICTIONARY"
        result="LOCALIZED_DICTIONARY"
      >
        {mission}
      </MediaSemanticNode>
      <div className="civic-media-resource-card__chips" aria-label={t("coverageAria")}>
        {chips.map((chip) => (
          <MediaSemanticNode
            key={chip}
            as="span"
            className="civic-media-chip"
            owner="UI_DICTIONARY"
            result="LOCALIZED_DICTIONARY"
          >
            {chip}
          </MediaSemanticNode>
        ))}
      </div>
      <ExternalResourceLink href={resource.websiteUrl}>{t("officialWebsite")}</ExternalResourceLink>
    </Card>
  );
}

function PropagandaCard({ resource }: { resource: PropagandaAnalysisResource }) {
  const t = useTranslations("civicMediaPublic");
  const focusCodeKey = `propaganda.resources.${resource.id}.focusCode`;
  const explanationKey = `propaganda.resources.${resource.id}.explanation`;
  const focusCode = t.has(focusCodeKey) ? t(focusCodeKey) : "";
  const focusLabel = focusCode && t.has(`propaganda.focus.${focusCode}`)
    ? t(`propaganda.focus.${focusCode}`)
    : t.has(`propaganda.resources.${resource.id}.focus`)
      ? t(`propaganda.resources.${resource.id}.focus`)
      : resource.focus;
  const explanation = t.has(explanationKey) ? t(explanationKey) : resource.explanation;

  return (
    <Card className="civic-media-resource-card civic-media-resource-card--analysis">
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
      <MediaSemanticNode as="span" owner="UI_DICTIONARY" result="LOCALIZED_DICTIONARY">
        <Badge status="neutral" variant="neutral" label={focusLabel} />
      </MediaSemanticNode>
      <MediaSemanticNode
        as="p"
        className="civic-media-resource-card__body"
        owner="UI_DICTIONARY"
        result="LOCALIZED_DICTIONARY"
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
  initialNewsArticles,
}: {
  media: CivicMediaCenterPublic;
  initialEditorial?: CivicMediaResolvedEditorial;
  plpTrustedById?: Readonly<Record<string, MediaPlpResolvedPresentation>>;
  plpPrinciplesById?: Readonly<Record<string, MediaPlpResolvedPresentation>>;
  plpEditorialPresentation?: MediaPlpResolvedPresentation;
  initialNewsArticles?: PublicNewsArticleItem[];
}) {
  const t = useTranslations("civicMediaPublic");
  const plpMode = plpTrustedById != null && plpPrinciplesById != null;
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

  const editorialResult = plpMode
    ? plpModeToSemanticResult(
        plpEditorialPresentation?.mode ?? "CANONICAL_FALLBACK",
      )
    : "CANONICAL_FALLBACK";
  const editorialMode =
    plpEditorialPresentation?.mode ?? (plpMode ? "CANONICAL_FALLBACK" : undefined);

  return (
    <main
      className="civic-media-page"
      data-hu-media-plp={plpMode ? "true" : undefined}
      data-hu-media-renderer="shared"
      data-hu-semantic-contract="rendered"
      data-hu-plp-editorial-mode={editorialMode}
    >
      <div className="civic-media-page__container">
        <section id="overview" className="civic-media-page__hero civic-media-section-shell">
          <div className="civic-media-section-shell__inner">
            <MediaSemanticNode
              as="p"
              className="civic-media-page__eyebrow"
              owner="UI_DICTIONARY"
              result="LOCALIZED_DICTIONARY"
            >
              {t("eyebrow")}
            </MediaSemanticNode>
            <MediaSemanticNode as="h1" owner="UI_DICTIONARY" result="LOCALIZED_DICTIONARY">
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
              >
                {editorial.overview.summary}
              </MediaSemanticNode>
              <div className="civic-media-page__hero-grid">
                {editorial.overview.points.map((point) => (
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
                    >
                      {point.heading}
                    </MediaSemanticNode>
                    <MediaSemanticNode
                      as="p"
                      owner="PLP_ENTITY"
                      result={editorialResult}
                      entityType="civic_media_editorial"
                      entityId="civic-media-center"
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
          disableOnDemandTranslation={plpMode}
          initialArticles={initialNewsArticles}
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
          renderItem={(resource) => <FactCheckCard resource={resource} />}
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
          renderItem={(resource) => <PropagandaCard resource={resource} />}
        />

        <section id="faq" className="civic-media-page__faq civic-media-section-shell">
          <div className="civic-media-section-shell__inner">
            <MediaSemanticNode as="h2" owner="UI_DICTIONARY" result="LOCALIZED_DICTIONARY">
              {t("faq.heading")}
            </MediaSemanticNode>
            <div className="civic-media-page__faq-list">
              {editorial.faq.map((item) => (
                <Card key={item.id} className="civic-media-resource-card">
                  <MediaSemanticNode
                    as="h3"
                    owner="PLP_ENTITY"
                    result={editorialResult}
                    entityType="civic_media_editorial"
                    entityId="civic-media-center"
                  >
                    {item.question}
                  </MediaSemanticNode>
                  <MediaSemanticNode
                    as="p"
                    owner="PLP_ENTITY"
                    result={editorialResult}
                    entityType="civic_media_editorial"
                    entityId="civic-media-center"
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
  initialNewsArticles,
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
  /** Optional SSR/static news seed for PublicNewsSection. */
  initialNewsArticles?: PublicNewsArticleItem[];
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
      initialNewsArticles={initialNewsArticles}
    />
  );
}
