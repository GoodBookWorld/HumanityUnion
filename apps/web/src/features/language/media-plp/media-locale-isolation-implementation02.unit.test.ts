/**
 * Media Locale Isolation — Implementation 02
 * Editorial / fact-check / propaganda PLP apply must reject wrong-locale presentations.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CivicMediaCenterPublic } from "@hu/types";
import { MEDIA_PLP_ENTITY_TYPE } from "@hu/types";

import {
  applyMediaPlpFactCheckMaps,
  applyMediaPlpPresentationsToEditorial,
  applyMediaPlpPropagandaMaps,
} from "./apply-media-plp-editorial.js";
import type { MediaPlpResolvedPresentation } from "./presentation.js";

function sampleMedia(): CivicMediaCenterPublic {
  return {
    overview: {
      title: "Overview title",
      summary: "Overview summary",
      points: [{ id: "p1", heading: "H1", body: "B1" }],
    },
    selectionPrinciples: [
      {
        id: "editorial-transparency",
        title: "Independence",
        description: "Principle description",
        whyItMatters: "Why matters",
      },
    ],
    trustedMediaCategories: [],
    trustedMedia: [
      {
        id: "reuters",
        name: "Reuters",
        logoLabel: "R",
        categoryId: "wire",
        explanation: "Canonical explanation",
        websiteUrl: "https://example.com",
        sortOrder: 1,
      },
    ],
    factChecking: [
      {
        id: "fact-a",
        name: "Fact A",
        logoLabel: "F",
        mission: "Canonical mission",
        coverage: "Canonical coverage",
        websiteUrl: "https://example.com/fact",
        sortOrder: 1,
      },
    ],
    propagandaAnalysis: [
      {
        id: "prop-a",
        name: "Prop A",
        logoLabel: "P",
        focus: "Canonical focus",
        explanation: "Canonical prop explanation",
        websiteUrl: "https://example.com/prop",
        sortOrder: 1,
      },
    ],
    faq: [{ id: "faq-1", question: "Q1?", answer: "A1" }],
    initiativeFlow: {
      title: "Flow",
      summary: "Summary",
      stages: ["S1"],
    },
  } as unknown as CivicMediaCenterPublic;
}

function ukEditorialPresentation(): MediaPlpResolvedPresentation {
  return {
    mode: "PUBLISHED_LOCALIZED",
    presentation: {
      overviewTitle: "UK Overview",
      overviewSummary: "UK Summary",
      overviewPoints: [{ id: "p1", heading: "UK H1", body: "UK B1" }],
      faq: [{ id: "faq-1", question: "UK Q1?", answer: "UK A1" }],
    },
    entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
    entityId: "civic-media-center",
    locale: "uk",
    canonicalVersion: "v1",
  };
}

describe("Implementation 02 — Media editorial PLP locale isolation", () => {
  it("A. uk PUBLISHED_LOCALIZED under requested ar keeps canonical editorial fields", () => {
    const media = sampleMedia();
    const applied = applyMediaPlpPresentationsToEditorial({
      media,
      trustedById: {
        reuters: {
          mode: "PUBLISHED_LOCALIZED",
          presentation: { explanation: "Українське пояснення" },
          entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
          entityId: "reuters",
          locale: "uk",
          canonicalVersion: "v1",
        },
      },
      principlesById: {
        "editorial-transparency": {
          mode: "PUBLISHED_LOCALIZED",
          presentation: {
            title: "Український принцип",
            description: "Український опис",
            whyItMatters: "Чому важливо",
          },
          entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
          entityId: "editorial-transparency",
          locale: "uk",
          canonicalVersion: "v1",
        },
      },
      editorialPresentation: ukEditorialPresentation(),
      requestedLocale: "ar",
    });

    assert.equal(applied.overview.title, "Overview title");
    assert.equal(applied.overview.summary, "Overview summary");
    assert.equal(applied.faq[0]?.question, "Q1?");
    assert.equal(applied.selectionPrinciples[0]?.title, "Independence");
    assert.equal(applied.trustedExplanationsById.reuters, "Canonical explanation");
    assert.notEqual(applied.overview.title, "UK Overview");
  });

  it("B. uk fact-check + propaganda under requested ar keep canonical fields", () => {
    const media = sampleMedia();
    const fact = applyMediaPlpFactCheckMaps({
      resources: media.factChecking,
      factCheckById: {
        "fact-a": {
          mode: "PUBLISHED_LOCALIZED",
          presentation: {
            mission: "Українська місія",
            coverage: "Українське охоплення",
          },
          entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_FACT_CHECK,
          entityId: "fact-a",
          locale: "uk",
          canonicalVersion: "v1",
        },
      },
      requestedLocale: "ar",
    });
    assert.equal(fact.missionsById["fact-a"], "Canonical mission");
    assert.equal(fact.coverageById["fact-a"], "Canonical coverage");

    const propaganda = applyMediaPlpPropagandaMaps({
      resources: media.propagandaAnalysis,
      propagandaById: {
        "prop-a": {
          mode: "PUBLISHED_LOCALIZED",
          presentation: {
            focus: "Український фокус",
            explanation: "Українське пояснення пропаганди",
          },
          entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PROPAGANDA,
          entityId: "prop-a",
          locale: "uk",
          canonicalVersion: "v1",
        },
      },
      requestedLocale: "ar",
    });
    assert.equal(propaganda.focusById["prop-a"], "Canonical focus");
    assert.equal(
      propaganda.explanationsById["prop-a"],
      "Canonical prop explanation",
    );
  });

  it("C. matching future locale de applies PUBLISHED_LOCALIZED fields", () => {
    const media = sampleMedia();
    const applied = applyMediaPlpPresentationsToEditorial({
      media,
      trustedById: {
        reuters: {
          mode: "PUBLISHED_LOCALIZED",
          presentation: { explanation: "Deutsche Erklärung" },
          entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
          entityId: "reuters",
          locale: "de",
          canonicalVersion: "v1",
        },
      },
      principlesById: {
        "editorial-transparency": {
          mode: "PUBLISHED_LOCALIZED",
          presentation: {
            title: "Deutsche Unabhängigkeit",
            description: "Deutsche Beschreibung",
            whyItMatters: "Warum wichtig",
          },
          entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
          entityId: "editorial-transparency",
          locale: "de",
          canonicalVersion: "v1",
        },
      },
      editorialPresentation: {
        mode: "PUBLISHED_LOCALIZED",
        presentation: {
          overviewTitle: "Deutsche Übersicht",
          overviewSummary: "Deutsche Zusammenfassung",
          overviewPoints: [{ id: "p1", heading: "DE H1", body: "DE B1" }],
          faq: [{ id: "faq-1", question: "DE Q1?", answer: "DE A1" }],
        },
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
        entityId: "civic-media-center",
        locale: "de",
        canonicalVersion: "v1",
      },
      requestedLocale: "de",
    });

    assert.equal(applied.overview.title, "Deutsche Übersicht");
    assert.equal(applied.faq[0]?.question, "DE Q1?");
    assert.equal(applied.selectionPrinciples[0]?.title, "Deutsche Unabhängigkeit");
    assert.equal(applied.trustedExplanationsById.reuters, "Deutsche Erklärung");

    const fact = applyMediaPlpFactCheckMaps({
      resources: media.factChecking,
      factCheckById: {
        "fact-a": {
          mode: "PUBLISHED_LOCALIZED",
          presentation: { mission: "DE Mission", coverage: "DE Coverage" },
          entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_FACT_CHECK,
          entityId: "fact-a",
          locale: "de",
          canonicalVersion: "v1",
        },
      },
      requestedLocale: "de",
    });
    assert.equal(fact.missionsById["fact-a"], "DE Mission");
  });
});
