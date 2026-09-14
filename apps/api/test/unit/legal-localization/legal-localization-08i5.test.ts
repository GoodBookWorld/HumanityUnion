/**
 * Pack 08I.5 — Legal Localization unit tests.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, it } from "node:test";

import { CANONICAL_LEGAL_SOURCE_VERSIONS } from "@hu/types";

import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "../../../src/modules/administration/administration.errors.js";
import {
  resetAdministrationAuditMemoryForTests,
  setAdministrationAuditForceMemoryForTests,
} from "../../../src/modules/administration/persistence/administration-audit.repository.js";
import {
  LegalLocalizationValidationError,
  ensureLegalLocalizationReady,
  getLegalLocalization,
  listAdminLegalLocalizations,
  listLegalLocalizations,
  publishAdminLegalLocalization,
  resetLegalLocalizationStoreForTests,
  resolveCanonicalLegalLocaleForTests,
  resolvePublishedLegalLocalization,
  setLegalLocalizationAdminAssertOverrideForTests,
  setLegalLocalizationForceMemoryForTests,
  upsertAdminLegalLocalization,
  upsertLegalLocalization,
} from "../../../src/modules/legal-localization/index.js";
import {
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/language-registry/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const moduleRoot = path.join(repoRoot, "apps/api/src/modules/legal-localization");

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectTsFiles(full));
    } else if (entry.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("Pack 08I.5 — Legal Localization", () => {
  beforeEach(async () => {
    setLegalLocalizationForceMemoryForTests(true);
    setLanguageRegistryForceMemoryForTests(true);
    setAdministrationAuditForceMemoryForTests(true);
    resetLegalLocalizationStoreForTests();
    resetLanguageRegistryStoreForTests();
    resetAdministrationAuditMemoryForTests();
    setLegalLocalizationAdminAssertOverrideForTests(async (userId) => {
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
    await ensureLegalLocalizationReady();
  });

  afterEach(() => {
    setLegalLocalizationAdminAssertOverrideForTests(null);
    resetLegalLocalizationStoreForTests();
    resetLanguageRegistryStoreForTests();
    resetAdministrationAuditMemoryForTests();
    setLegalLocalizationForceMemoryForTests(false);
    setLanguageRegistryForceMemoryForTests(false);
    setAdministrationAuditForceMemoryForTests(false);
  });

  it("starts empty — no English or non-English seed bodies", async () => {
    const all = await listLegalLocalizations();
    assert.equal(all.length, 0);
    const fallback = await resolvePublishedLegalLocalization("privacy", "en");
    assert.equal(fallback.source, "expected_legal_fallback");
    assert.equal(fallback.localizedBodyHtml, null);
    assert.equal(fallback.isStaleRelativeToCanonical, false);
  });

  it("draft/unapproved never public; published matching version serves body", async () => {
    const draft = await upsertAdminLegalLocalization({
      actorUserId: "admin-1",
      body: {
        documentType: "privacy",
        locale: "uk",
        localizedBody: "<p>Українська політика конфіденційності (counsel)</p>",
        status: "draft",
      },
    });
    assert.equal(draft.status, "draft");
    assert.equal(draft.canonicalSourceVersion, CANONICAL_LEGAL_SOURCE_VERSIONS.privacy);

    const draftResolve = await resolvePublishedLegalLocalization("privacy", "uk");
    assert.equal(draftResolve.source, "expected_legal_fallback");
    assert.equal(draftResolve.localizedBodyHtml, null);

    const approved = await upsertAdminLegalLocalization({
      actorUserId: "admin-1",
      body: {
        documentType: "privacy",
        locale: "uk",
        localizedBody: "<p>Українська політика конфіденційності (counsel)</p>",
        status: "approved",
      },
    });
    assert.equal(approved.status, "approved");
    const approvedResolve = await resolvePublishedLegalLocalization("privacy", "uk");
    assert.equal(approvedResolve.source, "expected_legal_fallback");

    const published = await publishAdminLegalLocalization({
      actorUserId: "admin-1",
      documentType: "privacy",
      locale: "uk",
    });
    assert.equal(published.status, "published");
    assert.ok(published.approvedAt);

    const ukResolved = await resolvePublishedLegalLocalization("privacy", "uk");
    assert.equal(ukResolved.source, "published_locale");
    assert.equal(
      ukResolved.localizedBodyHtml,
      "<p>Українська політика конфіденційності (counsel)</p>",
    );
    assert.equal(ukResolved.isStaleRelativeToCanonical, false);
    assert.equal(ukResolved.locale, "uk");
  });

  it("version mismatch falls back + stale flag; does not serve stale body", async () => {
    const published = await upsertAdminLegalLocalization({
      actorUserId: "admin-1",
      body: {
        documentType: "terms",
        locale: "uk",
        localizedBody: "<p>Старий переклад умов</p>",
        status: "published",
        canonicalSourceVersion: "terms-2025-01-v0",
      },
    });
    assert.equal(published.status, "published");
    assert.equal(published.isStaleRelativeToCanonical, true);

    const resolved = await resolvePublishedLegalLocalization("terms", "uk");
    assert.equal(resolved.source, "expected_legal_fallback");
    assert.equal(resolved.localizedBodyHtml, null);
    assert.equal(resolved.isStaleRelativeToCanonical, true);
    assert.equal(
      resolved.canonicalSourceVersion,
      CANONICAL_LEGAL_SOURCE_VERSIONS.terms,
    );

    const list = await listAdminLegalLocalizations({ actorUserId: "admin-1" });
    const row = list.localizations.find(
      (entry) => entry.documentType === "terms" && entry.locale === "uk",
    );
    assert.ok(row);
    assert.equal(row.isStaleRelativeToCanonical, true);
  });

  it("locale alias zh-TW → zh-Hant canonicalization", async () => {
    const tw = await resolveCanonicalLegalLocaleForTests("zh-TW");
    const hant = await resolveCanonicalLegalLocaleForTests("zh-Hant");
    assert.equal(tw, hant);

    const first = await upsertAdminLegalLocalization({
      actorUserId: "admin-1",
      body: {
        documentType: "privacy",
        locale: "zh-TW",
        localizedBody: "<p>隱私權政策（律師核准）</p>",
        status: "published",
      },
    });
    assert.equal(first.locale, "zh-Hant");

    const second = await upsertAdminLegalLocalization({
      actorUserId: "admin-1",
      body: {
        documentType: "privacy",
        locale: "zh-Hant",
        localizedBody: "<p>隱私權政策 2</p>",
        status: "published",
      },
    });
    assert.equal(second.legalId, first.legalId);
    assert.equal(second.locale, "zh-Hant");

    const viaAlias = await resolvePublishedLegalLocalization("privacy", "zh-TW");
    assert.equal(viaAlias.source, "published_locale");
    assert.equal(viaAlias.locale, "zh-Hant");
    assert.equal(viaAlias.requestedLocale, "zh-TW");
    assert.equal(viaAlias.localizedBodyHtml, "<p>隱私權政策 2</p>");

    const all = await listLegalLocalizations();
    const zhRows = all.filter(
      (row) =>
        row.documentType === "privacy" &&
        (row.locale === "zh-Hant" || row.locale === "zh-TW"),
    );
    assert.equal(zhRows.length, 1);
  });

  it("admin persistence upsert/publish and rejects empty publish body", async () => {
    await assert.rejects(
      () =>
        upsertAdminLegalLocalization({
          actorUserId: "admin-1",
          body: {
            documentType: "privacy",
            locale: "ar",
            localizedBody: " ",
            status: "draft",
          },
        }),
      LegalLocalizationValidationError,
    );

    const draft = await upsertAdminLegalLocalization({
      actorUserId: "admin-1",
      body: {
        documentType: "privacy",
        locale: "ar",
        localizedBody: "<p>سياسة الخصوصية</p>",
        status: "draft",
      },
    });
    assert.ok(draft.legalId);
    assert.equal(draft.documentType, "privacy");
    assert.equal(draft.locale, "ar");

    const loaded = await getLegalLocalization("privacy", "ar");
    assert.ok(loaded);
    assert.equal(loaded.localizedBody, "<p>سياسة الخصوصية</p>");

    const published = await publishAdminLegalLocalization({
      actorUserId: "admin-1",
      documentType: "privacy",
      locale: "ar",
    });
    assert.equal(published.status, "published");
    assert.ok(published.approvedAt);
    assert.equal(
      published.canonicalSourceVersion,
      CANONICAL_LEGAL_SOURCE_VERSIONS.privacy,
    );

    await assert.rejects(
      () =>
        upsertAdminLegalLocalization({
          actorUserId: "admin-1",
          body: {
            documentType: "xx-not-a-type",
            locale: "uk",
            localizedBody: "<p>x</p>",
          },
        }),
      LegalLocalizationValidationError,
    );

    await assert.rejects(
      () =>
        upsertAdminLegalLocalization({
          actorUserId: "admin-1",
          body: {
            documentType: "terms",
            locale: "xx-NOT-A-LOCALE",
            localizedBody: "<p>x</p>",
          },
        }),
      LegalLocalizationValidationError,
    );
  });

  it("legal-localization module never imports Gemini / TranslationProvider / content_translations", () => {
    const files = collectTsFiles(moduleRoot);
    assert.ok(files.length > 0);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(
        source,
        /^\s*import[\s\S]*?(TranslationProvider|gemini-translation|content_translations|content-translation)/im,
      );
      assert.doesNotMatch(
        source,
        /from\s+["'][^"']*(terminology-glossary|content-translation|gemini)[^"']*["']/i,
      );
    }
  });

  it("repository upsert persists without seeding English copies", async () => {
    const now = new Date().toISOString();
    await upsertLegalLocalization({
      legalId: "legal-terms-uk-test",
      documentType: "terms",
      locale: "uk",
      canonicalSourceVersion: CANONICAL_LEGAL_SOURCE_VERSIONS.terms,
      localizedBody: "<p>Умови використання</p>",
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    const found = await getLegalLocalization("terms", "uk");
    assert.ok(found);
    assert.equal(found.status, "draft");
    const english = await getLegalLocalization("terms", "en");
    assert.equal(english, null);
  });
});
