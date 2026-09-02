/**
 * Pack 02G Task 08E.3 — soft-fail shell + Initiative language display i18n.
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
import { formatLanguageDisplayName } from "../language/format-language-display-name.js";
import {
  formatInitiativeExperienceLanguageName,
  resolveInitiativeExperienceMessage,
} from "../public-initiative-experience/initiative-experience-i18n.js";
import { publicSafeOptionalSectionMessage } from "../public-initiative-experience/initiative-lifecycle-shell.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function ieKey(messages: Record<string, unknown>, key: string): string {
  const value = resolveInitiativeExperienceMessage(messages, key);
  assert.ok(value, `missing initiativeExperience.${key}`);
  return value;
}

describe("Pack 02G Task 08E.3 — soft-fail shell + language display", () => {
  it("catalog parity includes common.optionalStageUnavailable", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      assert.equal(
        typeof ieKey(loaded.messages, "common.optionalStageUnavailable.petition"),
        "string",
      );
      assert.equal(
        typeof ieKey(loaded.messages, "common.optionalStageUnavailable.civicArchive"),
        "string",
      );
    }
  });

  it("Ukrainian Petition and Civic Archive soft-fail messages resolve natively", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(
      ieKey(uk.messages, "common.optionalStageUnavailable.petition"),
      "Інформація про петицію тимчасово недоступна.",
    );
    assert.equal(
      ieKey(uk.messages, "common.optionalStageUnavailable.civicArchive"),
      "Інформація про громадянський архів тимчасово недоступна.",
    );
    assert.notEqual(
      ieKey(uk.messages, "common.optionalStageUnavailable.petition"),
      "Petition information is temporarily unavailable.",
    );
  });

  it("soft-fail helper returns section ids; page resolves via next-intl; no API prose matching", () => {
    assert.equal(
      publicSafeOptionalSectionMessage(
        { petition: { health: "unavailable", reasonCode: "infrastructure_failure" } },
        "petition",
      ),
      "petition",
    );
    assert.equal(
      publicSafeOptionalSectionMessage(
        { civicArchive: { health: "unavailable", reasonCode: "infrastructure_failure" } },
        "civicArchive",
      ),
      "civicArchive",
    );
    assert.equal(
      publicSafeOptionalSectionMessage(
        { petition: { health: "absent", reasonCode: "not_created_yet" } },
        "petition",
      ),
      null,
    );

    const shell = readWeb("features/public-initiative-experience/initiative-lifecycle-shell.ts");
    const page = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeExperiencePage.tsx",
    );
    assert.doesNotMatch(shell, /Petition information is temporarily unavailable/);
    assert.doesNotMatch(shell, /Civic Archive information is temporarily unavailable/);
    assert.match(page, /common\.optionalStageUnavailable\.\$\{petitionDegradedSection\}/);
    assert.match(page, /common\.optionalStageUnavailable\.\$\{civicArchiveDegradedSection\}/);
    assert.match(page, /selectedStageId === "archive"/);
    assert.doesNotMatch(page, /registrationGatewayMessage/);
    assert.doesNotMatch(shell, /reasonCode.*replace|includes\("infrastructure/);
  });

  it("metadata.language display uses shared formatter; canonical code path unchanged", () => {
    const panel = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );
    const i18n = readWeb("features/public-initiative-experience/initiative-experience-i18n.ts");
    assert.match(
      panel,
      /formatInitiativeExperienceLanguageName\(locale, metadata\.language\)/,
    );
    assert.doesNotMatch(panel, /value=\{metadata\.language\}/);
    assert.match(i18n, /formatLanguageDisplayName\(interfaceLocale, languageCode\)/);
    assert.doesNotMatch(i18n, /LANGUAGE_NAME_REGISTRY|languageNames\s*=/);

    assert.equal(formatInitiativeExperienceLanguageName("en", "en"), formatLanguageDisplayName("en", "en"));
    assert.equal(formatInitiativeExperienceLanguageName("uk", "uk"), formatLanguageDisplayName("uk", "uk"));
    assert.match(formatInitiativeExperienceLanguageName("en", "en"), /English/i);
    assert.match(formatInitiativeExperienceLanguageName("uk", "uk"), /україн/i);
    assert.equal(formatInitiativeExperienceLanguageName("en", "zh-Hant"), formatLanguageDisplayName("en", "zh-Hant"));
    assert.equal(formatInitiativeExperienceLanguageName("ar", "ar"), formatLanguageDisplayName("ar", "ar"));
    assert.equal(formatInitiativeExperienceLanguageName("en", "not-a-real-lang"), "not-a-real-lang");
    assert.equal(formatInitiativeExperienceLanguageName("en", ""), "");
  });

  it("geography World remains deferred shared geography output", () => {
    const geo = readFileSync(
      path.resolve(webSrc, "../../../packages/geography/src/format-public-geography.ts"),
      "utf8",
    );
    assert.match(geo, /return "World"/);
    const panel = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );
    assert.match(panel, /formatPublicGeography\(/);
    assert.doesNotMatch(panel, /"World"/);
  });

  it("layout resilience for soft-fail banner and overview metadata", () => {
    const css = readWeb("features/public-initiative-experience/public-initiative-experience.css");
    assert.match(css, /\.pie-optional-degraded\s*\{[^}]*min-width:\s*0/s);
    assert.match(css, /\.pie-optional-degraded\s*\{[^}]*overflow-wrap:\s*anywhere/s);
    assert.match(css, /\.pie-overview__item p\s*\{[^}]*overflow-wrap:\s*anywhere/s);
    assert.match(css, /\.pie-overview__column\s*\{[^}]*min-width:\s*0/s);
  });

  it("missing optionalStageUnavailable key fails catalog parity", async () => {
    const en = await import("../i18n/messages/en.json", { with: { type: "json" } });
    const uk = structuredClone(
      (await import("../i18n/messages/uk.json", { with: { type: "json" } })).default,
    );
    delete (
      uk.initiativeExperience as {
        common?: { optionalStageUnavailable?: { petition?: string } };
      }
    ).common?.optionalStageUnavailable?.petition;
    const report = compareCatalogParityToEnglish(en.default, uk, "uk");
    assert.equal(report.ok, false);
    assert.ok(
      report.issues.some((issue) =>
        issue.path.includes("initiativeExperience.common.optionalStageUnavailable.petition"),
      ),
    );
  });
});
