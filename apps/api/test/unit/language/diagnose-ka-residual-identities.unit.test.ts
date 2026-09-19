import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  KA_RESIDUAL_DIAGNOSTIC_KINDS,
  KA_RESIDUAL_DIAGNOSTIC_LOCALE,
  assertKaResidualDiagnosticSafetyGate,
  classifyKaResidualIdentity,
  classifyBlockedAttemptLastErrorShape,
  classifyBlockedAttemptVersionProvenance,
  safeFailureClassToken,
} from "../../../src/scripts/diagnose-ka-residual-identities.logic.js";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("ka residual identity diagnostic", () => {
  it("classifies live current ahead of historical stale", () => {
    assert.equal(
      classifyKaResidualIdentity({
        liveCurrent: true,
        liveStale: false,
        preflightReady: false,
        readyState: "CURRENT",
        terminalFailureForCurrentVersion: false,
      }),
      "currentExactLiveVersion",
    );
  });

  it("classifies retry-ready missing and stale separately from terminal failure", () => {
    assert.equal(
      classifyKaResidualIdentity({
        liveCurrent: false,
        liveStale: false,
        preflightReady: true,
        readyState: "MISSING_READY_FOR_WARM",
        terminalFailureForCurrentVersion: false,
      }),
      "retryReadyMissing",
    );
    assert.equal(
      classifyKaResidualIdentity({
        liveCurrent: false,
        liveStale: true,
        preflightReady: true,
        readyState: "MISSING_READY_FOR_WARM",
        terminalFailureForCurrentVersion: false,
      }),
      "retryReadyStale",
    );
    assert.equal(
      classifyKaResidualIdentity({
        liveCurrent: false,
        liveStale: false,
        preflightReady: false,
        readyState: "BLOCKED",
        terminalFailureForCurrentVersion: true,
      }),
      "blockedFailedAttempt",
    );
    assert.equal(
      classifyKaResidualIdentity({
        liveCurrent: false,
        liveStale: false,
        preflightReady: false,
        readyState: "BLOCKED",
        terminalFailureForCurrentVersion: false,
      }),
      "sourceOrPreflightBlocked",
    );
  });

  it("refuses any database other than staging and any missing read-only flag", () => {
    assert.equal(KA_RESIDUAL_DIAGNOSTIC_LOCALE, "ka");
    assert.deepEqual([...KA_RESIDUAL_DIAGNOSTIC_KINDS], [
      "initiative",
      "discussion_comment",
      "improvement_proposal",
      "initiative_revision",
      "decision_session",
      "collective_decision",
      "implementation_commitment",
      "implementation_tracking",
    ]);
    const refused = assertKaResidualDiagnosticSafetyGate({
      nodeEnv: "production",
      mongoDatabase: "humanity_union_dev",
      readOnlyFlag: "1",
    });
    assert.equal(refused.ok, false);
    const missingFlag = assertKaResidualDiagnosticSafetyGate({
      nodeEnv: "production",
      mongoDatabase: "humanity_union_staging",
      readOnlyFlag: undefined,
    });
    assert.equal(missingFlag.ok, false);
  });

  it("attributes blocked sourceVersion only from the attempt, never from the live version", () => {
    assert.deepEqual(
      classifyBlockedAttemptVersionProvenance({
        metadataSourceVersion: "attempt-v",
        resolvedAttemptSourceVersion: "attempt-v",
        liveSourceVersion: "attempt-v",
      }),
      { provenance: "failure_metadata", versionEqualsLive: true },
    );
    assert.deepEqual(
      classifyBlockedAttemptVersionProvenance({
        metadataSourceVersion: null,
        resolvedAttemptSourceVersion: "payload-v",
        liveSourceVersion: "payload-v",
      }),
      { provenance: "command_payload", versionEqualsLive: true },
    );
    assert.deepEqual(
      classifyBlockedAttemptVersionProvenance({
        metadataSourceVersion: null,
        resolvedAttemptSourceVersion: null,
        liveSourceVersion: "live-v",
      }),
      { provenance: "none", versionEqualsLive: false },
    );
    assert.equal(classifyBlockedAttemptLastErrorShape("CT_FAIL_META_V1:{}"), "structured_metadata");
    assert.equal(classifyBlockedAttemptLastErrorShape("plain failure"), "unstructured");
    assert.equal(safeFailureClassToken("secret prose"), "unlisted");
    assert.equal(safeFailureClassToken("PROVIDER_TIMEOUT"), "PROVIDER_TIMEOUT");
  });

  it("does not call activation, enqueue, or the provider from the script", () => {
    const script = readFileSync(
      join(apiRoot, "src/scripts/diagnose-ka-residual-identities.ts"),
      "utf8",
    );
    assert.match(script, /discoverStagingInitiativePathWarmSources/);
    assert.match(script, /loadTranslatableSource/);
    assert.match(script, /buildPublicLocalizationRetryPreflight/);
    assert.match(script, /peekContentTranslationWarmOutboxFailure/);
    assert.match(script, /sourceVersionProvenance/);
    assert.doesNotMatch(script, /console\.log\([^)]*lastErrorRaw/);
    assert.doesNotMatch(script, /translatedContent|source fields/);
    assert.match(script, /HU_READ_ONLY_DIAGNOSTIC/);
    assert.doesNotMatch(script, /activateLanguageLocalization/);
    assert.doesNotMatch(script, /processLanguageActivationJob/);
    assert.doesNotMatch(script, /enqueueContentTranslationWarmRequested/);
    assert.doesNotMatch(script, /runPublicLocalizationResidualRetry/);
    assert.doesNotMatch(script, /ensureMongoIndexes/);
    assert.doesNotMatch(script, /syncInitiativeStoreAfterMongoHydrate/);

    const enqueue = readFileSync(
      join(apiRoot, "src/modules/language/content-translation-warm-enqueue.ts"),
      "utf8",
    );
    const provider = readFileSync(
      join(apiRoot, "src/modules/language/resolve-translation-provider.ts"),
      "utf8",
    );
    const registry = readFileSync(
      join(apiRoot, "src/modules/language/language-registry/language-registry.repository.ts"),
      "utf8",
    );
    assert.match(enqueue, /refuseReadOnlyDiagnosticMutation/);
    assert.match(provider, /read-only diagnostic cannot call the translation provider/);
    assert.match(registry, /refuseReadOnlyDiagnosticMutation\("seed the language registry"\)/);
  });
});
