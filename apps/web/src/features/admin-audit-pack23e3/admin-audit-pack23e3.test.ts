/**
 * Pack 23E.3 — Admin Audit browser UI contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { formatAdminAuditCategoryLabel } from "../administration/admin-audit-labels.js";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

describe("Pack 23E.3 — Admin Audit browser UI", () => {
  it("table columns + search/filters/pagination", () => {
    const section = read("features/administration/components/AdminAuditSection.tsx");
    assert.match(section, /listAdminAudit/);
    assert.match(section, /Date \/ time/);
    assert.match(section, /Action/);
    assert.match(section, /Actor/);
    assert.match(section, /Target/);
    assert.match(section, /Summary/);
    assert.match(section, /Category/);
    assert.match(section, /Search audit/);
    assert.match(section, /Previous/);
    assert.match(section, /Next/);
    assert.match(section, /PAGE_SIZE = 25/);
    assert.match(section, /No audit records match/);
    assert.match(section, /Audit unavailable|Access restricted/);
  });

  it("19–21 — responsive scroll + a11y labels; no charts/export/raw JSON", () => {
    const css = read("features/administration/components/admin-audit.css");
    assert.match(css, /overflow-x:\s*auto/);
    assert.match(css, /@media \(max-width: 640px\)/);

    const section = read("features/administration/components/AdminAuditSection.tsx");
    assert.match(section, /htmlFor=\{searchId\}/);
    assert.match(section, /<table/);
    assert.match(section, /scope="col"/);
    assert.doesNotMatch(section, /BarChart|export CSV|download JSON|raw JSON/i);
  });

  it("target links use Link when href present", () => {
    const section = read("features/administration/components/AdminAuditSection.tsx");
    assert.match(section, /row\.targetHref/);
    assert.match(section, /admin-panel__link/);
  });

  it("category labels", () => {
    assert.equal(formatAdminAuditCategoryLabel("beta_access"), "Beta Access");
    assert.equal(formatAdminAuditCategoryLabel("seo"), "SEO");
  });

  it("Admin page remains access-gated", () => {
    assert.match(read("app/admin/audit/page.tsx"), /AdminAccessGate/);
  });

  it("API client hits Admin audit route", () => {
    assert.match(
      read("features/administration/admin-audit-api.ts"),
      /\/api\/v1\/admin\/audit/,
    );
  });
});
