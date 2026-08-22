/**
 * Public Choice Fix 08C — Admin web contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { ADMIN_PANEL_SECTIONS } from "../administration/admin-panel-sections";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webRoot, relativePath), "utf8");
}

describe("Public Choice Fix 08C — Admin UI", () => {
  it("nav order places Public Choice between Initiatives and Publishing", () => {
    const labels = ADMIN_PANEL_SECTIONS.map((section) => section.label);
    const initiatives = labels.indexOf("Initiatives");
    const publicChoice = labels.indexOf("Public Choice");
    const publishing = labels.indexOf("Publishing");
    assert.ok(initiatives >= 0);
    assert.equal(publicChoice, initiatives + 1);
    assert.equal(publishing, publicChoice + 1);
  });

  it("Public Choice list/detail and Initiative Block/Unblock exist", () => {
    const list = readWeb("features/administration/components/AdminPublicChoiceSection.tsx");
    const detail = readWeb(
      "features/administration/components/AdminPublicChoiceDetailSection.tsx",
    );
    const initiatives = readWeb(
      "features/administration/components/AdminInitiativesSection.tsx",
    );
    assert.match(list, /Block election\?/);
    assert.match(list, /Unblock election\?/);
    assert.match(detail, /Block candidate\?/);
    assert.match(detail, /updateAdminPublicChoiceCandidate/);
    assert.match(initiatives, /Block initiative\?/);
    assert.match(initiatives, /blockAdminInitiative|unblockAdminInitiative/);
  });
});
