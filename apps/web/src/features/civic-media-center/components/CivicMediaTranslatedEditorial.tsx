"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";

import type {
  CivicMediaCenterPublic,
  CivicMediaFaqItem,
  CivicMediaOverview,
  CivicMediaSelectionPrinciple,
  LanguageCode,
} from "@hu/types";
import { DEFAULT_PLATFORM_LANGUAGE } from "@hu/types";

import {
  generateContentTranslation,
  resolveTranslatedContent,
} from "../../language/translation-api";
import { shouldAttemptOnDemandContentTranslation } from "../../language/public-translation-presentation-lifecycle";
import { resolvePublicContentDisplayLanguage } from "../../language/resolve-public-content-display-language";
import { usePublicContentReadingContext } from "../../language/use-public-content-reading-context";

export const CIVIC_MEDIA_RECORD_ID = "civic-media-center";

/** Trusted-media explanation overlay keyed by resource id (name/url stay identity). */
export type CivicMediaTrustedExplanationsById = Readonly<Record<string, string>>;

export interface CivicMediaResolvedEditorial {
  readonly overview: CivicMediaOverview;
  readonly selectionPrinciples: readonly CivicMediaSelectionPrinciple[];
  readonly faq: readonly CivicMediaFaqItem[];
  readonly initiativeFlow: {
    readonly title: string;
    readonly summary: string;
    readonly stages: readonly string[];
  };
  readonly trustedExplanationsById: CivicMediaTrustedExplanationsById;
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
type TrustedExplanationTranslated = { id: string; explanation: string };

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

type PrincipleTranslatedWithId = PrincipleTranslated & { id?: string };

function isPrincipleTranslatedWithId(
  value: unknown,
): value is PrincipleTranslatedWithId {
  return isPrincipleTranslated(value);
}

function isFaqTranslated(value: unknown): value is FaqTranslated {
  return (
    isRecord(value) &&
    typeof value.question === "string" &&
    typeof value.answer === "string"
  );
}

function isTrustedExplanationTranslated(
  value: unknown,
): value is TrustedExplanationTranslated {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.explanation === "string"
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

export function buildTrustedExplanationsById(
  media: CivicMediaCenterPublic,
): CivicMediaTrustedExplanationsById {
  const byId: Record<string, string> = {};
  for (const item of media.trustedMedia) {
    byId[item.id] = item.explanation;
  }
  return byId;
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
    trustedExplanationsById: buildTrustedExplanationsById(media),
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
    isPrincipleTranslatedWithId,
  );
  const faqTranslated = parseCivicMediaJsonArray(fields.faq, isFaqTranslated);
  const stagesTranslated = parseInitiativeFlowStages(fields.initiativeFlowStages);
  const trustedExplanationsTranslated = parseCivicMediaJsonArray(
    fields.trustedMediaExplanations,
    isTrustedExplanationTranslated,
  );

  const trustedExplanationsById: Record<string, string> = {
    ...buildTrustedExplanationsById(media),
  };
  if (trustedExplanationsTranslated) {
    for (const item of trustedExplanationsTranslated) {
      const explanation = item.explanation.trim();
      if (explanation.length > 0) {
        trustedExplanationsById[item.id] = explanation;
      }
    }
  }

  const principlesById = new Map<string, PrincipleTranslatedWithId>();
  if (principlesTranslated) {
    for (const item of principlesTranslated) {
      if (typeof item.id === "string" && item.id.trim()) {
        principlesById.set(item.id.trim(), item);
      }
    }
  }

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
      // Pack 08K.3.2 — prefer id match; fall back to index for legacy rows.
      const translated =
        principlesById.get(item.id) ?? principlesTranslated?.[index] ?? null;
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
    trustedExplanationsById,
    translationChrome: chrome,
  };
}

/**
 * Pack 02G / 08I / 08I.7 / 08J.1 — cache-first civic_media editorial overlay.
 * UI displayLanguage drives resolve/generate; readingContext supplies ready + preference.
 * Preferred locale + original miss + not stale → generateContentTranslation (blog parity).
 * Structured JSON fields are parsed back into arrays; never stringify for UI display.
 */
