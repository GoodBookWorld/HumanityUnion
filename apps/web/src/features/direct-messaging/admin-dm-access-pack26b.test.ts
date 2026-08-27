/**
 * Pack 26B — Admin Messages hub / directory Message action (web contracts).
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

describe("Pack 26B — Admin Messages hub (web)", () => {
  it("Admin directory Message opens by stable participantId", () => {
    const section = read("features/administration/components/AdminParticipantsSection.tsx");
    assert.match(section, /useOpenDirectConversation/);
    assert.match(section, /participantId:\s*row\.memberId/);
    assert.match(section, /aria-label=\{`Message \$\{participantPrimaryName\(row\)\}`\}/);
  });

  it("All Participants panel is Admin-gated in Messages workspace", () => {
    const workspace = read("features/direct-messaging/components/DirectMessagesWorkspace.tsx");
    assert.match(workspace, /isAdminAccountRole/);
    assert.match(workspace, /AdminAllParticipantsPanel/);
    assert.match(workspace, /ActiveAlliesPanel/);
  });

  it("does not invent a second conversation API", () => {
    const panel = read("features/direct-messaging/components/AdminAllParticipantsPanel.tsx");
    assert.match(panel, /openConversation\(\{\s*participantId/);
    assert.doesNotMatch(panel, /admin-direct-messages|admin\/messages/);
  });
});
