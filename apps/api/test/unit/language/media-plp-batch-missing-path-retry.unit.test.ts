/**
 * Bounded same-batch MISSING_PATH retry — Media PLP provider boundary.
 */
import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";

import {
  buildProviderOwnedMachinePayload,
  MEDIA_PLP_ENTITY_TYPE,
} from "@hu/types";

import { CIVIC_MEDIA_FAQ, CIVIC_MEDIA_OVERVIEW } from "../../../src/modules/civic-media-center/content/sections.js";
import {
  callMediaPlpMaterializerProviderOnce,
  encodePlpTranslationsContract,
  FakeLocalMediaPlpTransport,
  MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
  planPlpProviderBatches,
  resetMediaPlpMaterializerCountersForTests,
  resetMediaPlpMaterializerProviderCallBudget,
} from "../../../src/modules/language/media-plp-materializer/index.js";
import {
  asMediaPlpPresentationNode,
  buildCanonicalEditorialPresentation,
  collectAutoPaths,
  isCollectedPathMachineEligible,
  resolveFieldPolicyForEntityType,
} from "../../../src/modules/language/published-localized-presentation/index.js";

function editorialAutoValues(): Record<string, string> {
  const tree = asMediaPlpPresentationNode(
    buildCanonicalEditorialPresentation({
      overview: CIVIC_MEDIA_OVERVIEW,
      faq: [...CIVIC_MEDIA_FAQ],
    }),
  );
  const policy = resolveFieldPolicyForEntityType(
    MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
  );
  const values: Record<string, string> = {};
  for (const node of collectAutoPaths(tree)) {
    if (isCollectedPathMachineEligible(node.path, policy)) {
      values[node.path] = node.value;
    }
  }
  return values;
}

function translateComplete(requestText: string, locale: string): string {
  const parsed = JSON.parse(requestText) as {
    translations: Array<{ key: string; value: string }>;
  };
  return JSON.stringify({
    translations: parsed.translations.map((row) => ({
      key: row.key,
      value: `[${locale}] ${row.value}`,
    })),
  });
}

function translateOmitOneKey(requestText: string, locale: string): string {
  const parsed = JSON.parse(requestText) as {
    translations: Array<{ key: string; value: string }>;
  };
  const omit = parsed.translations[0]?.key;
  return JSON.stringify({
    translations: parsed.translations
      .filter((row) => row.key !== omit)
      .map((row) => ({
        key: row.key,
        value: `[${locale}] ${row.value}`,
      })),
  });
}

beforeEach(() => {
  resetMediaPlpMaterializerCountersForTests();
});

afterEach(() => {
  resetMediaPlpMaterializerCountersForTests();
});

