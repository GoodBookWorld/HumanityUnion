/**
 * Simplification Step 04A — public controlled-lifecycle preferredTerm map.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  ensureLanguageRegistrySeeded,
  ensureTerminologyGlossarySeeded,
  resetLanguageRegistryStoreForTests,
  resetTerminologyGlossaryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
  setTerminologyGlossaryForceMemoryForTests,
  updateTerminologyConcept,
} from "../../../src/modules/language/index.js";
import { resolveControlledLifecyclePreferredTermsForLocale } from "../../../src/modules/language/terminology-glossary/terminology-glossary.public.js";

describe("Localization Simplification Step 04A — public preferredTerm map", () => {
  beforeEach(async () => {
    setLanguageRegistryForceMemoryForTests(true);
    setTerminologyGlossaryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    resetTerminologyGlossaryStoreForTests();
    await ensureLanguageRegistrySeeded();
    await ensureTerminologyGlossarySeeded();
  });

  afterEach(() => {
    resetTerminologyGlossaryStoreForTests();
    resetLanguageRegistryStoreForTests();
    setTerminologyGlossaryForceMemoryForTests(false);
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("returns published preferredTerm keyed by lifecycle stageId", async () => {
    await updateTerminologyConcept("discussion", {
      translations: {
        uk: { preferredTerm: "Обговорення", aliases: [] },
      },
    });

    const resolved = await resolveControlledLifecyclePreferredTermsForLocale("uk");
    assert.equal(resolved.locale, "uk");
    assert.equal(resolved.preferredTermsByStageId.discussion, "Обговорення");
    assert.equal(resolved.preferredTermsByStageId.analysis, undefined);
  });

  it("omits stages without preferredTerm (WEB_UI/English remain caller fallback)", async () => {
    const resolved = await resolveControlledLifecyclePreferredTermsForLocale("uk");
    assert.deepEqual(resolved.preferredTermsByStageId, {});
  });

  it("does not hardcode locales in the public resolver", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(
      join(
        here,
        "../../../src/modules/language/terminology-glossary/terminology-glossary.public.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(src, /\b(?:uk|ar|zh-Hant|ka)\b/);
  });
});
