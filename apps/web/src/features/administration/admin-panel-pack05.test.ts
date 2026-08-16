import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

describe("Admin Panel Pack 05 — Initiative administration UI", () => {
  it("directory uses admin API with filters, pagination, and aggregates", () => {
    const section = read("features/administration/components/AdminInitiativesSection.tsx");
    assert.match(section, /listAdminInitiatives/);
    assert.match(section, /admin-initiatives-table/);
    assert.match(section, /Total Initiatives/);
    assert.match(section, /lifecyclePhase/);
    assert.match(section, /visibility/);
    assert.match(section, /Previous/);
    assert.match(section, /Next/);
    assert.doesNotMatch(section, /listInitiatives\(\)/);
    assert.doesNotMatch(section, /saveInitiativeDraft|updatePublishedInitiative/);

    const api = read("features/administration/admin-initiative-directory-api.ts");
    assert.match(api, /\/api\/v1\/admin\/initiatives/);
    assert.match(api, /visibility\/hide/);
    assert.match(api, /visibility\/restore/);
  });

  it("detail route and lifecycle visualization exist", () => {
    assert.equal(
      existsSync(path.resolve(webSrc, "app/admin/initiatives/[initiativeId]/page.tsx")),
      true,
    );
    const detail = read("features/administration/components/AdminInitiativeDetailSection.tsx");
    assert.match(detail, /getAdminInitiativeDetail/);
    assert.match(detail, /admin-initiative-lifecycle/);
    assert.match(detail, /Administrator reason/);
    assert.match(detail, /Hide from public|Restore public visibility/);
    assert.match(detail, /AdminCapabilityGap/);
    assert.match(detail, /Technical details/);
  });
});
