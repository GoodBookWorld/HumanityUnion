"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { getMyPreferences } from "../../preferences/preferences-api";
import { readHuLangCookieFromDocument } from "../hu-lang-cookie.web";
import { writeHuLangCookieViaWebRoute } from "../write-hu-lang-cookie";

/**
 * Module-level latch — survives soft remounts after `router.refresh()` so we
 * do not re-write the same cookie or refresh in a loop.
 */
let lastSyncedInterfaceLocale: string | null = null;
let syncInFlight: Promise<void> | null = null;

export function markInterfaceLanguageCookieSynced(locale: string): void {
  lastSyncedInterfaceLocale = locale.trim();
}

/** Test-only. */
export function resetInterfaceLanguageCookieSyncForTests(): void {
  lastSyncedInterfaceLocale = null;
  syncInFlight = null;
}

/**
 * Pack 02C Task 03/04 — after authenticated session resolution/login, sync
 * Participant `interfaceLanguage` → Web-origin `hu_lang` when they differ.
 *
 * Does not read API host-only auth cookies from the server. Uses the existing
 * credentialed Preferences API from the browser after auth status is known.
 * Does not mutate documentElement.lang/dir (SSR refresh applies attributes).
 */
export function InterfaceLanguageCookieSync() {
  const authStatus = useClientAuthStatus();
  const router = useRouter();

  useEffect(() => {
    if (authStatus !== "authenticated") {
      if (authStatus === "unauthenticated") {
        lastSyncedInterfaceLocale = null;
      }
      return;
    }

    if (syncInFlight) {
      return;
    }

    let cancelled = false;

    syncInFlight = (async () => {
      try {
        const preferences = await getMyPreferences();
        if (cancelled) {
          return;
        }

        const interfaceLanguage = preferences.experiencePreferences.interfaceLanguage?.trim();
        if (!interfaceLanguage) {
          return;
        }

        if (lastSyncedInterfaceLocale === interfaceLanguage) {
          return;
        }

        const currentCookie = readHuLangCookieFromDocument();
        if (currentCookie === interfaceLanguage) {
          lastSyncedInterfaceLocale = interfaceLanguage;
          return;
        }

        await writeHuLangCookieViaWebRoute(interfaceLanguage);
        if (cancelled) {
          return;
        }

        lastSyncedInterfaceLocale = interfaceLanguage;
        router.refresh();
      } catch {
        // Best-effort sync — preference remains authoritative on API requests.
      } finally {
        syncInFlight = null;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authStatus, router]);

  return null;
}
