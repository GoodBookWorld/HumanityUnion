/**
 * Presentation-locale cookie synchronization (Pack 02C / Simplification Step 06A.5).
 *
 * Web SSR cannot read API host-only auth cookies, so `hu_lang` is the SSR bridge.
 * Participant Preferred Reading (`readingLanguages[0]`) is the preference authority;
 * `interfaceLanguage` remains the aligned fallback (server-synced on prefs save).
 *
 * Generation token: authoritative presentation applies bump the generation so a
 * stale in-flight prefs→cookie sync cannot overwrite a newer locale.
 */

import type { MemberPreferences } from "@hu/types";

import { readHuLangCookieFromDocument } from "./hu-lang-cookie.web.js";
import { writeHuLangCookieViaWebRoute } from "./write-hu-lang-cookie.js";

/** Survives soft remounts; not proof the cookie is correct without reading it. */
let lastSyncedPresentationLocale: string | null = null;
/**
 * Monotonic during the browser runtime. Bumped by authoritative applies and
 * session resets — never reset to an older value (that would revive stale gens).
 */
let presentationLocaleSyncGeneration = 0;
/** Identity of the currently booked in-flight sync; null when none is booked. */
let syncInFlightId: number | null = null;
/** Monotonic id allocator for in-flight ownership (survives session reset). */
let syncInFlightSeq = 0;

export function getPresentationLocaleSyncGenerationForTests(): number {
  return presentationLocaleSyncGeneration;
}

export function getLastSyncedPresentationLocaleForTests(): string | null {
  return lastSyncedPresentationLocale;
}

export function getPresentationLocaleSyncInFlightIdForTests(): number | null {
  return syncInFlightId;
}

/**
 * Resolve the presentation locale from persisted preferences.
 * Preferred Reading (`readingLanguages[0]`) wins; interfaceLanguage is fallback.
 */
export function resolvePreferredPresentationLocale(
  preferences: Pick<MemberPreferences, "experiencePreferences">,
): string | null {
  const reading =
    preferences.experiencePreferences.readingLanguages[0]?.trim() || "";
  if (reading) {
    return reading;
  }
  const interfaceLanguage =
    preferences.experiencePreferences.interfaceLanguage?.trim() || "";
  return interfaceLanguage.length > 0 ? interfaceLanguage : null;
}

/**
 * Claim authoritative ownership of the presentation locale.
 * Invalidates in-flight Cookie Sync attempts so they cannot overwrite this locale.
 * Call before/after a successful `/api/hu-lang` write from Preferences / LanguageSelector.
 */
export function claimAuthoritativePresentationLocale(locale: string): number {
  const normalized = locale.trim();
  presentationLocaleSyncGeneration += 1;
  if (normalized) {
    lastSyncedPresentationLocale = normalized;
  }
  return presentationLocaleSyncGeneration;
}

/**
 * @deprecated Prefer {@link claimAuthoritativePresentationLocale} — kept as the
 * historical name used by applyPresentationLocale / LanguageSelector.
 */
export function markInterfaceLanguageCookieSynced(locale: string): void {
  claimAuthoritativePresentationLocale(locale);
}

/**
 * Invalidate the current sync session (logout / auth loss).
 * Generation is incremented (never reset) so prior attempts stay permanently stale.
 * Releases in-flight booking so a new session may schedule; an old Promise's
 * `finally` cannot clear a newer booking (identity ownership).
 */
export function clearPresentationLocaleCookieSyncSession(): void {
  lastSyncedPresentationLocale = null;
  presentationLocaleSyncGeneration += 1;
  syncInFlightId = null;
}

/** Test-only — invalidate session state without pretending generation rewound. */
export function resetInterfaceLanguageCookieSyncForTests(): void {
  clearPresentationLocaleCookieSyncSession();
}

