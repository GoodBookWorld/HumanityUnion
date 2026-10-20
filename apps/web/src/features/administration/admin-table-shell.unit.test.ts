/**
 * HU–IM.07C.2 — remaining Admin tables keep headers on one line and scroll locally.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

const shells: ReadonlyArray<{ file: string; wrap: string; header: string }> = [
  {
    file: "features/administration/components/admin-publishing.css",
    wrap: ".admin-publishing-table-wrap",
    header: ".admin-publishing-table th",
  },
  {
    file: "features/administration/components/admin-initiatives.css",
    wrap: ".admin-initiatives-table-wrap",
    header: ".admin-initiatives-table th",
  },
  {
    file: "features/administration/components/admin-languages.css",
    wrap: ".admin-languages__table-wrap",
    header: ".admin-languages-table th",
  },
  {
    file: "features/administration/components/admin-editors.css",
    wrap: ".admin-editors-table-wrap",
    header: ".admin-editors-table th",
  },
  {
    file: "features/administration/components/editor-panel.css",
    wrap: ".editor-panel__table-wrap",
    header: ".editor-panel__table th",
  },
  {
    file: "features/administration/components/admin-traffic.css",
    wrap: ".admin-traffic__table-wrap",
    header: ".admin-traffic__table th",
  },
  {
    file: "features/administration/components/admin-insights.css",
    wrap: ".admin-insights-chart__table-wrap",
    header: ".admin-traffic__table th",
  },
  {
    file: "features/administration/components/admin-audit.css",
    wrap: ".admin-audit__table-wrap",
    header: ".admin-audit__table th",
  },
  {
    file: "features/administration/components/admin-seo-console.css",
    wrap: ".admin-seo-console__table-wrap",
    header: ".admin-seo-console__table th",
  },
  {
    file: "features/administration/components/admin-terminology-glossary.css",
    wrap: ".admin-glossary__table-wrap",
    header: ".admin-glossary-table th",
  },
  {
    file: "features/administration/components/admin-participants-table.css",
    wrap: ".admin-participants-table-wrap",
    header: ".admin-participants-table th",
  },
  {
    file: "features/administration/components/admin-integrity-author-message-dialog.css",
    wrap: ".admin-integrity-authors .admin-participants-table-wrap",
    header: ".admin-integrity-authors .admin-integrity-authors-table th",
  },
  {
    file: "features/administration/components/admin-media-resources.css",
    wrap: ".admin-initiatives-table-wrap",
    header: ".admin-media-resources-table th",
  },
];

describe("Admin table scroll shells", () => {
  for (const shell of shells) {
    it(`${shell.wrap} scrolls locally and ${shell.header} stays on one line`, () => {
      const css = shell.file.endsWith("admin-media-resources.css")
        ? `${read("features/administration/components/admin-initiatives.css")}\n${read(shell.file)}`
        : shell.file.endsWith("admin-insights.css")
          ? `${read("features/administration/components/admin-traffic.css")}\n${read(shell.file)}`
          : read(shell.file);
      const wrapRule = new RegExp(
        `${shell.wrap.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{[^}]*overflow-x:\\s*auto[^}]*min-width:\\s*0|${shell.wrap.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{[^}]*min-width:\\s*0[^}]*overflow-x:\\s*auto`,
        "s",
      );
      assert.match(css, wrapRule);
      assert.match(
        css,
        new RegExp(
          `${shell.header.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^{]*\\{[^}]*white-space:\\s*nowrap`,
          "s",
        ),
      );
    });
  }

  it("country people and media resource forms no longer clip with overflow-x hidden", () => {
    for (const relative of [
      "features/administration/components/admin-country-people.css",
      "features/administration/components/admin-media-resources.css",
    ]) {
      assert.doesNotMatch(read(relative), /overflow-x:\s*hidden/);
      assert.match(read(relative), /overflow-x:\s*auto/);
    }
  });

  it("keeps existing table controls in the Admin sections", () => {
    const publishing = read("features/administration/components/AdminPublishingSection.tsx");
    assert.match(publishing, /Previous/);
    assert.match(publishing, /Next/);
    assert.match(publishing, /admin-publishing__toolbar/);
    assert.match(read("features/administration/components/AdminAuditSection.tsx"), /Previous/);
    assert.match(read("features/administration/components/AdminViewsSubscribersSection.tsx"), /Previous/);
    assert.match(read("features/administration/components/AdminLanguagesSection.tsx"), /position:\s*sticky|admin-languages__table-wrap/);
    assert.match(read("features/administration/components/admin-languages.css"), /position:\s*sticky/);
    assert.match(read("features/administration/components/AdminParticipantsSection.tsx"), /Select all participants on this page/);
    const seo = read("features/administration/components/admin-seo-console.css");
    assert.doesNotMatch(seo, /\.admin-seo-console__table-wrap\s*\{[^}]*display:\s*none/s);
  });
});
