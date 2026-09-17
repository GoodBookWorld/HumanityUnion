/**
 * PWA Full Translation Pack 01 — client ordinary-reading ownership hook.
 *
 * SSR and first paint default to browser-native (hydration-safe canonical DOM).
 * After mount, standalone detection may upgrade to hu-persisted; callers then
 * cache-only resolve CURRENT translation without provider generation.
 */

"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";

import type { ContentTranslationSourceKind, LanguageCode } from "@hu/types";

import {
  resolvePresentationMode,
  subscribePresentationMode,
  type HuPresentationMode,
} from "../pwa/presentation-mode";
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

export function useOrdinaryReadingOwner(input?: {
  readonly sourceKind?: ContentTranslationSourceKind | string | null;
}): OrdinaryReadingOwnerState {
  const locale = useLocale();
  const preferredReadingLanguage = resolvePublicContentDisplayLanguage(locale);

  // Hydration-safe: SSR + first client paint stay browser-native.
  const [presentationMode, setPresentationMode] = useState<HuPresentationMode>("browser");
  const [ownershipReady, setOwnershipReady] = useState(false);

  useEffect(() => {
    const apply = (mode: HuPresentationMode) => {
      setPresentationMode(mode);
      setOwnershipReady(true);
    };
    apply(resolvePresentationMode());
    return subscribePresentationMode(apply);
  }, []);

  const owner = ownershipReady
    ? resolveOrdinaryReadingOwner({
        presentationMode,
        preferredReadingLanguage,
        sourceKind: input?.sourceKind,
      })
    : "browser-native";

  return {
    owner,
    presentationMode,
    preferredReadingLanguage,
    ownershipReady,
  };
}
