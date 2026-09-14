/**
 * Pack 08I.15 — API contract: CIVIC discovery + Admin domains + DEFAULT_LOCALIZABLE.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ADMIN_MANAGED_LOCALIZATION_DOMAINS,
  CIVIC_CONTENT_MANUAL_OVERRIDE_STATUS,
  DEFAULT_LOCALIZABLE_RULE,
  LOCALIZATION_RESOLUTION_PRIORITY,
} from "../../../src/modules/language/localization-ownership.js";
import { CONTENT_TRANSLATION_FIELD_ALLOWLIST } from "../../../src/modules/language/content-translation-eligibility.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function readApi(relative: string): string {
  return readFileSync(path.resolve(here, "../../../", relative), "utf8");
}

describe("Pack 08I.15 — API localization ownership", () => {
  it("DEFAULT_LOCALIZABLE rule is exported and Admin domains preserved", () => {
    assert.match(DEFAULT_LOCALIZABLE_RULE, /localizable by default/i);
    assert.deepEqual([...ADMIN_MANAGED_LOCALIZATION_DOMAINS], [
      "BRAND_LOCALIZATION",
      "LEGAL_LOCALIZATION",
    ]);
    assert.equal(CIVIC_CONTENT_MANUAL_OVERRIDE_STATUS.adminWritePathExists, false);
    assert.ok(LOCALIZATION_RESOLUTION_PRIORITY.includes("BRAND_LOCALIZATION"));
  });

  it("every public CIVIC allowlist kind remains discoverable via warm enumerator", () => {
    const warm = readApi(
      "src/modules/language/content-translation-staging-warm-backfill.ts",
    );
    for (const kind of [
      "initiative",
      "discussion_comment",
      "collaborative_analysis",
      "petition",
      "improvement_proposal",
      "official_response",
      "public_impact",
      "civic_archive",
    ] as const) {
      assert.ok(
        (CONTENT_TRANSLATION_FIELD_ALLOWLIST as Record<string, readonly string[]>)[kind]
          ?.length >= 0,
      );
      assert.match(warm, new RegExp(`"${kind}"`));
    }
  });

  it("Brand/Legal modules are not wired into ContentTranslationWarm", () => {
    const consumer = readApi("src/modules/language/content-translation-warm-consumer.ts");
    assert.doesNotMatch(consumer, /brand-localization|legal-localization/);
    const warmTargets = readApi("src/modules/language/content-translation-warm-targets.ts");
    assert.doesNotMatch(warmTargets, /brand-localization|legal-localization/);
    assert.ok(ADMIN_MANAGED_LOCALIZATION_DOMAINS.includes("BRAND_LOCALIZATION"));
    assert.ok(ADMIN_MANAGED_LOCALIZATION_DOMAINS.includes("LEGAL_LOCALIZATION"));
  });

  it("machine generation always writes translationKind machine (no silent Admin override)", () => {
    const service = readApi("src/modules/language/content-translation.service.ts");
    assert.match(service, /translationKind:\s*"machine"/);
  });
});
