/**
 * RESET 05D.5 — provider-boundary forensics (no speculative translation fix).
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  BRAND_SITE_NAME_MACHINE_SENTINEL,
  BRAND_SITE_NAME_TOKEN,
  MEDIA_PLP_ENTITY_TYPE,
  protectBrandTokensForMachineTranslation,
} from "@hu/types";

import {
  FakeLocalMediaPlpTransport,
  MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
  callMediaPlpMaterializerProviderOnce,
  validateMediaPlpProviderLocalizationValues,
  flattenStructuredLocalizationValues,
  classifyBrandPathForensics,
  classifyNewsPathForensics,
  deriveProviderPartialSubreason,
  formatProviderForensicsSafe,
  isProviderPartialSubtypeRetryable,
} from "../../../src/modules/language/media-plp-materializer/index.js";
import { resetMediaPlpMaterializerCountersForTests } from "../../../src/modules/language/media-plp-materializer/counters.js";
import {
  mapProviderBoundaryReasonToFailure,
  sanitizePlpAutoBuildFailureReason,
} from "../../../src/modules/language/published-localized-presentation/universal/plp-auto-build-failure.js";

beforeEach(() => {
  resetMediaPlpMaterializerCountersForTests();
});

afterEach(() => {
  resetMediaPlpMaterializerCountersForTests();
});

describe("RESET 05D.5 — provider boundary forensics", () => {
  it("sanitize truncation no longer drops BRAND_TOKEN_PATHS (deterministic repo bug)", () => {
    const paths = [
      "faq[0].answer:MISSING_AFTER_PROVIDER:1:1:0:0:0:0:1",
      "faq[2].question:MISSING_AFTER_PROVIDER:1:1:0:0:0:0:1",
      "faq[3].answer:MISSING_AFTER_PROVIDER:1:1:0:0:0:0:1",
      "faq[3].question:MISSING_AFTER_PROVIDER:1:1:0:0:0:0:1",
    ].join("|");
    const verbose =
      "PROVIDER_INTEGRITY:BRAND_TOKEN_PRESERVATION_FAILED;Provider removed/altered Brand tokens on many paths refusing publish with long prose padding " +
      "x".repeat(200) +
      `;EXPECTED_MACHINE_PATHS=a|b|c|d|e|f|g|h|i|j|k|l|m|n|o|p|q|r;BRAND_TOKEN_PATHS=${paths}`;
    const sanitized = sanitizePlpAutoBuildFailureReason(verbose);
    assert.match(sanitized, /BRAND_TOKEN_PATHS=faq\[0\]\.answer:MISSING_AFTER_PROVIDER/);
    assert.ok(sanitized.includes("faq[3].question"));
  });

  it("token removed by provider → MISSING_AFTER_PROVIDER + persisted path", async () => {
    const source = `{siteName} curates sources.`;
    const protectedText = protectBrandTokensForMachineTranslation(source);
    assert.match(protectedText, new RegExp(BRAND_SITE_NAME_MACHINE_SENTINEL));

    const result = await callMediaPlpMaterializerProviderOnce({
      provider: new FakeLocalMediaPlpTransport({
        responseText: () =>
          JSON.stringify({
            "faq[0].answer": "[uk] Союз Людяності curates sources.",
          }),
      }),
      locale: "uk",
      autoValues: { "faq[0].answer": source },
      sourceRecordId: "civic_media_editorial:civic-media-center",
      sourceVersion: "v-test",
      PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "BRAND_TOKEN_PRESERVATION_FAILED");
    const brand = result.forensics?.BRAND_TOKEN_PATH_STATES[0];
    assert.ok(brand);
    assert.equal(brand!.TOKEN_STATE, "MISSING_AFTER_PROVIDER");
    assert.equal(brand!.PROVIDER_PATH_PRESENT, true);
    assert.equal(brand!.PROTECTED_TOKEN_COUNT_BEFORE_SERIALIZE, 1);
    assert.equal(brand!.TOKEN_COUNT_AFTER_PROVIDER_PARSE, 0);

    const failure = mapProviderBoundaryReasonToFailure({
      reason: result.reason,
      message: result.message,
    });
    assert.match(failure.safeReason, /BRAND_TOKEN_PATHS=faq\[0\]\.answer:MISSING_AFTER_PROVIDER/);
    assert.equal(failure.retryable, false);
  });

  it("path omitted by provider → MISSING_AFTER_PARSE / MISSING_PATH", async () => {
    const source = `{siteName} recommends organizations.`;
    const result = await callMediaPlpMaterializerProviderOnce({
      provider: new FakeLocalMediaPlpTransport({
        responseText: () => JSON.stringify({ other: "[uk] x" }),
      }),
      locale: "uk",
      autoValues: { "faq[0].answer": source },
      sourceRecordId: "x",
      sourceVersion: "v",
      PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "PARTIAL");
    assert.equal(result.forensics?.PROVIDER_PARTIAL_SUBREASON, "MISSING_PATH");
    assert.deepEqual(result.forensics?.MISSING_MACHINE_PATHS, ["faq[0].answer"]);
    const brand = result.forensics?.BRAND_TOKEN_PATH_STATES[0];
    assert.equal(brand?.TOKEN_STATE, "MISSING_AFTER_PARSE");
    assert.equal(brand?.PROVIDER_PATH_PRESENT, false);
  });

  it("token survives provider but flatten loses nested path → MISSING_AFTER_FLATTEN", () => {
    const source = `${BRAND_SITE_NAME_TOKEN} hello`;
    const protectedText = protectBrandTokensForMachineTranslation(source);
    const report = classifyBrandPathForensics({
      path: "faq[0].answer",
      canonicalSource: source,
      protectedBeforeSerialize: protectedText,
      rawAfterParse: `Keep ${BRAND_SITE_NAME_MACHINE_SENTINEL} please`,
      afterFlatten: null,
      afterRestore: null,
      pathPresentInProviderObject: true,
    });
    assert.equal(report?.TOKEN_STATE, "MISSING_AFTER_FLATTEN");
  });

  it("token survives flatten but restore fails → RESTORE_FAILED", () => {
    const source = `${BRAND_SITE_NAME_TOKEN} hello`;
    const protectedText = protectBrandTokensForMachineTranslation(source);
    const report = classifyBrandPathForensics({
      path: "faq[0].answer",
      canonicalSource: source,
      protectedBeforeSerialize: protectedText,
      rawAfterParse: `Keep ${BRAND_SITE_NAME_MACHINE_SENTINEL}`,
      afterFlatten: `Keep ${BRAND_SITE_NAME_MACHINE_SENTINEL}`,
      afterRestore: `Keep ${BRAND_SITE_NAME_MACHINE_SENTINEL}`,
      pathPresentInProviderObject: true,
    });
    assert.equal(report?.TOKEN_STATE, "RESTORE_FAILED");
  });

  it("duplicated token → DUPLICATED", () => {
    const source = `${BRAND_SITE_NAME_TOKEN} hello`;
    const protectedText = protectBrandTokensForMachineTranslation(source);
    const report = classifyBrandPathForensics({
      path: "faq[0].answer",
      canonicalSource: source,
      protectedBeforeSerialize: protectedText,
      rawAfterParse: `${BRAND_SITE_NAME_MACHINE_SENTINEL} ${BRAND_SITE_NAME_MACHINE_SENTINEL}`,
      afterFlatten: `${BRAND_SITE_NAME_MACHINE_SENTINEL} ${BRAND_SITE_NAME_MACHINE_SENTINEL}`,
      afterRestore: `${BRAND_SITE_NAME_TOKEN} ${BRAND_SITE_NAME_TOKEN}`,
      pathPresentInProviderObject: true,
    });
    assert.equal(report?.TOKEN_STATE, "DUPLICATED");
  });

  it("News path missing → MISSING_PATH subtype retryable", () => {
    const states = [
      classifyNewsPathForensics({
        path: "title",
        canonicalSource: "Title EN",
        returnedValue: "[uk] Title EN",
        locale: "uk",
        mappedToExpectedPath: true,
      }),
      classifyNewsPathForensics({
        path: "summary",
        canonicalSource: "Summary EN",
        returnedValue: undefined,
        locale: "uk",
        mappedToExpectedPath: false,
      }),
    ];
    const sub = deriveProviderPartialSubreason({
      pathStates: states,
      missingPaths: ["summary"],
      unexpectedPaths: [],
    });
    assert.equal(sub, "MISSING_PATH");
    assert.equal(isProviderPartialSubtypeRetryable(sub), true);

    const failure = mapProviderBoundaryReasonToFailure({
      reason: "PARTIAL",
      message: formatProviderForensicsSafe({
        PROVIDER_RESPONSE_SHAPE: "OBJECT",
        BRAND_TOKEN_PATH_STATES: [],
        NEWS_PATH_STATES: states,
        PROVIDER_PARTIAL_SUBREASON: sub,
        EXPECTED_MACHINE_PATHS: ["summary", "title"],
        RETURNED_MACHINE_PATHS: ["title"],
        MISSING_MACHINE_PATHS: ["summary"],
        UNEXPECTED_MACHINE_PATHS: [],
      }),
    });
    assert.equal(failure.failureCode, "PROVIDER_PARTIAL");
    assert.equal(failure.retryable, true);
    assert.match(failure.safeReason, /PROVIDER_PARTIAL_SUBREASON=MISSING_PATH/);
    assert.match(failure.safeReason, /PATH_STATES=title:/);
    assert.match(failure.safeReason, /MISSING_MACHINE_PATHS=summary/);
  });

  it("News path present but empty → EMPTY_VALUE", () => {
    const validated = validateMediaPlpProviderLocalizationValues({
      locale: "uk",
      autoValues: { title: "Title EN", summary: "Summary EN" },
      translated: { title: "[uk] Title EN", summary: "" },
      presentKeys: ["title", "summary"],
    });
    assert.equal(validated.ok, false);
    if (validated.ok) return;
    assert.equal(validated.reason, "PARTIAL");
    assert.equal(
      validated.pathDiagnostics.PROVIDER_PARTIAL_SUBREASON,
      "EMPTY_VALUE",
    );
    assert.deepEqual(validated.pathDiagnostics.MISSING_MACHINE_PATHS, []);
  });

  it("News path present but wrong target language → WRONG_TARGET_LANGUAGE", () => {
    const validated = validateMediaPlpProviderLocalizationValues({
      locale: "uk",
      autoValues: { title: "Title EN", summary: "Summary EN" },
      translated: { title: "Title EN", summary: "Summary EN" },
      presentKeys: ["title", "summary"],
    });
    assert.equal(validated.ok, false);
    if (validated.ok) return;
    assert.equal(validated.reason, "WRONG_TARGET_LANGUAGE");
    assert.equal(
      validated.pathDiagnostics.PROVIDER_PARTIAL_SUBREASON,
      "WRONG_TARGET_LANGUAGE",
    );
    const failure = mapProviderBoundaryReasonToFailure({
      reason: validated.reason,
      message: validated.message,
    });
    assert.equal(failure.failureCode, "PROVIDER_PARTIAL");
    assert.equal(failure.retryable, true);
    assert.match(failure.safeReason, /PATH_STATES=/);
  });

  it("News path present but integrity-invalid → CONTENT_INTEGRITY_FAILURE terminal", () => {
    const validated = validateMediaPlpProviderLocalizationValues({
      locale: "uk",
      autoValues: { title: "Title EN", summary: "Summary EN long enough" },
      translated: {
        title: "[uk] Title EN",
        summary: "Summary EN long enough",
      },
      presentKeys: ["title", "summary"],
    });
    assert.equal(validated.ok, false);
    if (validated.ok) return;
    assert.equal(validated.reason, "LOCALIZATION_CONTENT_INTEGRITY_FAILED");
    assert.equal(
      validated.pathDiagnostics.PROVIDER_PARTIAL_SUBREASON,
      "CONTENT_INTEGRITY_FAILURE",
    );
    const failure = mapProviderBoundaryReasonToFailure({
      reason: validated.reason,
      message: validated.message,
    });
    assert.equal(failure.failureCode, "PROVIDER_INTEGRITY");
    assert.equal(failure.retryable, false);
  });

  it("News path mapping mismatch → PATH_MAPPING_FAILURE not retryable", () => {
    const states = [
      classifyNewsPathForensics({
        path: "title",
        canonicalSource: "Title EN",
        returnedValue: "[uk] Title EN",
        locale: "uk",
        mappedToExpectedPath: false,
      }),
      classifyNewsPathForensics({
        path: "summary",
        canonicalSource: "Summary EN",
        returnedValue: "[uk] Summary EN",
        locale: "uk",
        mappedToExpectedPath: false,
      }),
    ];
    const sub = deriveProviderPartialSubreason({
      pathStates: states,
      missingPaths: [],
      unexpectedPaths: ["Title", "Summary"],
    });
    assert.equal(sub, "PATH_MAPPING_FAILURE");
    assert.equal(isProviderPartialSubtypeRetryable(sub), false);
  });

  it("generic/unknown PARTIAL is not retryable", () => {
    const failure = mapProviderBoundaryReasonToFailure({
      reason: "PARTIAL",
      message: "missing paths",
    });
    assert.equal(failure.failureCode, "PROVIDER_PARTIAL");
    assert.equal(failure.retryable, false);
    assert.match(failure.safeReason, /OTHER_STRUCTURAL_FAILURE/);
  });

  it("nested flatten preserves Brand sentinel path relationship", () => {
    const out: Record<string, string> = {};
    flattenStructuredLocalizationValues(
      {
        faq: [
          {
            answer: `Keep ${BRAND_SITE_NAME_MACHINE_SENTINEL} intact`,
          },
        ],
      },
      "",
      out,
    );
    assert.equal(
      out["faq[0].answer"],
      `Keep ${BRAND_SITE_NAME_MACHINE_SENTINEL} intact`,
    );
  });

  it("Brand failure without path metadata is unacceptable after mapping", () => {
    const failure = mapProviderBoundaryReasonToFailure({
      reason: "BRAND_TOKEN_PRESERVATION_FAILED",
      message: "BRAND_TOKEN_PRESERVATION_FAILED",
    });
    assert.match(failure.safeReason, /BRAND_TOKEN_PATHS=/);
  });
});
