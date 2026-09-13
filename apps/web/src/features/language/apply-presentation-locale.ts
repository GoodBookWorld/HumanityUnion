/**
 * Shared presentation-locale apply path (Pack 02C / Simplification Step 06A.3).
 *
 * Same sequence formerly inlined in LanguageSelector:
 * write Web-origin `hu_lang` → latch → Registry-driven locale navigation.
 *
 * Does not persist participant preferences (callers that need prefs write first).
 * Does not set document lang/dir client-side — SSR recomposes via navigation/refresh.
 */

import { markInterfaceLanguageCookieSynced } from "./components/InterfaceLanguageCookieSync";
import { recordLocaleSwitchStarted } from "./media-plp/media-plp-locale-switch-machine";
import { resolveLocaleSwitchNavigationHref } from "./resolve-locale-switch-navigation-href";
import {
  runLocaleSwitchNavigation,
  type LocaleSwitchRouter,
} from "./run-locale-switch-navigation";
import {
  writeHuLangCookieViaWebRoute,
  type WriteHuLangCookieResult,
} from "./write-hu-lang-cookie";

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
   * When true, mark InterfaceLanguageCookieSync latch after a successful cookie write
   * (authenticated Preference / selector flows).
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
  const written = await writeHuLangCookieViaWebRoute(input.locale);

  if (input.markAuthenticatedSync === true) {
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
