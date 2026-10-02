/**
 * F.3.31A — unchanged terminology failures are not provider work.
 * A changed sourceVersion or localizationInputVersion is.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { decideSameVersionWarmFailureRetry } from "../../../src/modules/language/content-translation-failure-metadata.js";

const here = path.dirname(fileURLToPath(import.meta.url));

const unchanged = {
  failureClass: "VALIDATION_FAILED",
  failureReasonCode: "TERMINOLOGY_PROTECTION_VIOLATION",
  retryabilityHint: "deferred_semantic_retry",
  liveSourceVersion: "v-1",
  failedSourceVersion: "v-1",
  liveLocalizationInputVersion: "input-1",
  failedLocalizationInputVersion: "input-1",
} as const;

describe("F.3.31A unchanged terminology provider retries", () => {
  it("A. same source and input are not provider-retryable", () => {
    assert.equal(decideSameVersionWarmFailureRetry(unchanged), "terminal");
    assert.equal(
      decideSameVersionWarmFailureRetry({
        failureClass: "VALIDATION_FAILED",
        failureReasonCode: "TERMINOLOGY_PROTECTION_VIOLATION",
        retryabilityHint: "non_retryable_until_code_or_content_change",
      }),
      "terminal",
    );
  });

  it("B. a changed sourceVersion is provider-retryable", () => {
    assert.equal(
      decideSameVersionWarmFailureRetry({
        ...unchanged,
        liveSourceVersion: "v-2",
      }),
      "retryable",
    );
  });

  it("C. a changed localizationInputVersion is provider-retryable", () => {
    assert.equal(
      decideSameVersionWarmFailureRetry({
        ...unchanged,
        liveLocalizationInputVersion: "input-2",
      }),
      "retryable",
    );
  });

  it("D. transient provider failures stay retryable", () => {
    for (const failureClass of [
      "PROVIDER_TIMEOUT",
      "PROVIDER_INVALID_RESPONSE",
      "PERSISTENCE_FAILED",
      "MISSING_AFTER_DISPATCH",
      "SOURCE_UNAVAILABLE",
    ]) {
      assert.equal(
        decideSameVersionWarmFailureRetry({
          failureClass,
          failureReasonCode: null,
          liveSourceVersion: "v-1",
          failedSourceVersion: "v-1",
        }),
        "retryable",
      );
    }
    assert.equal(
      decideSameVersionWarmFailureRetry({
        failureClass: "PROVIDER_INVALID_RESPONSE",
        failureReasonCode: "INVALID_PROVIDER_PAYLOAD",
        liveSourceVersion: "v-1",
        failedSourceVersion: "v-1",
        liveLocalizationInputVersion: "input-1",
        failedLocalizationInputVersion: "input-1",
      }),
      "retryable",
    );
    assert.equal(
      decideSameVersionWarmFailureRetry({
        failureClass: "VALIDATION_FAILED",
        failureReasonCode: "UNCHANGED_SOURCE_PROSE",
        retryabilityHint: "retryable",
      }),
      "terminal",
    );
  });

  it("E. the decision has no locale branch and does not schedule from the fingerprint", () => {
    const source = readFileSync(
      path.join(here, "../../../src/modules/language/content-translation-failure-metadata.ts"),
      "utf8",
    );
    const start = source.indexOf("export function decideSameVersionWarmFailureRetry");
    const end = source.indexOf("export function isExplicitlyRetryableModernFailure");
    const decision = source.slice(start, end);
    assert.equal(decision.includes('locale === "uk"'), false);
    assert.equal(decision.includes('locale === "he"'), false);
    assert.equal(decision.includes('locale === "ar"'), false);
    assert.equal(decision.includes("terminologyViolationFingerprint"), false);
    assert.equal(decision.includes("sourceKind"), false);

    const preflight = readFileSync(
      path.join(here, "../../../src/modules/language/public-localization-retry-preflight.ts"),
      "utf8",
    );
    const suppression = preflight.slice(
      preflight.indexOf("sameVersionRetryDecision"),
      preflight.indexOf("let semanticRetryDeferred"),
    );
    assert.equal(suppression.includes('locale === "uk"'), false);
    assert.equal(suppression.includes("terminologyViolationFingerprint"), false);
  });
});
