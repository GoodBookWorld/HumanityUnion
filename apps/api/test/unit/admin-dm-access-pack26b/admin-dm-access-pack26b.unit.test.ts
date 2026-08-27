/**
 * Pack 26B — Admin Direct Messaging access + All Participants hub contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  isNewDirectConversationAllowed,
  type DirectMessagingEligibilityDependencies,
} from "../../../src/modules/direct-messaging/direct-messaging-eligibility.js";

const apiSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../src");
const webSrc = path.resolve(apiSrc, "../../web/src");

function readApi(relativePath: string): string {
  return readFileSync(path.resolve(apiSrc, relativePath), "utf8");
}

function readWeb(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

function buildDeps(): DirectMessagingEligibilityDependencies {
  return {
    async listWorkspaceAlliesForParticipant() {
      return [];
    },
  };
}

describe("Pack 26B — Admin Direct Messaging access", () => {
  it("1 — Admin bypasses active_allies", async () => {
    assert.equal(
      await isNewDirectConversationAllowed("admin", "target", "active_allies", buildDeps(), {
        viewerIsAdmin: true,
      }),
      true,
    );
  });

  it("2 — normal Participant does not bypass active_allies", async () => {
    assert.equal(
      await isNewDirectConversationAllowed("viewer", "target", "active_allies", buildDeps(), {
        viewerIsAdmin: false,
      }),
      false,
    );
  });

  it("3 — Admin still respects nobody", async () => {
    assert.equal(
      await isNewDirectConversationAllowed("admin", "target", "nobody", buildDeps(), {
        viewerIsAdmin: true,
      }),
      false,
    );
  });

  it("4 — registered_participants unchanged for normal viewers", async () => {
    assert.equal(
      await isNewDirectConversationAllowed("viewer", "target", "registered_participants", buildDeps()),
      true,
    );
  });

  it("5 — disabled target gate lives on openOrCreate path", () => {
    const service = readApi("modules/direct-messaging/direct-messaging.service.ts");
    assert.match(service, /assertTargetAcceptsNewDirectConversation/);
    assert.match(service, /status === "disabled"/);
  });

  it("6–8 — Admin directory Message uses participantId; profile projection passes viewerIsAdmin", () => {
    const section = readWeb("features/administration/components/AdminParticipantsSection.tsx");
    assert.match(section, /openConversation\(\{\s*participantId:\s*row\.memberId\s*\}\)/);
    assert.match(section, /:\s*"Message"/);
    assert.match(section, /aria-label=\{`Message \$\{participantPrimaryName\(row\)\}`\}/);

    const profile = readApi("modules/member-profile/member-profile.service.ts");
    assert.match(profile, /viewerIsAdmin/);
    assert.match(profile, /status !== "disabled"/);
  });

  it("9–11 — Admin All Participants sidebar is Admin-only; normal UX preserved", () => {
    const workspace = readWeb("features/direct-messaging/components/DirectMessagesWorkspace.tsx");
    assert.match(workspace, /AdminAllParticipantsPanel/);
    assert.match(workspace, /isAdminViewer/);
    assert.match(workspace, /ActiveAlliesPanel/);
    assert.match(workspace, /Select an Ally/);

    const panel = readWeb("features/direct-messaging/components/AdminAllParticipantsPanel.tsx");
    assert.match(panel, /All Participants/);
    assert.doesNotMatch(panel, /All Allies/);
  });

  it("12–16 — bounded listing, search, selection model, select-all current page", () => {
    const panel = readWeb("features/direct-messaging/components/AdminAllParticipantsPanel.tsx");
    assert.match(panel, /listAdminParticipants/);
    assert.match(panel, /PAGE_SIZE\s*=\s*25/);
    assert.match(panel, /Search participants/);
    assert.match(panel, /Open Personal Chat/);
    assert.match(panel, /Prepare Initiative Group Chat/);
    assert.match(panel, /Select all on this page/);
    assert.match(panel, /selectedCount !== 1/);
    assert.match(panel, /selectedCount < 2/);
  });

  it("17–18 — notifications path unchanged; no second DM system", () => {
    const notifications = readApi("modules/direct-messaging/direct-messaging-notifications.ts");
    assert.match(notifications, /direct_message_received/);
    assert.doesNotMatch(notifications, /admin_direct_message/);

    const api = readWeb("features/direct-messaging/api.ts");
    assert.match(api, /\/api\/v1\/direct-messages\/conversations/);
  });

  it("19–20 — responsive scroll + accessibility labels", () => {
    const css = readWeb("features/direct-messaging/components/admin-all-participants-panel.css");
    assert.match(css, /overflow-y:\s*auto/);
    assert.match(css, /max-height:\s*calc\(100vh/);

    const panel = readWeb("features/direct-messaging/components/AdminAllParticipantsPanel.tsx");
    assert.match(panel, /aria-label=\{`Select \$\{name\}`\}/);
    assert.match(panel, /aria-label=\{`Message \$\{name\}`\}/);
    assert.match(panel, /role="status"/);
  });

  it("server derives Admin from auth role, not client claim", () => {
    const service = readApi("modules/direct-messaging/direct-messaging.service.ts");
    assert.match(service, /resolveViewerIsAdmin/);
    assert.match(service, /role === "admin"/);
  });
});
