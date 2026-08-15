"use client";

import { useEffect } from "react";

import { DEFAULT_PLATFORM_LANGUAGE, normalizeLanguageCode } from "@hu/types";

import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { getMyPreferences } from "../../preferences/preferences-api";
import { documentDirectionForLanguage } from "../language";

function applyDocumentLanguage(language: string): void {
  const normalized = normalizeLanguageCode(language, DEFAULT_PLATFORM_LANGUAGE);
  document.documentElement.lang = normalized;
  document.documentElement.dir = documentDirectionForLanguage(normalized);
}

/**
 * Pack 02 / PWA UX Correction Pack 02 — drive root document lang/dir from
 * Interface Language preference only after canonical auth reports authenticated.
 * Guests keep the platform default without calling private `/preferences/me`.
 */
export function DocumentLanguageAttributes() {
  const authStatus = useClientAuthStatus();

  useEffect(() => {
    if (authStatus === "pending") {
      // Keep server-rendered / previous lang until auth settles.
      return;
    }

    if (authStatus !== "authenticated") {
      applyDocumentLanguage(DEFAULT_PLATFORM_LANGUAGE);
      return;
    }

    let cancelled = false;

    void getMyPreferences()
      .then((preferences) => {
        if (cancelled) {
          return;
        }

        applyDocumentLanguage(preferences.experiencePreferences.interfaceLanguage);
      })
      .catch(() => {
        if (!cancelled) {
          applyDocumentLanguage(DEFAULT_PLATFORM_LANGUAGE);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  return null;
}
