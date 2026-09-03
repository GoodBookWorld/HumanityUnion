"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import type { InitiativeCoverMedia, PublicInitiativeExperienceHero } from "@hu/types";

import {
  TranslatedContentSharedChrome,
  TranslatedContentView,
} from "../../language";
import type { TranslatedContentViewMode } from "../../language/translated-content-view-mode";
import { translatedContentHasDistinctTranslation } from "../../language/translated-content-view-mode";
import { usePublicContentReadingContext } from "../../language/use-public-content-reading-context";
import { InitiativeImage } from "../../initiatives/components/InitiativeImage";
import {
  formatInitiativeExperienceDate,
  resolveActivityAreaDisplayLabel,
  resolveInitiativeStatusDisplayLabel,
  resolveLifecycleStageDisplayLabel,
} from "../initiative-experience-i18n";
import { resolveInitiativeDetailPresentation } from "../resolve-initiative-detail-presentation";

export interface PublicExperienceHeroMetaItem {
  label: string;
  value: string;
  column: "a" | "b";
}

export interface PublicExperienceHeroProps {
  title: string;
  summary?: string;
  imageUrl?: string | null;
  imageAltText?: string;
  coverMedia?: InitiativeCoverMedia;
  meta: PublicExperienceHeroMetaItem[];
  parentLink?: { href: string; label: string };
  /** Pack 02 / 08I.8 — title/description resolve through shared Initiative detail presentation. */
  initiativeId?: string;
  /** Pack 08I.9 — SSR warm title/description seed (GET resolve only). */
  initialPresentation?: {
    readonly title: string;
    readonly description: string;
  };
}

