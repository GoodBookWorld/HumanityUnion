"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useEffect } from "react";

import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { getMyPreferences } from "../../preferences/preferences-api";
import { readHuLangCookieFromDocument } from "../hu-lang-cookie.web";
import { shouldSuppressInterfaceLanguageCookieSyncForPath } from "../public-seo-locale-request";
import {
  clearPresentationLocaleCookieSyncSession,
  createBrowserPresentationLocaleCookieSyncDeps,
  runGuestPresentationLocaleNextIntlRecompose,
  runPresentationLocaleCookieSyncAttempt,
  schedulePresentationLocaleCookieSync,
} from "../presentation-locale-cookie-sync";
import { runLocaleSwitchNavigation } from "../run-locale-switch-navigation";

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
 * Also reconciles stale next-intl: when cookie already equals Preferred Reading but
 * `useLocale()` still differs, refresh-only recomposes presentation — cookie-only
 * "aligned" is not presentation-aligned.
 *
 * Locale-free private routes (e.g. `/workspace`) must never `router.replace` the
 * current path for presentation sync. Same-path replace re-fires this effect and
 * thrash-navigates. Cookie writes still occur; navigation href remains null.
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
  const presentationLocale = useLocale();

  useEffect(() => {
    const path = pathname || "/";

    const recomposePresentation = () => {
      // Refresh-only: locale-free shells have no localized href. Never
      // forceSamePathRecompose — Preferences apply owns that path explicitly.
      runLocaleSwitchNavigation({
        router,
        pathname: path,
        href: null,
      });
    };

    if (authStatus === "pending") {
      return;
    }

    if (shouldSuppressInterfaceLanguageCookieSyncForPath(pathname)) {
      return;
    }

    if (authStatus === "unauthenticated") {
      clearPresentationLocaleCookieSyncSession();
      runGuestPresentationLocaleNextIntlRecompose({
        cookieLocale: readHuLangCookieFromDocument(),
        currentPresentationLocale: presentationLocale,
        refresh: recomposePresentation,
      });
      return;
    }

    if (authStatus !== "authenticated") {
      return;
    }

    let cancelled = false;

    schedulePresentationLocaleCookieSync({
      run: async (generation) => {
        await runPresentationLocaleCookieSyncAttempt(
          createBrowserPresentationLocaleCookieSyncDeps({
            generation,
            isCancelled: () => cancelled,
            refresh: recomposePresentation,
            getPreferences: getMyPreferences,
            currentPresentationLocale: presentationLocale,
          }),
        );
      },
    });

    return () => {
      cancelled = true;
    };
  }, [authStatus, router, pathname, presentationLocale]);

  return null;
}
