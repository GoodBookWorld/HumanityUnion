/**
 * Pack 12B2 — Editor Panel completion: Initiative mutations + operational widgets + Overview order.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../../");

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Pack 12B2 — Initiative Editor authority", () => {
  it("exposes Editor Initiative get/update/republish via assertEditorCanMutate", () => {
    const editor = readRepo("apps/api/src/modules/initiatives/initiative-editor.service.ts");
    assert.match(editor, /resolveEffectiveModerationBlock/);
    assert.match(editor, /INITIATIVE_EDIT/);
    assert.match(editor, /updateInitiativeAsEditor/);
    assert.match(editor, /republishInitiativeAsEditor/);
    assert.match(editor, /saveInitiativeDraftContent|updatePublishedInitiativeContent/);

    const routes = readRepo("apps/api/src/modules/editor-grants/editor-panel.routes.ts");
    assert.match(routes, /\/initiatives\/:initiativeId/);
    assert.match(routes, /updateInitiativeAsEditor/);
    assert.match(routes, /republishInitiativeAsEditor/);
  });

  it("reuses ownership-agnostic content cores (no stewardship transfer)", () => {
    const service = readRepo("apps/api/src/modules/initiatives/initiative.service.ts");
    assert.match(service, /export function saveInitiativeDraftContent/);
    assert.match(service, /export function updatePublishedInitiativeContent/);
    assert.match(service, /export function republishInitiativeContent/);
    assert.match(service, /getOwnedInitiative/);
  });

  it("cover media upload accepts Editor INITIATIVE_EDIT", () => {
    const authority = readRepo("apps/api/src/modules/initiatives/initiative-media-authority.ts");
    assert.match(authority, /assertCanUploadInitiativeCoverMedia/);
    assert.match(authority, /INITIATIVE_EDIT/);
    const routes = readRepo("apps/api/src/modules/media-upload/media-upload.routes.ts");
    assert.match(routes, /assertCanUploadInitiativeCoverMedia/);
  });
});

describe("Pack 12B2 — grant-driven panel honesty", () => {
  it("marks INITIATIVE_EDIT mutationSupported and includes PUBLISHING_EDIT publishing tool", () => {
    const panel = readRepo("apps/api/src/modules/editor-grants/editor-panel.service.ts");
    assert.match(panel, /toolId: "initiatives"/);
    assert.match(panel, /mutationSupported: true/);
    assert.match(panel, /caps\.has\("PUBLISHING_EDIT"\)/);
    assert.match(panel, /toolId: "publishing"/);
  });

  it("lists Public Choice candidates for Editor and blocks Editor on Admin-blocked candidates", () => {
    const panel = readRepo("apps/api/src/modules/editor-grants/editor-panel.service.ts");
    assert.match(panel, /listEditorPublicChoiceCandidates/);
    const candidate = readRepo(
      "apps/api/src/modules/public-choice-candidate/public-choice-candidate.service.ts",
    );
    assert.match(candidate, /PUBLIC_CHOICE_CANDIDATE_ADMIN_BLOCKED_MUTATION_MESSAGE/);
    assert.match(candidate, /user\.role !== "admin"/);
  });
});
