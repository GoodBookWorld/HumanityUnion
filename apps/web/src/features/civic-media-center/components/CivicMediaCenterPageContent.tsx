"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
  PRINCIPLE_WHY_IT_MATTERS,
} from "../civic-media-card-utils";
import {
  HuxDirectorySection,
  HuxDirectoryShell,
  HuxEducationSection,
} from "../../horizontal-experience";
import { PublicNewsSection } from "../../public-news/components/PublicNewsSection";
import { fetchCivicMediaCenter } from "../api";
import { CivicPipelineWorkflow } from "./CivicPipelineWorkflow";
import { MediaLogo } from "./MediaLogo";
import { TrustedMediaCategoryTabs } from "./TrustedMediaCategoryTabs";
import { TrustedMediaRailCard } from "./TrustedMediaRailCard";

import "../civic-media-center.css";
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
  const icon = PRINCIPLE_ICONS[principle.id] ?? principle.title.slice(0, 1);
  const whyItMatters = PRINCIPLE_WHY_IT_MATTERS[principle.id];

  return (
    <Card className="civic-media-resource-card civic-media-resource-card--principle">
      <span className="civic-media-resource-card__icon" aria-hidden="true">
        {icon}
      </span>
      <h3>{principle.title}</h3>
      <p className="civic-media-resource-card__body">{principle.description}</p>
      {whyItMatters ? (
        <p className="civic-media-resource-card__why">
          <strong>Why it matters</strong>
          {whyItMatters}
        </p>
      ) : null}
    </Card>
  );
}

function FactCheckCard({ resource }: { resource: FactCheckResource }) {
  const chips = coverageToChips(resource.coverage);

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
      <p className="civic-media-resource-card__label">Mission</p>
      <p className="civic-media-resource-card__body">{resource.mission}</p>
      <div className="civic-media-resource-card__chips" aria-label="Coverage areas">
        {chips.map((chip) => (
          <span key={chip} className="civic-media-chip">
            {chip}
          </span>
        ))}
      </div>
      <ExternalResourceLink href={resource.websiteUrl}>Official website</ExternalResourceLink>
    </Card>
  );
}

function PropagandaCard({ resource }: { resource: PropagandaAnalysisResource }) {
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
      <Badge status={resource.focus} />
      <p className="civic-media-resource-card__body">{resource.explanation}</p>
      <ExternalResourceLink href={resource.websiteUrl}>Learn more</ExternalResourceLink>
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

export function CivicMediaCenterPageContent() {
  const [media, setMedia] = useState<CivicMediaCenterPublic | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchCivicMediaCenter()
      .then(setMedia)
      .catch((fetchError: unknown) => {
        setError(
          fetchError instanceof Error ? fetchError.message : "Civic Media Center unavailable.",
        );
      });
  }, []);

  if (error) {
    return (
      <main className="civic-media-page">
        <div className="civic-media-page__container">
          <p role="alert">{error}</p>
        </div>
      </main>
    );
  }

  if (!media) {
    return (
      <main className="civic-media-page">
        <div className="civic-media-page__container">
          <p role="status">Loading Civic Media…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="civic-media-page">
      <div className="civic-media-page__container">
        <section id="overview" className="civic-media-page__hero civic-media-section-shell">
          <div className="civic-media-section-shell__inner">
            <p className="civic-media-page__eyebrow">Civic Media</p>
            <h1>Civic Media Center</h1>
            <p className="civic-media-page__lead">{media.overview.summary}</p>
            <div className="civic-media-page__hero-grid">
              {media.overview.points.map((point) => (
                <Card key={point.id} className="civic-media-resource-card civic-media-resource-card--hero">
                  <h2>{point.heading}</h2>
                  <p>{point.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <CivicPipelineWorkflow />

        <PublicNewsSection sectionId="news-widgets" variant="discovery" />

        <HuxEducationSection
          sectionId="selection-principles"
          surfaceStyle="grouped"
          eyebrow="TRUSTED SOURCES"
          title="Why We Recommend These Sources"
          description="Selection follows published principles — not popularity, stars, or rankings."
          label="source selection principles"
          items={media.selectionPrinciples}
          layout="four-two-one"
          getItemKey={(principle) => principle.id}
          renderItem={(principle) => <PrincipleCard principle={principle} />}
          footerAction={
            <Link href={`${CIVIC_MEDIA_ROUTE}#faq`}>Read selection FAQ</Link>
          }
        />

        <HuxDirectoryShell
          sectionId="trusted-media"
          eyebrow="TRUSTED SOURCES"
          title="Recommended Trusted Media"
          description="Curated sources selected by editorial standards. No rankings, scores, or votes."
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
          eyebrow="VERIFY INFORMATION"
          title="Fact-Checking Resources"
          description="Independent organizations and tools for checking public claims, images, and media narratives."
          label="fact-checking resources"
          items={media.factChecking}
          layout="three-two-one"
          getItemKey={(resource) => resource.id}
          renderItem={(resource) => <FactCheckCard resource={resource} />}
        />

        <HuxDirectorySection
          sectionId="propaganda-analysis"
          eyebrow="ANALYZE NARRATIVES"
          title="Propaganda Analysis"
          description="Resources for identifying manipulation techniques, coordinated narratives, and information operations."
          label="propaganda analysis resources"
          items={media.propagandaAnalysis}
          layout="three-two-one"
          getItemKey={(resource) => resource.id}
          renderItem={(resource) => <PropagandaCard resource={resource} />}
        />

        <section id="faq" className="civic-media-page__faq civic-media-section-shell">
          <div className="civic-media-section-shell__inner">
            <h2>Frequently Asked Questions</h2>
            <div className="civic-media-page__faq-list">
              {media.faq.map((item) => (
                <Card key={item.id} className="civic-media-resource-card">
                  <h3>{item.question}</h3>
                  <p>{item.answer}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <p className="civic-media-page__knowledge-link">
          Looking for broader educational articles?{" "}
          <Link href="/knowledge">Visit the Knowledge Center</Link>.
        </p>
      </div>
    </main>
  );
}
