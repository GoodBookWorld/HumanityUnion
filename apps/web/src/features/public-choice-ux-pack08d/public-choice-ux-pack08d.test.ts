/**
 * Public Choice Fix 08D — web certification contracts (no product changes).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { ADMIN_PANEL_SECTIONS } from "../administration/admin-panel-sections";
import {
  INITIATIVE_ADMIN_BLOCKED_MUTATION_MESSAGE,
  PUBLIC_CHOICE_ELECTION_ADMIN_BLOCKED_MUTATION_MESSAGE,
  PUBLIC_CHOICE_MAX_CANDIDATES,
} from "@hu/types";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webRoot, relativePath), "utf8");
}

describe("Public Choice Fix 08D — web certification", () => {
  it("nav order + Admin list/detail + form helper + blocked messages", () => {
    const labels = ADMIN_PANEL_SECTIONS.map((section) => section.label);
    assert.equal(labels.indexOf("Public Choice"), labels.indexOf("Initiatives") + 1);
    assert.equal(labels.indexOf("Publishing"), labels.indexOf("Public Choice") + 1);

    const submit = readWeb(
      "features/public-choice-candidate/components/PublicChoiceCandidateSubmitPanel.tsx",
    );
    const overview = readWeb(
      "features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    const list = readWeb("features/administration/components/AdminPublicChoiceSection.tsx");
    const detail = readWeb(
      "features/administration/components/AdminPublicChoiceDetailSection.tsx",
    );
    const initiatives = readWeb(
      "features/administration/components/AdminInitiativesSection.tsx",
    );

    assert.equal(PUBLIC_CHOICE_MAX_CANDIDATES, 20);
    assert.match(submit, /Up to \{PUBLIC_CHOICE_MAX_CANDIDATES\} candidates/);
    assert.match(overview, /candidates\.length < PUBLIC_CHOICE_MAX_CANDIDATES/);
    assert.match(overview, /This election has been blocked by an administrator/);
    assert.match(list, /Block election\?/);
    assert.match(list, /View/);
    assert.match(list, /Manage/);
    assert.match(detail, /Block candidate\?/);
    assert.match(detail, /updateAdminPublicChoiceCandidate/);
    assert.match(initiatives, /Block initiative\?/);
    assert.equal(
      PUBLIC_CHOICE_ELECTION_ADMIN_BLOCKED_MUTATION_MESSAGE,
      "This election has been blocked by an administrator. Please contact the administrator.",
    );
    assert.equal(
      INITIATIVE_ADMIN_BLOCKED_MUTATION_MESSAGE,
      "This initiative has been blocked by an administrator. Please contact the administrator.",
    );
  });
});
