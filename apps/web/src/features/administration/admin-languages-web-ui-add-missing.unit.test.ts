/**
 * HU-LC-05C.4C.7F.7G — WEB Admin add-missing translations preview, confirm, 409.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { formatAddMissingWebUiPreviewMessage } from "./admin-languages-api";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("Admin WEB_UI add missing translations (WEB)", () => {
  it("formats preview counts for confirmation", () => {
    const message = formatAddMissingWebUiPreviewMessage({
      locale: "uk",
      currentRevision: 5,
      existingKeyCount: 4126,
      missingKeyCount: 1436,
      expectedFinalCount: 5562,
      packagedCatalogExists: true,
      packStatus: "published",
    });
    assert.match(message, /Current revision: 5/);
    assert.match(message, /Existing keys: 4126/);
    assert.match(message, /Missing keys: 1436/);
    assert.match(message, /Expected final keys: 5562/);
    assert.match(message, /preserved/i);
  });

  it("preview and apply paths require confirmation and handle 409 — source contract", () => {
    const api = readFileSync(path.join(here, "admin-languages-api.ts"), "utf8");
    assert.match(api, /previewAdminAddMissingWebUiFromPackaged/);
    assert.match(api, /applyAdminAddMissingWebUiFromPackaged/);
    assert.match(api, /add-missing-from-packaged/);
    assert.match(api, /expectedRevision: input\.expectedRevision/);

    const section = readFileSync(
      path.join(here, "components/AdminLanguagesSection.tsx"),
      "utf8",
    );
    assert.match(section, /Add missing translations/);
    assert.match(section, /window\.confirm/);
    assert.match(section, /previewAdminAddMissingWebUiFromPackaged/);
    assert.match(section, /applyAdminAddMissingWebUiFromPackaged/);
    assert.match(section, /error\.status === 409/);
    assert.match(section, /formatWebUiPackRevisionConflictMessage/);
    assert.match(section, /expectedRevision: preview\.currentRevision/);
  });
});