describe("Media PLP provider batch MISSING_PATH bounded retry", () => {
  it("1. first batch attempt missing key, retry complete → entity proceeds", async () => {
    const autoValues = editorialAutoValues();
    const { payload } = buildProviderOwnedMachinePayload(autoValues);
    const batches = planPlpProviderBatches(payload);
    assert.ok(batches.length >= 2);

    const seenPayloads: string[] = [];
    let batch1Attempts = 0;
    const provider = new FakeLocalMediaPlpTransport({
      responseText: (request) => {
        seenPayloads.push(request.text);
        const callIndex = seenPayloads.length - 1;
        // Batch 0 complete.
        if (callIndex === 0) {
          return translateComplete(request.text, "uk");
        }
        // Batch 1: first attempt incomplete, retry complete.
        if (callIndex === 1 || callIndex === 2) {
          batch1Attempts += 1;
          if (batch1Attempts === 1) {
            return translateOmitOneKey(request.text, "uk");
          }
          return translateComplete(request.text, "uk");
        }
        return translateComplete(request.text, "uk");
      },
    });

    resetMediaPlpMaterializerProviderCallBudget();
    const result = await callMediaPlpMaterializerProviderOnce({
      provider,
      locale: "uk",
      autoValues,
      sourceRecordId: "civic_media_editorial:civic-media-center",
      sourceVersion: "v-test",
      PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(batch1Attempts, 2);
    // batch0 + batch1 fail + batch1 retry + remaining batches
    assert.equal(provider.getRequestCountForTests(), batches.length + 1);
    // Same batch payload resent on retry (batch index 1).
    assert.equal(seenPayloads[1], seenPayloads[2]);
    // Successful prior batch not resent as entity restart.
    assert.notEqual(seenPayloads[0], seenPayloads[1]);
    for (const path of Object.keys(autoValues)) {
      assert.ok(result.values[path]?.trim());
    }
  });

  it("2. first + retry both missing → abort, zero publication values", async () => {
    const autoValues = editorialAutoValues();
    const { payload } = buildProviderOwnedMachinePayload(autoValues);
    const batches = planPlpProviderBatches(payload);
    assert.ok(batches.length >= 2);

    let batch1Attempts = 0;
    const provider = new FakeLocalMediaPlpTransport({
      responseText: (request) => {
        const call = provider.getRequestCountForTests();
        if (call === 1) {
          return translateComplete(request.text, "uk");
        }
        // Both attempts for batch 1 omit a key.
        batch1Attempts += 1;
        return translateOmitOneKey(request.text, "uk");
      },
    });

    resetMediaPlpMaterializerProviderCallBudget();
    const result = await callMediaPlpMaterializerProviderOnce({
      provider,
      locale: "uk",
      autoValues,
      sourceRecordId: "civic_media_editorial:civic-media-center",
      sourceVersion: "v-test",
      PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
    });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(batch1Attempts, 2);
    assert.equal(provider.getRequestCountForTests(), 3); // batch0 + 2x batch1
    assert.match(result.message, /PARTIAL:MISSING_PATH/);
    assert.match(result.message, /PROVIDER_FAILURE_SUBTYPE=EXPECTED_KEY_MISSING/);
    assert.match(result.message, /PROVIDER_BATCH_INDEX=1/);
    assert.match(result.message, /PROVIDER_BATCH_ATTEMPT=2/);
    assert.match(result.message, /PROVIDER_BATCH_EXPECTED_KEY_COUNT=/);
    assert.match(result.message, /PROVIDER_BATCH_MISSING_KEY_COUNT=/);
    assert.equal(result.forensics?.PROVIDER_BATCH_ATTEMPT, 2);
    assert.ok(
      (result.forensics?.PROVIDER_BATCH_EXPECTED_KEY_COUNT ?? 0) >
        (result.forensics?.PROVIDER_BATCH_RETURNED_KEY_COUNT ?? 0),
    );
    // Entity semantic expected remains distinct from batch expected.
    assert.equal(
      result.forensics?.PROVIDER_EXPECTED_KEY_COUNT,
      Object.keys(autoValues).length,
    );
    assert.notEqual(
      result.forensics?.PROVIDER_EXPECTED_KEY_COUNT,
      result.forensics?.PROVIDER_BATCH_EXPECTED_KEY_COUNT,
    );
  });

  it("3. successful batches are not retried; retry is batch-scoped only", async () => {
    const autoValues = editorialAutoValues();
    const { payload } = buildProviderOwnedMachinePayload(autoValues);
    const batches = planPlpProviderBatches(payload);
    assert.ok(batches.length >= 3);

    const batch2Payload = JSON.stringify(
      encodePlpTranslationsContract(batches[2]!),
    );

    const payloadsByCall: string[] = [];
    let batch2Attempts = 0;
    const provider = new FakeLocalMediaPlpTransport({
      responseText: (request) => {
        payloadsByCall.push(request.text);
        if (request.text === batch2Payload) {
          batch2Attempts += 1;
          if (batch2Attempts === 1) {
            return translateOmitOneKey(request.text, "ar");
          }
          return translateComplete(request.text, "ar");
        }
        return translateComplete(request.text, "ar");
      },
    });

    resetMediaPlpMaterializerProviderCallBudget();
    const result = await callMediaPlpMaterializerProviderOnce({
      provider,
      locale: "ar",
      autoValues,
      sourceRecordId: "civic_media_editorial:civic-media-center",
      sourceVersion: "v-test",
      PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(batch2Attempts, 2);
    assert.equal(provider.getRequestCountForTests(), batches.length + 1);
    // Successful earlier batches appear exactly once (not entity restart).
    assert.equal(
      payloadsByCall.filter((p) => p === payloadsByCall[0]).length,
      1,
    );
    assert.equal(
      payloadsByCall.filter((p) => p === payloadsByCall[1]).length,
      1,
    );
    // Failed batch payload appears twice (attempt + retry).
    assert.equal(
      payloadsByCall.filter((p) => p === batch2Payload).length,
      2,
    );
  });
});
