/**
 * Pack 13C — Author My Publications + publication date UI contracts.
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

describe("Pack 13C — Author publication management UI", () => {
  it("Authoring page places My Publications at the bottom", () => {
    const page = readWeb("features/blog/components/AuthoringPageContent.tsx");
    assert.match(page, /MyPublicationsTable/);
    const tableIndex = page.lastIndexOf("MyPublicationsTable");
    const formIndex = page.lastIndexOf("Submit application");
    assert.ok(tableIndex > formIndex);
  });

  it("My Publications table has required columns and actions", () => {
    const table = readWeb("features/blog/components/MyPublicationsTable.tsx");
    assert.match(table, /My Publications/);
    assert.match(table, /Publication date/);
    assert.match(table, /Visibility/);
    assert.match(table, /Last updated/);
    assert.match(table, /Cancel schedule/);
    assert.match(table, /Blocked by administrator/);
    assert.match(table, /listOwnBlogPosts/);
    assert.match(table, /mutationsDisabled/);
    assert.doesNotMatch(table, /Unblock/);
  });

  it("New Publication editor exposes publication date with 2022 minimum", () => {
    const editor = readWeb("features/blog/components/BlogPostEditor.tsx");
    assert.match(editor, /Publication date/);
    assert.match(editor, /BLOG_PUBLICATION_DATE_MIN/);
    assert.match(editor, /type="date"/);
    assert.match(editor, /publicationDate/);
    assert.match(editor, /noon UTC/);
  });

  it("publishing API supports publicationDate and cancel-schedule", () => {
    const api = readWeb("features/blog/publishing-api.ts");
    assert.match(api, /publicationDate/);
    assert.match(api, /cancel-schedule/);
    assert.match(api, /cancelScheduledBlogPublication/);
  });
});
