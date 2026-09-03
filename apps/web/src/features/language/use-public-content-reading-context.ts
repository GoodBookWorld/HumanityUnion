/**
 * Pack 02G Task 07B — auth-aware reading language for public translated surfaces.
 *
 * Content reading context is driven by a single getMyPreferences probe.
 * useClientAuthStatus "unauthenticated" alone is not treated as definitive guest
 * (cookie session may still authenticate API requests). Definitive guest requires
 * a preferences 401.
 *
 * Pack 08I.7 — definitive guests follow the active interface locale (next-intl)
 * with translationPreference preferred so warm content_translations display.
 * Authenticated users still use readingLanguages[0] only (never interface as substitute).
 */

"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";

import { DEFAULT_PLATFORM_LANGUAGE } from "@hu/types";
import type { LanguageCode } from "@hu/types";

import {
  useClientAuthStatus,
  type ClientAuthStatus,
} from "../auth/use-client-auth-status";
import { isAuthenticationRequiredError } from "../../lib/api-client";
import {
  getMyPreferences,
  MEMBER_PREFERENCES_CHANGED_EVENT,
} from "../preferences/preferences-api";
import {
  resolvePublicContentReadingFromProbe,
  type PublicContentReadingProbeOutcome,
} from "./public-content-reading-probe";

export { deriveAuthenticatedReadingLanguage } from "./public-content-reading-language";
export {
  resolvePublicContentReadingFromProbe,
  type PublicContentReadingProbeOutcome,
} from "./public-content-reading-probe";

export interface PublicContentReadingContext {
  /** False while auth is pending or prefs probe has not settled — callers must not resolve yet. */
  readonly ready: boolean;
  readonly authStatus: ClientAuthStatus;
  readonly isAuthenticated: boolean;
  /** Effective content reading language (not interface chrome language). */
  readonly readingLanguage: LanguageCode;
  readonly translationPreference: string;
}

function classifyPreferencesProbeError(error: unknown): PublicContentReadingProbeOutcome {
  if (isAuthenticationRequiredError(error)) {
    return { kind: "unauthorized" };
  }
  return { kind: "unavailable" };
}

/**
 * Shared lifecycle for public content translation resolution.
 * Probes preferences once when auth is not pending; re-probes on preferences-changed.
 */
export function usePublicContentReadingContext(): PublicContentReadingContext {
  const authStatus = useClientAuthStatus();
  const interfaceLocale = useLocale();
  /** Bumps on successful preferences PATCH so readingLanguages changes re-resolve. */
  const [preferencesEpoch, setPreferencesEpoch] = useState(0);
  const [context, setContext] = useState<PublicContentReadingContext>(() => ({
    authStatus,
    ready: false,
    isAuthenticated: authStatus === "authenticated",
    readingLanguage: DEFAULT_PLATFORM_LANGUAGE,
    translationPreference: "none",
  }));

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const onPreferencesChanged = () => {
      setPreferencesEpoch((epoch) => epoch + 1);
    };
    window.addEventListener(MEMBER_PREFERENCES_CHANGED_EVENT, onPreferencesChanged);
    return () => {
      window.removeEventListener(MEMBER_PREFERENCES_CHANGED_EVENT, onPreferencesChanged);
    };
  }, []);

  useEffect(() => {
    // C. Auth still pending — do not prematurely settle language=en.
    if (authStatus === "pending") {
      setContext((previous) => ({
        ...previous,
        authStatus,
        ready: false,
      }));
      return;
    }

    // Keep prior ready/language during refresh when already settled; block first paint.
    setContext((previous) => ({
      ...previous,
      authStatus,
      ready: previous.ready && previous.isAuthenticated ? previous.ready : false,
    }));

    let cancelled = false;

    void (async () => {
      let outcome: PublicContentReadingProbeOutcome;
      try {
        const preferences = await getMyPreferences();
        outcome = { kind: "success", preferences };
      } catch (error) {
        outcome = classifyPreferencesProbeError(error);
      }

      if (cancelled) {
        return;
      }

      setContext(
        resolvePublicContentReadingFromProbe({
          authStatus,
          outcome,
          interfaceLocale,
        }),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [authStatus, preferencesEpoch, interfaceLocale]);

  return context;
}
