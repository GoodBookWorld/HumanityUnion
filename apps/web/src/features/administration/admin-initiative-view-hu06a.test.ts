/**
 * HU-INIT-06A — admin Initiative View stays on the protected route.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

describe("HU-INIT-06A admin Initiative view", () => {
  it("shows the full stored description without clamping it", () => {
    const detail = readWeb(
      "features/administration/components/AdminInitiativeDetailSection.tsx",
    );
    const css = readWeb("features/administration/components/admin-initiatives.css");

    assert.match(detail, /getAdminInitiativeDetail/);
    assert.match(detail, /admin-initiative-description/);
    assert.match(detail, /\{detail\.description\}/);
    assert.doesNotMatch(detail, /detail\.descriptionPreview/);
    assert.match(detail, /Administrative block/);
    assert.match(detail, /detail\.administrativelyBlocked/);
    assert.match(detail, /Lifecycle profile/);
    assert.match(detail, /detail\.lifecycleProfile/);
    assert.match(css, /\.admin-initiative-description\s*\{[^}]*white-space:\s*pre-wrap/);
    assert.match(css, /\.admin-initiative-description\s*\{[^}]*overflow-wrap:\s*anywhere/);
    assert.doesNotMatch(css, /\.admin-initiative-description\s*\{[^}]*(line-clamp|max-height|text-overflow)/);
    assert.match(css, /@media \(max-width:\s*720px\)/);
  });

  it("uses one protected View action on Admin Initiatives", () => {
    const directory = readWeb("features/administration/components/AdminInitiativesSection.tsx");
    assert.match(
      directory,
      /href=\{`\/admin\/initiatives\/\$\{encodeURIComponent\(row\.initiativeId\)\}`\}/,
    );
    assert.match(directory, />\s*View\s*</);
    assert.doesNotMatch(directory, />\s*Inspect\s*</);
    assert.match(directory, />\s*Block\s*</);
    assert.match(directory, />\s*Unblock\s*</);
  });

  it("sends Public Choice View to the admin Initiative route and keeps Manage", () => {
    const section = readWeb("features/administration/components/AdminPublicChoiceSection.tsx");
    assert.match(section, /function adminInitiativeViewHref/);
    assert.match(section, /\/admin\/initiatives\/\$\{encodeURIComponent\(initiativeId\)\}/);
    assert.match(section, /href=\{adminInitiativeViewHref\(row\.initiativeId\)\}/);
    assert.match(section, />\s*View\s*</);
    assert.match(
      section,
      /href=\{`\/admin\/public-choice\/\$\{encodeURIComponent\(row\.initiativeId\)\}`\}/,
    );
    assert.match(section, />\s*Manage\s*</);
    assert.doesNotMatch(section, /\/initiatives\/public\//);
    assert.doesNotMatch(section, /function publicElectionHref/);
  });
});
