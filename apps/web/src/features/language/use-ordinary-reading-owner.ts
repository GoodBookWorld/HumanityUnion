/**
 * Language Architecture Pack 02 / Version 5.0 — client ordinary-reading ownership.
 *
 * SSR and first paint default to canonical (hydration-safe).
 * After mount, lightweight public Registry capability catalog may upgrade to
 * hu-persisted on Web and PWA. Standalone detection is not an eligibility gate.
 * Callers then cache-only resolve CURRENT translation without provider generation.
 *
 * Public `GET /api/v1/languages` is RUNTIME CAPABILITY only (activation flags).
 * Corpus readiness is never required for ownership (Admin/activation only).
 * Preferred Reading Language changes recompute eligibility via effect deps.
 */

"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";

import type {
  ContentTranslationSourceKind,
  LanguageCode,
  PwaPersistedOrdinaryReadingEligibility,
} from "@hu/types";
import { normalizeLanguageRegistryLocaleKey } from "@hu/types";

import {
  resolvePresentationMode,
  subscribePresentationMode,
  type HuPresentationMode,
} from "../pwa/presentation-mode";
import {
  listSelectablePublicLanguages,
  PUBLIC_LANGUAGES_CHANGED_EVENT,
} from "./public-languages-api";
import { resolvePublicContentDisplayLanguage } from "./resolve-public-content-display-language";
import {
  resolveOrdinaryReadingOwner,
  type OrdinaryReadingOwner,
} from "./ordinary-reading-ownership";

export interface OrdinaryReadingOwnerState {
  readonly owner: OrdinaryReadingOwner;
  readonly presentationMode: HuPresentationMode;
  readonly preferredReadingLanguage: LanguageCode;
  /**
   * False until the post-mount ownership effect has applied client standalone
   * detection. Visible reading must keep canonical until this is true when
   * deciding whether to resolve HU persisted translation.
   */
  readonly ownershipReady: boolean;
}

type PublicPwaEligibilityRow = PwaPersistedOrdinaryReadingEligibility & {
  readonly locale: string;
};

function findEligibility(
  rows: readonly PublicPwaEligibilityRow[],
  locale: string,
): PwaPersistedOrdinaryReadingEligibility | null {
  const key = normalizeLanguageRegistryLocaleKey(locale);
  const row = rows.find((entry) => normalizeLanguageRegistryLocaleKey(entry.locale) === key);
  if (!row) {
    return null;
  }
  return {
    enabled: row.enabled,
    contentTranslationEnabled: row.contentTranslationEnabled,
    pwaPersistedReadingEnabled: row.pwaPersistedReadingEnabled,
    pwaPersistedReadingReady: row.pwaPersistedReadingReady,
  };
}

export function useOrdinaryReadingOwner(input?: {
  readonly sourceKind?: ContentTranslationSourceKind | string | null;
}): OrdinaryReadingOwnerState {
  const locale = useLocale();
  const preferredReadingLanguage = resolvePublicContentDisplayLanguage(locale);

  // Hydration-safe: SSR + first client paint stay browser-native.
  const [presentationMode, setPresentationMode] = useState<HuPresentationMode>("browser");
  const [ownershipReady, setOwnershipReady] = useState(false);
  const [pwaEligibility, setPwaEligibility] =
    useState<PwaPersistedOrdinaryReadingEligibility | null>(null);

  useEffect(() => {
    const apply = (mode: HuPresentationMode) => {
      setPresentationMode(mode);
      setOwnershipReady(true);
    };
    apply(resolvePresentationMode());
    return subscribePresentationMode(apply);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const languages = await listSelectablePublicLanguages();
        if (cancelled) {
          return;
        }
        const rows: PublicPwaEligibilityRow[] = languages.map((row) => ({
          locale: row.locale,
          enabled: true,
          contentTranslationEnabled: row.contentTranslationEnabled === true,
          pwaPersistedReadingEnabled: row.pwaPersistedReadingEnabled === true,
          pwaPersistedReadingReady: row.pwaPersistedReadingReady === true,
        }));
        setPwaEligibility(findEligibility(rows, preferredReadingLanguage));
      } catch {
        if (!cancelled) {
          setPwaEligibility(null);
        }
      }
    };

    void load();
    const onChanged = () => {
      void load();
    };
    if (typeof window !== "undefined") {
      window.addEventListener(PUBLIC_LANGUAGES_CHANGED_EVENT, onChanged);
    }
    return () => {
      cancelled = true;
      if (typeof window !== "undefined") {
        window.removeEventListener(PUBLIC_LANGUAGES_CHANGED_EVENT, onChanged);
      }
    };
  }, [preferredReadingLanguage]);

  const owner = ownershipReady
    ? resolveOrdinaryReadingOwner({
        presentationMode,
        preferredReadingLanguage,
        sourceKind: input?.sourceKind,
        pwaEligibility,
      })
    : "browser-native";

  return {
    owner,
    presentationMode,
    preferredReadingLanguage,
    ownershipReady,
  };
}
