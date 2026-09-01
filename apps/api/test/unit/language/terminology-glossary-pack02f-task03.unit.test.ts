/**
 * Production Completion Pack 02F Task 03 — Terminology Glossary Admin API tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
  AdministrationValidationError,
} from "../../../src/modules/administration/administration.errors.js";
import {
  listAdministrationAuditsForTarget,
  resetAdministrationAuditMemoryForTests,
  setAdministrationAuditForceMemoryForTests,
} from "../../../src/modules/administration/index.js";
import {
  TERMINOLOGY_GLOSSARY_SEED_DEFINITIONS,
  TerminologyGlossaryNotFoundError,
  TerminologyGlossaryValidationError,
  ensureLanguageRegistrySeeded,
  ensureTerminologyGlossarySeeded,
  getAdminTerminologyConcept,
  getLanguageRegistryByLocale,
  getTerminologyConceptById,
  listAdminTerminologyConcepts,
  resetLanguageRegistryStoreForTests,
  resetTerminologyGlossaryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
  setTerminologyGlossaryAdminAssertOverrideForTests,
  setTerminologyGlossaryForceMemoryForTests,
  updateAdminTerminologyConcept,
} from "../../../src/modules/language/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");

describe("Production Completion Pack 02F Task 03 — Terminology Glossary Admin API", () => {
  beforeEach(async () => {
    setLanguageRegistryForceMemoryForTests(true);
    setTerminologyGlossaryForceMemoryForTests(true);
    setAdministrationAuditForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    resetTerminologyGlossaryStoreForTests();
    resetAdministrationAuditMemoryForTests();
    setTerminologyGlossaryAdminAssertOverrideForTests(async (userId) => {
      if (!userId.trim()) {
        throw new AdministrationUnauthorizedError();
      }
      if (userId === "member-1") {
        throw new AdministrationForbiddenError("Administrator access is required.");
      }
      if (userId !== "admin-1") {
        throw new AdministrationUnauthorizedError();
      }
      return { userId: "admin-1", participantId: "participant-admin-1" };
    });
    await ensureLanguageRegistrySeeded();
    await ensureTerminologyGlossarySeeded();
  });

  afterEach(() => {
    setTerminologyGlossaryAdminAssertOverrideForTests(null);
    resetTerminologyGlossaryStoreForTests();
    resetLanguageRegistryStoreForTests();
    resetAdministrationAuditMemoryForTests();
    setTerminologyGlossaryForceMemoryForTests(false);
    setLanguageRegistryForceMemoryForTests(false);
    setAdministrationAuditForceMemoryForTests(false);
  });

  it("non-admin cannot access Admin glossary", async () => {
    await assert.rejects(
      () => listAdminTerminologyConcepts({ actorUserId: "" }),
      AdministrationUnauthorizedError,
    );
    await assert.rejects(
      () => listAdminTerminologyConcepts({ actorUserId: "member-1" }),
      AdministrationForbiddenError,
    );
    await assert.rejects(
      () =>
        updateAdminTerminologyConcept({
          actorUserId: "member-1",
          conceptId: "participant",
          body: { status: "draft" },
        }),
      AdministrationForbiddenError,
    );
  });

  it("Admin can list seeded concepts", async () => {
    const listed = await listAdminTerminologyConcepts({ actorUserId: "admin-1" });
    assert.equal(listed.concepts.length, TERMINOLOGY_GLOSSARY_SEED_DEFINITIONS.length);
    assert.ok(listed.concepts.some((row) => row.conceptId === "participant"));
  });

  it("Admin can read one concept", async () => {
    const concept = await getAdminTerminologyConcept({
      actorUserId: "admin-1",
      conceptId: "initiative",
    });
    assert.equal(concept.conceptId, "initiative");
    assert.equal(concept.canonicalEnglishTerm, "Initiative");
    assert.equal(concept.linkedRefs?.stageId, "initiative");
  });

  it("unknown concept -> canonical not-found response", async () => {
    await assert.rejects(
      () =>
        getAdminTerminologyConcept({
          actorUserId: "admin-1",
          conceptId: "not_a_real_concept",
        }),
      TerminologyGlossaryNotFoundError,
    );
    await assert.rejects(
      () =>
        updateAdminTerminologyConcept({
          actorUserId: "admin-1",
          conceptId: "not_a_real_concept",
          body: { status: "draft" },
        }),
      TerminologyGlossaryNotFoundError,
    );
  });

  it("Admin can add/update one locale translation", async () => {
    const updated = await updateAdminTerminologyConcept({
      actorUserId: "admin-1",
      conceptId: "participant",
      body: {
        translations: {
          uk: {
            preferredTerm: "Учасник",
            aliases: ["учасниця"],
            guidance: "Universal civic actor",
          },
        },
      },
    });
    assert.equal(updated.translations.uk?.preferredTerm, "Учасник");
    assert.deepEqual(updated.translations.uk?.aliases, ["учасниця"]);
    assert.equal(updated.translations.uk?.guidance, "Universal civic actor");
    assert.equal(updated.updatedByParticipantId, "participant-admin-1");
  });

  it("zh-TW mutation stores under zh-Hant", async () => {
    const updated = await updateAdminTerminologyConcept({
      actorUserId: "admin-1",
      conceptId: "workspace",
      body: {
        translations: {
          "zh-TW": { preferredTerm: "工作區", aliases: ["工作空间"] },
        },
      },
    });
    assert.equal(updated.translations["zh-TW"], undefined);
    assert.equal(updated.translations["zh-Hant"]?.preferredTerm, "工作區");
  });

  it("disabled locale translation remains editable/storable", async () => {
    const uk = await getLanguageRegistryByLocale("uk");
    assert.ok(uk);
    assert.equal(uk.enabled, false);

    const updated = await updateAdminTerminologyConcept({
      actorUserId: "admin-1",
      conceptId: "assistant",
      body: {
        translations: {
          uk: { preferredTerm: "Асистент", aliases: [] },
        },
      },
    });
    assert.equal(updated.translations.uk?.preferredTerm, "Асистент");

    const ukAfter = await getLanguageRegistryByLocale("uk");
    assert.equal(ukAfter?.enabled, false);
  });

  it("unknown locale rejected", async () => {
    await assert.rejects(
      () =>
        updateAdminTerminologyConcept({
          actorUserId: "admin-1",
          conceptId: "assistant",
          body: {
            translations: {
              "xx-INVALID": { preferredTerm: "Nope", aliases: [] },
            },
          },
        }),
      TerminologyGlossaryValidationError,
    );
  });

  it("locale PATCH preserves translations for other locales", async () => {
    await updateAdminTerminologyConcept({
      actorUserId: "admin-1",
      conceptId: "civic_media",
      body: {
        translations: {
          uk: { preferredTerm: "Громадянські медіа", aliases: [] },
        },
      },
    });
    const updated = await updateAdminTerminologyConcept({
      actorUserId: "admin-1",
      conceptId: "civic_media",
      body: {
        translations: {
          ar: { preferredTerm: "الإعلام المدني", aliases: [] },
        },
      },
    });
    assert.equal(updated.translations.uk?.preferredTerm, "Громадянські медіа");
    assert.equal(updated.translations.ar?.preferredTerm, "الإعلام المدني");
  });

  it("aliases normalize/dedupe", async () => {
    const updated = await updateAdminTerminologyConcept({
      actorUserId: "admin-1",
      conceptId: "discussion",
      body: {
        translations: {
          uk: {
            preferredTerm: "  Обговорення  ",
            aliases: [" Дискусія ", "дискусія", "Forum"],
          },
        },
      },
    });
    assert.equal(updated.translations.uk?.preferredTerm, "Обговорення");
    assert.deepEqual(updated.translations.uk?.aliases, ["Дискусія", "Forum"]);
  });

  it("ambiguous alias rejected", async () => {
    await assert.rejects(
      () =>
        updateAdminTerminologyConcept({
          actorUserId: "admin-1",
          conceptId: "workspace",
          body: {
            translations: {
              uk: { preferredTerm: "Робочий простір", aliases: ["Initiative"] },
            },
          },
        }),
      TerminologyGlossaryValidationError,
    );
  });

  it("Participant/Member/Membership collapse rejected", async () => {
    await assert.rejects(
      () =>
        updateAdminTerminologyConcept({
          actorUserId: "admin-1",
          conceptId: "member",
          body: {
            translations: {
              uk: { preferredTerm: "Член", aliases: ["Participant"] },
            },
          },
        }),
      TerminologyGlossaryValidationError,
    );
  });

  it("valid draft/published/retired transitions accepted", async () => {
    for (const status of ["draft", "published", "retired"] as const) {
      const updated = await updateAdminTerminologyConcept({
        actorUserId: "admin-1",
        conceptId: "active_ally",
        body: { status },
      });
      assert.equal(updated.status, status);
    }
  });

  it("invalid status rejected", async () => {
    await assert.rejects(
      () =>
        updateAdminTerminologyConcept({
          actorUserId: "admin-1",
          conceptId: "active_ally",
          body: { status: "live" },
        }),
      AdministrationValidationError,
    );
  });

  it("immutable fields cannot be changed", async () => {
    await assert.rejects(
      () =>
        updateAdminTerminologyConcept({
          actorUserId: "admin-1",
          conceptId: "initiative",
          body: { canonicalEnglishTerm: "Hack" },
        }),
      AdministrationValidationError,
    );
    await assert.rejects(
      () =>
        updateAdminTerminologyConcept({
          actorUserId: "admin-1",
          conceptId: "initiative",
          body: { category: "brand" },
        }),
      AdministrationValidationError,
    );
    await assert.rejects(
      () =>
        updateAdminTerminologyConcept({
          actorUserId: "admin-1",
          conceptId: "initiative",
          body: { linkedRefs: { stageId: "petition" } },
        }),
      AdministrationValidationError,
    );

    const concept = await getTerminologyConceptById("initiative");
    assert.equal(concept?.canonicalEnglishTerm, "Initiative");
    assert.equal(concept?.linkedRefs?.stageId, "initiative");
  });

  it("no arbitrary create/delete API exists", () => {
    const routesSource = readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/language/terminology-glossary/admin-terminology-glossary.routes.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(routesSource, /\.post\(/);
    assert.doesNotMatch(routesSource, /\.delete\(/);
    assert.match(routesSource, /\.get\(/);
    assert.match(routesSource, /\.patch\(/);

    const appSource = readFileSync(
      path.join(repoRoot, "apps/api/src/app.ts"),
      "utf8",
    );
    assert.match(appSource, /\/api\/v1\/admin\/terminology-glossary/);
  });

  it("successful mutation creates Admin audit", async () => {
    await updateAdminTerminologyConcept({
      actorUserId: "admin-1",
      conceptId: "petition",
      body: {
        status: "draft",
        translations: {
          uk: { preferredTerm: "Петиція", aliases: [] },
        },
      },
    });
    const audits = await listAdministrationAuditsForTarget({
      targetType: "terminology_glossary",
      targetId: "petition",
    });
    assert.equal(audits.length, 1);
    assert.equal(audits[0]?.action, "terminology_glossary.update");
    assert.equal(audits[0]?.actorParticipantId, "participant-admin-1");
    assert.match(audits[0]?.afterSummary ?? "", /status=published->draft/);
    assert.match(audits[0]?.afterSummary ?? "", /locales=uk/);
    assert.doesNotMatch(audits[0]?.afterSummary ?? "", /Петиція/);
  });

  it("rejected mutation does not create mutation audit", async () => {
    await assert.rejects(
      () =>
        updateAdminTerminologyConcept({
          actorUserId: "admin-1",
          conceptId: "workspace",
          body: {
            translations: {
              uk: { preferredTerm: "X", aliases: ["Member"] },
            },
          },
        }),
      TerminologyGlossaryValidationError,
    );
    const audits = await listAdministrationAuditsForTarget({
      targetType: "terminology_glossary",
      targetId: "workspace",
    });
    assert.equal(audits.length, 0);
  });

  it("Language Registry remains unchanged", async () => {
    const before = await getLanguageRegistryByLocale("uk");
    assert.ok(before);
    await updateAdminTerminologyConcept({
      actorUserId: "admin-1",
      conceptId: "membership",
      body: {
        translations: {
          uk: { preferredTerm: "Членство", aliases: [] },
        },
      },
    });
    const after = await getLanguageRegistryByLocale("uk");
    assert.ok(after);
    assert.equal(after.enabled, before.enabled);
    assert.equal(after.englishName, before.englishName);
    assert.equal(after.contentTranslationEnabled, before.contentTranslationEnabled);
    assert.deepEqual(after.aliases, before.aliases);
  });

  it("provider/search behavior is not invoked as mutation side effect", () => {
    const serviceSource = readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/language/terminology-glossary/admin-terminology-glossary.service.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(serviceSource, /resolveTranslationProvider/);
    assert.doesNotMatch(serviceSource, /GeminiTranslationProvider/);
    assert.doesNotMatch(serviceSource, /searchPublicCivicRecords/);
    assert.doesNotMatch(serviceSource, /getGlobalSearchIndex/);
    assert.doesNotMatch(serviceSource, /HUMANITY_UNION_TRANSLATION_TERMINOLOGY/);
  });

  it("removeTranslationLocales deletes one locale and preserves others", async () => {
    await updateAdminTerminologyConcept({
      actorUserId: "admin-1",
      conceptId: "participant",
      body: {
        translations: {
          uk: { preferredTerm: "Учасник", aliases: ["учасниця"] },
          ar: { preferredTerm: "مشارك", aliases: [] },
        },
      },
    });

    const updated = await updateAdminTerminologyConcept({
      actorUserId: "admin-1",
      conceptId: "participant",
      body: {
        removeTranslationLocales: ["uk"],
      },
    });

    assert.equal(updated.translations.uk, undefined);
    assert.equal(updated.translations.ar?.preferredTerm, "مشارك");
    assert.equal(updated.status, "published");
    assert.equal(updated.canonicalEnglishTerm, "Participant");
    assert.equal(updated.conceptId, "participant");

    const audits = await listAdministrationAuditsForTarget({
      targetType: "terminology_glossary",
      targetId: "participant",
    });
    assert.ok(audits.some((audit) => /removedLocales=uk/.test(audit.afterSummary)));
    assert.ok(
      audits.some(
        (audit) =>
          audit.action === "terminology_glossary.update" &&
          /removedLocales=uk/.test(audit.afterSummary),
      ),
    );
  });

  it("zh-TW removal canonicalizes to zh-Hant; unknown locale rejected; disabled locale removable", async () => {
    await updateAdminTerminologyConcept({
      actorUserId: "admin-1",
      conceptId: "workspace",
      body: {
        translations: {
          "zh-TW": { preferredTerm: "工作區", aliases: [] },
          uk: { preferredTerm: "Робочий простір", aliases: [] },
        },
      },
    });
    const before = await getTerminologyConceptById("workspace");
    assert.ok(before?.translations["zh-Hant"]);
    assert.equal(before?.translations["zh-TW"], undefined);

    const removed = await updateAdminTerminologyConcept({
      actorUserId: "admin-1",
      conceptId: "workspace",
      body: {
        removeTranslationLocales: ["zh-TW"],
      },
    });
    assert.equal(removed.translations["zh-Hant"], undefined);
    assert.equal(removed.translations.uk?.preferredTerm, "Робочий простір");

    await assert.rejects(
      () =>
        updateAdminTerminologyConcept({
          actorUserId: "admin-1",
          conceptId: "workspace",
          body: {
            removeTranslationLocales: ["xx-NOT-A-LOCALE"],
          },
        }),
      (error: unknown) =>
        error instanceof TerminologyGlossaryValidationError ||
        error instanceof AdministrationValidationError,
    );

    // uk is disabled by default seed — still removable.
    const ukDisabled = await getLanguageRegistryByLocale("uk");
    assert.ok(ukDisabled);
    assert.equal(ukDisabled.enabled, false);
    const afterUkRemove = await updateAdminTerminologyConcept({
      actorUserId: "admin-1",
      conceptId: "workspace",
      body: {
        removeTranslationLocales: ["uk"],
      },
    });
    assert.equal(afterUkRemove.translations.uk, undefined);
  });

  it("empty preferredTerm remains invalid; removal is not preferredTerm blanking", async () => {
    await updateAdminTerminologyConcept({
      actorUserId: "admin-1",
      conceptId: "assistant",
      body: {
        translations: {
          uk: { preferredTerm: "Асистент", aliases: [] },
        },
      },
    });
    await assert.rejects(
      () =>
        updateAdminTerminologyConcept({
          actorUserId: "admin-1",
          conceptId: "assistant",
          body: {
            translations: {
              uk: { preferredTerm: "", aliases: [] },
            },
          },
        }),
      TerminologyGlossaryValidationError,
    );
    const stillThere = await getTerminologyConceptById("assistant");
    assert.equal(stillThere?.translations.uk?.preferredTerm, "Асистент");
  });
});
