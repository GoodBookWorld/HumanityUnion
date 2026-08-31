/**
 * Production Completion Pack 02F Task 02 — Terminology Glossary foundation tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, it } from "node:test";

import { isInitiativeLifecycleStageId } from "@hu/types";

import {
  HUMANITY_UNION_TRANSLATION_TERMINOLOGY,
  TERMINOLOGY_GLOSSARY_SEED_DEFINITIONS,
  TerminologyGlossaryValidationError,
  buildEnglishProviderTerminologyContext,
  ensureLanguageRegistrySeeded,
  ensureTerminologyGlossarySeeded,
  getTerminologyConceptById,
  listTerminologyConcepts,
  normalizeGlossaryAliasList,
  resetLanguageRegistryStoreForTests,
  resetTerminologyGlossaryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
  setTerminologyGlossaryForceMemoryForTests,
  updateTerminologyConcept,
} from "../../../src/modules/language/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");

describe("Production Completion Pack 02F Task 02 — Terminology Glossary", () => {
  beforeEach(async () => {
    setLanguageRegistryForceMemoryForTests(true);
    setTerminologyGlossaryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    resetTerminologyGlossaryStoreForTests();
    await ensureLanguageRegistrySeeded();
  });

  afterEach(() => {
    resetTerminologyGlossaryStoreForTests();
    resetLanguageRegistryStoreForTests();
    setTerminologyGlossaryForceMemoryForTests(false);
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("seed bootstrap creates required concepts", async () => {
    const first = await ensureTerminologyGlossarySeeded();
    assert.equal(first.inserted, TERMINOLOGY_GLOSSARY_SEED_DEFINITIONS.length);
    assert.equal(first.skippedExisting, 0);
    assert.equal(first.conceptIds.length, TERMINOLOGY_GLOSSARY_SEED_DEFINITIONS.length);

    const listed = await listTerminologyConcepts();
    assert.equal(listed.length, TERMINOLOGY_GLOSSARY_SEED_DEFINITIONS.length);

    for (const definition of TERMINOLOGY_GLOSSARY_SEED_DEFINITIONS) {
      const row = await getTerminologyConceptById(definition.conceptId);
      assert.ok(row);
      assert.equal(row.canonicalEnglishTerm, definition.canonicalEnglishTerm);
      assert.equal(row.category, definition.category);
      assert.equal(row.status, "published");
    }
  });

  it("bootstrap is idempotent", async () => {
    const first = await ensureTerminologyGlossarySeeded();
    assert.ok(first.inserted > 0);
    const second = await ensureTerminologyGlossarySeeded();
    assert.equal(second.inserted, 0);
    assert.equal(second.skippedExisting, TERMINOLOGY_GLOSSARY_SEED_DEFINITIONS.length);
    assert.equal(second.reconciled, 0);
  });

  it("restart/bootstrap preserves mutable Admin translation data", async () => {
    await ensureTerminologyGlossarySeeded();
    await updateTerminologyConcept("participant", {
      translations: {
        uk: { preferredTerm: "Учасник", aliases: ["учасниця"] },
      },
      status: "draft",
      updatedByParticipantId: "participant-admin-1",
    });

    const reseed = await ensureTerminologyGlossarySeeded();
    assert.equal(reseed.inserted, 0);

    const participant = await getTerminologyConceptById("participant");
    assert.ok(participant);
    assert.equal(participant.status, "draft");
    assert.equal(participant.translations.uk?.preferredTerm, "Учасник");
    assert.deepEqual(participant.translations.uk?.aliases, ["учасниця"]);
    assert.equal(participant.updatedByParticipantId, "participant-admin-1");
  });

  it("conceptId uniqueness is enforced by seed catalog", () => {
    const ids = TERMINOLOGY_GLOSSARY_SEED_DEFINITIONS.map((d) => d.conceptId);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("immutable seeded identity cannot be changed through repository update", async () => {
    await ensureTerminologyGlossarySeeded();
    const before = await getTerminologyConceptById("initiative");
    assert.ok(before);

    const updated = await updateTerminologyConcept("initiative", {
      status: "retired",
      translations: {
        uk: { preferredTerm: "Ініціатива", aliases: [] },
      },
      updatedByParticipantId: "participant-admin-2",
    });

    assert.equal(updated.conceptId, before.conceptId);
    assert.equal(updated.canonicalEnglishTerm, before.canonicalEnglishTerm);
    assert.equal(updated.category, before.category);
    assert.deepEqual(updated.linkedRefs, before.linkedRefs);
    assert.equal(updated.status, "retired");
  });

  it("Participant / Member / Membership remain distinct", async () => {
    await ensureTerminologyGlossarySeeded();
    const participant = await getTerminologyConceptById("participant");
    const member = await getTerminologyConceptById("member");
    const membership = await getTerminologyConceptById("membership");
    assert.ok(participant && member && membership);
    assert.notEqual(participant.conceptId, member.conceptId);
    assert.notEqual(member.conceptId, membership.conceptId);
    assert.notEqual(participant.canonicalEnglishTerm, member.canonicalEnglishTerm);
    assert.notEqual(member.canonicalEnglishTerm, membership.canonicalEnglishTerm);

    await assert.rejects(
      () =>
        updateTerminologyConcept("member", {
          translations: {
            uk: { preferredTerm: "Учасник", aliases: ["Participant"] },
          },
        }),
      TerminologyGlossaryValidationError,
    );
  });

  it("lifecycle linkedRefs use existing stable stage IDs without redefining them", () => {
    for (const definition of TERMINOLOGY_GLOSSARY_SEED_DEFINITIONS) {
      const stageId = definition.linkedRefs?.stageId;
      if (stageId !== undefined) {
        assert.equal(isInitiativeLifecycleStageId(stageId), true);
      }
    }
    const proposal = TERMINOLOGY_GLOSSARY_SEED_DEFINITIONS.find(
      (d) => d.conceptId === "improvement_proposal",
    );
    assert.equal(proposal?.linkedRefs?.stageId, "proposal");
    assert.equal(proposal?.canonicalEnglishTerm, "Improvement Proposal");

    const revision = TERMINOLOGY_GLOSSARY_SEED_DEFINITIONS.find((d) => d.conceptId === "revision");
    assert.equal(revision?.linkedRefs?.stageId, undefined);
    assert.equal(revision?.linkedRefs?.civicEntityType, "initiative_revision");
  });

  it("locale alias canonicalization includes zh-TW -> zh-Hant", async () => {
    await ensureTerminologyGlossarySeeded();
    const updated = await updateTerminologyConcept("workspace", {
      translations: {
        "zh-TW": { preferredTerm: "工作區", aliases: ["工作空间"] },
      },
    });
    assert.equal(updated.translations["zh-TW"], undefined);
    assert.equal(updated.translations["zh-Hant"]?.preferredTerm, "工作區");
  });

  it("disabled locale translations can remain stored", async () => {
    await ensureTerminologyGlossarySeeded();
    // uk is seeded disabled in Language Registry
    const updated = await updateTerminologyConcept("assistant", {
      translations: {
        uk: { preferredTerm: "Асистент", aliases: [] },
      },
    });
    assert.equal(updated.translations.uk?.preferredTerm, "Асистент");
  });

  it("invalid/unknown locale rejected on mutation", async () => {
    await ensureTerminologyGlossarySeeded();
    await assert.rejects(
      () =>
        updateTerminologyConcept("assistant", {
          translations: {
            "xx-INVALID": { preferredTerm: "Nope", aliases: [] },
          },
        }),
      TerminologyGlossaryValidationError,
    );
  });

  it("aliases dedupe deterministically", () => {
    assert.deepEqual(normalizeGlossaryAliasList([" Alpha ", "alpha", "Beta", " beta "]), [
      "Alpha",
      "Beta",
    ]);
  });

  it("ambiguous cross-concept canonical alias rejected", async () => {
    await ensureTerminologyGlossarySeeded();
    await assert.rejects(
      () =>
        updateTerminologyConcept("workspace", {
          translations: {
            uk: { preferredTerm: "Робочий простір", aliases: ["Initiative"] },
          },
        }),
      TerminologyGlossaryValidationError,
    );
  });

  it("published/draft/retired status contract", async () => {
    await ensureTerminologyGlossarySeeded();
    for (const status of ["draft", "published", "retired"] as const) {
      const updated = await updateTerminologyConcept("civic_media", { status });
      assert.equal(updated.status, status);
    }
    await assert.rejects(
      () =>
        updateTerminologyConcept("civic_media", {
          status: "live" as unknown as "draft",
        }),
      TerminologyGlossaryValidationError,
    );
  });

  it("English terminology list remains compatibility fallback; Task 05 owns provider injection", async () => {
    const fromSeed = buildEnglishProviderTerminologyContext();
    assert.equal(HUMANITY_UNION_TRANSLATION_TERMINOLOGY, fromSeed);
    assert.match(HUMANITY_UNION_TRANSLATION_TERMINOLOGY, /Participant/);
    assert.match(HUMANITY_UNION_TRANSLATION_TERMINOLOGY, /Member/);
    assert.match(HUMANITY_UNION_TRANSLATION_TERMINOLOGY, /Initiative/);
    assert.match(HUMANITY_UNION_TRANSLATION_TERMINOLOGY, /Workspace/);

    const geminiSource = readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/language/providers/gemini-translation-provider.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(geminiSource, /Preserve these Humanity Union terms consistently/);
    assert.match(geminiSource, /preferred target-language term/);
    assert.match(geminiSource, /machine identifiers/);
    assert.match(geminiSource, /HUMANITY_UNION_TRANSLATION_TERMINOLOGY/);

    const contentService = readFileSync(
      path.join(repoRoot, "apps/api/src/modules/language/content-translation.service.ts"),
      "utf8",
    );
    assert.match(contentService, /resolveProviderTerminologyContext/);
    assert.doesNotMatch(
      contentService,
      /terminologyContext:\s*HUMANITY_UNION_TRANSLATION_TERMINOLOGY/,
    );
  });

  it("no UI catalog authority moved into glossary", () => {
    const enCatalog = readFileSync(
      path.join(repoRoot, "apps/web/src/features/i18n/messages/en.json"),
      "utf8",
    );
    assert.match(enCatalog, /"civicMedia"/);
    assert.match(enCatalog, /"editProfile"/);

    const seedSource = readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/language/terminology-glossary/terminology-glossary.seed.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(seedSource, /editProfile/);
    assert.doesNotMatch(seedSource, /twoStepLogin/);
    assert.doesNotMatch(seedSource, /forgotPassword/);
  });

  it("wires glossary seed into Mongo bootstrap after Language Registry", () => {
    const bootstrapSource = readFileSync(
      path.join(repoRoot, "apps/api/src/infrastructure/mongodb/bootstrap-mongo-persistence.ts"),
      "utf8",
    );
    assert.match(bootstrapSource, /ensureTerminologyGlossarySeeded/);
    assert.match(
      bootstrapSource,
      /await ensureLanguageRegistrySeeded\(\);\s*\n\s*(?:\/\/[^\n]*\n\s*)*await ensureTerminologyGlossarySeeded\(\);/m,
    );
  });
});
