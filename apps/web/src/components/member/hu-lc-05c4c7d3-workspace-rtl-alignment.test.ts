/**
 * HU-LC-05C.4C.7D.3 — Workspace text follows the document direction:
 * `start` is left in LTR (unchanged) and right in RTL.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relative: string): string {
  return readFileSync(path.join(WEB_SRC, relative), "utf8");
}

function rootRule(css: string): string {
  const match = /^\.member-workspace \{([\s\S]*?)^\}/m.exec(css);
  assert.ok(match, ".member-workspace rule not found");
  return match[1] ?? "";
}

describe("HU-LC-05C.4C.7D.3 — Workspace RTL text alignment", () => {
  it("aligns Workspace text to the logical start edge", () => {
    const rule = rootRule(read("components/member/member-workspace.css"));
    assert.match(rule, /^\s*text-align: start;$/m);
    assert.doesNotMatch(rule, /text-align:\s*(left|right)/);
  });

  it("keeps the Workspace grid geometry unchanged", () => {
    const rule = rootRule(read("components/member/member-workspace.css"));
    for (const declaration of [
      "display: grid;",
      "grid-template-columns: minmax(0, var(--hu-sidebar-width)) minmax(0, 1fr);",
      "gap: var(--hu-content-gap);",
      "width: 100%;",
      "max-width: 100%;",
      "min-width: 0;",
      "align-items: start;",
      "box-sizing: border-box;",
    ]) {
      assert.ok(rule.includes(declaration), declaration);
    }
    assert.doesNotMatch(rule, /overflow|direction:/);
  });

  it("leaves no physical text alignment between the page and Petition Status text", () => {
    for (const file of [
      "components/member/member-workspace.css",
      "components/member/profile-section.css",
      "components/member/profile-field.css",
      "app/petitions/petition-page.css",
      "features/petition/components/workspace.css",
    ]) {
      assert.doesNotMatch(read(file), /text-align:\s*(left|right)\b/, file);
    }
  });
});
