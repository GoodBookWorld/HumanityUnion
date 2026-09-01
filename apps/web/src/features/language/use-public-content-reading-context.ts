/**
 * Pack 02G Task 07B — auth-aware reading language for public translated surfaces.
 *
 * Waits for the shared client auth resolver; authenticated participants use
 * readingLanguages[0] only (never interfaceLanguage as a substitute).
 * Guests keep the platform default without retry loops.
 */

"use client";

import { useEffect, useState } from "react";

import type { LanguageCode } from "@hu/types";
import { DEFAULT_PLATFORM_LANGUAGE } from "@hu/types";

import {
  useClientAuthStatus,
  type ClientAuthStatus,
} from "../auth/use-client-auth-status";
import {
  getMyPreferences,
  MEMBER_PREFERENCES_CHANGED_EVENT,
} from "../preferences/preferences-api";
import { deriveAuthenticatedReadingLanguage } from "./public-content-reading-language";

export { deriveAuthenticatedReadingLanguage } from "./public-content-reading-language";

export interface PublicContentReadingContext {
  /** False while auth status is still pending — callers must not resolve yet. */
  readonly ready: boolean;
  readonly authStatus: ClientAuthStatus;
  readonly isAuthenticated: boolean;
  /** Effective content reading language (not interface chrome language). */
  readonly readingLanguage: LanguageCode;
  readonly translationPreference: string;
}

const GUEST_CONTEXT: Omit<PublicContentReadingContext, "authStatus"> = {
  ready: true,
  isAuthenticated: false,
  readingLanguage: DEFAULT_PLATFORM_LANGUAGE,
  translationPreference: "none",
};

/**
 * Shared lifecycle for public content translation resolution.
 * Re-runs when auth settles authenticated ↔ unauthenticated.
 */
export function usePublicContentReadingContext(): PublicContentReadingContext {
  const authStatus = useClientAuthStatus();
  /** Bumps on successful preferences PATCH so readingLanguages changes re-resolve. */
  const [preferencesEpoch, setPreferencesEpoch] = useState(0);
  const [context, setContext] = useState<PublicContentReadingContext>(() => {
    if (authStatus === "unauthenticated") {
      return { ...GUEST_CONTEXT, authStatus };
    }
    // pending or authenticated: wait for auth settle / preferences load
    return {
      authStatus,
      ready: false,
      isAuthenticated: authStatus === "authenticated",
      readingLanguage: DEFAULT_PLATFORM_LANGUAGE,
      translationPreference: "none",
    };
  });

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
    if (authStatus === "pending") {
      setContext((previous) => ({
        ...previous,
        authStatus,
        ready: false,
      }));
      return;
    }

    if (authStatus === "unauthenticated") {
      setContext({
        ...GUEST_CONTEXT,
        authStatus,
      });
      return;
    }

    // Authenticated: block first resolve until prefs settle; preference refreshes
    // keep prior ready/language until the new payload arrives (no fallback flash).
    setContext((previous) => ({
      ...previous,
      authStatus,
      isAuthenticated: true,
      ready: previous.isAuthenticated ? previous.ready : false,
    }));

    let cancelled = false;

    void (async () => {
      try {
        const preferences = await getMyPreferences();
        if (cancelled) {
          return;
        }
        setContext({
          authStatus,
          ready: true,
          isAuthenticated: true,
          readingLanguage: deriveAuthenticatedReadingLanguage(
            preferences.experiencePreferences.readingLanguages,
          ),
          translationPreference:
            preferences.experiencePreferences.translationPreference || "none",
        });
      } catch {
        if (cancelled) {
          return;
        }
        // Authenticated but prefs unavailable — settle once, no retry loop.
        setContext({
          authStatus,
          ready: true,
          isAuthenticated: true,
          readingLanguage: DEFAULT_PLATFORM_LANGUAGE,
          translationPreference: "none",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authStatus, preferencesEpoch]);

  return context;
}
