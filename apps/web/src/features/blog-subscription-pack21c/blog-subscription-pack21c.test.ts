/**
 * Pack 21C — Admin Views → Subscribers table UI contracts.
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

describe("Pack 21C — Admin Subscribers table UI", () => {
  it("renders expected columns, Select All, and subscriberId selection", () => {
    const section = read("features/administration/components/AdminViewsSubscribersSection.tsx");
    assert.match(section, /admin-publishing-table/);
    assert.match(section, /Select all subscribers on this page/);
    assert.match(section, /selectedIds\.has\(row\.subscriberId\)/);
    assert.match(section, /toggleRow\(row\.subscriberId\)/);
    assert.match(section, /Name/);
    assert.match(section, /Subscription type/);
    assert.match(section, /Email subscription/);
    assert.match(section, /Date subscribed/);
    assert.match(section, /Country/);
    assert.match(section, /Emails sent/);
    assert.match(section, /Remove Subscriber/);
    assert.match(section, /ConfirmDialog/);
    assert.match(section, /selectedIds\.size/);
    assert.match(section, /PAGE_SIZE/);
  });

  it("Select All applies to current loaded page only", () => {
    const section = read("features/administration/components/AdminViewsSubscribersSection.tsx");
    assert.match(section, /allPageSelected/);
    assert.match(section, /pageIds/);
    assert.doesNotMatch(section, /selectAllDatabase|selectEntireCollection/i);
  });

  it("keeps Welcome Settings and does not implement campaign analytics", () => {
    const section = read("features/administration/components/AdminViewsSubscribersSection.tsx");
    assert.match(section, /Welcome Message/);
    assert.match(section, /updateAdminBlogSubscriptionSettings/);
    assert.match(section, /fetchAdminBlogSubscriptionSettings/);
    assert.doesNotMatch(section, /campaign analytics|delivery-history UI|recurring campaign/i);
    assert.doesNotMatch(section, /AdminCapabilityGap/);
  });

  it("admin API client exposes list/remove subscribers endpoints", () => {
    const api = read("features/administration/admin-publishing-api.ts");
    assert.match(api, /\/api\/v1\/admin\/publishing\/subscribers/);
    assert.match(api, /listAdminBlogSubscribers/);
    assert.match(api, /removeAdminBlogSubscriber/);
    assert.match(api, /method:\s*"DELETE"/);
  });

  it("status and type labels cover Admin presentation", () => {
    const labels = read("features/administration/blog-subscription-labels.ts");
    assert.match(labels, /Blog publications/);
    assert.match(labels, /Not confirmed/);
    assert.match(labels, /Subscribed/);
    assert.match(labels, /Unsubscribed/);
  });
});
