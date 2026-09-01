/**
 * Pack 02G Task 07B — warm target-resolution diagnostic field allowlist.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildContentTranslationWarmTargetDiagnostic,
  contentTranslationWarmRegistryCandidateDiagnosticKeys,
} from "../../../src/modules/language/content-translation-warm-diagnostic.js";

describe("Production Completion Pack 02G Task 07B — warm target diagnostic", () => {
  it("snapshot contains only approved identity + Registry + target fields", () => {
    const snapshot = buildContentTranslationWarmTargetDiagnostic({
      sourceKind: "initiative",
      sourceRecordId: "initiative-1784349613932",
      sourceVersion: "v-7455f4212786aa0a",
      sourceLanguage: "en",
      registryCandidates: [
        {
          locale: "en",
          enabled: true,
          contentTranslationEnabled: false,
        },
        {
          locale: "uk",
          enabled: true,
          contentTranslationEnabled: true,
        },
        // Hostile extra fields must not leak even if a caller spreads a full record.
        {
          locale: "ar",
          enabled: false,
          contentTranslationEnabled: false,
          englishName: "Arabic",
          aliases: ["secret"],
          providerMappings: { gemini: "x" },
        } as {
          locale: string;
          enabled: boolean;
          contentTranslationEnabled: boolean;
        },
      ],
      warmTargetLocales: ["uk"],
    });

    assert.deepEqual(Object.keys(snapshot).sort(), [
      "component",
      "registryCandidates",
      "sourceKind",
      "sourceLanguage",
      "sourceRecordId",
      "sourceVersion",
      "warmTargetLocales",
    ]);
    assert.equal(snapshot.component, "content-translation-warm");
    assert.equal(snapshot.sourceKind, "initiative");
    assert.equal(snapshot.sourceRecordId, "initiative-1784349613932");
    assert.equal(snapshot.sourceVersion, "v-7455f4212786aa0a");
    assert.equal(snapshot.sourceLanguage, "en");
    assert.deepEqual([...snapshot.warmTargetLocales], ["uk"]);

    const approved = contentTranslationWarmRegistryCandidateDiagnosticKeys();
    assert.deepEqual([...approved].sort(), [
      "contentTranslationEnabled",
      "enabled",
      "locale",
    ]);

    for (const row of snapshot.registryCandidates) {
      assert.deepEqual(Object.keys(row).sort(), [...approved].sort());
      assert.equal("englishName" in row, false);
      assert.equal("aliases" in row, false);
      assert.equal("providerMappings" in row, false);
      assert.equal("nativeName" in row, false);
      assert.equal("createdAt" in row, false);
      assert.equal("updatedAt" in row, false);
    }

    const uk = snapshot.registryCandidates.find((row) => row.locale === "uk");
    assert.ok(uk);
    assert.equal(uk.enabled, true);
    assert.equal(uk.contentTranslationEnabled, true);
  });
});
