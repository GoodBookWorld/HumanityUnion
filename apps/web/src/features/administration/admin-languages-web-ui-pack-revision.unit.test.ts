/**
 * HU-LC-05C.4C.7F.7F — WEB Admin catalog import sends expectedRevision and surfaces 409.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { formatWebUiPackRevisionConflictMessage } from "./admin-languages-api";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("Admin WEB_UI pack revision (WEB)", () => {
  it("formats a clear 409 conflict message without silent retry language", () => {
    const message = formatWebUiPackRevisionConflictMessage(
      "WEB_UI message pack revision conflict for locale uk (expected 5).",
    );
    assert.match(message, /revision conflict/i);
    assert.match(message, /Refresh the current pack data/i);
    assert.match(message, /not saved/i);
    assert.doesNotMatch(message, /retrying|automatic/i);
  });

  it("import path resolves expectedRevision and handles 409 — source contract", () => {
    const api = readFileSync(path.join(here, "admin-languages-api.ts"), "utf8");
    assert.match(api, /resolveAdminWebUiMessagePackExpectedRevision/);
    assert.match(api, /expectedRevision: input\.expectedRevision/);
    assert.match(api, /error\.status === 404/);

    const section = readFileSync(
      path.join(here, "components/AdminLanguagesSection.tsx"),
      "utf8",
    );
    assert.match(section, /resolveAdminWebUiMessagePackExpectedRevision\(locale\)/);
    assert.match(section, /expectedRevision,/);
    assert.match(section, /error\.status === 409/);
    assert.match(section, /formatWebUiPackRevisionConflictMessage/);
  });
});
