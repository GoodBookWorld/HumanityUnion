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
  resolveTranslatedContent,
} from "../../language/translation-api";
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
 * Reset 03: `disabled` skips resolve/generate (PLP mode — no legacy CT hooks).
 */
export function useTrustedMediaExplanationsOverlay(input?: {
  readonly seedById?: CivicMediaTrustedExplanationsById;
  readonly disabled?: boolean;
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

    if (input?.disabled) {
      return;
    }

    if (!readingContext.ready) {
      return;
    }

    const requestGeneration = ++requestGenerationRef.current;
    let cancelled = false;

    void (async () => {
      try {
        const media = await fetchCivicMediaCenter();
        if (cancelled || requestGeneration !== requestGenerationRef.current) {
          return;
        }
        const canonical = buildTrustedExplanationsById(media);

        // Pack 1.1 — cache-only GET resolve; never generate on read.
        const resolved = await resolveTranslatedContent({
          sourceKind: "civic_media",
          sourceRecordId: CIVIC_MEDIA_RECORD_ID,
          language: displayLanguage as LanguageCode,
        });

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
    input?.disabled,
    input?.seedById,
    readingContext.ready,
  ]);

  return byId;
}
