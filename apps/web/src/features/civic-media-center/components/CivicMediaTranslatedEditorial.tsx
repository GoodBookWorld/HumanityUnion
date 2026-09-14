"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";

import type { CivicMediaCenterPublic } from "@hu/types";

import { resolveTranslatedContent } from "../../language/translation-api";
import { resolvePublicContentDisplayLanguage } from "../../language/resolve-public-content-display-language";
import { usePublicContentReadingContext } from "../../language/use-public-content-reading-context";
import {
  buildCanonicalCivicMediaEditorial,
  CIVIC_MEDIA_RECORD_ID,
  overlayCivicMediaEditorialFromFields,
  type CivicMediaResolvedEditorial,
} from "../civic-media-canonical-editorial";

export {
  buildCanonicalCivicMediaEditorial,
  buildTrustedExplanationsById,
  CIVIC_MEDIA_RECORD_ID,
  overlayCivicMediaEditorialFromFields,
  parseCivicMediaJsonArray,
  parseInitiativeFlowStages,
  type CivicMediaResolvedEditorial,
  type CivicMediaTrustedExplanationsById,
} from "../civic-media-canonical-editorial";

/**
 * Pack 02G / 08I / Pack 1.1 — cache-only civic_media editorial overlay.
 * UI displayLanguage drives GET resolve; missing/stale → canonical/SSR seed.
 * Structured JSON fields are parsed back into arrays; never stringify for UI display.
 */
export function useCivicMediaResolvedEditorial(
  media: CivicMediaCenterPublic,
  initialEditorial?: CivicMediaResolvedEditorial,
  options?: {
    /** Reset 03C.1 — PLP mode: never resolve content_translations. */
    readonly skipClientTranslation?: boolean;
  },
): CivicMediaResolvedEditorial {
  const locale = useLocale();
  const readingContext = usePublicContentReadingContext();
  const displayLanguage = resolvePublicContentDisplayLanguage(locale);
  const requestGenerationRef = useRef(0);
  const skipClientTranslation = options?.skipClientTranslation === true;
  /**
   * Reset 03C.2 — PLP path derives editorial synchronously.
   * Never setEditorial from an unstable parent identity (that loop kept
   * LanguageSelector useTransition pending after locale switch).
   */
  const plpDerivedEditorial = skipClientTranslation
    ? (initialEditorial ?? buildCanonicalCivicMediaEditorial(media))
    : null;
  const [editorial, setEditorial] = useState(
    () => initialEditorial ?? buildCanonicalCivicMediaEditorial(media),
  );

  useEffect(() => {
    if (skipClientTranslation) {
      return;
    }

    // Pack 08I.9 — do not force canonical when SSR seed is present (Blog parity).
    if (!initialEditorial) {
      setEditorial(buildCanonicalCivicMediaEditorial(media));
    }

    if (!readingContext.ready) {
      return;
    }

    const requestGeneration = ++requestGenerationRef.current;
    let cancelled = false;

    void (async () => {
      try {
        // Pack 1.1 — cache-only GET resolve; never generate on read.
        const resolved = await resolveTranslatedContent({
          sourceKind: "civic_media",
          sourceRecordId: CIVIC_MEDIA_RECORD_ID,
          language: displayLanguage,
        });

        if (cancelled || requestGeneration !== requestGenerationRef.current) {
          return;
        }
        if (resolved.activeLanguage !== displayLanguage) {
          return;
        }
        if (resolved.presentationMode === "original") {
          // MISSING/STALE: keep SSR seed or canonical.
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
    skipClientTranslation,
    readingContext.ready,
    displayLanguage,
  ]);

  if (skipClientTranslation) {
    return plpDerivedEditorial ?? buildCanonicalCivicMediaEditorial(media);
  }
  return editorial;
}
