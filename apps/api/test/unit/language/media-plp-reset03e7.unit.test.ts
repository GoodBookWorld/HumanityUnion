/**
 * Reset 03E.7 — Web/API live PLP payload truth (no live ops).
 * Proves client-canonical version skew must not defeat a matching PUBLISHED snapshot,
 * and that fixtures previously bypassed the real POST version gate.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  MEDIA_PLP_ENTITY_TYPE,
  MEDIA_PLP_EDITORIAL_ENTITY_ID,
  PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
} from "@hu/types";

import {
  asMediaPlpPresentationNode,
  buildCanonicalEditorialPresentation,
  fingerprintMediaPlpCanonicalVersion,
  publishMediaPlpEntity,
  resetMediaPlpInstrumentationForTests,
  resetPublishedLocalizationPersistenceForTests,
  resolveMediaPlpConsumerItem,
  setMediaPlpConsumptionEnabledForTests,
  setPublishedLocalizationPersistenceModeForTests,
} from "../../../src/modules/language/published-localized-presentation/index.js";
import {
  CIVIC_MEDIA_FAQ,
  CIVIC_MEDIA_OVERVIEW,
} from "../../../src/modules/civic-media-center/content/sections.js";

const liveEditorial = asMediaPlpPresentationNode(
  buildCanonicalEditorialPresentation({
    overview: CIVIC_MEDIA_OVERVIEW,
    faq: [...CIVIC_MEDIA_FAQ],
  }),
);

const liveVersion = fingerprintMediaPlpCanonicalVersion(liveEditorial);

/** Staging-shaped skew: Web-sent tree differs by trailing whitespace → different fingerprint. */
const skewedWebEditorial = asMediaPlpPresentationNode(
  buildCanonicalEditorialPresentation({
    overview: {
      ...CIVIC_MEDIA_OVERVIEW,
      summary: `${CIVIC_MEDIA_OVERVIEW.summary} `,
    },
    faq: [...CIVIC_MEDIA_FAQ],
  }),
);

const skewedVersion = fingerprintMediaPlpCanonicalVersion(skewedWebEditorial);

beforeEach(() => {
  resetPublishedLocalizationPersistenceForTests();
  resetMediaPlpInstrumentationForTests();
  setPublishedLocalizationPersistenceModeForTests("memory");
  setMediaPlpConsumptionEnabledForTests(true);
});

afterEach(() => {
  setMediaPlpConsumptionEnabledForTests(null);
  resetPublishedLocalizationPersistenceForTests();
  resetMediaPlpInstrumentationForTests();
});

describe("Reset 03E.7 — live Web/API PLP version gate", () => {
  it("client-canonical skew must not defeat matching PUBLISHED editorial (POST vs GET parity)", async () => {
    assert.notEqual(liveVersion, skewedVersion);

    // Simulate materializer publish against live seed version (GET diagnostic path).
    const published = await publishMediaPlpEntity({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
      locale: "uk",
      canonicalVersion: liveVersion,
      contentRevision: 1,
      canonicalPresentation: liveEditorial,
      includeDeterministicMachine: true,
    });
    assert.equal(published.ok, true);

    // Pre-03E.7 failure class: fingerprinting skewed Web tree → CANONICAL_VERSION_MISMATCH.
    // Post-repair: live_source version aligns with GET diagnostic → PUBLISHED_LOCALIZED.
    const resolved = await resolveMediaPlpConsumerItem({
      locale: "uk",
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
      canonicalPresentation: skewedWebEditorial,
    });

    assert.equal(resolved.mode, "PUBLISHED_LOCALIZED");
    assert.equal(resolved.versionSource, "live_source");
    assert.equal(resolved.canonicalVersion, liveVersion);
    assert.notEqual(resolved.reasonCode, "CANONICAL_VERSION_MISMATCH");

    const presentation = resolved.presentation as Record<string, unknown>;
    assert.match(String(presentation.overviewSummary), /^\[uk\] /);
    const faq0 = (presentation.faq as Array<Record<string, string>>)[0];
    assert.match(String(faq0?.question), /^\[uk\] /);
    assert.match(String(faq0?.answer), /^\[uk\] /);
    void PUBLISHED_LOCALIZATION_SCHEMA_VERSION;
  });

  it("documents why prior fixtures passed: they injected matching fingerprints / skipped POST gate", () => {
    // Fixture pattern (03E.5/03E.6): directly inject MediaPlpResolvedPresentation with
    // mode=PUBLISHED_LOCALIZED into CivicMediaCenterPageContent — never exercises
    // resolveMediaPlpConsumerItem fingerprinting of a skewed client tree.
    assert.notEqual(liveVersion, skewedVersion);
  });
});