function isCivicMediaTranslationPartial(
  media: CivicMediaCenterPublic,
  fields: Record<string, string>,
): boolean {
  const principles = parseCivicMediaJsonArray(
    fields.selectionPrinciples,
    isPrincipleTranslatedWithId,
  );
  if (!principles) {
    // Field missing entirely while canonical has principles → treat as miss (not partial).
    return false;
  }
  let principlePresent = 0;
  let principleMissing = 0;
  for (const item of media.selectionPrinciples) {
    const byId = principles.find((p) => p.id === item.id);
    const byIndex = principles[media.selectionPrinciples.indexOf(item)];
    const match = byId ?? byIndex;
    if (
      match &&
      match.title.trim() &&
      match.description.trim()
    ) {
      principlePresent += 1;
    } else {
      principleMissing += 1;
    }
  }
  if (principlePresent > 0 && principleMissing > 0) {
    return true;
  }

  const trusted = parseCivicMediaJsonArray(
    fields.trustedMediaExplanations,
    isTrustedExplanationTranslated,
  );
  if (!trusted) {
    return false;
  }
  let trustedPresent = 0;
  let trustedMissing = 0;
  for (const resource of media.trustedMedia) {
    const match = trusted.find((t) => t.id === resource.id);
    if (match && match.explanation.trim()) {
      trustedPresent += 1;
    } else {
      trustedMissing += 1;
    }
  }
  return trustedPresent > 0 && trustedMissing > 0;
}

export function useCivicMediaResolvedEditorial(
  media: CivicMediaCenterPublic,
  initialEditorial?: CivicMediaResolvedEditorial,
): CivicMediaResolvedEditorial {
  const locale = useLocale();
  const readingContext = usePublicContentReadingContext();
  const displayLanguage = resolvePublicContentDisplayLanguage(locale);
  const requestGenerationRef = useRef(0);
  const [editorial, setEditorial] = useState(
    () => initialEditorial ?? buildCanonicalCivicMediaEditorial(media),
  );

  useEffect(() => {
    // Pack 08I.9 — do not force canonical when SSR seed is present (Blog parity).
    if (!initialEditorial) {
      setEditorial(buildCanonicalCivicMediaEditorial(media));
    }

    if (!readingContext.ready) {
      return;
    }

    const requestGeneration = ++requestGenerationRef.current;
    let cancelled = false;
    const preference = readingContext.translationPreference;

    void (async () => {
      try {
        // Pack 08I.13 — always GET warm resolve when ready; preference gates generate only.
        let resolved = await resolveTranslatedContent({
          sourceKind: "civic_media",
          sourceRecordId: CIVIC_MEDIA_RECORD_ID,
          language: displayLanguage,
        });

        const isPartial =
          resolved.presentationMode !== "original" &&
          isCivicMediaTranslationPartial(media, resolved.content);

        if (
          shouldAttemptOnDemandContentTranslation({
            ready: readingContext.ready,
            translationPreference: preference,
            readingLanguage: displayLanguage,
            resolvePresentationMode: resolved.presentationMode,
            originalLanguage: resolved.originalLanguage,
            isStale: resolved.isStale,
            isPartial,
          })
        ) {
          try {
            const generated = await generateContentTranslation({
              sourceKind: "civic_media",
              sourceRecordId: CIVIC_MEDIA_RECORD_ID,
              targetLanguage: displayLanguage,
            });
            resolved = generated.display;
          } catch {
            // keep resolve result
          }
        }

        if (cancelled || requestGeneration !== requestGenerationRef.current) {
          return;
        }
        if (resolved.activeLanguage !== displayLanguage) {
          return;
        }
        if (resolved.presentationMode === "original") {
          // MISSING/STALE: keep SSR seed or canonical; surface chrome so callers
          // can observe fallback (generate already attempted when preferred).
          setEditorial((prev) => ({
            ...prev,
            translationChrome: {
              activeLanguage: resolved.activeLanguage,
              originalLanguage: resolved.originalLanguage,
              isMachineTranslated: false,
              isStale: resolved.isStale,
              canViewOriginal: resolved.canViewOriginal,
              presentationMode: resolved.presentationMode,
            },
          }));
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
        // keep canonical / SSR seed fallback
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    media,
    initialEditorial,
    readingContext.ready,
    displayLanguage,
    readingContext.translationPreference,
  ]);

  return editorial;
}
