/**
 * Pack 08K — assertPublicLocalizationBoundary unit tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
  type PublicLocalizedPresentation,
} from "@hu/types";

import { assertPublicLocalizationBoundary } from "./assert-public-localization-boundary.js";
import { localizePublicPresentation } from "./public-localized-presentation.js";

function completePresentation(): PublicLocalizedPresentation {
  return localizePublicPresentation({
    identity: {
      sourceKind: "blog_post",
      sourceRecordId: "assert-boundary-01",
      presentationSchemaVersion: PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
    },
    sourceLanguage: "en",
    targetLanguage: "uk",
    presentation: { title: "Canonical title" },
    translations: { title: "[uk] Canonical title" },
  });
}

describe("Pack 08K — assertPublicLocalizationBoundary", () => {
  it("throws when a future component fails to pass presentation", () => {
    assert.throws(
      () =>
        assertPublicLocalizationBoundary({
          surfaceId: "future-unwired-component",
          presentation: null,
        }),
      /PUBLIC_LOCALIZATION_BOUNDARY.*missing presentation.*future-unwired-component/,
    );
  });

  it("throws when requireComplete and coverage is FALLBACK_CANONICAL", () => {
    const incomplete = localizePublicPresentation({
      identity: {
        sourceKind: "petition",
        sourceRecordId: "assert-boundary-incomplete",
        presentationSchemaVersion: PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
      },
      sourceLanguage: "en",
      targetLanguage: "uk",
      presentation: { title: "Petition title", body: "Petition body" },
      translations: { title: "[uk] Petition title" },
    });
    assert.equal(incomplete.coverage.status, "FALLBACK_CANONICAL");
    assert.throws(
      () =>
        assertPublicLocalizationBoundary({
          surfaceId: "petition-surface",
          presentation: incomplete,
          requireComplete: true,
        }),
      /requireComplete.*FALLBACK_CANONICAL/,
    );
  });

  it("allows COMPLETE presentation when requireComplete", () => {
    assert.doesNotThrow(() =>
      assertPublicLocalizationBoundary({
        surfaceId: "blog-surface",
        presentation: completePresentation(),
        requireComplete: true,
      }),
    );
  });
});
