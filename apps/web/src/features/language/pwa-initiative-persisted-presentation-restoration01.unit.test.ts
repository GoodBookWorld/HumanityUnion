/**
 * Version 5.0 — Persisted Presentation Restoration 01
 * Initiative canary: rendered-consumer boundary (hero / overview).
 *
 * Asserts final presentation values reach the DOM consumer, not only owner
 * or resolve helper return values.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  isDistinctInitiativePresentationSeed,
  selectBrowserNativeInitiativePresentation,
  selectHuPersistedInitiativeLocaleInterim,
  selectOrdinaryInitiativePresentationForOwnerPhase,
} from "../public-initiative-experience/initiative-ordinary-presentation-selection.js";
import {
  mergeInitiativePublicPresentationUpdate,
  selectInitiativePublicPresentation,
} from "../public-initiative-experience/initiative-public-presentation.js";
import {
  InitiativeOverviewDescriptionDom,
  InitiativePieHeroPresentationDom,
} from "../public-initiative-experience/initiative-presentation-dom.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const featuresRoot = path.resolve(here, "..");

function readFeatures(rel: string): string {
  return readFileSync(path.join(featuresRoot, rel), "utf8");
}

const EN_TITLE = "The Mind-Safe Alliance";
const EN_DESCRIPTION = "EN_INITIATIVE_DESCRIPTION_SENTINEL";
const UK_TITLE = "Альянс безпечного мислення";
const UK_DESCRIPTION = "UK_INITIATIVE_DESCRIPTION_SENTINEL";
const AR_TITLE = "تحالف العقل الآمن";
const AR_DESCRIPTION = "AR_INITIATIVE_DESCRIPTION_SENTINEL";

const canonical = { title: EN_TITLE, description: EN_DESCRIPTION };
const ukSeed = { title: UK_TITLE, description: UK_DESCRIPTION };

function renderHero(presentation: { title: string; description: string }): string {
  return renderToStaticMarkup(
    createElement(InitiativePieHeroPresentationDom, { presentation }),
  );
}

function renderOverview(description: string): string {
  return renderToStaticMarkup(
    createElement(InitiativeOverviewDescriptionDom, {
      label: "Full description",
      description,
    }),
  );
}

describe("Persisted Presentation Restoration 01 — Initiative rendered consumer", () => {
  it("A. browser mode renders canonical English title/description in hero/overview", () => {
    const presentation = selectOrdinaryInitiativePresentationForOwnerPhase({
      owner: "browser-native",
      ownershipReady: true,
      canonical,
      displayLanguage: "uk",
      initialPresentation: ukSeed,
      seedLocale: "uk",
    });
    assert.equal(presentation.presentationMode, "original");
    assert.equal(presentation.title, EN_TITLE);
    assert.equal(presentation.description, EN_DESCRIPTION);

    const hero = renderHero(presentation);
    assert.match(hero, /pie-hero__title/);
    assert.match(hero, new RegExp(EN_TITLE));
    assert.match(hero, new RegExp(EN_DESCRIPTION));
    assert.doesNotMatch(hero, new RegExp(UK_TITLE));
    assert.doesNotMatch(hero, new RegExp(UK_DESCRIPTION));

    const overview = renderOverview(presentation.description);
    assert.match(overview, new RegExp(EN_DESCRIPTION));
    assert.doesNotMatch(overview, new RegExp(UK_DESCRIPTION));
  });

  it("B. standalone + uk + CURRENT seed reaches final hero/overview presentation", () => {
    assert.equal(isDistinctInitiativePresentationSeed(canonical, ukSeed), true);

    const presentation = selectOrdinaryInitiativePresentationForOwnerPhase({
      owner: "hu-persisted",
      ownershipReady: true,
      canonical,
      displayLanguage: "uk",
      initialPresentation: ukSeed,
      seedLocale: "uk",
    });
    assert.equal(presentation.presentationMode, "translated");
    assert.equal(presentation.activeLanguage, "uk");
    assert.equal(presentation.title, UK_TITLE);
    assert.equal(presentation.description, UK_DESCRIPTION);

    const hero = renderHero(presentation);
    assert.match(hero, new RegExp(UK_TITLE));
    assert.match(hero, new RegExp(UK_DESCRIPTION));
    assert.doesNotMatch(hero, new RegExp(EN_TITLE));
    assert.doesNotMatch(hero, new RegExp(EN_DESCRIPTION));

    const overview = renderOverview(presentation.description);
    assert.match(overview, new RegExp(UK_DESCRIPTION));
    assert.doesNotMatch(overview, new RegExp(EN_DESCRIPTION));
  });

  it("C. ownership transition browser/not-ready → hu-persisted renders translated seed", () => {
    const beforeReady = selectOrdinaryInitiativePresentationForOwnerPhase({
      owner: "browser-native",
      ownershipReady: false,
      canonical,
      displayLanguage: "uk",
      initialPresentation: ukSeed,
      seedLocale: null,
    });
    assert.equal(beforeReady.title, EN_TITLE);
    assert.doesNotMatch(renderHero(beforeReady), new RegExp(UK_TITLE));

    const afterOwner = selectOrdinaryInitiativePresentationForOwnerPhase({
      owner: "hu-persisted",
      ownershipReady: true,
      canonical,
      displayLanguage: "uk",
      initialPresentation: ukSeed,
      seedLocale: "uk",
    });
    assert.equal(afterOwner.title, UK_TITLE);
    assert.equal(afterOwner.description, UK_DESCRIPTION);
    assert.match(renderHero(afterOwner), new RegExp(UK_TITLE));
    assert.match(renderOverview(afterOwner.description), new RegExp(UK_DESCRIPTION));
  });

  it("D. locale switch uk → ar replaces Ukrainian with Arabic CURRENT in hero DOM", () => {
    const uk = selectOrdinaryInitiativePresentationForOwnerPhase({
      owner: "hu-persisted",
      ownershipReady: true,
      canonical,
      displayLanguage: "uk",
      initialPresentation: ukSeed,
      seedLocale: "uk",
    });
    assert.match(renderHero(uk), new RegExp(UK_TITLE));

    const interimAr = selectHuPersistedInitiativeLocaleInterim({
      canonical,
      displayLanguage: "ar",
    });
    assert.equal(interimAr.activeLanguage, "ar");
    assert.equal(interimAr.title, EN_TITLE);
    assert.doesNotMatch(renderHero(interimAr), new RegExp(UK_TITLE));

    const arResolved = selectOrdinaryInitiativePresentationForOwnerPhase({
      owner: "hu-persisted",
      ownershipReady: true,
      canonical,
      displayLanguage: "ar",
      initialPresentation: ukSeed,
      seedLocale: "uk",
      resolved: {
        title: AR_TITLE,
        description: AR_DESCRIPTION,
        presentationMode: "translated",
        isStale: false,
        activeLanguage: "ar",
        originalLanguage: "en",
        originalTitle: EN_TITLE,
        originalDescription: EN_DESCRIPTION,
        isMachineTranslated: true,
        canViewOriginal: true,
        canViewTranslation: true,
      },
    });
    const merged = mergeInitiativePublicPresentationUpdate({
      previous: interimAr,
      next: arResolved,
    });
    assert.equal(merged.activeLanguage, "ar");
    assert.equal(merged.title, AR_TITLE);
    assert.equal(merged.description, AR_DESCRIPTION);

    const hero = renderHero(merged);
    assert.match(hero, new RegExp(AR_TITLE));
    assert.match(hero, new RegExp(AR_DESCRIPTION));
    assert.doesNotMatch(hero, new RegExp(UK_TITLE));
    assert.doesNotMatch(hero, new RegExp(UK_DESCRIPTION));
    assert.doesNotMatch(hero, new RegExp(EN_TITLE));
  });

  it("E. missing/stale/original resolve falls back to canonical in hero DOM", () => {
    const presentation = selectOrdinaryInitiativePresentationForOwnerPhase({
      owner: "hu-persisted",
      ownershipReady: true,
      canonical,
      displayLanguage: "uk",
      initialPresentation: undefined,
      seedLocale: "uk",
      resolved: {
        title: EN_TITLE,
        description: EN_DESCRIPTION,
        presentationMode: "original",
        isStale: true,
        activeLanguage: "uk",
        originalLanguage: "en",
        originalTitle: EN_TITLE,
        originalDescription: EN_DESCRIPTION,
        isMachineTranslated: false,
        canViewOriginal: false,
        canViewTranslation: false,
      },
    });
    assert.equal(presentation.presentationMode, "original");
    assert.equal(presentation.title, EN_TITLE);
    assert.equal(presentation.description, EN_DESCRIPTION);

    const hero = renderHero(presentation);
    assert.match(hero, new RegExp(EN_TITLE));
    assert.doesNotMatch(hero, new RegExp(UK_TITLE));
  });

  it("F. normal Web never receives persisted ordinary Initiative presentation", () => {
    const withSeed = selectBrowserNativeInitiativePresentation(canonical);
    assert.equal(withSeed.presentationMode, "original");
    assert.equal(withSeed.title, EN_TITLE);

    // Even when a distinct UK seed exists, browser-native phase ignores it.
    const ignoredSeed = selectOrdinaryInitiativePresentationForOwnerPhase({
      owner: "browser-native",
      ownershipReady: true,
      canonical,
      displayLanguage: "uk",
      initialPresentation: ukSeed,
      seedLocale: "uk",
      resolved: {
        title: UK_TITLE,
        description: UK_DESCRIPTION,
        presentationMode: "translated",
        isStale: false,
        activeLanguage: "uk",
        originalLanguage: "en",
        originalTitle: EN_TITLE,
        originalDescription: EN_DESCRIPTION,
        isMachineTranslated: true,
        canViewOriginal: true,
        canViewTranslation: true,
      },
    });
    assert.equal(ignoredSeed.title, EN_TITLE);
    assert.equal(ignoredSeed.description, EN_DESCRIPTION);
    assert.doesNotMatch(renderHero(ignoredSeed), new RegExp(UK_TITLE));

    const hook = readFeatures(
      "public-initiative-experience/use-initiative-public-presentation.ts",
    );
    assert.match(hook, /owner !== "hu-persisted"/);
    assert.match(hook, /selectBrowserNativeInitiativePresentation/);
    assert.match(hook, /initialPresentation/);
    assert.match(hook, /seedLocaleRef/);
    assert.match(hook, /resolveInitiativeDetailPresentation/);
    assert.doesNotMatch(hook, /generateContentTranslation/);
  });

  it("SSR seed for another locale is not kept after Preferred Reading switch", () => {
    // UK SSR seed must not paint when displayLanguage is ar.
    const presentation = selectOrdinaryInitiativePresentationForOwnerPhase({
      owner: "hu-persisted",
      ownershipReady: true,
      canonical,
      displayLanguage: "ar",
      initialPresentation: ukSeed,
      seedLocale: "uk",
    });
    assert.equal(presentation.presentationMode, "original");
    assert.equal(presentation.activeLanguage, "ar");
    assert.equal(presentation.title, EN_TITLE);
    assert.doesNotMatch(renderHero(presentation), new RegExp(UK_TITLE));
  });

  it("same-locale merge keeps translated presentation against transient canonical tick", () => {
    const translated = selectInitiativePublicPresentation({
      canonical,
      translated: ukSeed,
      presentationMode: "translated",
      activeLanguage: "uk",
      originalLanguage: "en",
      isMachineTranslated: true,
      canViewOriginal: true,
    });
    const transient = selectHuPersistedInitiativeLocaleInterim({
      canonical,
      displayLanguage: "uk",
    });
    const merged = mergeInitiativePublicPresentationUpdate({
      previous: translated,
      next: transient,
    });
    assert.equal(merged.title, UK_TITLE);
    assert.match(renderHero(merged), new RegExp(UK_TITLE));
  });
});
