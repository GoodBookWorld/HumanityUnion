"use client";

import Link from "next/link";

import type { PublicInitiativeExperienceHero } from "@hu/types";

import { InitiativeImage } from "../../initiatives/components/InitiativeImage";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export interface PublicExperienceHeroProps {
  title: string;
  summary?: string;
  imageUrl?: string | null;
  imageAltText?: string;
  meta: Array<{ label: string; value: string }>;
  parentLink?: { href: string; label: string };
}

export function PublicExperienceHero({
  title,
  summary,
  imageUrl,
  meta,
  parentLink,
}: PublicExperienceHeroProps) {
  return (
    <section className="pie-hero" aria-labelledby="pie-hero-title">
      <div className="pie-hero__media">
        <InitiativeImage
          title={title}
          imageUrl={imageUrl}
          className="pie-hero__image"
          loading="eager"
        />
      </div>
      <div className="pie-hero__content">
        {parentLink ? (
          <p className="pie-hero__parent">
            <Link href={parentLink.href}>{parentLink.label}</Link>
          </p>
        ) : null}
        <h1 id="pie-hero-title" className="pie-hero__title">
          {title}
        </h1>
        {summary ? <p className="pie-hero__summary">{summary}</p> : null}
        <dl className="pie-hero__meta">
          {meta.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function buildInitiativeHeroProps(
  hero: PublicInitiativeExperienceHero,
): PublicExperienceHeroProps {
  return {
    title: hero.title,
    summary: hero.summary,
    imageUrl: hero.imageUrl,
    imageAltText: hero.imageAltText,
    meta: [
      { label: "Activity Area", value: hero.activityArea },
      { label: "Geography", value: hero.geography.label },
      { label: "Status", value: hero.status.replaceAll("_", " ") },
      { label: "Current Stage", value: hero.currentStageLabel },
      { label: "First Published", value: formatDate(hero.firstPublishedAt) },
      { label: "Last Updated", value: formatDate(hero.lastUpdatedAt) },
    ],
  };
}
