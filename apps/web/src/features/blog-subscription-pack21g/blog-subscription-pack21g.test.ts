/**
 * Pack 21G — Admin Add Subscriber UI contracts.
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

describe("Pack 21G — Admin Add Subscriber UI", () => {
  it("exposes Add Subscriber form above the table with required fields", () => {
    const section = read("features/administration/components/AdminViewsSubscribersSection.tsx");
    assert.match(section, /Add Subscriber/);
    assert.match(section, /addAdminBlogSubscriber/);
    assert.match(section, /Confirmed existing subscriber/);
    assert.match(section, /Needs confirmation/);
    assert.match(section, /Restore if currently unsubscribed/);
    assert.match(section, /refreshSubscriberList/);
  });

  it("API client posts to Admin subscribers endpoint", () => {
    const api = read("features/administration/admin-publishing-api.ts");
    assert.match(api, /addAdminBlogSubscriber/);
    assert.match(api, /method:\s*"POST"/);
    assert.match(api, /importMode/);
    assert.match(api, /restoreUnsubscribed/);
  });
});
