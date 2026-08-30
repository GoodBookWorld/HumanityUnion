/**
 * Production Completion Pack 01 — PUBLISHING_EDIT dual-auth bridge contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  EDITOR_ASSIGNABLE_CAPABILITY_IDS,
  EDITOR_CAPABILITY_LABELS,
} from "@hu/types";

import { normalizeEditorCapabilities } from "../../../src/modules/editor-grants/editor-grant.authorization.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../..");

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Production Completion Pack 01 — Edit publications authorization", () => {
  it("PUBLISHING_EDIT is assignable and labeled Edit publications", () => {
    assert.ok(EDITOR_ASSIGNABLE_CAPABILITY_IDS.includes("PUBLISHING_EDIT"));
    assert.equal(EDITOR_CAPABILITY_LABELS.PUBLISHING_EDIT, "Edit publications");
    assert.deepEqual(normalizeEditorCapabilities(["PUBLISHING_EDIT"]), ["PUBLISHING_EDIT"]);
  });

  it("bridges ACTIVE Editor PUBLISHING_EDIT into BlogCapability editor", () => {
    const permissions = readRepo("apps/api/src/modules/blog/blog-permissions.ts");
    assert.match(permissions, /findEditorGrantByParticipantId/);
    assert.match(permissions, /PUBLISHING_EDIT/);
    assert.match(permissions, /editorGrant\?\.status === "ACTIVE"/);
    assert.match(permissions, /capabilities\.add\("editor"\)/);
    assert.match(permissions, /Compatibility bridge|Dual-auth bridge/);
  });

  it("Admin role retains Blog editor/administrator via role mapping without Editor grant", () => {
    const permissions = readRepo("apps/api/src/modules/blog/blog-permissions.ts");
    assert.match(permissions, /input\.role === "admin"/);
    assert.match(permissions, /capabilities\.add\("administrator"\)/);
  });

  it("Admin Editor form exposes Edit publications checkbox from assignable IDs", () => {
    const form = readRepo(
      "apps/web/src/features/administration/components/AdminEditorFormSection.tsx",
    );
    assert.match(form, /EDITOR_ASSIGNABLE_CAPABILITY_IDS/);
    assert.match(form, /Editing permissions/);
  });

  it("publication mutations continue to enforce via resolveBlogCapabilities", () => {
    const blogService = readRepo("apps/api/src/modules/blog/blog.service.ts");
    assert.match(blogService, /resolveBlogCapabilities/);
    assert.match(blogService, /canEditOthersDrafts|canEditorialPublish/);
  });
});
