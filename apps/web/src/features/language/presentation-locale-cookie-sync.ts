/**
 * Presentation-locale cookie synchronization (Pack 02C / Simplification Step 06A.5).
 *
 * Web SSR cannot read API host-only auth cookies, so `hu_lang` is the SSR bridge.
 * Participant Preferred Reading (`readingLanguages[0]`) is the preference authority;
 * `interfaceLanguage` remains the aligned fallback (server-synced on prefs save).
 *
 * Generation token: authoritative presentation applies bump the generation so a
 * stale in-flight prefs→cookie sync cannot overwrite a newer locale.
 *
 * Alignment requires cookie AND client next-intl (`useLocale`) to match Preferred
 * Reading. Cookie-only equality is not sufficient — stale NextIntlClientProvider
 * must recompose via refresh-only locale-switch navigation (never same-path replace
 * from CookieSync on locale-free private routes).
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
/**
 * Cycle-aware one-shot latch: locale for which CookieSync/guest reconciliation
 * has already *requested* a refresh while waiting for useLocale to catch up.
 * Represents actual refresh ownership — not "apply asked for recompose".
 * Cleared when client presentation alignment is observed, or when a new
 * authoritative cookie claim starts (requested ≠ completed).
 */
let lastStaleNextIntlRecomposeForLocale: string | null = null;

export function getPresentationLocaleSyncGenerationForTests(): number {
  return presentationLocaleSyncGeneration;
}

export function getLastSyncedPresentationLocaleForTests(): string | null {
  return lastSyncedPresentationLocale;
}

export function getPresentationLocaleSyncInFlightIdForTests(): number | null {
  return syncInFlightId;
}

