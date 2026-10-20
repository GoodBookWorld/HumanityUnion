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
    assert.match(section, /Pending applications/);
    assert.match(section, /Pending Review/);
    assert.match(section, /Block/);
    assert.match(section, /Unblock/);
    assert.match(section, /View profile/);
    assert.match(section, /admin-publishing-table-wrap/);
  });

  it("Authors table scrolls horizontally and keeps headers on one line", () => {
    const section = readWeb("features/administration/components/AdminPublishingSection.tsx");
    const css = readWeb("features/administration/components/admin-publishing.css");
    const authorsStart = section.indexOf('{tab === "authors" ?');
    const publicationsStart = section.indexOf('title="Publications"', authorsStart);
    const authors = section.slice(authorsStart, publicationsStart);
    const statsAt = authors.indexOf("admin-publishing__stats");
    const toolbarAt = authors.indexOf("admin-publishing__toolbar");
    const wrapAt = authors.indexOf("admin-publishing-table-wrap--authors");
    assert.ok(statsAt >= 0 && toolbarAt > statsAt && wrapAt > toolbarAt);
    assert.match(
      authors,
      /admin-publishing-table-wrap admin-publishing-table-wrap--authors/,
    );
    assert.match(authors, /admin-publishing-table admin-publishing-table--authors/);
    assert.match(authors, /Trusted publishing/);
    assert.match(authors, /Publish without manual review/);
    assert.match(authors, /View publications/);
    assert.match(authors, /authorParticipantId=/);
    assert.match(authors, /integrityMediaLinked/);
    assert.match(authors, /Integrity Media/);
    assert.match(section, /All publications/);
    assert.match(section, /authorParticipantId: publicationAuthorId/);
    assert.match(css, /\.admin-publishing-table-wrap--authors\s*\{[^}]*overflow-x:\s*auto/s);
    assert.match(css, /\.admin-publishing-table-wrap--authors\s*\{[^}]*min-width:\s*0/s);
    assert.match(css, /\.admin-publishing-table--authors\s*\{[^}]*min-width:\s*76rem/s);
    assert.match(
      css,
      /\.admin-publishing-table--authors th\s*,\s*\.admin-publishing-table--authors td\s*\{[^}]*white-space:\s*nowrap/s,
    );
    assert.match(
      css,
      /\.admin-publishing-table--authors \.admin-publishing-table__trusted\s*\{[^}]*max-width:\s*none/s,
    );
    assert.match(css, /\.admin-publishing-table\s*\{[^}]*min-width:\s*56rem/s);
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
