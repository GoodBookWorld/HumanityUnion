/**
 * Pack 13B — Admin Publishing Web contracts.
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

describe("Pack 13B — Admin Publishing UI", () => {
  it("Publishing section has Authors and Publications tables with Block/Unblock", () => {
    const section = readWeb("features/administration/components/AdminPublishingSection.tsx");
    assert.match(section, /Authors/);
    assert.match(section, /Publications/);
    assert.match(section, /Block/);
    assert.match(section, /Unblock/);
    assert.match(section, /View profile/);
    assert.match(section, /admin-publishing-table-wrap/);
  });

  it("Author blocked UX copy on authoring page", () => {
    const page = readWeb("features/blog/components/AuthoringPageContent.tsx");
    assert.match(page, /author_blocked/);
    assert.match(page, /Your Author access has been blocked/);
  });

  it("Admin publishing API client targets /api/v1/admin/publishing", () => {
    const api = readWeb("features/administration/admin-publishing-api.ts");
    assert.match(api, /\/api\/v1\/admin\/publishing\/authors/);
    assert.match(api, /\/api\/v1\/admin\/publishing\/publications/);
  });
});