export function PublicExperienceHero({
  title,
  summary,
  imageUrl,
  coverMedia,
  meta,
  parentLink,
  initiativeId,
  initialPresentation,
}: PublicExperienceHeroProps) {
  const t = useTranslations("initiativeExperience");
  const readingContext = usePublicContentReadingContext();
  const [displayTitle, setDisplayTitle] = useState(
    () => initialPresentation?.title || title,
  );
  const [displaySummary, setDisplaySummary] = useState(
    () => initialPresentation?.description || summary || "",
  );
  const [originalTitle, setOriginalTitle] = useState(title);
  const [originalSummary, setOriginalSummary] = useState(summary ?? "");
  const [activeLanguage, setActiveLanguage] = useState("en");
  const [originalLanguage, setOriginalLanguage] = useState("en");
  const [canViewOriginal, setCanViewOriginal] = useState(false);
  const [isMachineTranslated, setIsMachineTranslated] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [viewMode, setViewMode] = useState<TranslatedContentViewMode>(() =>
    initialPresentation &&
    (initialPresentation.title !== title ||
      initialPresentation.description !== (summary ?? ""))
      ? "translation"
      : "original",
  );

  useEffect(() => {
    // Pack 08I.9 — keep SSR seed until reading context is ready (Blog parity).
    if (!readingContext.ready) {
      if (!initialPresentation) {
        setDisplayTitle(title);
        setDisplaySummary(summary ?? "");
      }
      setOriginalTitle(title);
      setOriginalSummary(summary ?? "");
      return;
    }

    if (!initiativeId) {
      setDisplayTitle(initialPresentation?.title || title);
      setDisplaySummary(initialPresentation?.description || summary || "");
      return;
    }

    let cancelled = false;

    void resolveInitiativeDetailPresentation({
      initiativeId,
      canonical: {
        title,
        description: summary ?? "",
      },
      readingContext,
    }).then((presentation) => {
      if (cancelled) {
        return;
      }

      setDisplayTitle(presentation.title);
      setDisplaySummary(presentation.description);
      setOriginalTitle(presentation.originalTitle);
      setOriginalSummary(presentation.originalDescription);
      setActiveLanguage(presentation.activeLanguage);
      setOriginalLanguage(presentation.originalLanguage);
      setCanViewOriginal(presentation.canViewOriginal || presentation.canViewTranslation);
      setIsMachineTranslated(presentation.isMachineTranslated);
      setIsStale(presentation.isStale);
      setViewMode(
        translatedContentHasDistinctTranslation({
          content: `${presentation.title}\n${presentation.description}`,
          originalContent: `${presentation.originalTitle}\n${presentation.originalDescription}`,
          canViewOriginal: presentation.canViewOriginal || presentation.canViewTranslation,
        })
          ? "translation"
          : "original",
      );
    });

    return () => {
      cancelled = true;
    };
  }, [
    initiativeId,
    summary,
    title,
    initialPresentation,
    readingContext.ready,
    readingContext.readingLanguage,
    readingContext.translationPreference,
  ]);

  const columnA = useMemo(() => meta.filter((item) => item.column === "a"), [meta]);
  const columnB = useMemo(() => meta.filter((item) => item.column === "b"), [meta]);
  const descriptionText = displaySummary || originalSummary || summary || "";
  const showSharedChrome = Boolean(initiativeId);

  return (
    <section className="pie-hero" aria-labelledby="pie-hero-title">
      <div className="pie-hero__top">
        <div className="pie-hero__media">
          <InitiativeImage
            title={displayTitle}
            imageUrl={imageUrl}
            coverMedia={coverMedia}
            className="pie-hero__image"
            loading="eager"
            interactive
          />
        </div>
        <div className="pie-hero__content">
          {parentLink ? (
            <p className="pie-hero__parent">
              <Link href={parentLink.href}>{parentLink.label}</Link>
            </p>
          ) : null}
          {showSharedChrome ? (
            <TranslatedContentSharedChrome
              mode={viewMode}
              onModeChange={setViewMode}
              activeLanguage={activeLanguage}
              originalLanguage={originalLanguage}
              canViewOriginal={canViewOriginal}
              content={`${displayTitle}\n${displaySummary || summary || ""}`}
              originalContent={`${originalTitle}\n${originalSummary || summary || ""}`}
              isMachineTranslated={isMachineTranslated}
              isStale={isStale}
            />
          ) : null}
          {initiativeId ? (
            <h1 id="pie-hero-title" className="pie-hero__title">
              <TranslatedContentView
                chrome="body"
                mode={viewMode}
                onModeChange={setViewMode}
                content={displayTitle}
                originalContent={originalTitle}
                activeLanguage={activeLanguage}
                originalLanguage={originalLanguage}
                canViewOriginal={canViewOriginal}
                isMachineTranslated={isMachineTranslated}
                isStale={isStale}
              />
            </h1>
          ) : (
            <h1 id="pie-hero-title" className="pie-hero__title">
              {title}
            </h1>
          )}
          <div className="pie-hero__meta-grid" role="group" aria-label={t("hero.detailsAria")}>
            <dl className="pie-hero__meta pie-hero__meta--column-a">
              {columnA.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
            <dl className="pie-hero__meta pie-hero__meta--column-b">
              {columnB.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
      {descriptionText ? (
        <div className="pie-hero__description">
          {initiativeId ? (
            <TranslatedContentView
              chrome="body"
              mode={viewMode}
              onModeChange={setViewMode}
              content={displaySummary || summary || ""}
              originalContent={originalSummary || summary || ""}
              activeLanguage={activeLanguage}
              originalLanguage={originalLanguage}
              canViewOriginal={canViewOriginal}
              isMachineTranslated={isMachineTranslated}
              isStale={isStale}
            />
          ) : (
            <p>{descriptionText}</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Build hero props with localized labels/values for the active interface locale.
 * Call from a client component that has next-intl context.
 */
export function buildInitiativeHeroProps(
  hero: PublicInitiativeExperienceHero,
  options: {
    readonly t: (key: string, values?: Record<string, string | number | Date>) => string;
    readonly locale: string;
    readonly currentStageId?: string;
  },
): PublicExperienceHeroProps {
  const { t, locale, currentStageId } = options;
  const stageId =
    currentStageId || inferStageIdFromEnglishLabel(hero.currentStageLabel) || hero.currentStageLabel;

  return {
    title: hero.title,
    summary: hero.summary,
    imageUrl: hero.imageUrl,
    imageAltText: hero.imageAltText,
    coverMedia: hero.coverMedia,
    meta: [
      {
        label: t("hero.activityArea"),
        value: resolveActivityAreaDisplayLabel(hero.activityArea, t),
        column: "a",
      },
      {
        label: t("hero.status"),
        value: resolveInitiativeStatusDisplayLabel(hero.status, t),
        column: "a",
      },
      {
        label: t("hero.firstPublished"),
        value: formatInitiativeExperienceDate(locale, hero.firstPublishedAt),
        column: "a",
      },
      { label: t("hero.geography"), value: hero.geography.label, column: "b" },
      {
        label: t("hero.currentStage"),
        value: resolveLifecycleStageDisplayLabel(stageId, t, hero.currentStageLabel),
        column: "b",
      },
      {
        label: t("hero.lastUpdated"),
        value: formatInitiativeExperienceDate(locale, hero.lastUpdatedAt),
        column: "b",
      },
    ],
  };
}

function inferStageIdFromEnglishLabel(label: string): string | null {
  const normalized = label.trim();
  const entries: Array<[string, string]> = [
    ["Initiative", "initiative"],
    ["Discussion", "discussion"],
    ["Collaborative Analysis", "analysis"],
    ["Improvement Proposals", "proposal"],
    ["Petition", "petition"],
    ["Decision Session", "decision_session"],
    ["Collective Decision", "collective_decision"],
    ["Implementation Commitments", "commitment"],
    ["Implementation Tracking", "tracking"],
    ["Official Responses", "official_response"],
    ["Public Impact", "public_impact"],
    ["Civic Archive", "archive"],
  ];
  for (const [english, id] of entries) {
    if (english === normalized) {
      return id;
    }
  }
  return null;
}

