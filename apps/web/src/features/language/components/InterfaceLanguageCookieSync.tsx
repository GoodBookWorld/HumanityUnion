"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { getMyPreferences } from "../../preferences/preferences-api";
import { shouldSuppressInterfaceLanguageCookieSyncForPath } from "../public-seo-locale-request";
import {
  clearPresentationLocaleCookieSyncSession,
  createBrowserPresentationLocaleCookieSyncDeps,
  runPresentationLocaleCookieSyncAttempt,
  schedulePresentationLocaleCookieSync,
} from "../presentation-locale-cookie-sync";

export {
  claimAuthoritativePresentationLocale,
  clearPresentationLocaleCookieSyncSession,
  markInterfaceLanguageCookieSynced,
  resetInterfaceLanguageCookieSyncForTests,
  resolvePreferredPresentationLocale,
  runPresentationLocaleCookieSyncAttempt,
  getPresentationLocaleSyncGenerationForTests,
  getLastSyncedPresentationLocaleForTests,
} from "../presentation-locale-cookie-sync";

/**
 * Pack 02C Task 03/04 / Simplification Step 06A.5 — after authenticated session
 * resolution/login, sync Preferred Reading / interfaceLanguage → Web-origin `hu_lang`
 * when they differ from the actual cookie.
 *
 * Pack 2.1A — on a valid locale-prefixed SEO public document URL, do not write
 * a conflicting cookie or `router.refresh()` (URL locale remains authoritative).
 *
 * Does not read API host-only auth cookies from the server. Uses the existing
 * credentialed Preferences API from the browser after auth status is known.
 * Does not mutate documentElement.lang/dir (SSR refresh applies attributes).
 *
 * Step 06A.5 — generation tokens invalidate stale in-flight syncs so they cannot
 * overwrite a newer Preferences presentation apply. Latch alone is never cookie proof.
 */
export function InterfaceLanguageCookieSync() {
  const authStatus = useClientAuthStatus();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (authStatus !== "authenticated") {
      if (authStatus === "unauthenticated") {
        clearPresentationLocaleCookieSyncSession();
      }
      return;
    }

    if (shouldSuppressInterfaceLanguageCookieSyncForPath(pathname)) {
      return;
    }

    let cancelled = false;

    schedulePresentationLocaleCookieSync({
      run: async (generation) => {
        await runPresentationLocaleCookieSyncAttempt(
          createBrowserPresentationLocaleCookieSyncDeps({
            generation,
            isCancelled: () => cancelled,
            refresh: () => {
              router.refresh();
            },
            getPreferences: getMyPreferences,
          }),
        );
      },
    });

    return () => {
      cancelled = true;
    };
  }, [authStatus, router, pathname]);

  return null;
}
