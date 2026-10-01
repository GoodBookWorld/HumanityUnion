/**
 * F.3.29.4 — durable privacy-safe terminology violation fingerprint.
 * Does not change retry, READY, or public resolve.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ContentTranslationValidationError,
  buildTerminologyViolationFingerprint,
  encodeContentTranslationFailureMetadata,
  isSameTerminologyFailureIdentity,
  normalizeTerminologyViolationDescriptors,
  parseContentTranslationFailureMetadata,
  terminologyFailureDiagnosticForMetadata,
  type ContentTranslationSafeFailureMetadata,
} from "../../../src/modules/language/content-translation-failure-metadata.js";

const SOURCE_PROSE = "The Initiative discussion remains in English.";
const TRANSLATED_PROSE = "Ініціатива обговорення залишилось англійською.";
const PREFERRED_TERM = "Ініціатива";
const CANONICAL_TERM = "Initiative";

function baseMeta(
  overrides: Partial<ContentTranslationSafeFailureMetadata> = {},
): ContentTranslationSafeFailureMetadata {
  return {
    schema: "content_translation_failure_meta_v1",
    validationContractVersion: "v1",
    failureClass: "VALIDATION_FAILED",
    failureReasonCode: "TERMINOLOGY_PROTECTION_VIOLATION",
    sourceKind: "initiative",
    sourceRecordId: "source-1",
    sourceVersion: "v-source",
    targetLocale: "ar",
    failedAt: "2026-10-01T12:00:00.000Z",
    retryabilityHint: "deferred_semantic_retry",
    localizationInputVersion: "input-a",
    ...overrides,
  };
}

const unordered = [
  { conceptId: "discussion", reason: "residual_canonical" as const },
  { conceptId: "initiative", reason: "missing_preferred" as const },
  { conceptId: "discussion", reason: "residual_canonical" as const },
];

describe("F.3.29.4 terminology violation fingerprint", () => {
  it("1. same violations in different traversal order share one fingerprint", () => {
    const forward = buildTerminologyViolationFingerprint([
      { conceptId: "initiative", violationType: "missing_preferred" },
      { conceptId: "discussion", violationType: "residual_canonical" },
    ]);
    const reverse = buildTerminologyViolationFingerprint([
      { conceptId: "discussion", reason: "residual_canonical" },
      { conceptId: "initiative", reason: "missing_preferred" },
    ]);
    assert.equal(forward, reverse);
    assert.equal(typeof forward, "string");
    assert.equal(forward?.length, 64);
  });

  it("2. duplicate violations normalize to the same fingerprint", () => {
    const once = normalizeTerminologyViolationDescriptors([
      { conceptId: "initiative", reason: "missing_preferred" },
    ]);
    const twice = normalizeTerminologyViolationDescriptors([
      { conceptId: "initiative", reason: "missing_preferred" },
      { conceptId: "initiative", violationType: "missing_preferred" },
    ]);
    assert.deepEqual(once, twice);
    assert.equal(
      buildTerminologyViolationFingerprint(once),
      buildTerminologyViolationFingerprint(twice),
    );
  });

  it("3. a different concept id changes the fingerprint", () => {
    const left = buildTerminologyViolationFingerprint([
      { conceptId: "initiative", violationType: "missing_preferred" },
    ]);
    const right = buildTerminologyViolationFingerprint([
      { conceptId: "petition", violationType: "missing_preferred" },
    ]);
    assert.notEqual(left, right);
  });

  it("4. a different violation type changes the fingerprint", () => {
    const missing = buildTerminologyViolationFingerprint([
      { conceptId: "initiative", violationType: "missing_preferred" },
    ]);
    const residual = buildTerminologyViolationFingerprint([
      { conceptId: "initiative", violationType: "residual_canonical" },
    ]);
    assert.notEqual(missing, residual);
  });

  it("5. source and translation prose are not persisted", () => {
    const error = new ContentTranslationValidationError(
      "TERMINOLOGY_PROTECTION_VIOLATION",
      `TERMINOLOGY_PROTECTION_VIOLATION: initiative:missing_preferred(expected=${PREFERRED_TERM}, canonical=${CANONICAL_TERM}) ${SOURCE_PROSE} ${TRANSLATED_PROSE}`,
      "malformed_response",
      "input-a",
      unordered,
    );
    const encoded = encodeContentTranslationFailureMetadata({
      ...baseMeta(),
      terminologyViolations: error.terminologyViolations,
    });
    assert.equal(encoded.includes(SOURCE_PROSE), false);
    assert.equal(encoded.includes(TRANSLATED_PROSE), false);
    assert.equal(encoded.includes(PREFERRED_TERM), false);
    assert.equal(encoded.includes(CANONICAL_TERM), false);
    assert.equal(encoded.includes("expected="), false);
    const parsed = parseContentTranslationFailureMetadata(encoded);
    assert.deepEqual(parsed?.terminologyViolations, [
      { conceptId: "discussion", violationType: "residual_canonical" },
      { conceptId: "initiative", violationType: "missing_preferred" },
    ]);
  });

  it("6. a terminology failure persists the fingerprint and the descriptor set", () => {
    const error = new ContentTranslationValidationError(
      "TERMINOLOGY_PROTECTION_VIOLATION",
      "safe",
      "malformed_response",
      "input-a",
      unordered,
    );
    const encoded = encodeContentTranslationFailureMetadata({
      ...baseMeta({ targetLocale: "es" }),
      terminologyViolations: error.terminologyViolations,
    });
    const parsed = parseContentTranslationFailureMetadata(encoded);
    assert.equal(parsed?.failureReasonCode, "TERMINOLOGY_PROTECTION_VIOLATION");
    assert.equal(
      parsed?.terminologyViolationFingerprint,
      buildTerminologyViolationFingerprint(unordered),
    );
    assert.equal(parsed?.terminologyViolations?.length, 2);
    assert.equal(parsed?.sourceVersion, "v-source");
    assert.equal(parsed?.localizationInputVersion, "input-a");
  });

  it("7. a non-terminology failure drops a stale terminology fingerprint", () => {
    const encoded = encodeContentTranslationFailureMetadata({
      ...baseMeta({
        failureReasonCode: "UNCHANGED_SOURCE_PROSE",
        sourceKind: "blog_post",
        sourceRecordId: "blog-1",
        terminologyViolationFingerprint: "stale-fingerprint",
        terminologyViolations: [
          { conceptId: "initiative", violationType: "missing_preferred" },
        ],
      }),
    });
    const parsed = parseContentTranslationFailureMetadata(encoded);
    assert.equal(parsed?.failureReasonCode, "UNCHANGED_SOURCE_PROSE");
    assert.equal(parsed?.terminologyViolationFingerprint, undefined);
    assert.equal(parsed?.terminologyViolations, undefined);
    assert.equal(encoded.includes("stale-fingerprint"), false);
    assert.equal(encoded.includes("initiative"), false);
    const otherReason = new ContentTranslationValidationError(
      "EMPTY_TRANSLATION",
      "empty",
      "bad_request",
      "input-a",
      unordered,
    );
    assert.equal(otherReason.terminologyViolations, null);
  });

  it("8. a changed localizationInputVersion is not the same failure identity", () => {
    const fingerprint = buildTerminologyViolationFingerprint(unordered);
    const left = {
      sourceVersion: "v-source",
      localizationInputVersion: "input-a",
      terminologyViolationFingerprint: fingerprint,
    };
    assert.equal(
      isSameTerminologyFailureIdentity(left, {
        ...left,
        localizationInputVersion: "input-b",
      }),
      false,
    );
    assert.equal(isSameTerminologyFailureIdentity(left, left), true);
  });

  it("9. a changed sourceVersion is not the same failure identity", () => {
    const fingerprint = buildTerminologyViolationFingerprint(unordered);
    const left = {
      sourceVersion: "v-source",
      localizationInputVersion: "input-a",
      terminologyViolationFingerprint: fingerprint,
    };
    assert.equal(
      isSameTerminologyFailureIdentity(left, {
        ...left,
        sourceVersion: "v-next",
      }),
      false,
    );
  });

  it("10. success does not carry failure identity", () => {
    const fingerprint = buildTerminologyViolationFingerprint(unordered);
    const failed = {
      sourceVersion: "v-source",
      localizationInputVersion: "input-a",
      terminologyViolationFingerprint: fingerprint,
    };
    assert.equal(
      isSameTerminologyFailureIdentity(failed, {
        sourceVersion: "v-source",
        localizationInputVersion: "input-a",
        terminologyViolationFingerprint: null,
      }),
      false,
    );
    const diagnostic = terminologyFailureDiagnosticForMetadata({
      failureReasonCode: "TERMINOLOGY_PROTECTION_VIOLATION",
      violations: [],
    });
    assert.deepEqual(diagnostic, {});
  });

  it("11. the fingerprint is independent of locale", () => {
    const violations = [
      { conceptId: "participant", violationType: "missing_preferred" as const },
    ];
    const arabic = encodeContentTranslationFailureMetadata({
      ...baseMeta({ targetLocale: "ar" }),
      terminologyViolations: violations,
    });
    const spanish = encodeContentTranslationFailureMetadata({
      ...baseMeta({ targetLocale: "es" }),
      terminologyViolations: violations,
    });
    const parsedArabic = parseContentTranslationFailureMetadata(arabic);
    const parsedSpanish = parseContentTranslationFailureMetadata(spanish);
    assert.equal(parsedArabic?.targetLocale, "ar");
    assert.equal(parsedSpanish?.targetLocale, "es");
    assert.equal(
      parsedArabic?.terminologyViolationFingerprint,
      parsedSpanish?.terminologyViolationFingerprint,
    );
    assert.equal(
      isSameTerminologyFailureIdentity(
        {
          sourceVersion: parsedArabic?.sourceVersion,
          localizationInputVersion: parsedArabic?.localizationInputVersion,
          terminologyViolationFingerprint: parsedArabic?.terminologyViolationFingerprint,
        },
        {
          sourceVersion: parsedSpanish?.sourceVersion,
          localizationInputVersion: parsedSpanish?.localizationInputVersion,
          terminologyViolationFingerprint: parsedSpanish?.terminologyViolationFingerprint,
        },
      ),
      true,
    );
  });
});
