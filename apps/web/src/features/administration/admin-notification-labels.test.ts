import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveAdminNotificationHref,
  resolveAdminNotificationTypeLabel,
} from "./admin-notification-labels";

describe("Admin notification labels", () => {
  it("names an Integrity Media author reply and links to Integrity Authors", () => {
    assert.equal(
      resolveAdminNotificationTypeLabel({
        type: "integrity_media_author_message",
        title: "Integrity Media author message",
      }),
      "Integrity Media author message",
    );
    assert.equal(
      resolveAdminNotificationHref({
        type: "integrity_media_author_message",
        targetHref: "/admin/integrity-media",
      }),
      "/admin/integrity-media",
    );
  });
});
