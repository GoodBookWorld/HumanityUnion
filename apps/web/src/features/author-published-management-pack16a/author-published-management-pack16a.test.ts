/**
 * Pack 16A — Author published publication management (Web contracts).
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

describe("Pack 16A — Author published management (Web)", () => {
  it("Published cards expose Edit / Correct and Delete with confirmation", () => {
    const item = readWeb("features/blog/components/PublicationListItem.tsx");
    assert.match(item, /Edit \/ Correct/);
    assert.match(item, /Delete/);
    assert.match(item, /ConfirmDialog/);
    assert.match(item, /archiveBlogPost/);
    assert.match(item, /startPublishedCorrection/);
    assert.match(item, /mutationsDisabled/);
    assert.match(item, /administrativelyBlocked/);

    const table = readWeb("features/blog/components/MyPublicationsTable.tsx");
    assert.match(table, /Edit \/ Correct/);
    assert.match(table, /Delete/);
    assert.match(table, /archiveBlogPost/);
    assert.match(table, /startPublishedCorrection/);
  });

  it("reuses canonical editor route and publishing API (no second editor)", () => {
    const item = readWeb("features/blog/components/PublicationListItem.tsx");
    assert.match(item, /\/workspace\/publishing\/\$\{/);
    assert.doesNotMatch(item, /SecondEditor|CorrectEditor|TipTap/i);

    const api = readWeb("features/blog/publishing-api.ts");
    assert.match(api, /\/archive/);
    assert.match(api, /\/start-correction/);
    assert.match(api, /export async function archiveBlogPost/);
    assert.match(api, /export async function startPublishedCorrection/);
  });

  it("Publishing dashboard wires Author block + reload after mutate", () => {
    const dash = readWeb("features/blog/components/PublishingDashboard.tsx");
    assert.match(dash, /mutationsDisabled/);
    assert.match(dash, /onMutated/);

    const page = readWeb("features/blog/components/PublishingPageContent.tsx");
    assert.match(page, /author_blocked|authorAdministrativelyBlocked/);
    assert.match(page, /mutationsDisabled/);
  });
});
