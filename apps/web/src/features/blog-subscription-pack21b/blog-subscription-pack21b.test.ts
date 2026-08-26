/**
 * Pack 21B — Admin Views → Subscribers Welcome Message settings UI.
 * Pack 21C keeps Settings; directory gap is replaced by the table.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

describe("Pack 21B — Admin Subscribers Settings UI", () => {
  it("Views → Subscribers renders Settings section with Welcome Message controls", () => {
    const section = read("features/administration/components/AdminViewsSubscribersSection.tsx");
    assert.match(section, /Settings/);
    assert.match(section, /Welcome Message/);
    assert.match(section, /textarea/);
    assert.match(section, /Save/);
    assert.match(section, /fetchAdminBlogSubscriptionSettings/);
    assert.match(section, /updateAdminBlogSubscriptionSettings/);
    assert.match(section, /Welcome Message saved/);
    assert.match(section, /role="alert"/);
    assert.match(section, /role="status"/);
  });

  it("Settings remain separate from campaign analytics tooling", () => {
    const section = read("features/administration/components/AdminViewsSubscribersSection.tsx");
    assert.doesNotMatch(section, /campaign analytics|delivery-history dashboard/i);
  });

  it("admin publishing API client exposes subscription-settings endpoints", () => {
    const api = read("features/administration/admin-publishing-api.ts");
    assert.match(api, /\/api\/v1\/admin\/publishing\/subscription-settings/);
    assert.match(api, /fetchAdminBlogSubscriptionSettings/);
    assert.match(api, /updateAdminBlogSubscriptionSettings/);
    assert.match(api, /method:\s*"PATCH"/);
  });
});
