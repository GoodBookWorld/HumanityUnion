/**
 * Version 5.0 — Final Civic Media persisted presentation closure.
 * Verification + Analysis card rendered-consumer acceptance.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { applyMediaPlpFactCheckMaps } from "./apply-media-plp-editorial.js";
import { applyMediaPlpPropagandaMaps } from "./apply-media-plp-editorial.js";
import {
  selectCivicMediaFactCheckOrdinaryPresentation,
  selectCivicMediaPropagandaOrdinaryPresentation,
} from "./civic-media-hu-persisted-resource-presentation.js";
import {
  CivicMediaAnalysisCardPresentationDom,
  CivicMediaVerificationCardPresentationDom,
} from "./civic-media-resource-card-presentation-dom.js";
import type { MediaPlpResolvedPresentation } from "./presentation.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const featuresRoot = path.resolve(here, "../..");

function readFeatures(rel: string): string {
  return readFileSync(path.join(featuresRoot, rel), "utf8");
}

const EN_MISSION = "EN_FACT_CHECK_MISSION_SENTINEL";
const EN_COVERAGE = "Claims, Sources, Methods";
const UK_MISSION = "UK_FACT_CHECK_MISSION_SENTINEL";
const UK_COVERAGE = "Твердження, Джерела, Методи";
const AR_MISSION = "AR_FACT_CHECK_MISSION_SENTINEL";
const AR_COVERAGE = "ادعاءات، مصادر، أساليب";

const EN_FOCUS = "EN_PROPAGANDA_FOCUS_SENTINEL";
const EN_EXPLANATION = "EN_PROPAGANDA_EXPLANATION_SENTINEL";
const UK_FOCUS = "UK_PROPAGANDA_FOCUS_SENTINEL";
const UK_EXPLANATION = "UK_PROPAGANDA_EXPLANATION_SENTINEL";
const AR_FOCUS = "AR_PROPAGANDA_FOCUS_SENTINEL";
const AR_EXPLANATION = "AR_PROPAGANDA_EXPLANATION_SENTINEL";

const factResource = {
  id: "fact-check-1",
  mission: EN_MISSION,
  coverage: EN_COVERAGE,
};

const propagandaResource = {
  id: "propaganda-1",
  focus: EN_FOCUS,
  explanation: EN_EXPLANATION,
};

function localizedFactPlp(
  locale: string,
  mission: string,
  coverage: string,
): MediaPlpResolvedPresentation {
  return {
    mode: "PUBLISHED_LOCALIZED",
    presentation: { mission, coverage },
    entityType: "civic_media_fact_check",
    entityId: factResource.id,
    locale,
    canonicalVersion: "v1",
  };
}

function localizedPropagandaPlp(
  locale: string,
  focus: string,
  explanation: string,
): MediaPlpResolvedPresentation {
  return {
    mode: "PUBLISHED_LOCALIZED",
    presentation: { focus, explanation },
    entityType: "civic_media_propaganda",
    entityId: propagandaResource.id,
    locale,
    canonicalVersion: "v1",
  };
}

describe("Version 5.0 — Civic Media verification/analysis persisted presentation closure", () => {
  it("uk hu-persisted: verification body + chips and analysis badge + body render localized", () => {
    const factMaps = applyMediaPlpFactCheckMaps({
      resources: [factResource as never],
      factCheckById: {
        [factResource.id]: localizedFactPlp("uk", UK_MISSION, UK_COVERAGE),
      },
      requestedLocale: "uk",
    });
    const verification = selectCivicMediaFactCheckOrdinaryPresentation({
      owner: "hu-persisted",
      resource: factResource,
      missionsById: factMaps.missionsById,
      coverageById: factMaps.coverageById,
      resolvedMode: "PUBLISHED_LOCALIZED",
      plpBatchActive: true,
    });
    assert.equal(verification.mission, UK_MISSION);
    assert.deepEqual([...verification.chips], ["Твердження", "Джерела", "Методи"]);

    const verificationHtml = renderToStaticMarkup(
      createElement(CivicMediaVerificationCardPresentationDom, {
        mission: verification.mission,
        chips: verification.chips,
      }),
    );
    assert.match(verificationHtml, /civic-media-resource-card--verification/);
    assert.match(verificationHtml, /civic-media-resource-card__body/);
    assert.match(verificationHtml, /civic-media-resource-card__chips/);
    assert.match(verificationHtml, new RegExp(UK_MISSION));
    assert.match(verificationHtml, /Твердження/);
    assert.doesNotMatch(verificationHtml, new RegExp(EN_MISSION));

    const propagandaMaps = applyMediaPlpPropagandaMaps({
      resources: [propagandaResource as never],
      propagandaById: {
        [propagandaResource.id]: localizedPropagandaPlp("uk", UK_FOCUS, UK_EXPLANATION),
      },
      requestedLocale: "uk",
    });
    const analysis = selectCivicMediaPropagandaOrdinaryPresentation({
      owner: "hu-persisted",
      resource: propagandaResource,
      focusById: propagandaMaps.focusById,
      explanationsById: propagandaMaps.explanationsById,
      resolvedMode: "PUBLISHED_LOCALIZED",
      plpBatchActive: true,
    });
    assert.equal(analysis.focus, UK_FOCUS);
    assert.equal(analysis.explanation, UK_EXPLANATION);

    const analysisHtml = renderToStaticMarkup(
      createElement(CivicMediaAnalysisCardPresentationDom, {
        focus: analysis.focus,
        explanation: analysis.explanation,
      }),
    );
    assert.match(analysisHtml, /civic-media-resource-card--analysis/);
    assert.match(analysisHtml, /workspace-badge--neutral/);
    assert.match(analysisHtml, /civic-media-resource-card__body/);
    assert.match(analysisHtml, new RegExp(UK_FOCUS));
    assert.match(analysisHtml, new RegExp(UK_EXPLANATION));
    assert.doesNotMatch(analysisHtml, new RegExp(EN_FOCUS));
    assert.doesNotMatch(analysisHtml, new RegExp(EN_EXPLANATION));
  });

  it("ar hu-persisted: second prepared locale reaches verification and analysis consumers", () => {
    const factMaps = applyMediaPlpFactCheckMaps({
      resources: [factResource as never],
      factCheckById: {
        [factResource.id]: localizedFactPlp("ar", AR_MISSION, AR_COVERAGE),
      },
      requestedLocale: "ar",
    });
    const verification = selectCivicMediaFactCheckOrdinaryPresentation({
      owner: "hu-persisted",
      resource: factResource,
      missionsById: factMaps.missionsById,
      coverageById: factMaps.coverageById,
      resolvedMode: "PUBLISHED_LOCALIZED",
      plpBatchActive: true,
    });
    const verificationHtml = renderToStaticMarkup(
      createElement(CivicMediaVerificationCardPresentationDom, {
        mission: verification.mission,
        chips: verification.chips,
      }),
    );
    assert.match(verificationHtml, new RegExp(AR_MISSION));
    assert.match(verificationHtml, /ادعاءات/);
    assert.doesNotMatch(verificationHtml, new RegExp(UK_MISSION));

    const propagandaMaps = applyMediaPlpPropagandaMaps({
      resources: [propagandaResource as never],
      propagandaById: {
        [propagandaResource.id]: localizedPropagandaPlp("ar", AR_FOCUS, AR_EXPLANATION),
      },
      requestedLocale: "ar",
    });
    const analysis = selectCivicMediaPropagandaOrdinaryPresentation({
      owner: "hu-persisted",
      resource: propagandaResource,
      focusById: propagandaMaps.focusById,
      explanationsById: propagandaMaps.explanationsById,
      resolvedMode: "PUBLISHED_LOCALIZED",
      plpBatchActive: true,
    });
    const analysisHtml = renderToStaticMarkup(
      createElement(CivicMediaAnalysisCardPresentationDom, {
        focus: analysis.focus,
        explanation: analysis.explanation,
      }),
    );
    assert.match(analysisHtml, new RegExp(AR_FOCUS));
    assert.match(analysisHtml, new RegExp(AR_EXPLANATION));
    assert.doesNotMatch(analysisHtml, new RegExp(UK_FOCUS));
  });

  it("canonical fallback when persisted field unavailable still renders English body/chips/badge", () => {
    const verification = selectCivicMediaFactCheckOrdinaryPresentation({
      owner: "hu-persisted",
      resource: factResource,
      missionsById: { [factResource.id]: EN_MISSION },
      coverageById: { [factResource.id]: EN_COVERAGE },
      resolvedMode: "CANONICAL_FALLBACK",
      resolvedReasonCode: "NO_PUBLISHED_SNAPSHOT",
      plpBatchActive: true,
    });
    assert.equal(verification.mission, EN_MISSION);
    assert.deepEqual([...verification.chips], ["Claims", "Sources", "Methods"]);
    assert.equal(verification.plpMode, "CANONICAL_FALLBACK");

    const verificationHtml = renderToStaticMarkup(
      createElement(CivicMediaVerificationCardPresentationDom, {
        mission: verification.mission,
        chips: verification.chips,
      }),
    );
    assert.match(verificationHtml, new RegExp(EN_MISSION));
    assert.match(verificationHtml, /Claims/);

    const analysis = selectCivicMediaPropagandaOrdinaryPresentation({
      owner: "hu-persisted",
      resource: propagandaResource,
      resolvedMode: "CANONICAL_FALLBACK",
      plpBatchActive: true,
    });
    assert.equal(analysis.focus, EN_FOCUS);
    assert.equal(analysis.explanation, EN_EXPLANATION);
    const analysisHtml = renderToStaticMarkup(
      createElement(CivicMediaAnalysisCardPresentationDom, {
        focus: analysis.focus,
        explanation: analysis.explanation,
      }),
    );
    assert.match(analysisHtml, new RegExp(EN_FOCUS));
    assert.match(analysisHtml, new RegExp(EN_EXPLANATION));
  });

  it("browser-native ignores PLP maps and keeps canonical verification/analysis DOM", () => {
    const verification = selectCivicMediaFactCheckOrdinaryPresentation({
      owner: "browser-native",
      resource: factResource,
      missionsById: { [factResource.id]: UK_MISSION },
      coverageById: { [factResource.id]: UK_COVERAGE },
      resolvedMode: "PUBLISHED_LOCALIZED",
      plpBatchActive: true,
    });
    assert.equal(verification.mission, EN_MISSION);
    assert.deepEqual([...verification.chips], ["Claims", "Sources", "Methods"]);
    assert.equal(verification.plpMode, "CANONICAL_FALLBACK");
    assert.doesNotMatch(
      renderToStaticMarkup(
        createElement(CivicMediaVerificationCardPresentationDom, {
          mission: verification.mission,
          chips: verification.chips,
        }),
      ),
      new RegExp(UK_MISSION),
    );

    const analysis = selectCivicMediaPropagandaOrdinaryPresentation({
      owner: "browser-native",
      resource: propagandaResource,
      focusById: { [propagandaResource.id]: UK_FOCUS },
      explanationsById: { [propagandaResource.id]: UK_EXPLANATION },
      resolvedMode: "PUBLISHED_LOCALIZED",
      plpBatchActive: true,
    });
    assert.equal(analysis.focus, EN_FOCUS);
    assert.equal(analysis.explanation, EN_EXPLANATION);
    assert.doesNotMatch(
      renderToStaticMarkup(
        createElement(CivicMediaAnalysisCardPresentationDom, {
          focus: analysis.focus,
          explanation: analysis.explanation,
        }),
      ),
      new RegExp(UK_FOCUS),
    );
  });

  it("page wires fact-check/propaganda maps under hu-persisted; public_news path unchanged", () => {
    const page = readFeatures(
      "civic-media-center/components/CivicMediaCenterPageContent.tsx",
    );
    assert.match(page, /selectCivicMediaFactCheckOrdinaryPresentation/);
    assert.match(page, /selectCivicMediaPropagandaOrdinaryPresentation/);
    assert.match(page, /factCheckMaps\?\.missionsById/);
    assert.match(page, /propagandaMaps\?\.focusById/);
    assert.doesNotMatch(page, /void factCheckMaps/);
    assert.doesNotMatch(page, /void propagandaMaps/);
    assert.match(page, /civicMediaOwner === "hu-persisted"/);
    assert.doesNotMatch(page, /generateContentTranslation/);

    // Public News stays on dedicated section path (source-original ordinary reading).
    assert.match(page, /PublicNewsSection/);
    assert.match(page, /disableOnDemandTranslation/);

    const newsHook = readFeatures("public-news/use-localized-public-news-card.ts");
    assert.match(newsHook, /plpPresentation: null/);
    assert.match(newsHook, /never HU-persisted|Pack 01/i);
  });
});
