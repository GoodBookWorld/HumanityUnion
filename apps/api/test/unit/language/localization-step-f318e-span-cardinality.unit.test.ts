/**
 * STEP F.3.18E — explicit WEB_UI span cardinality.
 * Deterministic. No Gemini. No catalog writes.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { WebUiMessageTree } from "@hu/types";

import { isLanguageActivationWebUiReadyForHistoricalEnqueue } from "../../../src/modules/language/language-localization-activation/language-activation-job.domains.js";
import { assessWebUiMessageTreeReadiness } from "../../../src/modules/language/language-localization-activation/assess-web-ui-catalog-readiness.js";
import { LOCALIZATION_PROVIDER_MIN_INTERVAL_MS_DEFAULT } from "../../../src/modules/language/localization-provider-governor.js";
import type { TranslationProviderRequest } from "../../../src/modules/language/translation-provider.js";
import { loadPackagedWebUiCatalog } from "../../../src/modules/web-ui-message-packs/packaged-web-ui-catalog.js";
import { translateWebUiProviderBatch } from "../../../src/modules/web-ui-message-packs/web-ui-draft-builder.js";
import {
  reconstructWebUiMessageFromProviderSpans,
  segmentWebUiMessageForProvider,
  webUiProviderCardinalityLines,
  webUiProviderPayloadValue,
  webUiProviderSpanInstructions,
  WebUiProviderPayloadShapeError,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-structure-protect.js";
import { validateWebUiMessageTreeAgainstEnglish } from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.validate.js";
import {
  classifyWebUiStructureFailure,
  isRecoverableWebUiActivationCheckpoint,
  WEB_UI_PROVIDER_SHAPE_STRUCTURE_FAILURE_BOUND,
  WEB_UI_PROVIDER_SHAPE_VERSION,
  webUiProviderShapeFailureCountForBound,
} from "../../../src/modules/web-ui-message-packs/web-ui-provider-output-structure.js";

const ONE = "Recommended Media";
const THREE =
  "Explore civic activity, Participants, and Initiatives in {countryName} on {siteName}.";
const ONE_TRAILING_EMPTY = "Country not found | {siteName}";
const ONE_SLOT = "Our Partners in {countryName}";
const THREE_BRAND_FIRST = "Organizations collaborating with {siteName} in {countryName}.";
const ONE_AGAIN = "Our Partners";
const BRAND_ONLY = "{siteName}";
const FORBIDDEN_SPAN = "DO_NOT_PERSIST_SPAN_ALPHA";

const MIXED_KEYS = [
  "leaf.one",
  "leaf.three",
  "leaf.trailingEmpty",
  "leaf.slot",
  "leaf.threeBrandFirst",
  "leaf.oneAgain",
] as const;

const MIXED_ENGLISH: Record<(typeof MIXED_KEYS)[number], string> = {
  "leaf.one": ONE,
  "leaf.three": THREE,
  "leaf.trailingEmpty": ONE_TRAILING_EMPTY,
  "leaf.slot": ONE_SLOT,
  "leaf.threeBrandFirst": THREE_BRAND_FIRST,
  "leaf.oneAgain": ONE_AGAIN,
};

function mixedPayload(): Record<string, readonly string[]> {
  return Object.fromEntries(
    MIXED_KEYS.map((key) => [key, webUiProviderPayloadValue(MIXED_ENGLISH[key])]),
  );
}

describe("F.3.18E explicit span cardinality", () => {
  it("states count 1 for a one-span leaf and count 3 for a three-span leaf", () => {
    assert.equal(WEB_UI_PROVIDER_SHAPE_VERSION, 4);
    const one = webUiProviderPayloadValue(ONE);
    const three = webUiProviderPayloadValue(THREE);
    assert.deepEqual(one, [ONE]);
    assert.equal(three.length, 3);
    const lines = webUiProviderCardinalityLines({
      keys: ["leaf.one", "leaf.three"],
      payload: { "leaf.one": one, "leaf.three": three },
    });
    assert.match(lines, /leaf\.one expects exactly 1 translated strings\./);
    assert.match(lines, /leaf\.one expects exactly 1 translated strings\. Return one JSON array of length 1\./);
    assert.match(lines, /leaf\.three expects exactly 3 translated strings\./);
    assert.match(lines, /Return one JSON array of length 3\./);
    assert.match(lines, /Do not convert the array into a scalar string\./);
    assert.equal(lines.includes(ONE), false);
    assert.equal(lines.includes(three[0] ?? "missing"), false);
  });

  it("keeps 1/3/1/1/3/1 counts independent in one batch prompt", async () => {
    const payload = mixedPayload();
    assert.deepEqual(
      MIXED_KEYS.map((key) => payload[key]?.length),
      [1, 3, 1, 1, 3, 1],
    );
    let terminology = "";
    let requestText = "";
    await translateWebUiProviderBatch({
      locale: "eo",
      englishFlat: MIXED_ENGLISH,
      keys: MIXED_KEYS,
      terminologyContext: "",
      translator: async (request: TranslationProviderRequest) => {
        terminology = request.terminologyContext ?? "";
        requestText = request.text;
        const parsed = JSON.parse(request.text) as Record<string, unknown>;
        assert.equal(Array.isArray(parsed), false);
        const translated: Record<string, string[]> = {};
        for (const key of MIXED_KEYS) {
          const spans = parsed[key];
          assert.ok(Array.isArray(spans), key);
          translated[key] = (spans as unknown[]).map((span) => `t:${String(span)}`);
        }
        return {
          translatedText: JSON.stringify(translated),
          providerId: "deterministic",
          isPlaceholder: false,
        };
      },
    });
    const instructions = webUiProviderSpanInstructions();
    assert.equal(instructions.includes("Leave empty strings empty"), false);
    assert.match(instructions, /Do not return a scalar string/);
    assert.match(instructions, /Do not flatten arrays across keys/);
    assert.match(instructions, /Each key has its own array length/);
    assert.match(instructions, /Empty structural spans are not included/);
    for (const [key, count] of [
      ["leaf.one", 1],
      ["leaf.three", 3],
      ["leaf.trailingEmpty", 1],
      ["leaf.slot", 1],
      ["leaf.threeBrandFirst", 3],
      ["leaf.oneAgain", 1],
    ] as const) {
      assert.match(terminology, new RegExp(`${key.replaceAll(".", "\\.")} expects exactly ${count} translated strings`));
    }
    const sent = JSON.parse(requestText) as Record<string, string[]>;
    assert.equal(sent["leaf.trailingEmpty"]?.includes(""), false);
    assert.equal(sent["leaf.slot"]?.includes(""), false);
    assert.equal(JSON.stringify(sent).includes("__HU_BRAND_SITE_NAME__"), false);
    assert.equal(JSON.stringify(sent).includes("{siteName}"), false);
    assert.equal(JSON.stringify(sent).includes("{countryName}"), false);
  });

  it("rejects a scalar, a flattened root, and a shared batch length", async () => {
    await assert.rejects(
      () =>
        translateWebUiProviderBatch({
          locale: "eo",
          englishFlat: { "leaf.one": ONE },
          keys: ["leaf.one"],
          terminologyContext: "",
          translator: async () => ({
            translatedText: JSON.stringify({ "leaf.one": "scalar title" }),
            providerId: "deterministic" as const,
            isPlaceholder: false as const,
          }),
        }),
      (error: unknown) => {
        assert.ok(error instanceof WebUiProviderPayloadShapeError);
        assert.equal(
          classifyWebUiStructureFailure(error).failureClass,
          "provider_payload_type_mismatch",
        );
        return true;
      },
    );
    await assert.rejects(
      () =>
        translateWebUiProviderBatch({
          locale: "eo",
          englishFlat: MIXED_ENGLISH,
          keys: MIXED_KEYS,
          terminologyContext: "",
          translator: async () => ({
            translatedText: JSON.stringify(["flattened"]),
            providerId: "deterministic" as const,
            isPlaceholder: false as const,
          }),
        }),
      /Provider response was not a JSON object\./,
    );
    await assert.rejects(
      () =>
        translateWebUiProviderBatch({
          locale: "eo",
          englishFlat: {
            "leaf.one": ONE,
            "leaf.three": THREE,
          },
          keys: ["leaf.one", "leaf.three"],
          terminologyContext: "",
          translator: async () => ({
            translatedText: JSON.stringify({
              "leaf.one": [FORBIDDEN_SPAN, "extra", "shared"],
              "leaf.three": ["a", "b", "c"],
            }),
            providerId: "deterministic" as const,
            isPlaceholder: false as const,
          }),
        }),
      (error: unknown) => {
        const diagnostic = classifyWebUiStructureFailure(error);
        assert.equal(diagnostic.failureClass, "provider_span_count_mismatch");
        assert.equal(diagnostic.code, "provider_span_count_mismatch");
        assert.equal(diagnostic.catalogKey, "leaf.one");
        assert.equal(diagnostic.expectedSpanCount, 1);
        assert.equal(diagnostic.actualSpanCount, 3);
        const stored = JSON.stringify(diagnostic);
        assert.equal(stored.includes(FORBIDDEN_SPAN), false);
        assert.equal(stored.includes("scalar"), false);
        assert.equal("message" in diagnostic, false);
        return true;
      },
    );
  });

  it("counts a Brand sentinel as zero provider spans and omits empty local spans", () => {
    const brand = webUiProviderPayloadValue(BRAND_ONLY);
    assert.deepEqual(brand, []);
    const plan = segmentWebUiMessageForProvider(BRAND_ONLY);
    assert.equal(plan.providerSpanIndexes.length, 0);
    assert.ok(plan.slots.includes("__HU_BRAND_SITE_NAME__"));
    const trailing = segmentWebUiMessageForProvider(ONE_TRAILING_EMPTY);
    assert.ok(trailing.spans.includes(""));
    assert.equal(trailing.providerSpanIndexes.length, 1);
    assert.equal(webUiProviderPayloadValue(ONE_TRAILING_EMPTY).includes(""), false);
    const lines = webUiProviderCardinalityLines({
      keys: ["brand.only", "leaf.trailingEmpty"],
      payload: {
        "brand.only": brand,
        "leaf.trailingEmpty": webUiProviderPayloadValue(ONE_TRAILING_EMPTY),
      },
    });
    assert.match(lines, /brand\.only expects exactly 0 translated strings\./);
    assert.match(lines, /leaf\.trailingEmpty expects exactly 1 translated strings\./);
    assert.equal(webUiProviderSpanInstructions().includes("Leave empty strings empty"), false);
    assert.throws(
      () => reconstructWebUiMessageFromProviderSpans(ONE, [ONE, "extra"]),
      /Provider span count 2 does not match 1\./,
    );
  });

  it("reopens an older structure block and keeps the current shape closed", () => {
    assert.equal(WEB_UI_PROVIDER_SHAPE_VERSION, 4);
    assert.equal(
      isRecoverableWebUiActivationCheckpoint({
        phase: "structure_blocked",
        providerShapeVersion: WEB_UI_PROVIDER_SHAPE_VERSION - 1,
      }),
      true,
    );
    assert.equal(
      isRecoverableWebUiActivationCheckpoint({
        phase: "structure_blocked",
        providerShapeVersion: WEB_UI_PROVIDER_SHAPE_VERSION,
      }),
      false,
    );
    assert.equal(
      webUiProviderShapeFailureCountForBound({
        providerShapeVersion: WEB_UI_PROVIDER_SHAPE_VERSION - 1,
        providerShapeFailureCount: 6,
      }),
      0,
    );
    assert.equal(
      webUiProviderShapeFailureCountForBound({
        providerShapeVersion: WEB_UI_PROVIDER_SHAPE_VERSION,
        providerShapeFailureCount: 6,
      }),
      6,
    );
    assert.equal(WEB_UI_PROVIDER_SHAPE_STRUCTURE_FAILURE_BOUND, 6);
    assert.equal(LOCALIZATION_PROVIDER_MIN_INTERVAL_MS_DEFAULT, 10_000);
  });
});

describe("F.3.18E preserved validation and gate", () => {
  it("keeps packaged ICU repair valid and whole-pack validation strict", () => {
    const packaged = loadPackagedWebUiCatalog("zh-Hant");
    assert.ok(packaged);
    const tree = packaged as WebUiMessageTree;
    const report = validateWebUiMessageTreeAgainstEnglish(tree);
    assert.deepEqual(report.placeholderMismatchPaths, []);
    assert.equal(
      assessWebUiMessageTreeReadiness({ messages: tree, scope: "public" }).structuralInvalidCount,
      0,
    );
    assert.equal(
      assessWebUiMessageTreeReadiness({ messages: tree, scope: "participant" }).structuralInvalidCount,
      0,
    );
    const broken = structuredClone(tree) as {
      publicGeo?: { country?: { media?: { title?: string } } };
    };
    assert.equal(typeof broken.publicGeo?.country?.media?.title, "string");
    broken.publicGeo!.country!.media!.title = `${broken.publicGeo!.country!.media!.title} {inventedToken}`;
    const brokenReport = validateWebUiMessageTreeAgainstEnglish(broken as WebUiMessageTree);
    assert.ok(brokenReport.placeholderMismatchPaths.length > 0);
  });

  it("keeps Gate 15D.9.1 closed while WEB_UI is incomplete", () => {
    const closed = isLanguageActivationWebUiReadyForHistoricalEnqueue({
      webUi: {
        status: "in_progress",
        dataReady: false,
        missingKeyCount: 196,
        emptyKeyCount: 0,
        requiredKeyCount: 2925,
        effectiveSource: "bundled",
        detail: "Automatic retry scheduled.",
        preparationPhase: "structure_retry",
        checkpointId: "webui-act-lang-act-zh-hant-6-1678980a-a2f3b5dc",
        sourceHash: "hash",
        totalBatches: 702,
        completedBatches: 506,
        totalLeaves: 2925,
        completedLeaves: 506 * 6,
        providerFailure: false,
        nextAttemptAt: null,
        transientFailureCount: 0,
        lastTransientFailure: null,
      },
      publicWebUiDataReady: false,
      participantWebUiDataReady: false,
    });
    assert.equal(closed, false);
  });
});
