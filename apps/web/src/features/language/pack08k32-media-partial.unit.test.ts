/**
 * Pack 08K.3.2 — web-side PARTIAL + on-demand repair contract.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION } from "@hu/types";

import { localizePublicPresentation } from "./public-localized-presentation.js";
import { shouldAttemptOnDemandContentTranslation } from "./public-translation-presentation-lifecycle.js";
import { isPartialTranslatedFieldBag } from "./resolve-localized-presentation.js";

describe("Pack 08K.3.2 web PARTIAL contract", () => {
  it("PARTIAL coverage when some AUTO nodes missing", () => {
    const localized = localizePublicPresentation({
      identity: {
        sourceKind: "public_news",
        sourceRecordId: "news-partial-1",
        presentationSchemaVersion: PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
      },
      sourceLanguage: "en",
      targetLanguage: "uk",
      presentation: { title: "T", summary: "S", category: "C" },
      translations: { title: "[uk] T", category: "[uk] C" },
    });
    assert.equal(localized.coverage.status, "PARTIAL");
    assert.deepEqual([...localized.coverage.canonicalFallbackPaths], ["summary"]);
  });

  it("PARTIAL schedules on-demand generate", () => {
    assert.equal(
      shouldAttemptOnDemandContentTranslation({
        ready: true,
        translationPreference: "preferred",
        readingLanguage: "uk",
        resolvePresentationMode: "preferred_translation",
        originalLanguage: "en",
        isPartial: true,
      }),
      true,
    );
    assert.equal(
      isPartialTranslatedFieldBag({
        canonicalFields: { title: "T", summary: "S" },
        translatedFields: { title: "t" },
      }),
      true,
    );
  });
});
