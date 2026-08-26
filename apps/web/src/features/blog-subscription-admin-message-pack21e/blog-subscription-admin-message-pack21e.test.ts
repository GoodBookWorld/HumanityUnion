/**
 * Pack 21E — Admin selected-subscriber composer UI contracts.
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

describe("Pack 21E — Admin selected-subscriber composer UI", () => {
  it("renders composer with labels, selected count, and disabled empty selection", () => {
    const section = read("features/administration/components/AdminViewsSubscribersSection.tsx");
    assert.match(section, /Send message to selected subscribers/);
    assert.match(section, /Subject/);
    assert.match(section, /Message/);
    assert.match(section, /selectedIds\.size/);
    assert.match(section, /Select subscribers in the table to enable sending/);
    assert.match(section, /selectedIds\.size < 1/);
    assert.match(section, /queueAdminBlogSubscriberMessage/);
    assert.match(section, /Send to selected/);
    assert.match(section, /composeSubjectId/);
    assert.match(section, /composeMessageId/);
    assert.match(section, /BLOG_ADMIN_MESSAGE_MAX_RECIPIENTS/);
  });

  it("clears selection after successful queue; preserves form on failure path", () => {
    const section = read("features/administration/components/AdminViewsSubscribersSection.tsx");
    assert.match(section, /setSelectedIds\(new Set\(\)\)/);
    assert.match(section, /setComposeError\(formatAuthFormError/);
    assert.match(section, /Welcome Message/);
    assert.match(section, /selectedIds\.has\(row\.subscriberId\)/);
  });

  it("API client posts subscriberIds to messages endpoint", () => {
    const api = read("features/administration/admin-publishing-api.ts");
    assert.match(api, /\/api\/v1\/admin\/publishing\/subscribers\/messages/);
    assert.match(api, /queueAdminBlogSubscriberMessage/);
    assert.match(api, /subscriberIds/);
  });
});