export type PresentationLocaleCookieSyncDeps = {
  readonly getPreferences: () => Promise<MemberPreferences>;
  readonly readCookie: () => string | null;
  readonly writeCookie: (locale: string) => Promise<{ locale: string }>;
  readonly refresh: () => void;
  readonly isCancelled?: () => boolean;
  /** Generation captured when this sync attempt started. */
  readonly generation: number;
};

export type PresentationLocaleCookieSyncOutcome =
  | "aligned"
  | "written"
  | "skipped_stale"
  | "skipped_cancelled"
  | "noop";

function isStaleGeneration(generation: number): boolean {
  return generation !== presentationLocaleSyncGeneration;
}

/**
 * Align `hu_lang` with Preferred Reading / interfaceLanguage.
 * Latch is never sufficient alone — cookie truth is always inspected.
 * Stale generations (superseded by an authoritative apply) never write.
 */
export async function runPresentationLocaleCookieSyncAttempt(
  deps: PresentationLocaleCookieSyncDeps,
): Promise<PresentationLocaleCookieSyncOutcome> {
  if (isStaleGeneration(deps.generation)) {
    return "skipped_stale";
  }

  const preferences = await deps.getPreferences();
  if (deps.isCancelled?.()) {
    return "skipped_cancelled";
  }
  if (isStaleGeneration(deps.generation)) {
    return "skipped_stale";
  }

  const target = resolvePreferredPresentationLocale(preferences);
  if (!target) {
    return "noop";
  }

  const currentCookie = deps.readCookie();
  if (currentCookie === target) {
    if (isStaleGeneration(deps.generation)) {
      return "skipped_stale";
    }
    lastSyncedPresentationLocale = target;
    return "aligned";
  }

  // Cookie differs from preference — repair even when the in-memory latch
  // previously claimed this locale (latch is not cookie proof).
  if (isStaleGeneration(deps.generation)) {
    return "skipped_stale";
  }

  const written = await deps.writeCookie(target);
  if (deps.isCancelled?.()) {
    return "skipped_cancelled";
  }
  if (isStaleGeneration(deps.generation)) {
    // A newer authoritative apply claimed ownership during our write.
    // Our Set-Cookie may have landed after theirs — repair to the claimed locale.
    const authoritative = lastSyncedPresentationLocale;
    if (authoritative && authoritative !== written.locale) {
      await deps.writeCookie(authoritative);
    }
    return "skipped_stale";
  }

  lastSyncedPresentationLocale = written.locale;
  deps.refresh();
  return "written";
}

export function isPresentationLocaleCookieSyncInFlight(): boolean {
  return syncInFlightId !== null;
}

/**
 * Schedule a best-effort cookie sync. Returns whether a new attempt started.
 * In-flight ownership uses a monotonic id so an older Promise's `finally` cannot
 * clear bookkeeping for a newer scheduled attempt (e.g. after session reset).
 */
export function schedulePresentationLocaleCookieSync(input: {
  readonly run: (generation: number) => Promise<void>;
}): boolean {
  if (syncInFlightId !== null) {
    return false;
  }
  const generation = presentationLocaleSyncGeneration;
  const flightId = ++syncInFlightSeq;
  syncInFlightId = flightId;
  void (async () => {
    try {
      await input.run(generation);
    } finally {
      if (syncInFlightId === flightId) {
        syncInFlightId = null;
      }
    }
  })();
  return true;
}

/** Default browser deps for InterfaceLanguageCookieSync. */
export function createBrowserPresentationLocaleCookieSyncDeps(input: {
  readonly generation: number;
  readonly isCancelled: () => boolean;
  readonly refresh: () => void;
  readonly getPreferences: () => Promise<MemberPreferences>;
}): PresentationLocaleCookieSyncDeps {
  return {
    generation: input.generation,
    isCancelled: input.isCancelled,
    refresh: input.refresh,
    getPreferences: input.getPreferences,
    readCookie: readHuLangCookieFromDocument,
    writeCookie: writeHuLangCookieViaWebRoute,
  };
}
