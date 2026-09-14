/**
 * Simplification Step 04C — controlled concept preferredTerm map on shared endpoint.
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

describe("Localization Simplification Step 04C — preferredTermsByConceptId", () => {
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

  it("includes lifecycle stage preferredTerms under preferredTermsByConceptId", async () => {
    await updateTerminologyConcept("discussion", {
      translations: {
        uk: { preferredTerm: "Обговорення", aliases: [] },
      },
    });

    const resolved = await resolveControlledLifecyclePreferredTermsForLocale("uk");
    assert.equal(resolved.preferredTermsByStageId.discussion, "Обговорення");
    assert.equal(resolved.preferredTermsByConceptId.discussion, "Обговорення");
  });

  it("maps Glossary active_ally onto vocabulary concept active_allies", async () => {
    await updateTerminologyConcept("active_ally", {
      translations: {
        uk: { preferredTerm: "Активний союзник", aliases: [] },
      },
    });

    const resolved = await resolveControlledLifecyclePreferredTermsForLocale("uk");
    assert.equal(resolved.preferredTermsByConceptId.active_allies, "Активний союзник");
  });

  it("includes domain concept preferredTerms without a new endpoint", async () => {
    await updateTerminologyConcept("ready_to_collaborate", {
      translations: {
        uk: { preferredTerm: "Готовий співпрацювати", aliases: [] },
      },
    });

    const resolved = await resolveControlledLifecyclePreferredTermsForLocale("uk");
    assert.equal(
      resolved.preferredTermsByConceptId.ready_to_collaborate,
      "Готовий співпрацювати",
    );

    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const here = dirname(fileURLToPath(import.meta.url));
    const routes = readFileSync(
      join(
        here,
        "../../../src/modules/language/terminology-glossary/public-terminology-glossary.routes.ts",
      ),
      "utf8",
    );
    assert.equal(
      (routes.match(/Router\(\)|publicTerminologyGlossaryRouter\.(get|post)/g) || []).length >= 1,
      true,
    );
    assert.match(routes, /controlled-lifecycle-preferred-terms/);
    assert.doesNotMatch(routes, /controlled-vocabulary-preferred-terms/);
  });

  it("does not hardcode locales", async () => {
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
