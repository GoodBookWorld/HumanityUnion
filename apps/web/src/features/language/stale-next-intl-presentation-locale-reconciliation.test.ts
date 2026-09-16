/**
 * Stale next-intl presentation locale reconciliation with Preferred Reading / hu_lang.
 *
 * Cookie === preferred is not sufficient alignment when useLocale() still differs.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { MemberPreferences } from "@hu/types";

import {
  claimAuthoritativePresentationLocale,
  getLastStaleNextIntlRecomposeForLocaleForTests,
  getLastSyncedPresentationLocaleForTests,
  getPresentationLocaleSyncGenerationForTests,
  resetInterfaceLanguageCookieSyncForTests,
  runGuestPresentationLocaleNextIntlRecompose,
  runPresentationLocaleCookieSyncAttempt,
  shouldRecomposeStaleNextIntlPresentation,
} from "./presentation-locale-cookie-sync.js";
import { shouldSuppressInterfaceLanguageCookieSyncForPath } from "./public-seo-locale-request.js";
import { runLocaleSwitchNavigation } from "./run-locale-switch-navigation.js";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readWeb(rel: string): string {
  return readFileSync(path.join(webRoot, rel), "utf8");
}

function prefsFor(locale: string): MemberPreferences {
  return {
    memberId: "member-test",
    experiencePreferences: {
      interfaceLanguage: locale,
      readingLanguages: [locale],
      writingLanguages: [],
      translationPreference: "none",
      timeZone: "UTC",
      dateFormat: "YYYY-MM-DD",
      timeFormat: "24h",
      expertiseAreas: [],
      skills: [],
    },
    participationPreferences: {} as MemberPreferences["participationPreferences"],
    communicationPreferences: {} as MemberPreferences["communicationPreferences"],
    accessibilityPreferences: {} as MemberPreferences["accessibilityPreferences"],
    workspacePreferences: {} as MemberPreferences["workspacePreferences"],
    visibilityPreferences: {} as MemberPreferences["visibilityPreferences"],
    updatedAt: new Date().toISOString(),
  } as MemberPreferences;
}

afterEach(() => {
  resetInterfaceLanguageCookieSyncForTests();
});

describe("Stale next-intl presentation locale reconciliation", () => {
  it("A. cookie == preferred == current next-intl locale → no refresh (aligned)", async () => {
    let refreshCount = 0;
    const outcome = await runPresentationLocaleCookieSyncAttempt({
      generation: getPresentationLocaleSyncGenerationForTests(),
      getPreferences: async () => prefsFor("xx-READ"),
      readCookie: () => "xx-READ",
      writeCookie: async (locale) => ({ locale }),
      refresh: () => {
        refreshCount += 1;
      },
      currentPresentationLocale: "xx-READ",
    });
    assert.equal(outcome, "aligned");
    assert.equal(refreshCount, 0);
  });

  it("B. cookie == preferred != current next-intl locale → one same-path recompose", async () => {
    let refreshCount = 0;
    const outcome = await runPresentationLocaleCookieSyncAttempt({
      generation: getPresentationLocaleSyncGenerationForTests(),
      getPreferences: async () => prefsFor("xx-READ"),
      readCookie: () => "xx-READ",
      writeCookie: async (locale) => ({ locale }),
      refresh: () => {
        refreshCount += 1;
      },
      currentPresentationLocale: "en",
    });
    assert.equal(outcome, "recomposed");
    assert.equal(refreshCount, 1);
    assert.equal(getLastStaleNextIntlRecomposeForLocaleForTests(), "xx-READ");
  });

  it("C. cookie != preferred → existing write + refresh flow remains", async () => {
    const writes: string[] = [];
    let cookie: string | null = "en";
    const outcome = await runPresentationLocaleCookieSyncAttempt({
      generation: getPresentationLocaleSyncGenerationForTests(),
      getPreferences: async () => prefsFor("xx-READ"),
      readCookie: () => cookie,
      writeCookie: async (locale) => {
        writes.push(locale);
        cookie = locale;
        return { locale };
      },
      refresh: () => {
        writes.push("refresh");
      },
      currentPresentationLocale: "en",
    });
    assert.equal(outcome, "written");
    assert.deepEqual(writes, ["xx-READ", "refresh"]);
  });

  it("D. after reconciliation succeeds → no refresh loop; latch clears on alignment", async () => {
    let refreshCount = 0;
    const refresh = () => {
      refreshCount += 1;
    };
    const first = await runPresentationLocaleCookieSyncAttempt({
      generation: getPresentationLocaleSyncGenerationForTests(),
      getPreferences: async () => prefsFor("xx-READ"),
      readCookie: () => "xx-READ",
      writeCookie: async (locale) => ({ locale }),
      refresh,
      currentPresentationLocale: "en",
    });
    assert.equal(first, "recomposed");
    assert.equal(refreshCount, 1);

    // Effect re-runs before useLocale catches up — latch prevents a second refresh.
    const second = await runPresentationLocaleCookieSyncAttempt({
      generation: getPresentationLocaleSyncGenerationForTests(),
      getPreferences: async () => prefsFor("xx-READ"),
      readCookie: () => "xx-READ",
      writeCookie: async (locale) => ({ locale }),
      refresh,
      currentPresentationLocale: "en",
    });
    assert.equal(second, "aligned");
    assert.equal(refreshCount, 1);
    assert.equal(getLastStaleNextIntlRecomposeForLocaleForTests(), "xx-READ");

    // Once next-intl matches, cycle completes and latch clears.
    const third = await runPresentationLocaleCookieSyncAttempt({
      generation: getPresentationLocaleSyncGenerationForTests(),
      getPreferences: async () => prefsFor("xx-READ"),
      readCookie: () => "xx-READ",
      writeCookie: async (locale) => ({ locale }),
      refresh,
      currentPresentationLocale: "xx-READ",
    });
    assert.equal(third, "aligned");
    assert.equal(refreshCount, 1);
    assert.equal(getLastStaleNextIntlRecomposeForLocaleForTests(), null);
  });

  it("same-locale re-stale cycle: A–E authenticated", async () => {
    let refreshCount = 0;
    const refresh = () => {
      refreshCount += 1;
    };
    const depsBase = {
      getPreferences: async () => prefsFor("xx-L"),
      readCookie: () => "xx-L",
      writeCookie: async (locale: string) => ({ locale }),
      refresh,
    };

    // A. mismatch L -> first recompose
    assert.equal(
      await runPresentationLocaleCookieSyncAttempt({
        ...depsBase,
        generation: getPresentationLocaleSyncGenerationForTests(),
        currentPresentationLocale: "en",
      }),
      "recomposed",
    );
    assert.equal(refreshCount, 1);

    // B. same mismatch before useLocale catches up -> no second recompose
    assert.equal(
      await runPresentationLocaleCookieSyncAttempt({
        ...depsBase,
        generation: getPresentationLocaleSyncGenerationForTests(),
        currentPresentationLocale: "en",
      }),
      "aligned",
    );
    assert.equal(refreshCount, 1);

    // C. useLocale becomes L -> reconciliation cycle completed
    assert.equal(
      await runPresentationLocaleCookieSyncAttempt({
        ...depsBase,
        generation: getPresentationLocaleSyncGenerationForTests(),
        currentPresentationLocale: "xx-L",
      }),
      "aligned",
    );
    assert.equal(getLastStaleNextIntlRecomposeForLocaleForTests(), null);
    assert.equal(refreshCount, 1);

    // D. later same-L mismatch -> exactly one new recompose
    assert.equal(
      await runPresentationLocaleCookieSyncAttempt({
        ...depsBase,
        generation: getPresentationLocaleSyncGenerationForTests(),
        currentPresentationLocale: "en",
      }),
      "recomposed",
    );
    assert.equal(refreshCount, 2);

    // E. repeat D before catch-up -> no loop
    assert.equal(
      await runPresentationLocaleCookieSyncAttempt({
        ...depsBase,
        generation: getPresentationLocaleSyncGenerationForTests(),
        currentPresentationLocale: "en",
      }),
      "aligned",
    );
    assert.equal(refreshCount, 2);
  });

  it("F. equivalent guest same-locale re-stale cycle", () => {
    let refreshCount = 0;
    const refresh = () => {
      refreshCount += 1;
    };

    assert.equal(
      runGuestPresentationLocaleNextIntlRecompose({
        cookieLocale: "xx-GUEST",
        currentPresentationLocale: "en",
        refresh,
      }),
      "recomposed",
    );
    assert.equal(refreshCount, 1);

    assert.equal(
      runGuestPresentationLocaleNextIntlRecompose({
        cookieLocale: "xx-GUEST",
        currentPresentationLocale: "en",
        refresh,
      }),
      "aligned",
    );
    assert.equal(refreshCount, 1);

    assert.equal(
      runGuestPresentationLocaleNextIntlRecompose({
        cookieLocale: "xx-GUEST",
        currentPresentationLocale: "xx-GUEST",
        refresh,
      }),
      "aligned",
    );
    assert.equal(getLastStaleNextIntlRecomposeForLocaleForTests(), null);

    assert.equal(
      runGuestPresentationLocaleNextIntlRecompose({
        cookieLocale: "xx-GUEST",
        currentPresentationLocale: "en",
        refresh,
      }),
      "recomposed",
    );
    assert.equal(refreshCount, 2);

    assert.equal(
      runGuestPresentationLocaleNextIntlRecompose({
        cookieLocale: "xx-GUEST",
        currentPresentationLocale: "en",
        refresh,
      }),
      "aligned",
    );
    assert.equal(refreshCount, 2);
  });

  it("G. authoritative apply claims cookie only — stale useLocale remains recoverable once", async () => {
    const generation = claimAuthoritativePresentationLocale("xx-READ");
    assert.equal(getLastStaleNextIntlRecomposeForLocaleForTests(), null);
    let refreshCount = 0;
    const refresh = () => {
      refreshCount += 1;
    };

    // Post-apply: hu_lang NEW, useLocale still OLD → recovery refresh permitted.
    assert.equal(
      await runPresentationLocaleCookieSyncAttempt({
        generation,
        getPreferences: async () => prefsFor("xx-READ"),
        readCookie: () => "xx-READ",
        writeCookie: async (locale) => ({ locale }),
        refresh,
        currentPresentationLocale: "en",
      }),
      "recomposed",
    );
    assert.equal(refreshCount, 1);
    assert.equal(getLastStaleNextIntlRecomposeForLocaleForTests(), "xx-READ");

    // Settling: latch blocks a second refresh for the same target.
    assert.equal(
      await runPresentationLocaleCookieSyncAttempt({
        generation: getPresentationLocaleSyncGenerationForTests(),
        getPreferences: async () => prefsFor("xx-READ"),
        readCookie: () => "xx-READ",
        writeCookie: async (locale) => ({ locale }),
        refresh,
        currentPresentationLocale: "en",
      }),
      "aligned",
    );
    assert.equal(refreshCount, 1);

    // Alignment observed — cycle complete, latch cleared.
    assert.equal(
      await runPresentationLocaleCookieSyncAttempt({
        generation: getPresentationLocaleSyncGenerationForTests(),
        getPreferences: async () => prefsFor("xx-READ"),
        readCookie: () => "xx-READ",
        writeCookie: async (locale) => ({ locale }),
        refresh,
        currentPresentationLocale: "xx-READ",
      }),
      "aligned",
    );
    assert.equal(getLastStaleNextIntlRecomposeForLocaleForTests(), null);
    assert.equal(refreshCount, 1);

    // Later same-locale re-stale eligible again.
    assert.equal(
      await runPresentationLocaleCookieSyncAttempt({
        generation: getPresentationLocaleSyncGenerationForTests(),
        getPreferences: async () => prefsFor("xx-READ"),
        readCookie: () => "xx-READ",
        writeCookie: async (locale) => ({ locale }),
        refresh,
        currentPresentationLocale: "en",
      }),
      "recomposed",
    );
    assert.equal(refreshCount, 2);
  });

  it("Preferred Reading apply start: cookie NEW does not falsely complete NextIntl latch", async () => {
    // CASE 1 — OLD en → apply uk
    claimAuthoritativePresentationLocale("uk");
    assert.equal(getLastSyncedPresentationLocaleForTests(), "uk");
    assert.equal(getLastStaleNextIntlRecomposeForLocaleForTests(), null);

    let refreshCount = 0;
    const outcome = await runPresentationLocaleCookieSyncAttempt({
      generation: getPresentationLocaleSyncGenerationForTests(),
      getPreferences: async () => prefsFor("uk"),
      readCookie: () => "uk",
      writeCookie: async (locale) => ({ locale }),
      refresh: () => {
        refreshCount += 1;
      },
      currentPresentationLocale: "en",
    });
    assert.equal(outcome, "recomposed");
    assert.equal(refreshCount, 1);
    // Stale useLocale=en was NOT treated as completed/aligned without recovery.
  });

  it("leave before recompose settles: recovery once, no same-path replace", async () => {
    // CASE 2 / 4 — prefs+cookie uk, useLocale en, apply latch must not suppress.
    claimAuthoritativePresentationLocale("uk");
    const replaces: string[] = [];
    let refreshCount = 0;
    const refresh = () => {
      const nav = runLocaleSwitchNavigation({
        router: {
          replace: (href) => {
            replaces.push(href);
          },
          refresh: () => {
            refreshCount += 1;
          },
        },
        pathname: "/workspace",
        href: null,
      });
      assert.equal(nav.didReplace, false);
    };

    const first = await runPresentationLocaleCookieSyncAttempt({
      generation: getPresentationLocaleSyncGenerationForTests(),
      getPreferences: async () => prefsFor("uk"),
      readCookie: () => "uk",
      writeCookie: async (locale) => ({ locale }),
      refresh,
      currentPresentationLocale: "en",
    });
    assert.equal(first, "recomposed");
    assert.equal(refreshCount, 1);
    assert.deepEqual(replaces, []);

    const second = await runPresentationLocaleCookieSyncAttempt({
      generation: getPresentationLocaleSyncGenerationForTests(),
      getPreferences: async () => prefsFor("uk"),
      readCookie: () => "uk",
      writeCookie: async (locale) => ({ locale }),
      refresh,
      currentPresentationLocale: "en",
    });
    assert.equal(second, "aligned");
    assert.equal(refreshCount, 1);
    assert.deepEqual(replaces, []);
  });

  it("alignment observed after apply race → idle; further Workspace needs no repair", async () => {
    // CASE 3 — continues from recovery latch
    claimAuthoritativePresentationLocale("uk");
    let refreshCount = 0;
    const refresh = () => {
      refreshCount += 1;
    };

    await runPresentationLocaleCookieSyncAttempt({
      generation: getPresentationLocaleSyncGenerationForTests(),
      getPreferences: async () => prefsFor("uk"),
      readCookie: () => "uk",
      writeCookie: async (locale) => ({ locale }),
      refresh,
      currentPresentationLocale: "en",
    });
    assert.equal(refreshCount, 1);

    const aligned = await runPresentationLocaleCookieSyncAttempt({
      generation: getPresentationLocaleSyncGenerationForTests(),
      getPreferences: async () => prefsFor("uk"),
      readCookie: () => "uk",
      writeCookie: async (locale) => ({ locale }),
      refresh,
      currentPresentationLocale: "uk",
    });
    assert.equal(aligned, "aligned");
    assert.equal(getLastStaleNextIntlRecomposeForLocaleForTests(), null);
    assert.equal(refreshCount, 1);

    const idle = await runPresentationLocaleCookieSyncAttempt({
      generation: getPresentationLocaleSyncGenerationForTests(),
      getPreferences: async () => prefsFor("uk"),
      readCookie: () => "uk",
      writeCookie: async (locale) => ({ locale }),
      refresh,
      currentPresentationLocale: "uk",
    });
    assert.equal(idle, "aligned");
    assert.equal(refreshCount, 1);
  });

  it("claim clears a prior false-completed latch so rapid leave stays recoverable", async () => {
    // Simulate old bug residue: latch already NEW while useLocale still OLD.
    claimAuthoritativePresentationLocale("uk");
    // Manually poison as the old claim did — then re-claim must clear it.
    const poisoned = await runPresentationLocaleCookieSyncAttempt({
      generation: getPresentationLocaleSyncGenerationForTests(),
      getPreferences: async () => prefsFor("uk"),
      readCookie: () => "uk",
      writeCookie: async (locale) => ({ locale }),
      refresh: () => undefined,
      currentPresentationLocale: "en",
    });
    assert.equal(poisoned, "recomposed");
    assert.equal(getLastStaleNextIntlRecomposeForLocaleForTests(), "uk");

    // Another Preferences apply / claim for same locale releases the latch.
    claimAuthoritativePresentationLocale("uk");
    assert.equal(getLastStaleNextIntlRecomposeForLocaleForTests(), null);

    let refreshCount = 0;
    const recovered = await runPresentationLocaleCookieSyncAttempt({
      generation: getPresentationLocaleSyncGenerationForTests(),
      getPreferences: async () => prefsFor("uk"),
      readCookie: () => "uk",
      writeCookie: async (locale) => ({ locale }),
      refresh: () => {
        refreshCount += 1;
      },
      currentPresentationLocale: "en",
    });
    assert.equal(recovered, "recomposed");
    assert.equal(refreshCount, 1);
  });

  it("E. English/default locale remains correct", async () => {
    let refreshCount = 0;
    const aligned = await runPresentationLocaleCookieSyncAttempt({
      generation: getPresentationLocaleSyncGenerationForTests(),
      getPreferences: async () => prefsFor("en"),
      readCookie: () => "en",
      writeCookie: async (locale) => ({ locale }),
      refresh: () => {
        refreshCount += 1;
      },
      currentPresentationLocale: "en",
    });
    assert.equal(aligned, "aligned");
    assert.equal(refreshCount, 0);

    const healToEnglish = await runPresentationLocaleCookieSyncAttempt({
      generation: getPresentationLocaleSyncGenerationForTests(),
      getPreferences: async () => prefsFor("en"),
      readCookie: () => "en",
      writeCookie: async (locale) => ({ locale }),
      refresh: () => {
        refreshCount += 1;
      },
      currentPresentationLocale: "xx-OTHER",
    });
    assert.equal(healToEnglish, "recomposed");
    assert.equal(refreshCount, 1);
  });

  it("no hardcoded locale lists in reconciliation sources", () => {
    assert.equal(
      shouldRecomposeStaleNextIntlPresentation({
        targetLocale: "xx-FUTURE",
        currentPresentationLocale: "en",
        alreadyRecomposedForLocale: null,
      }),
      true,
    );
    assert.equal(
      shouldRecomposeStaleNextIntlPresentation({
        targetLocale: "xx-FUTURE",
        currentPresentationLocale: "xx-FUTURE",
        alreadyRecomposedForLocale: null,
      }),
      false,
    );

    const sync = readWeb("src/features/language/presentation-locale-cookie-sync.ts");
    const component = readWeb(
      "src/features/language/components/InterfaceLanguageCookieSync.tsx",
    );
    for (const src of [sync, component]) {
      assert.doesNotMatch(src, /Ukrainian|Arabic|Georgian|Hebrew|["']ka["']|["']he["']/);
    }
  });

  it("locale-prefixed SEO route suppression remains unchanged", () => {
    assert.equal(shouldSuppressInterfaceLanguageCookieSyncForPath("/uk/media"), true);
    assert.equal(shouldSuppressInterfaceLanguageCookieSyncForPath("/zh-hant/blog"), true);
    assert.equal(shouldSuppressInterfaceLanguageCookieSyncForPath("/initiatives"), false);
    assert.equal(shouldSuppressInterfaceLanguageCookieSyncForPath("/workspace"), false);

    const component = readWeb(
      "src/features/language/components/InterfaceLanguageCookieSync.tsx",
    );
    assert.match(component, /shouldSuppressInterfaceLanguageCookieSyncForPath/);
    assert.match(component, /runLocaleSwitchNavigation/);
    // CookieSync must refresh-only on locale-free paths — never same-path replace.
    assert.doesNotMatch(component, /forceSamePathRecompose:\s*true/);
    assert.match(component, /currentPresentationLocale:\s*presentationLocale/);
    assert.match(component, /runGuestPresentationLocaleNextIntlRecompose/);
  });

  it("omitting currentPresentationLocale preserves cookie-only aligned behavior", async () => {
    let refreshCount = 0;
    const outcome = await runPresentationLocaleCookieSyncAttempt({
      generation: getPresentationLocaleSyncGenerationForTests(),
      getPreferences: async () => prefsFor("xx-READ"),
      readCookie: () => "xx-READ",
      writeCookie: async (locale) => ({ locale }),
      refresh: () => {
        refreshCount += 1;
      },
    });
    assert.equal(outcome, "aligned");
    assert.equal(refreshCount, 0);
  });

  it("Preferences forceSamePathRecompose still replaces then refreshes (unchanged)", () => {
    const replaces: string[] = [];
    const refreshes: number[] = [];
    const result = runLocaleSwitchNavigation({
      router: {
        replace: (href) => {
          replaces.push(href);
        },
        refresh: () => {
          refreshes.push(1);
        },
      },
      pathname: "/preferences",
      href: null,
      forceSamePathRecompose: true,
    });
    assert.equal(result.didReplace, true);
    assert.equal(result.didRefresh, true);
    assert.deepEqual(replaces, ["/preferences"]);
    assert.equal(refreshes.length, 1);
  });

  it("locale-free CookieSync recompose is refresh-only — never replace(/workspace)", () => {
    const replaces: string[] = [];
    const refreshes: number[] = [];
    const result = runLocaleSwitchNavigation({
      router: {
        replace: (href) => {
          replaces.push(href);
        },
        refresh: () => {
          refreshes.push(1);
        },
      },
      pathname: "/workspace",
      href: null,
    });
    assert.equal(result.didReplace, false);
    assert.equal(result.didRefresh, true);
    assert.deepEqual(replaces, []);
    assert.equal(refreshes.length, 1);
  });

  it("non-en Preferred Reading + stale hu_lang on /workspace: write once, refresh once, no replace", async () => {
    const replaces: string[] = [];
    const writes: string[] = [];
    let cookie: string | null = "en";
    let refreshCount = 0;

    const refresh = () => {
      // Mirror CookieSync wiring: locale-free path → refresh-only.
      const nav = runLocaleSwitchNavigation({
        router: {
          replace: (href) => {
            replaces.push(href);
          },
          refresh: () => {
            refreshCount += 1;
          },
        },
        pathname: "/workspace",
        href: null,
      });
      assert.equal(nav.didReplace, false);
    };

    const first = await runPresentationLocaleCookieSyncAttempt({
      generation: getPresentationLocaleSyncGenerationForTests(),
      getPreferences: async () => prefsFor("uk"),
      readCookie: () => cookie,
      writeCookie: async (locale) => {
        writes.push(locale);
        cookie = locale;
        return { locale };
      },
      refresh,
      currentPresentationLocale: "en",
    });
    assert.equal(first, "written");
    assert.deepEqual(writes, ["uk"]);
    assert.equal(cookie, "uk");
    assert.equal(refreshCount, 1);
    assert.deepEqual(replaces, []);

    // Settling: effect would re-run with same preferred; latch blocks another refresh.
    const second = await runPresentationLocaleCookieSyncAttempt({
      generation: getPresentationLocaleSyncGenerationForTests(),
      getPreferences: async () => prefsFor("uk"),
      readCookie: () => cookie,
      writeCookie: async (locale) => {
        writes.push(locale);
        return { locale };
      },
      refresh,
      currentPresentationLocale: "en",
    });
    assert.equal(second, "aligned");
    assert.equal(refreshCount, 1);
    assert.deepEqual(writes, ["uk"]);
    assert.deepEqual(replaces, []);

    // Fully aligned: no navigation.
    const third = await runPresentationLocaleCookieSyncAttempt({
      generation: getPresentationLocaleSyncGenerationForTests(),
      getPreferences: async () => prefsFor("uk"),
      readCookie: () => "uk",
      writeCookie: async (locale) => {
        writes.push(locale);
        return { locale };
      },
      refresh,
      currentPresentationLocale: "uk",
    });
    assert.equal(third, "aligned");
    assert.equal(refreshCount, 1);
    assert.deepEqual(replaces, []);
  });

  it("en Preferred Reading + /workspace aligned → no navigation/recomposition", async () => {
    const replaces: string[] = [];
    let refreshCount = 0;
    const outcome = await runPresentationLocaleCookieSyncAttempt({
      generation: getPresentationLocaleSyncGenerationForTests(),
      getPreferences: async () => prefsFor("en"),
      readCookie: () => "en",
      writeCookie: async (locale) => ({ locale }),
      refresh: () => {
        runLocaleSwitchNavigation({
          router: {
            replace: (href) => {
              replaces.push(href);
            },
            refresh: () => {
              refreshCount += 1;
            },
          },
          pathname: "/workspace",
          href: null,
        });
      },
      currentPresentationLocale: "en",
    });
    assert.equal(outcome, "aligned");
    assert.equal(refreshCount, 0);
    assert.deepEqual(replaces, []);
  });

  it("public locale-switch with valid localized href still replaces then refreshes", () => {
    const calls: string[] = [];
    const result = runLocaleSwitchNavigation({
      router: {
        replace: (href) => {
          calls.push(`replace:${href}`);
        },
        refresh: () => {
          calls.push("refresh");
        },
      },
      pathname: "/uk/media",
      href: "/ar/media",
    });
    assert.equal(result.didReplace, true);
    assert.equal(result.didRefresh, true);
    assert.deepEqual(calls, ["replace:/ar/media", "refresh"]);
  });
});
