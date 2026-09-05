/**
 * Pack 08K.3.1 — shared trusted-media explanation overlay from civic_media.
 * /media and country media rails share this boundary for AUTO_TRANSLATABLE explanations.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";

import type { LanguageCode } from "@hu/types";

import {
  buildTrustedExplanationsById,
  CIVIC_MEDIA_RECORD_ID,
  parseCivicMediaJsonArray,
  type CivicMediaTrustedExplanationsById,
} from "./CivicMediaTranslatedEditorial";
import {
  generateContentTranslation,
  resolveTranslatedContent,
} from "../../language/translation-api";
import { shouldAttemptOnDemandContentTranslation } from "../../language/public-translation-presentation-lifecycle";
import { resolvePublicContentDisplayLanguage } from "../../language/resolve-public-content-display-language";
import { usePublicContentReadingContext } from "../../language/use-public-content-reading-context";
import { fetchCivicMediaCenter } from "../api";

function isTrustedExplanationTranslated(
  value: unknown,
): value is { id: string; explanation: string } {
  return (
    value != null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as { id?: unknown }).id === "string" &&
    typeof (value as { explanation?: unknown }).explanation === "string"
  );
}

function mergeTrustedExplanations(
  canonical: CivicMediaTrustedExplanationsById,
  fields: Record<string, string>,
): CivicMediaTrustedExplanationsById {
  const translated = parseCivicMediaJsonArray(
    fields.trustedMediaExplanations,
    isTrustedExplanationTranslated,
  );
  const next: Record<string, string> = { ...canonical };
  if (translated) {
    for (const item of translated) {
      const explanation = item.explanation.trim();
      if (explanation.length > 0) {
        next[item.id] = explanation;
      }
    }
  }
  return next;
}

/**
 * Resolve localized trusted-media explanations for the interface locale.
 * Optional `seedById` preserves SSR /media overlay until client resolve upgrades.
 */
export function useTrustedMediaExplanationsOverlay(input?: {
  readonly seedById?: CivicMediaTrustedExplanationsById;
}): CivicMediaTrustedExplanationsById {
  const locale = useLocale();
  const displayLanguage = resolvePublicContentDisplayLanguage(locale);
  const readingContext = usePublicContentReadingContext();
  const requestGenerationRef = useRef(0);
  const [byId, setById] = useState<CivicMediaTrustedExplanationsById>(
    () => input?.seedById ?? {},
  );

  useEffect(() => {
    if (input?.seedById) {
      setById(input.seedById);
    }

    if (!readingContext.ready) {
      return;
    }

    const requestGeneration = ++requestGenerationRef.current;
    let cancelled = false;
    const preference = readingContext.translationPreference;

    void (async () => {
      try {
        const media = await fetchCivicMediaCenter();
        if (cancelled || requestGeneration !== requestGenerationRef.current) {
          return;
        }
        const canonical = buildTrustedExplanationsById(media);

        let resolved = await resolveTranslatedContent({
          sourceKind: "civic_media",
          sourceRecordId: CIVIC_MEDIA_RECORD_ID,
          language: displayLanguage as LanguageCode,
        });

        const isPartial =
          resolved.presentationMode !== "original" &&
          (() => {
            const translated = parseCivicMediaJsonArray(
              resolved.content.trustedMediaExplanations,
              isTrustedExplanationTranslated,
            );
            if (!translated || translated.length === 0) {
              return false;
            }
            // WORLD + COUNTRY explanations share one civic_media bag (08K.3.3).
            let present = 0;
            let missing = 0;
            for (const item of translated) {
              if (item.explanation.trim()) {
                present += 1;
              } else {
                missing += 1;
              }
            }
            for (const resource of media.trustedMedia) {
              const match = translated.find((entry) => entry.id === resource.id);
              if (!match || !match.explanation.trim()) {
                missing += 1;
              }
            }
            if (input?.seedById) {
              for (const id of Object.keys(input.seedById)) {
                const match = translated.find((entry) => entry.id === id);
                if (!match || !match.explanation.trim()) {
                  missing += 1;
                }
              }
            }
            return present > 0 && missing > 0;
          })();

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
              targetLanguage: displayLanguage as LanguageCode,
            });
            resolved = generated.display;
          } catch {
            // keep resolve
          }
        }

        if (cancelled || requestGeneration !== requestGenerationRef.current) {
          return;
        }
        if (resolved.activeLanguage !== displayLanguage) {
          return;
        }

        if (resolved.presentationMode === "original") {
          setById(input?.seedById ?? canonical);
          return;
        }

        setById(mergeTrustedExplanations(canonical, resolved.content));
      } catch {
        // keep seed
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    displayLanguage,
    input?.seedById,
    readingContext.ready,
    readingContext.translationPreference,
  ]);

  return byId;
}
