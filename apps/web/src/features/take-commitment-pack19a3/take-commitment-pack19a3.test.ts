import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import {
  resolveCommitmentViewStateDisplayLabel,
} from "../public-initiative-experience/initiative-experience-i18n.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("Pack 19A.3 — Take Commitment compact UX", () => {
  it("Public Result uses Take Commitment with ConfirmDialog and state labels", () => {
    const ui = read(
      "initiative-implementation-commitment-lifecycle/components/InitiativeImplementationCommitmentPublicResult.tsx",
    );

    assert.match(ui, /author\.commitment\.public\.takeCommitment/);
    assert.match(ui, /ConfirmDialog/);
    assert.match(ui, /takeInitiativeImplementationCommitment/);
    assert.match(ui, /resolveCommitmentViewStateDisplayLabel/);
    assert.match(ui, /author\.commitment\.messages\.acceptedSuccess/);
    assert.match(ui, /viewState === "available"/);
    assert.match(ui, /commitment\.status === "published"/);
    assert.doesNotMatch(ui, /Take Action|Join|Accept Action/);
    // Proposed Accept/Decline stay out of the permanent public card (inbox/notification-first).
    assert.doesNotMatch(ui, /onClick=\{\(\) => void handleAccept/);
  });

  it("view-state display labels resolve for Available / awaiting states", async () => {
    const en = await loadUiMessagesForLocale("en");
    assert.equal(resolveCommitmentViewStateDisplayLabel("available", en.messages), "Available");
    assert.equal(
      resolveCommitmentViewStateDisplayLabel("awaiting_you", en.messages),
      "Awaiting your response",
    );
    assert.equal(
      resolveCommitmentViewStateDisplayLabel("awaiting_response", en.messages),
      "Awaiting response",
    );
    assert.equal(resolveCommitmentViewStateDisplayLabel("legacy", en.messages), "");
  });

  it("client API exposes take endpoint", () => {
    const api = read("initiative-implementation-commitment-lifecycle/api.ts");
    assert.match(api, /commitments\/\$\{encodeURIComponent\(commitmentId\)\}\/take/);
  });
});
