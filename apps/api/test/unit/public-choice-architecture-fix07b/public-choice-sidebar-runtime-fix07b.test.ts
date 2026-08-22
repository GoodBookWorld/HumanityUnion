/**
 * Public Choice Fix 07B — public initiative GET must not be gated by shared-docs auth.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { resolveParticipantFacingCurrentStageId } from "@hu/types";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../../");

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Public Choice Fix 07B — public roster + presentation stage", () => {
  it("shared documents JWT middleware is path-scoped under public/initiatives", () => {
    const routes = readRepo(
      "apps/api/src/modules/shared-documents/shared-documents.initiatives.routes.ts",
    );
    const app = readRepo("apps/api/src/app.ts");
    assert.match(app, /sharedDocumentsInitiativesRouter/);
    assert.match(app, /publicInitiativeRouter/);
    // Mount order: shared docs before public initiative GET — auth must not be global.
    assert.match(routes, /Fix 07B — Auth must be path-scoped/);
    assert.doesNotMatch(
      routes,
      /sharedDocumentsInitiativesRouter\.use\(requireJwtAuthenticationMiddleware\);/,
    );
  });

  it("experience + journey apply participant-facing current stage clamp", () => {
    const experience = readRepo(
      "apps/api/src/modules/initiatives/public-initiative-experience.service.ts",
    );
    const journey = readRepo(
      "apps/api/src/modules/collective-participation-journey/collective-participation-journey.service.ts",
    );
    assert.match(experience, /resolveParticipantFacingCurrentStageId/);
    assert.match(journey, /resolveParticipantFacingCurrentStageId/);
    assert.equal(
      resolveParticipantFacingCurrentStageId("archive", "PUBLIC_CHOICE"),
      "collective_decision",
    );
  });
});
