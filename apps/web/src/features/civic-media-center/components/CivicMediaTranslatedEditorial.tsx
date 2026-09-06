"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";

import type {
  CivicMediaCenterPublic,
  LanguageCode,
} from "@hu/types";

import {
  generateContentTranslation,
  resolveTranslatedContent,
} from "../../language/translation-api";
import { shouldAttemptOnDemandContentTranslation } from "../../language/public-translation-presentation-lifecycle";
import { resolvePublicContentDisplayLanguage } from "../../language/resolve-public-content-display-language";
import { usePublicContentReadingContext } from "../../language/use-public-content-reading-context";
import {
  buildCanonicalCivicMediaEditorial,
  CIVIC_MEDIA_RECORD_ID,
  overlayCivicMediaEditorialFromFields,
  parseCivicMediaJsonArray,
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

type PrincipleTranslatedWithId = {
  title: string;
  description: string;
  id?: string;
};

type TrustedExplanationTranslated = { id: string; explanation: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function isPrincipleTranslatedWithId(
  value: unknown,
): value is PrincipleTranslatedWithId {
  return (
    isRecord(value) &&
    typeof value.title === "string" &&
    typeof value.description === "string"
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
  options?: {
    /** Reset 03C.1 — PLP mode: never resolve/generate content_translations. */
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
    skipClientTranslation,
    readingContext.ready,
    displayLanguage,
    readingContext.translationPreference,
  ]);

  if (skipClientTranslation) {
    return plpDerivedEditorial ?? buildCanonicalCivicMediaEditorial(media);
  }
  return editorial;
}
