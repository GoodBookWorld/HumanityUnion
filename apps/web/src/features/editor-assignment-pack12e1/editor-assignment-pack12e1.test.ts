/**
 * Pack 12E1 — Admin Editor assignment confirmation + Editors table runtime (web).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("Pack 12E1 — Assign Editor runtime completion", () => {
  it("sends application/json on Assign/Update Editor mutations", () => {
    const api = readWeb("features/administration/admin-editors-api.ts");
    assert.match(api, /assignAdminEditor[\s\S]*Content-Type["']:\s*["']application\/json["']/);
    assert.match(api, /updateAdminEditor[\s\S]*Content-Type["']:\s*["']application\/json["']/);
    assert.match(api, /listAdminEditors[\s\S]*\/api\/v1\/admin\/editors/);
  });

  it("Assign Editor button uses Assigning… / Assigned with aria-busy", () => {
    const form = readWeb("features/administration/components/AdminEditorFormSection.tsx");
    assert.match(form, /Assigning…/);
    assert.match(form, /["']Assigned["']/);
    assert.match(form, /aria-busy=\{submitBusy\}/);
    assert.match(form, /Editor assigned successfully/);
    assert.match(form, /router\.push\([\s\S]*\/admin\/editors\?assigned=1/);
    assert.match(form, /setSubmitPhase\(["']idle["']\)/);
    assert.match(form, /formatAuthFormError/);
  });

  it("Editors table reloads from Admin Editors API and shows success banner", () => {
    const table = readWeb("features/administration/components/AdminEditorsSection.tsx");
    assert.match(table, /listAdminEditors/);
    assert.match(table, /Editor assigned successfully/);
    assert.match(table, /searchParams\.get\(["']assigned["']\)/);
    assert.match(table, /StatusBanner[\s\S]*Action completed/);
    assert.match(table, /displayName/);
    assert.match(table, /capabilityLabels/);
    assert.match(table, /geographicScope/);
    assert.doesNotMatch(table, /staticEditors|MOCK_EDITORS|localStorage\.getItem\(["']editors/);
  });
});
