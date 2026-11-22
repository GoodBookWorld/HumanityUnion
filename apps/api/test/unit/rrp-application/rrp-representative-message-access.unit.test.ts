/**
 * HU-RRP-MSG-01C — Message link only for this application's active Representative appointment.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { RRP_APPLICATION_STATUSES, type RrpApplicationStatus } from "@hu/types";

import { isRrpRepresentativeConversationLinkEligible } from "../../../src/modules/rrp-application/rrp-application.lifecycle.js";

const apiSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../src");

describe("HU-RRP-MSG-01C Representative message access", () => {
  it("requires this application's approved status and active appointment", () => {
    assert.equal(
      isRrpRepresentativeConversationLinkEligible({
        status: "approved",
        platformDesignationActive: true,
      }),
      true,
    );
    assert.equal(
      isRrpRepresentativeConversationLinkEligible({
        status: "approved",
        platformDesignationActive: false,
      }),
      false,
    );

    const ineligible: readonly RrpApplicationStatus[] = [
      "draft",
      "submitted",
      "under_review",
      "information_requested",
      "rejected",
      "withdrawn",
    ];
    for (const status of ineligible) {
      assert.equal(
        isRrpRepresentativeConversationLinkEligible({
          status,
          platformDesignationActive: true,
        }),
        false,
        status,
      );
    }
    assert.equal(RRP_APPLICATION_STATUSES.includes("cancelled" as RrpApplicationStatus), false);
  });

  it("keeps the dedicated conversation resolver and direct-message access ungated", () => {
    const resolution = readFileSync(
      path.join(apiSrc, "modules/rrp-application/rrp-admin-conversation.resolution.ts"),
      "utf8",
    );
    const messaging = readFileSync(
      path.join(apiSrc, "modules/direct-messaging/direct-messaging.service.ts"),
      "utf8",
    );
    assert.match(resolution, /export async function resolveOwnRrpAdminConversationForUser/);
    assert.doesNotMatch(resolution, /isRrpRepresentativeConversationLinkEligible/);
    assert.doesNotMatch(resolution, /openOrCreateDirectConversation/);
    assert.match(messaging, /export async function openOrCreateDirectConversation/);
    assert.match(messaging, /export async function sendDirectMessage/);
  });
});
