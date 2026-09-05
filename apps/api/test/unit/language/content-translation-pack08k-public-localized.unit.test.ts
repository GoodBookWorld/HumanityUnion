/**
 * Pack 08K — PublicLocalizedPresentation engine regressions.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
  isPublicProtectedValue,
  protectedIdentity,
  protectedTechnical,
} from "@hu/types";

import {
  applyPublicPresentationTranslations,
  collectAutoTranslatableNodes,
  ensureLocalizedPublicPresentation,
  fingerprintPublicPresentation,
  localizePublicPresentation,
} from "../../../src/modules/language/public-localized-presentation.js";
import { resolveTranslatedDisplay } from "../../../src/modules/language/resolve-translated-display.js";

describe("Pack 08K — PublicLocalizedPresentation engine", () => {
  it("new semantic properties localize COMPLETE; protected wrappers preserved byte-identical", () => {
    const id = protectedTechnical("x");
    const creatorName = protectedIdentity("Alice");
    const tree = {
      id,
      creatorName,
      title: "Canonical title",
      completelyNewSemanticProperty: "Canonical new prose",
      nested: { anotherNeverSeenBeforeField: "Canonical nested prose" },
    };

    const auto = collectAutoTranslatableNodes(tree);
    assert.deepEqual(
      auto.map((n) => n.path).sort(),
      [
        "completelyNewSemanticProperty",
        "nested.anotherNeverSeenBeforeField",
        "title",
      ].sort(),
    );

    const translations = {
      title: "Localized title",
      completelyNewSemanticProperty: "Localized new prose",
      "nested.anotherNeverSeenBeforeField": "Localized nested prose",
    };

    const localized = localizePublicPresentation({
      identity: {
        sourceKind: "initiative",
        sourceRecordId: "init-08k",
        presentationSchemaVersion: PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
      },
      sourceLanguage: "en",
      targetLanguage: "uk",
      presentation: tree,
      translations,
      isMachineTranslated: true,
    });

    assert.equal(localized.coverage.status, "COMPLETE");
    assert.equal(localized.coverage.canonicalFallbackNodeCount, 0);
    assert.equal(localized.coverage.staleNodeCount, 0);
    assert.equal(localized.coverage.semanticNodeCount, 3);
    assert.equal(localized.coverage.localizedNodeCount, 3);
    assert.equal(localized.coverage.protectedNodeCount, 2);

    const presentation = localized.presentation as typeof tree;
    assert.equal(presentation.title, "Localized title");
    assert.equal(presentation.completelyNewSemanticProperty, "Localized new prose");
    assert.equal(
      (presentation.nested as { anotherNeverSeenBeforeField: string })
        .anotherNeverSeenBeforeField,
      "Localized nested prose",
    );

    // Protected wrappers preserved byte-identical (same object references).
    assert.equal(presentation.id, id);
    assert.equal(presentation.creatorName, creatorName);
    assert.ok(isPublicProtectedValue(presentation.id));
    assert.ok(isPublicProtectedValue(presentation.creatorName));
    assert.equal(presentation.id.value, "x");
    assert.equal(presentation.creatorName.value, "Alice");

    const applied = applyPublicPresentationTranslations(tree, translations);
    assert.equal((applied as typeof tree).id, id);
    assert.equal((applied as typeof tree).creatorName, creatorName);
  });

  it("5-paragraph petition: one missing translation → FALLBACK_CANONICAL not COMPLETE", () => {
    const tree = {
      title: "Petition title",
      paragraphs: [
        "Paragraph one canonical",
        "Paragraph two canonical",
        "Paragraph three canonical",
        "Paragraph four canonical",
        "Paragraph five canonical",
      ],
    };

    const auto = collectAutoTranslatableNodes(tree);
    assert.equal(auto.length, 6);

    const translations = {
      title: "Заголовок петиції",
      "paragraphs[0]": "Абзац один",
      "paragraphs[1]": "Абзац два",
      "paragraphs[2]": "Абзац три",
      "paragraphs[3]": "Абзац чотири",
      // paragraphs[4] intentionally missing
    };

    const localized = localizePublicPresentation({
      identity: {
        sourceKind: "petition",
        sourceRecordId: "pet-08k",
        presentationSchemaVersion: PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
      },
      sourceLanguage: "en",
      targetLanguage: "uk",
      presentation: tree,
      translations,
    });

    assert.equal(localized.coverage.status, "FALLBACK_CANONICAL");
    assert.notEqual(localized.coverage.status, "COMPLETE");
    assert.equal(localized.coverage.canonicalFallbackNodeCount, 1);
    assert.deepEqual(localized.coverage.canonicalFallbackPaths, ["paragraphs[4]"]);
    assert.equal(localized.coverage.localizedNodeCount, 5);
    assert.equal(
      (localized.presentation as typeof tree).paragraphs[4],
      "Paragraph five canonical",
    );
  });

  it("stale paths never yield COMPLETE", () => {
    const tree = { title: "Canonical title", body: "Canonical body" };
    const localized = localizePublicPresentation({
      identity: {
        sourceKind: "initiative",
        sourceRecordId: "init-stale",
        presentationSchemaVersion: PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
      },
      sourceLanguage: "en",
      targetLanguage: "uk",
      presentation: tree,
      translations: { title: "UK title", body: "UK body" },
      stalePaths: ["title"],
    });
    assert.equal(localized.coverage.status, "STALE");
    assert.equal(localized.coverage.staleNodeCount, 1);
    assert.notEqual(localized.coverage.status, "COMPLETE");
  });

  it("sourceLanguage === targetLanguage → SOURCE_LANGUAGE", () => {
    const tree = { title: "Same locale" };
    const localized = localizePublicPresentation({
      identity: {
        sourceKind: "initiative",
        sourceRecordId: "init-src",
        presentationSchemaVersion: PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
      },
      sourceLanguage: "en",
      targetLanguage: "en",
      presentation: tree,
      translations: { title: "Should not apply" },
    });
    assert.equal(localized.coverage.status, "SOURCE_LANGUAGE");
    assert.equal((localized.presentation as typeof tree).title, "Same locale");
  });

  it("fingerprint is stable for identical auto-translatable content", () => {
    const a = { title: "A", note: "B" };
    const b = { title: "A", note: "B" };
    assert.equal(fingerprintPublicPresentation(a), fingerprintPublicPresentation(b));
    assert.match(fingerprintPublicPresentation(a), /^v-[0-9a-f]{16}$/);
  });

  it("ensureLocalizedPublicPresentation schedules missing and falls back", async () => {
    const tree = { title: "T", body: "B" };
    const scheduled: string[][] = [];
    const localized = await ensureLocalizedPublicPresentation({
      identity: {
        sourceKind: "initiative",
        sourceRecordId: "init-ensure",
        presentationSchemaVersion: PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
      },
      sourceLanguage: "en",
      targetLanguage: "uk",
      presentation: tree,
      loadTranslations: async () => ({ translations: { title: "UK-T" } }),
      scheduleMissing: ({ missingPaths }) => {
        scheduled.push([...missingPaths]);
      },
    });
    assert.deepEqual(scheduled, [["body"]]);
    assert.equal(localized.coverage.status, "FALLBACK_CANONICAL");
    assert.equal((localized.presentation as typeof tree).title, "UK-T");
    assert.equal((localized.presentation as typeof tree).body, "B");
  });

  it("resolveTranslatedDisplay: stale preferred returns original + isStale (Pack 08K)", () => {
    const resolved = resolveTranslatedDisplay({
      originalContent: "Hello EN",
      originalLanguage: "en",
      preferredReadingLanguage: "uk",
      translationPreference: "preferred",
      translations: [
        {
          translationId: "t1",
          sourceKind: "initiative",
          sourceRecordId: "i-1",
          sourceVersion: "v-old",
          sourceLanguage: "en",
          targetLanguage: "uk",
          translatedContent: "Привіт",
          translationProvider: "deterministic",
          translationKind: "machine",
          createdAt: "2026-01-01T00:00:00.000Z",
          stale: true,
          freshness: "stale",
        },
      ],
    });
    assert.equal(resolved.presentationMode, "original");
    assert.equal(resolved.content, "Hello EN");
    assert.equal(resolved.isStale, true);
  });
});
