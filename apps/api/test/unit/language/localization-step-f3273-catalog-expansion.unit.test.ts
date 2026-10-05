/**
 * STEP F.3.27.3 — one new required WEB_UI leaf.
 * Fingerprinted locales reuse every unchanged leaf. A pack with no fingerprints
 * is not reused from packaged or bundled catalogs. No live Gemini.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isParticipantWebUiRequiredPath,
  isPublicReaderWebUiRequiredPath,
} from "@hu/types";

import {
  emptyPendingDomains,
  isLanguageActivationWebUiReadyForHistoricalEnqueue,
} from "../../../src/modules/language/language-localization-activation/language-activation-job.domains.js";
import { assessWebUiMessageTreeReadiness } from "../../../src/modules/language/language-localization-activation/assess-web-ui-catalog-readiness.js";
import {
  buildWebUiSourceFingerprintsByPath,
  loadPublicWebUiEnglishCorpus,
  planWebUiDraftBatches,
  unflattenWebUiMessageMap,
} from "../../../src/modules/web-ui-message-packs/web-ui-draft-builder.js";
import { classifyWebUiCatalogLeaves } from "../../../src/modules/web-ui-message-packs/web-ui-leaf-reuse.js";
import { loadBundledWebUiMessagePackFromFs } from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.validate.js";

const NEW_KEY = "common.interfaceNote";

describe("STEP F.3.27.3 incremental WEB_UI catalog expansion", () => {
  it("the new English leaf is required and is the only provider residual for a fingerprinted pack", () => {
    const corpus = loadPublicWebUiEnglishCorpus();
    assert.equal(corpus.requiredPaths.length, 4115);
    assert.equal(corpus.flat[NEW_KEY], "Interface note");
    assert.equal(isPublicReaderWebUiRequiredPath(NEW_KEY), true);
    assert.equal(isParticipantWebUiRequiredPath(NEW_KEY), false);

    const oldPaths = corpus.requiredPaths.filter((pathKey) => pathKey !== NEW_KEY);
    assert.equal(oldPaths.length, 4114);
    const fingerprints = buildWebUiSourceFingerprintsByPath(corpus.flat, oldPaths);
    const localized: Record<string, string> = {};
    for (const pathKey of oldPaths) {
      localized[pathKey] = corpus.flat[pathKey] ?? "";
    }
    const decisions = classifyWebUiCatalogLeaves({
      englishFlat: corpus.flat,
      mongo: unflattenWebUiMessageMap(localized),
      mongoSourceFingerprintsByPath: fingerprints,
      packaged: null,
      bundled: null,
    });
    for (const pathKey of oldPaths) {
      assert.equal(decisions.get(pathKey)?.classification, "REUSE_CURRENT", pathKey);
    }
    assert.equal(decisions.get(NEW_KEY)?.classification, "MISSING");

    const residual: string[] = [];
    for (const batch of planWebUiDraftBatches(corpus.flat)) {
      for (const key of batch.keys) {
        if (decisions.get(key)?.classification !== "REUSE_CURRENT") {
          residual.push(key);
        }
      }
    }
    assert.deepEqual(residual, [NEW_KEY]);

    const publicReady = assessWebUiMessageTreeReadiness({
      messages: unflattenWebUiMessageMap(localized),
      requiredPaths: corpus.requiredPaths.filter((pathKey) =>
        isPublicReaderWebUiRequiredPath(pathKey),
      ),
    });
    assert.equal(publicReady.dataReady, false);
    assert.equal(publicReady.missingKeyCount, 1);
    assert.deepEqual(publicReady.sampleMissingPaths, [NEW_KEY]);
    const participantReady = assessWebUiMessageTreeReadiness({
      messages: unflattenWebUiMessageMap(localized),
      requiredPaths: corpus.requiredPaths.filter((pathKey) =>
        isParticipantWebUiRequiredPath(pathKey),
      ),
    });
    assert.equal(participantReady.dataReady, true);

    const otherwiseReady = {
      ...emptyPendingDomains().webUi,
      status: "ready" as const,
      dataReady: true,
      preparationPhase: "ready" as const,
    };
    assert.equal(
      isLanguageActivationWebUiReadyForHistoricalEnqueue({
        webUi: otherwiseReady,
        publicWebUiDataReady: publicReady.dataReady,
        participantWebUiDataReady: participantReady.dataReady,
      }),
      false,
    );

    const published = assessWebUiMessageTreeReadiness({
      messages: unflattenWebUiMessageMap({
        ...localized,
        [NEW_KEY]: "Примітка інтерфейсу",
      }),
      requiredPaths: corpus.requiredPaths.filter((pathKey) =>
        isPublicReaderWebUiRequiredPath(pathKey),
      ),
    });
    assert.equal(published.dataReady, true);
    assert.equal(
      isLanguageActivationWebUiReadyForHistoricalEnqueue({
        webUi: otherwiseReady,
        publicWebUiDataReady: published.dataReady,
        participantWebUiDataReady: participantReady.dataReady,
      }),
      true,
    );
  });

  it("a fingerprint-less pack is not reused from packaged or bundled Ukrainian", () => {
    const corpus = loadPublicWebUiEnglishCorpus();
    const ukrainian = loadBundledWebUiMessagePackFromFs("uk");
    assert.ok(ukrainian);
    const decisions = classifyWebUiCatalogLeaves({
      englishFlat: corpus.flat,
      mongo: ukrainian,
      mongoSourceFingerprintsByPath: null,
      packaged: ukrainian,
      bundled: ukrainian,
    });
    const reused = corpus.requiredPaths.filter(
      (pathKey) => decisions.get(pathKey)?.classification === "REUSE_CURRENT",
    );
    assert.deepEqual(reused, []);
    assert.equal(decisions.get(NEW_KEY)?.classification, "MISSING");
    assert.equal(decisions.get("common.save")?.classification, "STALE_SOURCE");
  });
});
