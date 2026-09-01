"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { InitiativeCoverMedia, PublicInitiativeExperienceHero } from "@hu/types";

import { TranslatedContentView } from "../../language";
import { resolveTranslatedContent, generateContentTranslation } from "../../language/translation-api";
import { usePublicContentReadingContext } from "../../language/use-public-content-reading-context";
import { InitiativeImage } from "../../initiatives/components/InitiativeImage";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

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
  /** Pack 02 — when set, title/summary resolve through provider-backed translation. */
  initiativeId?: string;
}

export function PublicExperienceHero({
  title,
  summary,
  imageUrl,
  coverMedia,
  meta,
  parentLink,
  initiativeId,
}: PublicExperienceHeroProps) {
  const readingContext = usePublicContentReadingContext();
  const [displayTitle, setDisplayTitle] = useState(title);
  const [displaySummary, setDisplaySummary] = useState(summary ?? "");
  const [originalTitle, setOriginalTitle] = useState(title);
  const [originalSummary, setOriginalSummary] = useState(summary ?? "");
  const [activeLanguage, setActiveLanguage] = useState("en");
  const [originalLanguage, setOriginalLanguage] = useState("en");
  const [canViewOriginal, setCanViewOriginal] = useState(false);
  const [isMachineTranslated, setIsMachineTranslated] = useState(false);
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    if (!initiativeId || !readingContext.ready) {
      return;
    }

    let cancelled = false;
    const readingLanguage = readingContext.readingLanguage;
    const preference = readingContext.translationPreference;

    void (async () => {
      try {
        let resolved = await resolveTranslatedContent({
          sourceKind: "initiative",
          sourceRecordId: initiativeId,
          language: readingLanguage,
        });

        if (
          preference === "preferred" &&
          resolved.presentationMode === "original" &&
          readingLanguage !== resolved.originalLanguage &&
          !resolved.isStale
        ) {
          try {
            const generated = await generateContentTranslation({
              sourceKind: "initiative",
              sourceRecordId: initiativeId,
              targetLanguage: readingLanguage,
            });
            resolved = generated.display;
          } catch {
            // keep original
          }
        }

        if (cancelled) {
          return;
        }

        setDisplayTitle(resolved.content.title || title);
        setDisplaySummary(resolved.content.description || summary || "");
        setOriginalTitle(resolved.originalContent.title || title);
        setOriginalSummary(resolved.originalContent.description || summary || "");
        setActiveLanguage(resolved.activeLanguage);
        setOriginalLanguage(resolved.originalLanguage);
        setCanViewOriginal(resolved.canViewOriginal || resolved.canViewTranslation);
        setIsMachineTranslated(resolved.isMachineTranslated);
        setIsStale(resolved.isStale);
      } catch {
        // keep props
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    initiativeId,
    summary,
    title,
    readingContext.ready,
    readingContext.readingLanguage,
    readingContext.translationPreference,
  ]);

  const columnA = useMemo(() => meta.filter((item) => item.column === "a"), [meta]);
  const columnB = useMemo(() => meta.filter((item) => item.column === "b"), [meta]);
  const descriptionText = displaySummary || originalSummary || summary || "";

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
          {initiativeId ? (
            <h1 id="pie-hero-title" className="pie-hero__title">
              <TranslatedContentView
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
          <div className="pie-hero__meta-grid" role="group" aria-label="Initiative details">
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

export function buildInitiativeHeroProps(
  hero: PublicInitiativeExperienceHero,
): PublicExperienceHeroProps {
  return {
    title: hero.title,
    summary: hero.summary,
    imageUrl: hero.imageUrl,
    imageAltText: hero.imageAltText,
    coverMedia: hero.coverMedia,
    meta: [
      { label: "Activity Area", value: hero.activityArea, column: "a" },
      { label: "Status", value: hero.status.replaceAll("_", " "), column: "a" },
      { label: "First Published", value: formatDate(hero.firstPublishedAt), column: "a" },
      { label: "Geography", value: hero.geography.label, column: "b" },
      { label: "Current Stage", value: hero.currentStageLabel, column: "b" },
      { label: "Last Updated", value: formatDate(hero.lastUpdatedAt), column: "b" },
    ],
  };
}
