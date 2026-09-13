/**
 * Shared presentation-locale apply path (Pack 02C / Simplification Steps 06A.3–06A.5).
 *
 * Same sequence formerly inlined in LanguageSelector:
 * claim sync generation → write Web-origin `hu_lang` → latch → Registry-driven navigation.
 *
 * Does not persist participant preferences (callers that need prefs write first).
 * Does not set document lang/dir client-side — SSR recomposes via navigation/refresh.
 */

import {
  claimAuthoritativePresentationLocale,
  markInterfaceLanguageCookieSynced,
} from "./presentation-locale-cookie-sync.js";
import { recordLocaleSwitchStarted } from "./media-plp/media-plp-locale-switch-machine.js";
import { resolveLocaleSwitchNavigationHref } from "./resolve-locale-switch-navigation-href.js";
import {
  runLocaleSwitchNavigation,
  type LocaleSwitchRouter,
} from "./run-locale-switch-navigation.js";
import {
  writeHuLangCookieViaWebRoute,
  type WriteHuLangCookieResult,
} from "./write-hu-lang-cookie.js";

export type ApplyPresentationLocaleInput = {
  /** Requested locale or alias; cookie write canonicalizes via Registry. */
  readonly locale: string;
  readonly pathname: string;
  /**
   * Registry `seoIndexingEnabled` for the target locale.
   * Drives whether SEO public routes may mint `/{locale}/…` prefixes.
   */
  readonly seoIndexingEnabled: boolean;
  readonly router: LocaleSwitchRouter;
  /**
   * When true, claim Cookie Sync generation before write and latch after success
   * so stale InterfaceLanguageCookieSync attempts cannot overwrite this locale.
   */
  readonly markAuthenticatedSync?: boolean;
  /**
   * When true, record Media PLP locale-switch ownership (LanguageSelector path).
   * Preferences language apply does not need Media timing instrumentation.
   */
  readonly recordMediaLocaleSwitch?: boolean;
  /**
   * Workspace / non-SEO-document paths resolve href=null. Soft refresh alone can leave
   * root `<html lang/dir>` stale; force a same-path replace + refresh so RSC recomposes.
   */
  readonly forceSamePathRecompose?: boolean;
  /** Optional scheduler (e.g. React startTransition). Defaults to immediate invoke. */
  readonly scheduleNavigation?: (run: () => void) => void;
};

export type ApplyPresentationLocaleResult = {
  readonly written: WriteHuLangCookieResult;
  readonly href: string | null;
  readonly didReplace: boolean;
  readonly didRefresh: boolean;
};

/**
 * Write `hu_lang` for an enabled Registry locale, then run locale-switch navigation.
 */
export async function applyPresentationLocale(
  input: ApplyPresentationLocaleInput,
): Promise<ApplyPresentationLocaleResult> {
  const requested = input.locale.trim();

  // Invalidate in-flight Cookie Sync *before* writing so a stale prefs fetch
  // cannot overwrite this apply after our Set-Cookie lands.
  if (input.markAuthenticatedSync === true && requested) {
    claimAuthoritativePresentationLocale(requested);
  }

  const written = await writeHuLangCookieViaWebRoute(requested);

  if (input.markAuthenticatedSync === true) {
    // Latch canonical Registry locale from the write response (may differ from alias).
    markInterfaceLanguageCookieSynced(written.locale);
  }

  if (input.recordMediaLocaleSwitch === true) {
    recordLocaleSwitchStarted(written.locale);
  }

  const href = resolveLocaleSwitchNavigationHref({
    pathname: input.pathname,
    nextLocale: written.locale,
    seoIndexingEnabled: input.seoIndexingEnabled === true,
  });

  const schedule = input.scheduleNavigation ?? ((run: () => void) => {
    run();
  });

  let navigation = { didReplace: false, didRefresh: false };
  schedule(() => {
    navigation = runLocaleSwitchNavigation({
      router: input.router,
      pathname: input.pathname,
      href,
      forceSamePathRecompose: input.forceSamePathRecompose === true,
    });
  });

  return {
    written,
    href,
    didReplace: navigation.didReplace,
    didRefresh: navigation.didRefresh,
  };
}
