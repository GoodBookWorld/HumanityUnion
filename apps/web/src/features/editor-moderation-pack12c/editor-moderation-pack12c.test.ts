/**
 * Pack 12C — Editor Panel moderation UI + Admin grant capability contracts.
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

describe("Pack 12C — Editor Panel moderation UI", () => {
  it("exposes Block/Unblock and Admin-blocked disablement", () => {
    const section = readWeb("features/administration/components/EditorPanelSection.tsx");
    assert.match(section, /blockEditorInitiative/);
    assert.match(section, /unblockEditorInitiative/);
    assert.match(section, /blockEditorPublicChoiceCandidate/);
    assert.match(section, /unblockEditorPublicChoiceCandidate/);
    assert.match(section, /moderationSupported/);
    assert.match(section, /Blocked by administrator/);
    assert.doesNotMatch(section, /Block \/ unblock remains Administrator-only/);
  });

  it("Admin Editors form lists moderation capabilities via EDITOR_CAPABILITY_IDS", () => {
    const form = readWeb("features/administration/components/AdminEditorFormSection.tsx");
    assert.match(form, /EDITOR_ASSIGNABLE_CAPABILITY_IDS/);
    const types = readFileSync(
      path.resolve(webSrc, "../../../packages/types/src/domain/editor-grant.ts"),
      "utf8",
    );
    assert.match(types, /INITIATIVE_MODERATE/);
    assert.match(types, /PUBLIC_CHOICE_MODERATE/);
    assert.match(types, /EDITOR_ASSIGNABLE_CAPABILITY_IDS/);
  });

  it("Admin Initiatives shows provenance label", () => {
    const section = readWeb("features/administration/components/AdminInitiativesSection.tsx");
    assert.match(section, /blockLabel/);
  });
});
