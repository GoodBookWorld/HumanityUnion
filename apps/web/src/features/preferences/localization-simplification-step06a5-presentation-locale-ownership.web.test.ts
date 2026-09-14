/**
 * Localization Simplification Step 06A.5 —
 * Authoritative presentation-locale cookie ownership (race + Preferred Reading).
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

import type { MemberPreferences } from "@hu/types";

import { applyPresentationLocale } from "../language/apply-presentation-locale.js";
import {
  claimAuthoritativePresentationLocale,
  clearPresentationLocaleCookieSyncSession,
  getLastSyncedPresentationLocaleForTests,
  getPresentationLocaleSyncGenerationForTests,
  getPresentationLocaleSyncInFlightIdForTests,
  isPresentationLocaleCookieSyncInFlight,
  resetInterfaceLanguageCookieSyncForTests,
  resolvePreferredPresentationLocale,
  runPresentationLocaleCookieSyncAttempt,
  schedulePresentationLocaleCookieSync,
} from "../language/presentation-locale-cookie-sync.js";
import { resolveDocumentHtmlLocale } from "../language/resolve-document-locale.js";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readWeb(rel: string): string {
  return readFileSync(path.join(webRoot, rel), "utf8");
}

function prefsFor(locale: {
  reading?: string;
  interfaceLanguage?: string;
}): MemberPreferences {
  return {
    memberId: "member-test",
    experiencePreferences: {
      interfaceLanguage: locale.interfaceLanguage ?? "en",
      readingLanguages: locale.reading ? [locale.reading] : [],
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

describe("Localization Simplification Step 06A.5 — presentation locale cookie ownership", () => {
  it("1–5. stale sync A cannot overwrite newer authoritative apply B", async () => {
    const cookieWrites: string[] = [];
    let cookieValue: string | null = "en";
    let stalePrefsResolved!: (value: MemberPreferences) => void;
    const stalePrefs = new Promise<MemberPreferences>((resolve) => {
      stalePrefsResolved = resolve;
    });

    const staleGeneration = getPresentationLocaleSyncGenerationForTests();
    const staleSync = runPresentationLocaleCookieSyncAttempt({
      generation: staleGeneration,
      getPreferences: async () => stalePrefs,
      readCookie: () => cookieValue,
      writeCookie: async (locale) => {
        cookieWrites.push(locale);
        cookieValue = locale;
        return { locale };
      },
      refresh: () => {
        cookieWrites.push("refresh");
      },
    });

    // User saves newer Preferred Reading B and applies presentation locale.
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/hu-lang") && init?.method === "POST") {
        const body = JSON.parse(String(init.body ?? "{}")) as { locale?: string };
        const locale = body.locale?.trim() || "en";
        cookieValue = locale;
        cookieWrites.push(`apply:${locale}`);
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              locale,
              languageId: `lang-${locale}`,
              textDirection: locale === "xx-RTL" ? "rtl" : "ltr",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      const applied = await applyPresentationLocale({
        locale: "xx-B",
        pathname: "/preferences",
        seoIndexingEnabled: false,
        router: { replace: () => undefined, refresh: () => undefined },
        markAuthenticatedSync: true,
        forceSamePathRecompose: true,
      });
      assert.equal(applied.written.locale, "xx-B");
      assert.equal(cookieValue, "xx-B");
      assert.ok(getPresentationLocaleSyncGenerationForTests() > staleGeneration);

      // Stale sync (started with locale A) completes afterward.
      stalePrefsResolved(
        prefsFor({ reading: "xx-A", interfaceLanguage: "xx-A" }),
      );
      const outcome = await staleSync;
      assert.equal(outcome, "skipped_stale");
      assert.equal(cookieValue, "xx-B");
      assert.equal(getLastSyncedPresentationLocaleForTests(), "xx-B");
      assert.ok(!cookieWrites.includes("xx-A"));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("stale sync write that finishes after apply B is repaired back to B", async () => {
    let cookieValue: string | null = "en";
    let releaseStaleWrite!: () => void;
    const staleWriteGate = new Promise<void>((resolve) => {
      releaseStaleWrite = resolve;
    });
    let enteredStaleWrite!: () => void;
    const enteredStaleWritePromise = new Promise<void>((resolve) => {
      enteredStaleWrite = resolve;
    });
    let stalePrefsResolved!: (value: MemberPreferences) => void;
    const stalePrefs = new Promise<MemberPreferences>((resolve) => {
      stalePrefsResolved = resolve;
    });

    const staleGeneration = getPresentationLocaleSyncGenerationForTests();
    const staleSync = runPresentationLocaleCookieSyncAttempt({
      generation: staleGeneration,
      getPreferences: async () => stalePrefs,
      readCookie: () => cookieValue,
      writeCookie: async (locale) => {
        enteredStaleWrite();
        await staleWriteGate;
        cookieValue = locale;
        return { locale };
      },
      refresh: () => undefined,
    });

    stalePrefsResolved(
      prefsFor({ reading: "xx-A", interfaceLanguage: "xx-A" }),
    );
    await enteredStaleWritePromise;

    claimAuthoritativePresentationLocale("xx-B");
    cookieValue = "xx-B";

    releaseStaleWrite();
    const outcome = await staleSync;
    assert.equal(outcome, "skipped_stale");
    assert.equal(cookieValue, "xx-B");
  });

  it("wrong/missing cookie is repaired even when latch previously claimed sync", async () => {
    claimAuthoritativePresentationLocale("xx-B");
    assert.equal(getLastSyncedPresentationLocaleForTests(), "xx-B");

    let cookieValue: string | null = "en"; // latch said xx-B but cookie is wrong
    const writes: string[] = [];
    const generation = getPresentationLocaleSyncGenerationForTests();

    const outcome = await runPresentationLocaleCookieSyncAttempt({
      generation,
      getPreferences: async () =>
        prefsFor({ reading: "xx-B", interfaceLanguage: "xx-B" }),
      readCookie: () => cookieValue,
      writeCookie: async (locale) => {
        writes.push(locale);
        cookieValue = locale;
        return { locale };
      },
      refresh: () => {
        writes.push("refresh");
      },
    });

    assert.equal(outcome, "written");
    assert.deepEqual(writes, ["xx-B", "refresh"]);
    assert.equal(cookieValue, "xx-B");
  });

  it("Preferred Reading readingLanguages[0] is post-save presentation authority", () => {
    assert.equal(
      resolvePreferredPresentationLocale(
        prefsFor({ reading: "xx-READ", interfaceLanguage: "en" }),
      ),
      "xx-READ",
    );
    assert.equal(
      resolvePreferredPresentationLocale(
        prefsFor({ interfaceLanguage: "xx-IFACE" }),
      ),
      "xx-IFACE",
    );

    const prefs = readWeb("src/features/preferences/components/PreferencesWorkspace.tsx");
    const handleSubmit = prefs.slice(prefs.indexOf("async function handleSubmit"));
    assert.match(handleSubmit, /resolvePreferredPresentationLocale\(updated\)/);
    assert.doesNotMatch(
      handleSubmit,
      /presentationLocale\s*=\s*updated\.experiencePreferences\.interfaceLanguage/,
    );
  });

  it("arbitrary enabled future RTL locale uses Registry direction without hardcoded lists", async () => {
    const catalog = [
      {
        languageId: "lang-en",
        locale: "en",
        textDirection: "ltr" as const,
        aliases: [],
      },
      {
        languageId: "lang-future-rtl",
        locale: "xx-RTL",
        textDirection: "rtl" as const,
        aliases: [],
      },
    ];
    const resolved = await resolveDocumentHtmlLocale({
      catalog,
      huLangCookie: "xx-RTL",
      acceptLanguageHeader: "en",
    });
    assert.equal(resolved.locale, "xx-RTL");
    assert.equal(resolved.textDirection, "rtl");

    const sync = readWeb("src/features/language/presentation-locale-cookie-sync.ts");
    const apply = readWeb("src/features/language/apply-presentation-locale.ts");
    for (const src of [sync, apply]) {
      assert.doesNotMatch(src, /RTL_LANGUAGE_CODES|isRtlLanguageCode|["']ka["']|["']he["']/);
      assert.doesNotMatch(src, /DATA_NOT_READY|languageDataReady|WEB_UI|Activate Localization/);
    }
  });

  it("apply claims generation before hu_lang write; Brand path stays locale-driven", () => {
    const apply = readWeb("src/features/language/apply-presentation-locale.ts");
    assert.match(apply, /claimAuthoritativePresentationLocale/);
    assert.match(apply, /writeHuLangCookieViaWebRoute/);
    const claimIdx = apply.indexOf("claimAuthoritativePresentationLocale");
    const writeIdx = apply.indexOf("writeHuLangCookieViaWebRoute");
    assert.ok(claimIdx >= 0 && writeIdx > claimIdx);

    const layout = readWeb("src/app/layout.tsx");
    const brandHook = readWeb("src/features/brand-localization/useLocalizedBrand.ts");
    const protect = readWeb(
      "src/features/language/components/ProtectedAuthoritativeText.tsx",
    );
    assert.match(layout, /resolveBrandForMetadata\(documentLocale\.locale\)/);
    assert.match(layout, /dir=\{documentLocale\.textDirection\}/);
    assert.match(brandHook, /resolveLocalizedBrandForLocale\(locale\)/);
    assert.match(protect, /translate:\s*"no"/);
  });

  it("06A.5A — session reset invalidates generation N; old attempt cannot become authoritative", async () => {
    let cookieValue: string | null = "en";
    const writes: string[] = [];
    let releasePrefs!: (value: MemberPreferences) => void;
    const prefsGate = new Promise<MemberPreferences>((resolve) => {
      releasePrefs = resolve;
    });

    const generationN = getPresentationLocaleSyncGenerationForTests();
    const oldAttempt = runPresentationLocaleCookieSyncAttempt({
      generation: generationN,
      getPreferences: async () => prefsGate,
      readCookie: () => cookieValue,
      writeCookie: async (locale) => {
        writes.push(locale);
        cookieValue = locale;
        return { locale };
      },
      refresh: () => {
        writes.push("refresh");
      },
    });

    clearPresentationLocaleCookieSyncSession();
    const afterReset = getPresentationLocaleSyncGenerationForTests();
    assert.ok(afterReset > generationN);
    assert.equal(getLastSyncedPresentationLocaleForTests(), null);

    releasePrefs(prefsFor({ reading: "xx-OLD", interfaceLanguage: "xx-OLD" }));
    const outcome = await oldAttempt;
    assert.equal(outcome, "skipped_stale");
    assert.ok(!writes.includes("xx-OLD"));
    assert.ok(!writes.includes("refresh"));
    assert.equal(cookieValue, "en");
    assert.equal(getLastSyncedPresentationLocaleForTests(), null);
  });

  it("06A.5A — old in-flight finally cannot corrupt newer session booking", async () => {
    let releaseOldRun!: () => void;
    const oldRunGate = new Promise<void>((resolve) => {
      releaseOldRun = resolve;
    });
    let oldRunStarted!: () => void;
    const oldRunStartedPromise = new Promise<void>((resolve) => {
      oldRunStarted = resolve;
    });

    const scheduledOld = schedulePresentationLocaleCookieSync({
      run: async () => {
        oldRunStarted();
        await oldRunGate;
      },
    });
    assert.equal(scheduledOld, true);
    assert.equal(isPresentationLocaleCookieSyncInFlight(), true);
    await oldRunStartedPromise;
    const oldFlightId = getPresentationLocaleSyncInFlightIdForTests();
    assert.ok(oldFlightId !== null);

    clearPresentationLocaleCookieSyncSession();
    assert.equal(getPresentationLocaleSyncInFlightIdForTests(), null);
    assert.equal(isPresentationLocaleCookieSyncInFlight(), false);

    let releaseNewRun!: () => void;
    const newRunGate = new Promise<void>((resolve) => {
      releaseNewRun = resolve;
    });
    let newRunGeneration: number | null = null;
    const scheduledNew = schedulePresentationLocaleCookieSync({
      run: async (generation) => {
        newRunGeneration = generation;
        await newRunGate;
      },
    });
    assert.equal(scheduledNew, true);
    const newFlightId = getPresentationLocaleSyncInFlightIdForTests();
    assert.ok(newFlightId !== null);
    assert.notEqual(newFlightId, oldFlightId);

    releaseOldRun();
    // Yield so old Promise `finally` runs while new booking is still held.
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(getPresentationLocaleSyncInFlightIdForTests(), newFlightId);
    assert.equal(isPresentationLocaleCookieSyncInFlight(), true);
    assert.equal(
      newRunGeneration,
      getPresentationLocaleSyncGenerationForTests(),
    );

    releaseNewRun();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(getPresentationLocaleSyncInFlightIdForTests(), null);
  });

  it("Cookie Sync source uses generation + cookie truth (not latch-only)", () => {
    const sync = readWeb("src/features/language/presentation-locale-cookie-sync.ts");
    const component = readWeb(
      "src/features/language/components/InterfaceLanguageCookieSync.tsx",
    );
    assert.match(sync, /presentationLocaleSyncGeneration/);
    assert.match(sync, /isStaleGeneration/);
    assert.match(sync, /resolvePreferredPresentationLocale/);
    assert.match(sync, /currentCookie === target/);
    assert.doesNotMatch(
      sync,
      /if \(lastSyncedPresentationLocale === target\) \{\s*return/,
    );
    assert.match(component, /runPresentationLocaleCookieSyncAttempt/);
    assert.match(component, /clearPresentationLocaleCookieSyncSession/);
  });
});