export function getLastStaleNextIntlRecomposeForLocaleForTests(): string | null {
  return lastStaleNextIntlRecomposeForLocale;
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
 * Claim authoritative ownership of the presentation-locale *cookie* target.
 * Invalidates in-flight Cookie Sync attempts so they cannot overwrite this locale.
 * Call before/after a successful `/api/hu-lang` write from Preferences / LanguageSelector.
 *
 * Does NOT mark stale-NextIntl recompose as completed. Requested recompose from
 * applyPresentationLocale is not observed alignment — clear any prior latch so
 * CookieSync may still refresh once while useLocale lags behind hu_lang.
 */
export function claimAuthoritativePresentationLocale(locale: string): number {
  const normalized = locale.trim();
  presentationLocaleSyncGeneration += 1;
  if (normalized) {
    lastSyncedPresentationLocale = normalized;
    lastStaleNextIntlRecomposeForLocale = null;
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
  // Keep stale-next-intl recompose latch: clearing it on every guest effect
  // would re-trigger refresh loops when useLocale is still catching up.
}

/** Test-only — invalidate session state without pretending generation rewound. */
export function resetInterfaceLanguageCookieSyncForTests(): void {
  lastSyncedPresentationLocale = null;
  presentationLocaleSyncGeneration += 1;
  syncInFlightId = null;
  lastStaleNextIntlRecomposeForLocale = null;
}

export type PresentationLocaleCookieSyncDeps = {
  readonly getPreferences: () => Promise<MemberPreferences>;
  readonly readCookie: () => string | null;
  readonly writeCookie: (locale: string) => Promise<{ locale: string }>;
  /**
   * Shared locale-switch recompose callback.
   * CookieSync wires refresh-only navigation (no same-path replace).
   * Used when cookie is written or when cookie/preferred match but next-intl is stale.
   * One-shot latch prevents repeated refresh while the same target is settling.
   */
  readonly refresh: () => void;
  readonly isCancelled?: () => boolean;
  /** Generation captured when this sync attempt started. */
  readonly generation: number;
  /**
   * Current client next-intl locale (`useLocale()`). When omitted, cookie-only
   * equality remains sufficient (legacy callers / unit tests).
   */
  readonly currentPresentationLocale?: string | null;
};

export type PresentationLocaleCookieSyncOutcome =
  | "aligned"
  | "recomposed"
  | "written"
  | "skipped_stale"
  | "skipped_cancelled"
  | "noop";

function isStaleGeneration(generation: number): boolean {
  return generation !== presentationLocaleSyncGeneration;
}

function localesEqual(a: string, b: string): boolean {
  return a.trim() === b.trim();
}

/**
 * Cookie/preferred already match, but mounted next-intl may still be stale.
 * Returns true when a one-shot same-path recompose should run.
 */
export function shouldRecomposeStaleNextIntlPresentation(input: {
  readonly targetLocale: string;
  readonly currentPresentationLocale: string | null | undefined;
  readonly alreadyRecomposedForLocale: string | null;
}): boolean {
  const target = input.targetLocale.trim();
  if (!target) {
    return false;
  }
  // Legacy / optional: without a client locale signal, do not refresh.
  if (
    input.currentPresentationLocale === undefined ||
    input.currentPresentationLocale === null
  ) {
    return false;
  }
  const client = input.currentPresentationLocale.trim();
  if (!client || localesEqual(client, target)) {
    return false;
  }
  if (
    input.alreadyRecomposedForLocale !== null &&
    localesEqual(input.alreadyRecomposedForLocale, target)
  ) {
    return false;
  }
  return true;
}

/**
 * When mounted next-intl matches the presentation target, the pending
 * recompose cycle is complete — clear the latch so a future same-locale
 * mismatch remains eligible for one new recompose.
 */
function completeStaleNextIntlReconciliationCycleIfAligned(input: {
  readonly targetLocale: string;
  readonly currentPresentationLocale: string | null | undefined;
}): boolean {
  if (
    input.currentPresentationLocale === undefined ||
    input.currentPresentationLocale === null
  ) {
    return false;
  }
  const client = input.currentPresentationLocale.trim();
  const target = input.targetLocale.trim();
  if (!client || !target || !localesEqual(client, target)) {
    return false;
  }
  lastStaleNextIntlRecomposeForLocale = null;
  return true;
}

/**
 * Guest / cookie-only: when `hu_lang` is set but next-intl still shows another
 * locale, trigger one same-path recompose (SEO-suppressed callers must not invoke).
 */
export function runGuestPresentationLocaleNextIntlRecompose(input: {
  readonly cookieLocale: string | null;
  readonly currentPresentationLocale: string | null | undefined;
  readonly refresh: () => void;
}): PresentationLocaleCookieSyncOutcome {
  const target = input.cookieLocale?.trim() || "";
  if (!target) {
    return "noop";
  }
  lastSyncedPresentationLocale = target;
  if (
    completeStaleNextIntlReconciliationCycleIfAligned({
      targetLocale: target,
      currentPresentationLocale: input.currentPresentationLocale,
    })
  ) {
    return "aligned";
  }
  if (
    !shouldRecomposeStaleNextIntlPresentation({
      targetLocale: target,
      currentPresentationLocale: input.currentPresentationLocale,
      alreadyRecomposedForLocale: lastStaleNextIntlRecomposeForLocale,
    })
  ) {
    return "aligned";
  }
  lastStaleNextIntlRecomposeForLocale = target;
  input.refresh();
  return "recomposed";
}

/**
 * Align `hu_lang` with Preferred Reading / interfaceLanguage.
 * Latch is never sufficient alone — cookie truth is always inspected.
 * Stale generations (superseded by an authoritative apply) never write.
 *
 * When cookie already equals preferred but client next-intl does not, recompose
 * via the shared refresh callback (same path as cookie-write repair).
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

    if (
      completeStaleNextIntlReconciliationCycleIfAligned({
        targetLocale: target,
        currentPresentationLocale: deps.currentPresentationLocale,
      })
    ) {
      return "aligned";
    }

    if (
      shouldRecomposeStaleNextIntlPresentation({
        targetLocale: target,
        currentPresentationLocale: deps.currentPresentationLocale,
        alreadyRecomposedForLocale: lastStaleNextIntlRecomposeForLocale,
      })
    ) {
      lastStaleNextIntlRecomposeForLocale = target;
      deps.refresh();
      return "recomposed";
    }

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
  lastStaleNextIntlRecomposeForLocale = written.locale;
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
  readonly currentPresentationLocale?: string | null;
}): PresentationLocaleCookieSyncDeps {
  return {
    generation: input.generation,
    isCancelled: input.isCancelled,
    refresh: input.refresh,
    getPreferences: input.getPreferences,
    readCookie: readHuLangCookieFromDocument,
    writeCookie: writeHuLangCookieViaWebRoute,
    currentPresentationLocale: input.currentPresentationLocale,
  };
}
