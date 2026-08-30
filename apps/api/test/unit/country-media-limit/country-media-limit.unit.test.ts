/**
 * Production Completion Pack 01 — country trusted media max 6.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { COUNTRY_MEDIA_LIMIT } from "../../../src/modules/country-statistics/country-public.service.js";
import { COUNTRY_TRUSTED_MEDIA_MAX } from "../../../src/modules/media-resources/media-resource.service.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../..");

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Production Completion Pack 01 — country media max 6", () => {
  it("public projection and create/update share max 6", () => {
    assert.equal(COUNTRY_MEDIA_LIMIT, 6);
    assert.equal(COUNTRY_TRUSTED_MEDIA_MAX, 6);
  });

  it("create/update paths enforce capacity without deleting legacy over-limit rows", () => {
    const service = readRepo("apps/api/src/modules/media-resources/media-resource.service.ts");
    assert.match(service, /assertCountryTrustedMediaCapacity/);
    assert.match(service, /isNewOccupancy/);
    assert.match(service, /Legacy over-limit/);
    assert.doesNotMatch(service, /deleteMany.*TRUSTED_MEDIA|slice\(0,\s*6\).*delete/);
  });

  it("Admin UI communicates max 6", () => {
    const section = readRepo(
      "apps/web/src/features/administration/components/AdminMediaResourcesSection.tsx",
    );
    assert.match(section, /COUNTRY_TRUSTED_MEDIA_MAX\s*=\s*6/);
    assert.match(section, /Country trusted media/);
  });
});
