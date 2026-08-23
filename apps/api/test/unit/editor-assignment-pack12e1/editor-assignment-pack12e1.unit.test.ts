/**
 * Pack 12E1 — Admin Editor assignment persistence contracts (API wiring).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../../");

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Pack 12E1 — assignment persistence authority", () => {
  it("POST /admin/editors assigns into editor_grants and returns 201 directory item", () => {
    assert.equal(MONGO_COLLECTIONS.editorGrants, "editor_grants");
    const routes = readRepo(
      "apps/api/src/modules/editor-grants/editor-grant.admin.routes.ts",
    );
    assert.match(routes, /assignEditorGrant/);
    assert.match(routes, /status\(201\)/);
    assert.match(routes, /Editor assigned/);

    const service = readRepo(
      "apps/api/src/modules/editor-grants/editor-grant.admin.service.ts",
    );
    assert.match(service, /insertEditorGrant/);
    assert.match(service, /findEditorGrantByParticipantId/);
    assert.match(
      service,
      /already has an Editor grant\. Update the existing grant instead/,
    );
    assert.match(service, /action:\s*["']editor\.assign["']/);
    assert.match(service, /toDirectoryItem/);
    assert.match(service, /findMemberProfileByUserId/);
  });

  it("list Admin Editors reads editor_grants only (not auth roles)", () => {
    const service = readRepo(
      "apps/api/src/modules/editor-grants/editor-grant.admin.service.ts",
    );
    assert.match(service, /listEditorGrants/);
    assert.doesNotMatch(service, /role\s*===\s*["']editor["']/);
    assert.match(service, /assertAdminActor/);
  });
});
