"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type {
  CivicMediaCenterPublic,
  CivicMediaSelectionPrinciple,
  FactCheckResource,
  PropagandaAnalysisResource,
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
  if (isExternalHttpUrl(href)) {
    return (
      <a href={href} className="hu-button hu-button--secondary" target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }

  return (
    <a href={href} className="hu-button hu-button--secondary">
      {children}
    </a>
  );
}

function PrincipleCard({ principle }: { principle: CivicMediaSelectionPrinciple }) {
  const t = useTranslations("civicMediaPublic");
  const icon = PRINCIPLE_ICONS[principle.id] ?? principle.title.slice(0, 1);
  const hasWhy = (PRINCIPLE_WHY_IT_MATTERS_IDS as readonly string[]).includes(principle.id);
  const whyItMatters = hasWhy ? t(`principles.${principle.id}.whyItMatters`) : null;

  return (
    <Card className="civic-media-resource-card civic-media-resource-card--principle">
      <span className="civic-media-resource-card__icon" aria-hidden="true">
        {icon}
      </span>
      <h3>{principle.title}</h3>
      <p className="civic-media-resource-card__body">{principle.description}</p>
      {whyItMatters ? (
        <p className="civic-media-resource-card__why">
          <strong>{t("whyItMatters")}</strong>
          {whyItMatters}
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
          <h3>{resource.name}</h3>
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
      <p className="civic-media-resource-card__label">{t("mission")}</p>
      <p className="civic-media-resource-card__body">{mission}</p>
      <div className="civic-media-resource-card__chips" aria-label={t("coverageAria")}>
        {chips.map((chip) => (
          <span key={chip} className="civic-media-chip">
            {chip}
          </span>
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
          <h3>{resource.name}</h3>
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
      <Badge status="neutral" variant="neutral" label={focusLabel} />
      <p className="civic-media-resource-card__body">{explanation}</p>
      <ExternalResourceLink href={resource.websiteUrl}>{t("learnMore")}</ExternalResourceLink>
    </Card>
  );
}

function TrustedMediaCard({
  resource,
  categoryTitle,
}: {
  resource: TrustedMediaResource;
  categoryTitle: string;
}) {
  return <TrustedMediaRailCard resource={resource} categoryTitle={categoryTitle} />;
}

function CivicMediaCenterLoaded({
  media,
  initialEditorial,
}: {
  media: CivicMediaCenterPublic;
  initialEditorial?: CivicMediaResolvedEditorial;
}) {
  const t = useTranslations("civicMediaPublic");
  const editorial = useCivicMediaResolvedEditorial(media, initialEditorial);

  return (
    <main className="civic-media-page">
      <div className="civic-media-page__container">
        <section id="overview" className="civic-media-page__hero civic-media-section-shell">
          <div className="civic-media-section-shell__inner">
            <p className="civic-media-page__eyebrow">{t("eyebrow")}</p>
            <h1>{t("pageTitle")}</h1>
            <div className="civic-media-page__editorial">
              <h2 className="civic-media-page__overview-title">{editorial.overview.title}</h2>
              <p className="civic-media-page__lead">{editorial.overview.summary}</p>
              <div className="civic-media-page__hero-grid">
                {editorial.overview.points.map((point) => (
                  <Card
                    key={point.id}
                    className="civic-media-resource-card civic-media-resource-card--hero"
                  >
                    <h2>{point.heading}</h2>
                    <p>{point.body}</p>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        <CivicPipelineWorkflow
          title={editorial.initiativeFlow.title}
          description={editorial.initiativeFlow.summary}
          stageTitles={editorial.initiativeFlow.stages}
        />

        <PublicNewsSection sectionId="news-widgets" variant="discovery" />

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
          renderItem={(principle) => <PrincipleCard principle={principle} />}
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
              <TrustedMediaCard resource={resource} categoryTitle={categoryTitle} />
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
            <h2>{t("faq.heading")}</h2>
            <div className="civic-media-page__faq-list">
              {editorial.faq.map((item) => (
                <Card key={item.id} className="civic-media-resource-card">
                  <h3>{item.question}</h3>
                  <p>{item.answer}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <p className="civic-media-page__knowledge-link">
          {t("knowledgeLink")}{" "}
          <Link href="/knowledge">{t("visitKnowledge")}</Link>.
        </p>
      </div>
    </main>
  );
}

export function CivicMediaCenterPageContent({
  initialMedia,
  initialEditorial,
}: {
  /** Pack 08I.9 — SSR-fetched media payload (Blog `initialPost` parity). */
  initialMedia?: CivicMediaCenterPublic | null;
  /** Pack 08I.9 — SSR warm editorial seed (GET resolve only). */
  initialEditorial?: CivicMediaResolvedEditorial;
} = {}) {
  const t = useTranslations("civicMediaPublic");
  const seeded = initialMedia !== undefined;
  const [media, setMedia] = useState<CivicMediaCenterPublic | null>(() =>
    initialMedia ?? null,
  );
  const [error, setError] = useState(() => seeded && initialMedia === null);

  useEffect(() => {
    if (seeded) {
      setMedia(initialMedia ?? null);
      setError(initialMedia === null);
      return;
    }

    let cancelled = false;
    void fetchCivicMediaCenter()
      .then((result) => {
        if (!cancelled) {
          setMedia(result);
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
  }, [seeded, initialMedia]);

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

  return <CivicMediaCenterLoaded media={media} initialEditorial={initialEditorial} />;
}
