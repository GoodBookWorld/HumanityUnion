/**
 * HU-LOC-BRAND-02D20B — WEB catalogs and API packaged catalogs stay aligned.
 */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  isParticipantWebUiRequiredPath,
  isPublicReaderWebUiRequiredPath,
} from "@hu/types";

import {
  inspectMessageStructure,
  selectEnglishWebUiMessages,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.validate.js";
import {
  compareWebUiCatalogParity,
  formatWebUiCatalogParityReport,
} from "../../../src/modules/web-ui-message-packs/web-ui-catalog-parity.js";

const repoRoot = path.resolve(import.meta.dirname, "../../../../..");
const webDir = path.join(repoRoot, "apps/web/src/features/i18n/messages");
const packagedDir = path.join(repoRoot, "apps/api/assets/packaged-web-ui-catalogs");

function writeCatalogs(
  root: string,
  web: Record<string, unknown>,
  packaged: Record<string, unknown>,
): { webMessagesDir: string; packagedDir: string } {
  const webMessagesDir = path.join(root, "web");
  const packagedCatalogDir = path.join(root, "packaged");
  mkdirSync(webMessagesDir, { recursive: true });
  mkdirSync(packagedCatalogDir, { recursive: true });
  for (const [locale, tree] of Object.entries(web)) {
    writeFileSync(path.join(webMessagesDir, `${locale}.json`), JSON.stringify(tree));
  }
  for (const [locale, tree] of Object.entries(packaged)) {
    writeFileSync(path.join(packagedCatalogDir, `${locale}.json`), JSON.stringify(tree));
  }
  return { webMessagesDir, packagedDir: packagedCatalogDir };
}

const english = { common: { save: "Save" }, notes: { body: "Hello {siteName}" } };
const aligned = { common: { save: "Зберегти" }, notes: { body: "Вітання, {siteName}" } };

describe("WEB/API catalog parity", () => {
  it("passes when every discovered locale matches English keys and packaged values", () => {
    const dirs = writeCatalogs(mkdtempSync(path.join(tmpdir(), "hu-parity-")), {
      en: english,
      uk: aligned,
    }, {
      en: english,
      uk: aligned,
    });
    const report = compareWebUiCatalogParity(dirs);
    assert.equal(report.ok, true, formatWebUiCatalogParityReport(report));
  });

  it("reports a WEB key missing from the packaged catalog", () => {
    const dirs = writeCatalogs(mkdtempSync(path.join(tmpdir(), "hu-parity-")), {
      en: english,
    }, {
      en: { common: { save: "Save" } },
    });
    const report = compareWebUiCatalogParity(dirs);
    assert.equal(report.ok, false);
    assert.ok(
      report.discrepancies.some(
        (item) => item.locale === "en" && item.path === "notes.body" && item.kind === "missing-key",
      ),
    );
    assert.match(formatWebUiCatalogParityReport(report), /en\tnotes\.body\tmissing-key/);
  });

  it("reports an extra packaged key", () => {
    const dirs = writeCatalogs(mkdtempSync(path.join(tmpdir(), "hu-parity-")), {
      en: english,
    }, {
      en: { ...english, extra: { leaf: "Only packaged" } },
    });
    const report = compareWebUiCatalogParity(dirs);
    assert.equal(report.ok, false);
    assert.ok(
      report.discrepancies.some(
        (item) => item.locale === "en" && item.path === "extra.leaf" && item.kind === "extra-key",
      ),
    );
  });

  it("reports a packaged value that differs from WEB", () => {
    const dirs = writeCatalogs(mkdtempSync(path.join(tmpdir(), "hu-parity-")), {
      en: english,
      uk: aligned,
    }, {
      en: english,
      uk: { common: { save: "Save" }, notes: { body: aligned.notes.body } },
    });
    const report = compareWebUiCatalogParity(dirs);
    assert.equal(report.ok, false);
    assert.ok(
      report.discrepancies.some(
        (item) =>
          item.locale === "uk" && item.path === "common.save" && item.kind === "value-mismatch",
      ),
    );
  });

  it("reports a non-English WEB key missing from the English canonical set", () => {
    const dirs = writeCatalogs(mkdtempSync(path.join(tmpdir(), "hu-parity-")), {
      en: english,
      uk: { common: { save: "Зберегти" } },
    }, {
      en: english,
      uk: { common: { save: "Зберегти" } },
    });
    const report = compareWebUiCatalogParity(dirs);
    assert.equal(report.ok, false);
    assert.ok(
      report.discrepancies.some(
        (item) => item.locale === "uk" && item.path === "notes.body" && item.kind === "missing-key",
      ),
    );
  });

  it("keeps the repository WEB and packaged catalogs aligned", () => {
    const report = compareWebUiCatalogParity({
      webMessagesDir: webDir,
      packagedDir,
    });
    assert.equal(report.ok, true, formatWebUiCatalogParityReport(report));
  });

  it("keeps admin keys outside readiness and privacy notices inside participant readiness", () => {
    const selected = selectEnglishWebUiMessages("full");
    const ordinary = selectEnglishWebUiMessages("public");
    assert.equal(selected.fullCatalogKeyCount, selected.selectedPaths.length);
    assert.equal(
      ordinary.selectedPaths.length,
      new Set([...ordinary.selectedPaths]).size,
    );
    assert.equal(
      ordinary.selectedPaths.length,
      new Set([
        ...selected.selectedPaths.filter((key) => isPublicReaderWebUiRequiredPath(key)),
        ...selected.selectedPaths.filter((key) => isParticipantWebUiRequiredPath(key)),
      ]).size,
    );
    for (const key of [
      "legalLocalizationAdmin.bodyLabel",
      "adminNotifications.types.participant_registered",
    ]) {
      assert.equal(isPublicReaderWebUiRequiredPath(key), false, key);
      assert.equal(isParticipantWebUiRequiredPath(key), false, key);
      assert.ok(selected.selectedPaths.includes(key), key);
    }
    for (const key of [
      "notifications.actions.readPrivacyPolicy",
      "notifications.types.privacy_policy_updated.title",
      "notifications.types.privacy_policy_updated.message",
    ]) {
      assert.equal(isPublicReaderWebUiRequiredPath(key), false, key);
      assert.equal(isParticipantWebUiRequiredPath(key), true, key);
    }
    const message = selected.messages as {
      notifications: { types: { privacy_policy_updated: { message: string } } };
    };
    assert.deepEqual(
      [...inspectMessageStructure(message.notifications.types.privacy_policy_updated.message).placeholders],
      ["siteName"],
    );
  });
});
