/**
 * Pack 08I.4 — Institutions full content localization (records + chrome).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  compareCatalogParityToEnglish,
  verifyBundledVerificationCatalogParity,
} from "../i18n/catalog-parity.js";
import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function readNested(messages: Record<string, unknown>, dottedPath: string): string {
  const parts = dottedPath.split(".");
  let cursor: unknown = messages;
  for (const part of parts) {
    assert.ok(cursor && typeof cursor === "object" && !Array.isArray(cursor), dottedPath);
    cursor = (cursor as Record<string, unknown>)[part];
  }
  assert.equal(typeof cursor, "string", dottedPath);
  return cursor as string;
}

const INSTITUTION_IDS = [
  "humanity-council",
  "chamber-of-state-representatives",
  "chamber-of-intellectual-analysis",
  "expert-analysis-team",
  "state-collaboration-department",
  "secretariat",
  "hpc",
  "wpc",
  "community-self-defense-units",
  "regional-offices",
] as const;

const RECORD_FIELDS = ["name", "purpose", "role", "knowledgeTitle"] as const;

const INSTITUTIONS_PUBLIC_KEYS = [
  "institutionsPublic.stickyNavAria",
  "institutionsPublic.stickyNav.architecture",
  "institutionsPublic.stickyNav.institutions",
  "institutionsPublic.stickyNav.protection",
  "institutionsPublic.stickyNav.wpc",
  "institutionsPublic.stickyNav.regional-offices",
  "institutionsPublic.stickyNav.related-initiatives",
  "institutionsPublic.architecture.title",
  "institutionsPublic.architecture.intro",
  "institutionsPublic.architecture.ribbonAria",
  "institutionsPublic.architecture.blocks.participants",
  "institutionsPublic.card.purpose",
  "institutionsPublic.card.role",
  "institutionsPublic.card.learnMore",
  "institutionsPublic.card.allNominations",
  "institutionsPublic.card.createInitiative",
  "institutionsPublic.card.relatedKnowledge",
  "institutionsPublic.card.readKnowledge",
  "institutionsPublic.status.concept",
  "institutionsPublic.status.futureInstitution",
  "institutionsPublic.status.underDevelopment",
  "institutionsPublic.hierarchy.title",
  "institutionsPublic.hierarchy.intro",
  "institutionsPublic.hierarchy.commands",
  "institutionsPublic.hierarchy.levels.hpc.title",
  "institutionsPublic.hierarchy.levels.operational-command.label",
  "institutionsPublic.hierarchy.levels.wpc.description",
  "institutionsPublic.wpc.accordionAria",
  "institutionsPublic.wpc.sections.management-coordination.title",
  "institutionsPublic.wpc.sections.legal-ethical.body",
] as const;

describe("Pack 08I.4 — Institutions full content localization", () => {
  it("InstitutionCard uses useTranslations and does not render content.ts English as sole display source", () => {
    const card = readWeb("features/institutions/components/InstitutionCard.tsx");
    assert.match(card, /useTranslations\("institutionsPublic"\)/);
    assert.match(card, /records\.\$\{institution\.id\}\.name/);
    assert.match(card, /records\.\$\{institution\.id\}\.purpose/);
    assert.match(card, /t\("card\.purpose"\)/);
    assert.match(card, /t\("card\.learnMore"\)/);
    assert.doesNotMatch(card, /\{institution\.name\}/);
    assert.doesNotMatch(card, /\{institution\.purpose\}/);
    assert.doesNotMatch(card, /\{institution\.role\}/);
    assert.doesNotMatch(card, />Purpose</);
    assert.doesNotMatch(card, />Learn More</);
  });

  it("Institutions chrome components use institutionsPublic catalogs", () => {
    const sticky = readWeb("features/institutions/components/InstitutionsStickyNav.tsx");
    const ribbon = readWeb("features/institutions/components/InstitutionNavigationRibbon.tsx");
    const hierarchy = readWeb("features/institutions/components/HpcWpcHierarchySection.tsx");
    const wpc = readWeb("features/institutions/components/WpcFeaturedCard.tsx");

    assert.match(sticky, /useTranslations\("institutionsPublic"\)/);
    assert.match(sticky, /stickyNav\.\$\{item\.id\}/);
    assert.match(ribbon, /architecture\.title/);
    assert.match(ribbon, /architecture\.blocks\.\$\{block\.id\}/);
    assert.match(hierarchy, /hierarchy\.title/);
    assert.match(hierarchy, /hierarchy\.commands/);
    assert.match(wpc, /records\.\$\{recordId\}\.name/);
    assert.match(wpc, /t\("card\.learnMore"\)/);
    assert.doesNotMatch(wpc, /\{WPC_INSTITUTION\.name\}/);
    assert.doesNotMatch(wpc, />Learn More</);
  });

  it("catalog keys present in all 4 locales with parity including institution records", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      for (const key of INSTITUTIONS_PUBLIC_KEYS) {
        assert.equal(typeof readNested(loaded.messages, key), "string", `${locale}:${key}`);
      }
      for (const id of INSTITUTION_IDS) {
        for (const field of RECORD_FIELDS) {
          const key = `institutionsPublic.records.${id}.${field}`;
          assert.equal(typeof readNested(loaded.messages, key), "string", `${locale}:${key}`);
        }
      }
    }

    const en = await loadUiMessagesForLocale("en");
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const other = await loadUiMessagesForLocale(locale);
      const parity = compareCatalogParityToEnglish(en.messages, other.messages, locale);
      assert.equal(parity.ok, true, JSON.stringify(parity, null, 2));
    }
  });
});
