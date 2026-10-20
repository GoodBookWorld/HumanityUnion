/**
 * HU–IM.07C.3 — Admin table cells must not shrink to one letter.
 *
 * Workspace and profile sections set overflow-wrap: anywhere. Combined with
 * width: 100% tables, that made badges, links and buttons stack vertically.
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

describe("Admin table readability", () => {
  it("overrides inherited anywhere wrapping inside Admin tables", () => {
    const cause = read("components/member/profile-section.css");
    const shell = read("components/member/member-workspace.css");
    const contract = read("features/administration/components/admin-table-readability.css");
    const layout = read("app/admin/layout.tsx");

    assert.match(cause, /\.profile-section\s*\{[^}]*overflow-wrap:\s*anywhere/s);
    assert.match(shell, /\.member-workspace__main\s*\{[^}]*overflow-wrap:\s*anywhere/s);
    assert.match(layout, /admin-table-readability\.css/);
    assert.match(contract, /\.admin-initiatives-table/);
    assert.match(contract, /\.admin-publishing-table/);
    assert.match(
      contract,
      /:is\(th, td\)\s*\{[^}]*overflow-wrap:\s*normal[^}]*word-break:\s*normal/s,
    );
    assert.doesNotMatch(contract, /overflow-wrap:\s*anywhere/);
    assert.match(
      contract,
      /:is\(th, \.workspace-badge, \.admin-publishing-table__status, \.hu-button, \.admin-panel__link\)\s*\{[^}]*white-space:\s*nowrap/s,
    );
    assert.match(contract, /\.hu-button, \.admin-panel__link, \.workspace-badge, \.admin-publishing-table__status\)\s*\{[^}]*max-width:\s*none/s);
    assert.match(contract, /\.admin-public-choice-actions[\s\S]*width:\s*max-content/);
    assert.match(contract, /overflow-wrap:\s*break-word/);
  });

  it("sizes the reported directories from content and scrolls the wrapper", () => {
    const initiatives = read("features/administration/components/admin-initiatives.css");
    const publishing = read("features/administration/components/admin-publishing.css");
    const choice = read("features/administration/components/admin-public-choice.css");
    const subscribers = read("features/administration/components/AdminViewsSubscribersSection.tsx");
    const initiativeSection = read("features/administration/components/AdminInitiativesSection.tsx");
    const choiceSection = read("features/administration/components/AdminPublicChoiceSection.tsx");

    assert.match(initiatives, /\.admin-initiatives-table\s*\{[^}]*width:\s*max-content/s);
    assert.match(initiatives, /\.admin-initiatives-table-wrap\s*\{[^}]*overflow-x:\s*auto/s);
    assert.match(initiatives, /\.admin-initiatives-table-wrap\s*\{[^}]*min-width:\s*0/s);
    assert.match(publishing, /\.admin-publishing-table\s*\{[^}]*width:\s*max-content/s);
    assert.match(publishing, /\.admin-publishing-table-wrap\s*\{[^}]*overflow-x:\s*auto/s);
    assert.match(publishing, /\.admin-publishing-table-wrap\s*\{[^}]*min-width:\s*0/s);
    assert.match(choice, /\.admin-public-choice-actions\s*\{[^}]*flex-wrap:\s*nowrap/s);

    assert.match(initiativeSection, /Inspect/);
    assert.match(initiativeSection, /Public page/);
    assert.match(initiativeSection, /WorkspaceStatusBadge/);
    assert.match(choiceSection, /Manage/);
    assert.match(choiceSection, />\s*View\s*</);
    assert.match(subscribers, /Remove Subscriber/);
    assert.match(subscribers, /blogSubscriptionStatusClassName/);
  });
});
