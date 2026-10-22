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
    assert.equal(
      resolveAdminNotificationHref({
        type: "integrity_media_author_message",
        targetHref: "/admin/integrity-media",
        sourceEventId: "11111111-1111-4111-8111-111111111111",
      }),
      "/admin/integrity-media?messageId=11111111-1111-4111-8111-111111111111",
    );
    assert.equal(
      resolveAdminNotificationHref({
        type: "integrity_media_author_message",
        targetHref: "/admin/integrity-media",
        sourceEventId: "not-a-message",
      }),
      "/admin/integrity-media",
    );
    assert.equal(
      resolveAdminNotificationHref({
        type: "participant_registered",
        targetHref: "/admin/participants",
        sourceEventId: "11111111-1111-4111-8111-111111111111",
      }),
      "/admin/participants",
    );
  });
});
