/**
 * Pack 12B2 — Overview Editors placement + Editor Panel operational UI contracts.
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

describe("Pack 12B2 — Admin Overview final order", () => {
  it("Editors is the last Overview widget, immediately after Quick links", () => {
    const overview = readWeb("features/administration/components/AdminOverviewSection.tsx");
    const titles = [...overview.matchAll(/ProfileSection title="([^"]+)"/g)].map(
      (match) => match[1],
    );
    assert.equal(titles.at(-1), "Editors");
    assert.equal(titles.at(-2), "Quick links");
    assert.equal(titles.filter((title) => title === "Editors").length, 1);

    const summary = readWeb(
      "features/administration/components/AdminEditorsOverviewSummary.tsx",
    );
    assert.match(summary, /Active editors/);
    assert.match(summary, /Total editors/);
    assert.match(summary, /Manage Editors/);
    assert.match(summary, /Add Editor/);
    assert.doesNotMatch(overview, /Admin as Editor|Editor World/);
  });
});

describe("Pack 12B2 — Editor Panel operational workflows", () => {
  it("Initiative Edit opens canonical form and calls Editor mutation APIs", () => {
    const section = readWeb("features/administration/components/EditorPanelSection.tsx");
    assert.match(section, /EditorInitiativeEditPanel/);
    assert.match(section, /fetchEditorInitiative/);
    assert.doesNotMatch(section, /hasTool\("publishing"\)/);

    const edit = readWeb("features/administration/components/EditorInitiativeEditPanel.tsx");
    assert.match(edit, /InitiativeFormFields/);
    assert.match(edit, /updateEditorInitiative/);
    assert.match(edit, /republishEditorInitiative/);
    assert.doesNotMatch(edit, /archiveInitiative|closePublicChoiceElection/);
  });

  it("Public Choice candidate edit UI uses Editor PATCH API", () => {
    const section = readWeb("features/administration/components/EditorPanelSection.tsx");
    assert.match(section, /fetchEditorPublicChoiceCandidates/);
    assert.match(section, /updateEditorPublicChoiceCandidate/);
    assert.match(section, /Edit candidates|Candidates/);
    assert.match(section, /Edit election/);
    assert.doesNotMatch(section, /block-candidate|unblock-candidate/);
  });

  it("Media and Country People expose create/edit/activate/deactivate", () => {
    const section = readWeb("features/administration/components/EditorPanelSection.tsx");
    assert.match(section, /createEditorMediaResource/);
    assert.match(section, /updateEditorMediaResource/);
    assert.match(section, /activateEditorMediaResource/);
    assert.match(section, /deactivateEditorMediaResource/);
    assert.match(section, /createEditorCountryPerson/);
    assert.match(section, /updateEditorCountryPerson/);
    assert.match(section, /activateEditorCountryPerson/);
    assert.match(section, /deactivateEditorCountryPerson/);
  });

  it("Beta remains operational; Publishing tool omitted until dual-authorized", () => {
    const section = readWeb("features/administration/components/EditorPanelSection.tsx");
    assert.match(section, /hasTool\("beta-access"\)/);
    assert.match(section, /createEditorBetaInvite/);
    assert.doesNotMatch(section, /\/workspace\/editorial|\/workspace\/publishing/);
  });
});
