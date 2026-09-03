/**
 * Pack 02G Task 07B — public content reading context auth-gate hotfix.
 *
 * Auth-status "unauthenticated" alone must not settle guest language=en;
 * definitive guest requires preferences 401. Prefer readingLanguages[0] only.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

import { DEFAULT_PLATFORM_LANGUAGE } from "@hu/types";
import type { MemberPreferences } from "@hu/types";

import { deriveAuthenticatedReadingLanguage } from "./public-content-reading-language";
import { resolvePublicContentReadingFromProbe } from "./public-content-reading-probe";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readWeb(rel: string): string {
  return readFileSync(path.join(webRoot, rel), "utf8");
}

function samplePreferences(input: {
  readingLanguages: string[];
  translationPreference: string;
  interfaceLanguage?: string;
}): MemberPreferences {
  return {
    memberId: "member-pack02g-reading-context",
    experiencePreferences: {
      interfaceLanguage: input.interfaceLanguage ?? "en",
      readingLanguages: input.readingLanguages,
      writingLanguages: ["en"],
      translationPreference: input.translationPreference,
      timeZone: "UTC",
      dateFormat: "iso",
      timeFormat: "24h",
      expertiseAreas: [],
      skills: [],
    },
    participationPreferences: {
      interestedTopics: [],
      preferredInitiativeTypes: [],
      volunteerInterests: [],
      preferredCountryIds: [],
      preferredRegions: [],
      preferredCityCommunityIds: [],
      participationAvailability: "",
      preferredActivityAreas: [],
      preferredGeographicScopes: [],
      initiativeParticipationInterests: [],
      contributionWillingness: [],
    },
    communicationPreferences: {
      announcementPreference: "",
      invitationPreference: "",
      digestFrequency: "",
      messageCategories: [],
      notificationFrequency: "platform_only",
      emailNotificationsEnabled: false,
      interestMatchNotificationsEnabled: false,
      disabledNotificationCategories: [],
    },
    accessibilityPreferences: {
      fontSize: "medium",
      highContrast: false,
      reducedMotion: false,
      screenReaderSupport: false,
      simplifiedExplanations: false,
      contentDensity: "comfortable",
    },
    workspacePreferences: {
      defaultStartPage: "",
      navigationStyle: "",
      expandedSections: [],
      cardDensity: "",
    },
    visibilityPreferences: {
      profileVisibility: "members_only",
      skillsVisibility: "members_only",
      interestsVisibility: "members_only",
      participationVisibility: "members_only",
    },
  };
}

describe("Production Completion Pack 02G Task 07B — reading context auth-gate", () => {
  it("A. auth snapshot unauthenticated + prefs success uk/preferred → uk context", () => {
    const resolved = resolvePublicContentReadingFromProbe({
      authStatus: "unauthenticated",
      outcome: {
        kind: "success",
        preferences: samplePreferences({
          readingLanguages: ["uk"],
          translationPreference: "preferred",
          interfaceLanguage: "en",
        }),
      },
    });
    assert.equal(resolved.ready, true);
    assert.equal(resolved.readingLanguage, "uk");
    assert.equal(resolved.translationPreference, "preferred");
    assert.equal(resolved.isAuthenticated, true);
  });

  it("B. definitive preferences 401 → guest follows interface locale + preferred (08I.7)", () => {
    const resolvedDefault = resolvePublicContentReadingFromProbe({
      authStatus: "unauthenticated",
      outcome: { kind: "unauthorized" },
    });
    assert.equal(resolvedDefault.ready, true);
    assert.equal(resolvedDefault.readingLanguage, DEFAULT_PLATFORM_LANGUAGE);
    assert.equal(resolvedDefault.translationPreference, "preferred");
    assert.equal(resolvedDefault.isAuthenticated, false);

    const resolvedUk = resolvePublicContentReadingFromProbe({
      authStatus: "unauthenticated",
      outcome: { kind: "unauthorized" },
      interfaceLocale: "uk",
    });
    assert.equal(resolvedUk.readingLanguage, "uk");
    assert.equal(resolvedUk.translationPreference, "preferred");

    const resolvedZhHant = resolvePublicContentReadingFromProbe({
      authStatus: "unauthenticated",
      outcome: { kind: "unauthorized" },
      interfaceLocale: "zh-Hant",
    });
    assert.equal(resolvedZhHant.readingLanguage, "zh-Hant");

    // zh-TW alias normalizes to zh-Hant for reading language.
    const resolvedZhTw = resolvePublicContentReadingFromProbe({
      authStatus: "unauthenticated",
      outcome: { kind: "unauthorized" },
      interfaceLocale: "zh-TW",
    });
    assert.equal(resolvedZhTw.readingLanguage, "zh-Hant");

    const resolvedAr = resolvePublicContentReadingFromProbe({
      authStatus: "unauthenticated",
      outcome: { kind: "unauthorized" },
      interfaceLocale: "ar",
    });
    assert.equal(resolvedAr.readingLanguage, "ar");
    assert.equal(resolvedAr.translationPreference, "preferred");
  });

  it("C. auth pending wiring keeps ready=false before prefs probe", () => {
    const hook = readWeb("src/features/language/use-public-content-reading-context.ts");
    assert.match(hook, /authStatus === "pending"/);
    assert.match(hook, /ready:\s*false/);
    assert.match(hook, /Do not prematurely settle|do not prematurely/i);
    // Must not treat unauthenticated alone as guest without prefs probe.
    assert.doesNotMatch(
      hook,
      /if \(authStatus === "unauthenticated"\) \{\s*setContext\(\{\s*\.\.\.GUEST_CONTEXT/,
    );
    assert.match(hook, /getMyPreferences/);
    assert.match(hook, /isAuthenticationRequiredError/);
  });

  it("D. authenticated + prefs success uk/preferred remains correct", () => {
    const resolved = resolvePublicContentReadingFromProbe({
      authStatus: "authenticated",
      outcome: {
        kind: "success",
        preferences: samplePreferences({
          readingLanguages: ["uk"],
          translationPreference: "preferred",
        }),
      },
    });
    assert.equal(resolved.ready, true);
    assert.equal(resolved.readingLanguage, "uk");
    assert.equal(resolved.translationPreference, "preferred");
    assert.equal(resolved.isAuthenticated, true);
    assert.equal(deriveAuthenticatedReadingLanguage(["uk"]), "uk");
  });

  it("D2. authenticated explicit none stays none (interface locale does not override)", () => {
    const resolved = resolvePublicContentReadingFromProbe({
      authStatus: "authenticated",
      outcome: {
        kind: "success",
        preferences: samplePreferences({
          readingLanguages: ["uk"],
          translationPreference: "none",
          interfaceLanguage: "uk",
        }),
      },
      interfaceLocale: "uk",
    });
    assert.equal(resolved.ready, true);
    assert.equal(resolved.isAuthenticated, true);
    assert.equal(resolved.readingLanguage, "uk");
    assert.equal(resolved.translationPreference, "none");
  });

  it("E. MEMBER_PREFERENCES_CHANGED_EVENT still refreshes prefs", () => {
    const hook = readWeb("src/features/language/use-public-content-reading-context.ts");
    assert.match(hook, /MEMBER_PREFERENCES_CHANGED_EVENT/);
    assert.match(hook, /preferencesEpoch/);
    assert.match(hook, /getMyPreferences/);
    const prefsApi = readWeb("src/features/preferences/preferences-api.ts");
    assert.match(prefsApi, /dispatchEvent\(new CustomEvent\(MEMBER_PREFERENCES_CHANGED_EVENT\)\)/);
  });

  it("F. authenticated interface language does not substitute readingLanguages[0]", () => {
    const resolved = resolvePublicContentReadingFromProbe({
      authStatus: "authenticated",
      outcome: {
        kind: "success",
        preferences: samplePreferences({
          readingLanguages: ["uk"],
          translationPreference: "preferred",
          interfaceLanguage: "fr",
        }),
      },
      interfaceLocale: "fr",
    });
    assert.equal(resolved.readingLanguage, "uk");
    assert.notEqual(resolved.readingLanguage, "fr");

    const derive = readWeb("src/features/language/public-content-reading-language.ts");
    assert.doesNotMatch(derive, /interfaceLanguage\s*[:=]|experiencePreferences\.interfaceLanguage/);

    // Pack 08I.7 — guests may follow UI locale; authenticated path must still use readingLanguages[0].
    const hook = readWeb("src/features/language/use-public-content-reading-context.ts");
    assert.match(hook, /interfaceLocale/);
    assert.match(hook, /readingLanguages|deriveAuthenticatedReadingLanguage|getMyPreferences/);
  });

  it("non-401 prefs failure does not force guest when auth snapshot is authenticated", () => {
    const resolved = resolvePublicContentReadingFromProbe({
      authStatus: "authenticated",
      outcome: { kind: "unavailable" },
    });
    assert.equal(resolved.ready, true);
    assert.equal(resolved.isAuthenticated, true);
    assert.equal(resolved.readingLanguage, DEFAULT_PLATFORM_LANGUAGE);
    assert.equal(resolved.translationPreference, "none");
  });

  it("no retry loop primitives in hook", () => {
    const hook = readWeb("src/features/language/use-public-content-reading-context.ts");
    assert.doesNotMatch(hook, /setInterval|while\s*\(/);
  });
});
