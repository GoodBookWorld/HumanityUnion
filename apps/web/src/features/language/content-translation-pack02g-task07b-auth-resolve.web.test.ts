/**
 * Pack 02G Task 07B — auth-aware public content reading lifecycle.
 *
 * Surfaces must wait for shared client auth readiness and derive reading
 * language from readingLanguages[0] only (never interfaceLanguage).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

import { DEFAULT_PLATFORM_LANGUAGE } from "@hu/types";

import { deriveAuthenticatedReadingLanguage } from "./public-content-reading-language";
import {
  resolveTranslatedContentViewModeLifecycle,
  translatedContentHasDistinctTranslation,
} from "./translated-content-view-mode";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readWeb(rel: string): string {
  return readFileSync(path.join(webRoot, rel), "utf8");
}

describe("Production Completion Pack 02G Task 07B — auth-aware content resolve", () => {
  it("A. derive reading language from readingLanguages[0] after auth-ready prefs", () => {
    assert.equal(deriveAuthenticatedReadingLanguage(["uk"]), "uk");
    assert.equal(deriveAuthenticatedReadingLanguage(["uk", "en"]), "uk");
    // Empty / missing → platform default, not interfaceLanguage.
    assert.equal(deriveAuthenticatedReadingLanguage([]), DEFAULT_PLATFORM_LANGUAGE);
    assert.equal(deriveAuthenticatedReadingLanguage(undefined), DEFAULT_PLATFORM_LANGUAGE);
    assert.equal(deriveAuthenticatedReadingLanguage(["  "]), DEFAULT_PLATFORM_LANGUAGE);
  });

  it("B. authenticated resolve path uses readingLanguages[0] language (wiring)", () => {
    const hook = readWeb("src/features/language/use-public-content-reading-context.ts");
    const derive = readWeb("src/features/language/public-content-reading-language.ts");
    assert.match(hook, /useClientAuthStatus/);
    assert.match(hook, /getMyPreferences/);
    assert.match(hook, /deriveAuthenticatedReadingLanguage/);
    assert.match(hook, /resolvePublicContentReadingFromProbe/);
    assert.match(hook, /isAuthenticationRequiredError/);
    assert.match(derive, /readingLanguages/);
    assert.doesNotMatch(derive, /interfaceLanguage\s*[:=]|experiencePreferences\.interfaceLanguage/);
    assert.doesNotMatch(hook, /experiencePreferences\.interfaceLanguage|interfaceLanguage\s*[:=]/);
    assert.match(hook, /ready:\s*false/);
    assert.match(hook, /authStatus === "pending"/);
    // Prefs probe runs even when auth snapshot is unauthenticated; 401 settles guest.
    assert.match(hook, /unauthorized/);
    assert.doesNotMatch(hook, /setInterval|while\s*\(/);
  });

  it("C. effective reading language change re-resolves without interfaceLanguage coupling", () => {
    const hook = readWeb("src/features/language/use-public-content-reading-context.ts");
    assert.match(hook, /MEMBER_PREFERENCES_CHANGED_EVENT/);
    assert.match(hook, /preferencesEpoch/);

    const prefsApi = readWeb("src/features/preferences/preferences-api.ts");
    assert.match(prefsApi, /MEMBER_PREFERENCES_CHANGED_EVENT/);
    assert.match(prefsApi, /dispatchEvent/);

    for (const surface of [
      "src/features/public-initiative-experience/components/PublicExperienceHero.tsx",
      "src/features/language/components/PublicTranslatedFields.tsx",
      "src/features/public-civic-archive/components/CivicArchiveCardTranslatedText.tsx",
    ]) {
      const src = readWeb(surface);
      assert.match(src, /usePublicContentReadingContext/);
      assert.match(src, /readingContext\.readingLanguage/);
      assert.match(src, /readingContext\.ready/);
      assert.doesNotMatch(src, /interfaceLanguage/);
      // Must not permanently stick on initial en without auth readiness.
      assert.doesNotMatch(src, /setReadingLanguage\("en"\)/);
    }
  });

  it("D. guest path settles once with platform default / no auth retry loop", () => {
    const hook = readWeb("src/features/language/use-public-content-reading-context.ts");
    const probe = readWeb("src/features/language/public-content-reading-probe.ts");
    assert.match(probe, /GUEST_FIELDS|unauthorized/);
    assert.match(probe, /translationPreference:\s*"none"/);
    assert.match(probe, /readingLanguage:\s*DEFAULT_PLATFORM_LANGUAGE/);
    assert.match(probe, /isAuthenticated:\s*false/);
    assert.match(hook, /isAuthenticationRequiredError/);
    assert.doesNotMatch(hook, /setInterval|while\s*\(/);
  });

  it("E. async translation display still auto-selects translation", () => {
    const before = resolveTranslatedContentViewModeLifecycle({
      hasDistinctTranslation: false,
      previouslyHadDistinctTranslation: false,
      currentMode: "original",
      userPrefersOriginal: false,
    });
    const after = resolveTranslatedContentViewModeLifecycle({
      hasDistinctTranslation: true,
      previouslyHadDistinctTranslation: before.previouslyHadDistinctTranslation,
      currentMode: before.mode,
      userPrefersOriginal: before.userPrefersOriginal,
    });
    assert.equal(after.mode, "translation");
    assert.equal(
      translatedContentHasDistinctTranslation({
        content: "Українська назва",
        originalContent: "English title",
        canViewOriginal: true,
      }),
      true,
    );
  });

  it("F. View Original remains respected after translation appears", () => {
    let state = resolveTranslatedContentViewModeLifecycle({
      hasDistinctTranslation: true,
      previouslyHadDistinctTranslation: false,
      currentMode: "original",
      userPrefersOriginal: false,
    });
    assert.equal(state.mode, "translation");

    state = {
      mode: "original",
      previouslyHadDistinctTranslation: true,
      userPrefersOriginal: true,
    };

    const rerender = resolveTranslatedContentViewModeLifecycle({
      hasDistinctTranslation: true,
      previouslyHadDistinctTranslation: state.previouslyHadDistinctTranslation,
      currentMode: state.mode,
      userPrefersOriginal: state.userPrefersOriginal,
    });
    assert.equal(rerender.mode, "original");
    assert.equal(rerender.userPrefersOriginal, true);
  });

  it("reuses shared client auth status (no second auth system)", () => {
    const hook = readWeb("src/features/language/use-public-content-reading-context.ts");
    assert.match(hook, /from "\.\.\/auth\/use-client-auth-status"/);
    assert.doesNotMatch(hook, /localStorage|hasStoredAccessToken|getItem\(["']token/);
  });
});
