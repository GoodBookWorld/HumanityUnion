/**
 * Step 15D.12.4.4 — Sanitized Terminology activation failure diagnostics.
 * Deterministic. No Gemini. No staging/production writes.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aggregateTerminologyFailureDiagnostics,
  classifyTerminologyActivationFailureReason,
  formatTerminologyProviderDiagnosticSummary,
  sanitizeTerminologyProviderDiagnostic,
  terminologyDomainFromPreparationResult,
  terminologyDomainProviderConfigFailure,
} from "../../../src/modules/language/language-localization-activation/index.js";
import type { LanguageOwnerPreparationResult } from "../../../src/modules/language-preparation/language-owner-preparation.js";

function baseResult(
  outcomes: LanguageOwnerPreparationResult["terminology"]["outcomes"],
): LanguageOwnerPreparationResult {
  return {
    mode: "execute",
    locale: "zz-Test",
    metadata: {
      locale: "zz-Test",
      englishName: "Test",
      nativeName: "zz",
      textDirection: "ltr",
      source: "registry",
    },
    brand: {
      existed: true,
      status: "published",
      outcomes: [],
      persisted: false,
    },
    terminology: {
      publishedConcepts: outcomes.length,
      outcomes,
      persistedCount: 0,
    },
    providerCalls: outcomes.filter((row) => row.outcome === "failed").length,
  };
}

describe("Step 15D.12.4.4 Terminology failure diagnostics", () => {
  it("1. known provider failure reason becomes the expected sanitized code", () => {
    assert.equal(classifyTerminologyActivationFailureReason("Gemini HTTP 404"), "model_not_found");
    assert.equal(classifyTerminologyActivationFailureReason("Gemini HTTP 429"), "rate_limited");
    assert.equal(classifyTerminologyActivationFailureReason("Gemini HTTP 503"), "unavailable");
    assert.equal(
      classifyTerminologyActivationFailureReason("Gemini translation timed out"),
      "timeout",
    );
    assert.equal(
      classifyTerminologyActivationFailureReason("Gemini response was not JSON"),
      "malformed_response",
    );
    assert.equal(
      classifyTerminologyActivationFailureReason("Provider response JSON could not be parsed."),
      "validation_parse_failure",
    );
    assert.equal(
      classifyTerminologyActivationFailureReason("Provider omitted keys: preferredTerm"),
      "validation_parse_failure",
    );
  });

  it("2. multiple equal failures aggregate counts", () => {
    const diagnostic = aggregateTerminologyFailureDiagnostics([
      { field: "a", outcome: "failed", reason: "Gemini HTTP 429" },
      { field: "b", outcome: "failed", reason: "Gemini HTTP 429" },
      { field: "c", outcome: "failed", reason: "Gemini HTTP 429" },
      { field: "d", outcome: "preserved" },
    ]);
    assert.deepEqual(diagnostic, {
      failureCodes: [{ code: "rate_limited", count: 3 }],
    });
    assert.equal(
      formatTerminologyProviderDiagnosticSummary(diagnostic),
      "rate_limited (3)",
    );
  });

  it("3. multiple different failure classes aggregate safely", () => {
    const diagnostic = aggregateTerminologyFailureDiagnostics([
      { field: "a", outcome: "failed", reason: "Gemini HTTP 429" },
      { field: "b", outcome: "failed", reason: "Gemini HTTP 429" },
      { field: "c", outcome: "failed", reason: "Gemini HTTP 404" },
      { field: "d", outcome: "failed", reason: "Gemini translation timed out" },
    ]);
    assert.deepEqual(diagnostic?.failureCodes, [
      { code: "rate_limited", count: 2 },
      { code: "model_not_found", count: 1 },
      { code: "timeout", count: 1 },
    ]);
  });

  it("4. unknown/raw error becomes unknown without persisting raw text", () => {
    const raw = "sk-secret-key leaked in vendor prose with unexpected body";
    assert.equal(classifyTerminologyActivationFailureReason(raw), "unknown");
    const diagnostic = aggregateTerminologyFailureDiagnostics([
      { field: "a", outcome: "failed", reason: raw },
    ]);
    assert.deepEqual(diagnostic, {
      failureCodes: [{ code: "unknown", count: 1 }],
    });
    const encoded = JSON.stringify(diagnostic);
    assert.equal(encoded.includes("sk-secret"), false);
    assert.equal(encoded.includes(raw), false);
  });

  it("5. secrets/raw provider payloads cannot enter the durable diagnostic", () => {
    const poisoned = {
      failureCodes: [
        { code: "rate_limited", count: 2 },
        {
          code: "AIzaSyFakeSecretValueThatMustNotPersist",
          count: 1,
          message: "full provider body",
          prompt: "Translate this",
        },
        { code: "malformed_response", count: 1, stack: "Error: key=secret" },
      ],
      rawError: "GEMINI_API_KEY=should-not-appear",
    };
    const sanitized = sanitizeTerminologyProviderDiagnostic(poisoned);
    assert.ok(sanitized);
    assert.deepEqual(sanitized?.failureCodes, [
      { code: "rate_limited", count: 2 },
      { code: "malformed_response", count: 1 },
      { code: "unknown", count: 1 },
    ]);
    const encoded = JSON.stringify(sanitized);
    assert.equal(encoded.includes("AIzaSy"), false);
    assert.equal(encoded.includes("provider body"), false);
    assert.equal(encoded.includes("Translate this"), false);
    assert.equal(encoded.includes("GEMINI_API_KEY"), false);
    assert.equal(encoded.includes("secret"), false);
  });

  it("6. existing activation success/failure semantics are unchanged", () => {
    const failed = terminologyDomainFromPreparationResult(
      baseResult([
        { field: "a", outcome: "failed", reason: "Gemini HTTP 404" },
        { field: "b", outcome: "failed", reason: "Gemini HTTP 404" },
        { field: "c", outcome: "preserved" },
      ]),
    );
    assert.equal(failed.status, "failed");
    assert.equal(failed.providerFailure, true);
    assert.equal(failed.conceptsFailed, 2);
    assert.equal(failed.conceptsPreserved, 1);
    assert.equal(failed.conceptsGenerated, 0);
    assert.equal(failed.detail, "Terminology preparation failed — retry activation");
    assert.deepEqual(failed.providerDiagnostic, {
      failureCodes: [{ code: "model_not_found", count: 2 }],
    });

    const ready = terminologyDomainFromPreparationResult(
      baseResult([
        { field: "a", outcome: "preserved" },
        { field: "b", outcome: "generated" },
      ]),
    );
    assert.equal(ready.status, "ready");
    assert.equal(ready.providerFailure, false);
    assert.equal(ready.detail, "Terminology ready");
    assert.equal(ready.providerDiagnostic, null);

    const config = terminologyDomainProviderConfigFailure(
      "TRANSLATION_PROVIDER=gemini but GEMINI_API_KEY is missing",
    );
    assert.equal(config.status, "failed");
    assert.match(config.detail ?? "", /Terminology preparation failed/);
    assert.deepEqual(config.providerDiagnostic, {
      failureCodes: [{ code: "not_configured", count: 1 }],
    });
  });
});
