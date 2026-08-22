/**
 * UX / Administration Pack 09D — Media Resources admin surface.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { ADMIN_PANEL_SECTIONS } from "../administration/admin-panel-sections.js";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

describe("Administration Pack 09D — Media Resources", () => {
  it("Admin Panel includes Media Resources after Publishing", () => {
    const labels = ADMIN_PANEL_SECTIONS.map((section) => section.label);
    const publishing = labels.indexOf("Publishing");
    const media = labels.indexOf("Media Resources");
    assert.ok(publishing >= 0 && media === publishing + 1);
    assert.ok(existsSync(path.resolve(webSrc, "app/admin/media-resources/page.tsx")));
    assert.match(read("app/admin/media-resources/page.tsx"), /AdminAccessGate/);
    assert.match(read("app/admin/media-resources/page.tsx"), /AdminMediaResourcesSection/);
  });

  it("Admin UI reuses Pack 09A landscape logo upload and CRUD API", () => {
    const section = read("features/administration/components/AdminMediaResourcesSection.tsx");
    const api = read("features/administration/admin-media-resources-api.ts");
    const css = read("features/administration/components/admin-media-resources.css");

    assert.match(section, /PersonImageUploadField/);
    assert.match(section, /variant="landscape"/);
    assert.match(section, /uploadMediaResourceLogo/);
    assert.match(section, /toGeographyCountryOptions|GEOGRAPHY_COUNTRIES/);
    assert.match(section, /TRUSTED_MEDIA|NEWS_SOURCE|FACT_CHECKING|PROPAGANDA_ANALYSIS/);
    assert.match(section, /scopeType/);
    assert.match(section, /Deactivate|Activate/);
    assert.match(api, /\/api\/v1\/admin\/media-resources/);
    assert.match(css, /overflow|admin-media-resources-table|min-width/);
  });

  it("Pack 09B / Pack 09C regressions remain available", () => {
    assert.ok(
      existsSync(
        path.resolve(webSrc, "features/media-responsive-ux-pack09b/media-responsive-ux-pack09b.test.ts"),
      ),
    );
    assert.ok(
      existsSync(path.resolve(webSrc, "features/mobile-shell-pack09c/mobile-shell-pack09c.test.ts")),
    );
  });
});
