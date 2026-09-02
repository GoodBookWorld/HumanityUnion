"use client";

import { useEffect, useState } from "react";

import type {
  CivicMediaCenterPublic,
  CivicMediaFaqItem,
  CivicMediaOverview,
  CivicMediaSelectionPrinciple,
  LanguageCode,
} from "@hu/types";
import { DEFAULT_PLATFORM_LANGUAGE } from "@hu/types";

import { resolveTranslatedContent } from "../../language/translation-api";
import { usePublicContentReadingContext } from "../../language/use-public-content-reading-context";

export const CIVIC_MEDIA_RECORD_ID = "civic-media-center";

export interface CivicMediaResolvedEditorial {
  readonly overview: CivicMediaOverview;
  readonly selectionPrinciples: readonly CivicMediaSelectionPrinciple[];
  readonly faq: readonly CivicMediaFaqItem[];
  readonly initiativeFlow: {
    readonly title: string;
    readonly summary: string;
    readonly stages: readonly string[];
  };
  readonly translationChrome: {
    readonly activeLanguage: LanguageCode;
    readonly originalLanguage: LanguageCode;
    readonly isMachineTranslated: boolean;
    readonly isStale: boolean;
    readonly canViewOriginal: boolean;
    readonly presentationMode: string;
  };
}

type OverviewPointTranslated = { heading: string; body: string };
type PrincipleTranslated = { title: string; description: string };
type FaqTranslated = { question: string; answer: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function isOverviewPointTranslated(value: unknown): value is OverviewPointTranslated {
  return (
    isRecord(value) &&
    typeof value.heading === "string" &&
    typeof value.body === "string"
  );
}

function isPrincipleTranslated(value: unknown): value is PrincipleTranslated {
  return (
    isRecord(value) &&
    typeof value.title === "string" &&
    typeof value.description === "string"
  );
}

function isFaqTranslated(value: unknown): value is FaqTranslated {
  return (
    isRecord(value) &&
    typeof value.question === "string" &&
    typeof value.answer === "string"
  );
}

/**
 * Safe JSON.parse for civic_media structured fields.
 * Returns null when missing, invalid JSON, or not a typed array — callers keep canonical.
 */
export function parseCivicMediaJsonArray<T>(
  raw: string | undefined | null,
  isItem: (value: unknown) => value is T,
): T[] | null {
  if (raw == null || raw.trim().length === 0) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isItem)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Parse newline-joined initiativeFlowStages translation back into stage labels. */
export function parseInitiativeFlowStages(
  raw: string | undefined | null,
): string[] | null {
  if (raw == null) {
    return null;
  }
  const stages = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return stages.length > 0 ? stages : null;
}

export function buildCanonicalCivicMediaEditorial(
  media: CivicMediaCenterPublic,
): CivicMediaResolvedEditorial {
  return {
    overview: {
      title: media.overview.title,
      summary: media.overview.summary,
      points: media.overview.points.map((point) => ({ ...point })),
    },
    selectionPrinciples: media.selectionPrinciples.map((item) => ({ ...item })),
    faq: media.faq.map((item) => ({ ...item })),
    initiativeFlow: {
      title: media.initiativeFlow.title,
      summary: media.initiativeFlow.summary,
      stages: [...media.initiativeFlow.stages],
    },
    translationChrome: {
      activeLanguage: DEFAULT_PLATFORM_LANGUAGE,
      originalLanguage: DEFAULT_PLATFORM_LANGUAGE,
      isMachineTranslated: false,
      isStale: false,
      canViewOriginal: false,
      presentationMode: "original",
    },
  };
}

export function overlayCivicMediaEditorialFromFields(
  media: CivicMediaCenterPublic,
  fields: Record<string, string>,
  chrome: CivicMediaResolvedEditorial["translationChrome"],
): CivicMediaResolvedEditorial {
  const pointsTranslated = parseCivicMediaJsonArray(
    fields.overviewPoints,
    isOverviewPointTranslated,
  );
  const principlesTranslated = parseCivicMediaJsonArray(
    fields.selectionPrinciples,
    isPrincipleTranslated,
  );
  const faqTranslated = parseCivicMediaJsonArray(fields.faq, isFaqTranslated);
  const stagesTranslated = parseInitiativeFlowStages(fields.initiativeFlowStages);

  return {
    overview: {
      title: fields.overviewTitle?.trim() || media.overview.title,
      summary: fields.overviewSummary?.trim() || media.overview.summary,
      points: media.overview.points.map((point, index) => {
        const translated = pointsTranslated?.[index];
        if (!translated) {
          return { ...point };
        }
        return {
          ...point,
          heading: translated.heading.trim() || point.heading,
          body: translated.body.trim() || point.body,
        };
      }),
    },
    selectionPrinciples: media.selectionPrinciples.map((item, index) => {
      const translated = principlesTranslated?.[index];
      if (!translated) {
        return { ...item };
      }
      return {
        ...item,
        title: translated.title.trim() || item.title,
        description: translated.description.trim() || item.description,
      };
    }),
    faq: media.faq.map((item, index) => {
      const translated = faqTranslated?.[index];
      if (!translated) {
        return { ...item };
      }
      return {
        ...item,
        question: translated.question.trim() || item.question,
        answer: translated.answer.trim() || item.answer,
      };
    }),
    initiativeFlow: {
      title: fields.initiativeFlowTitle?.trim() || media.initiativeFlow.title,
      summary: fields.initiativeFlowSummary?.trim() || media.initiativeFlow.summary,
      stages: stagesTranslated ?? [...media.initiativeFlow.stages],
    },
    translationChrome: chrome,
  };
}

/**
 * Pack 02G / 08I — cache-first civic_media editorial overlay.
 * Resolves translated fields only (no POST /generate). Structured JSON fields are
 * parsed back into arrays; never stringify for UI display.
 */
export function useCivicMediaResolvedEditorial(
  media: CivicMediaCenterPublic,
): CivicMediaResolvedEditorial {
  const readingContext = usePublicContentReadingContext();
  const [editorial, setEditorial] = useState(() => buildCanonicalCivicMediaEditorial(media));

  useEffect(() => {
    setEditorial(buildCanonicalCivicMediaEditorial(media));

    if (!readingContext.ready) {
      return;
    }

    if (readingContext.translationPreference === "none") {
      return;
    }

    let cancelled = false;
    const readingLanguage = readingContext.readingLanguage;

    void (async () => {
      try {
        const resolved = await resolveTranslatedContent({
          sourceKind: "civic_media",
          sourceRecordId: CIVIC_MEDIA_RECORD_ID,
          language: readingLanguage,
        });
        if (cancelled) {
          return;
        }
        if (resolved.presentationMode === "original") {
          return;
        }
        setEditorial(
          overlayCivicMediaEditorialFromFields(media, resolved.content, {
            activeLanguage: resolved.activeLanguage,
            originalLanguage: resolved.originalLanguage,
            isMachineTranslated: resolved.isMachineTranslated,
            isStale: resolved.isStale,
            canViewOriginal: resolved.canViewOriginal,
            presentationMode: resolved.presentationMode,
          }),
        );
      } catch {
        // keep canonical fallback
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    media,
    readingContext.ready,
    readingContext.readingLanguage,
    readingContext.translationPreference,
  ]);

  return editorial;
}
