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

describe("Pack 19A.5 — re-propose / transfer UX", () => {
  it("Public Result exposes state-driven re-propose and transfer Author actions", () => {
    const ui = read(
      "initiative-implementation-commitment-lifecycle/components/InitiativeImplementationCommitmentPublicResult.tsx",
    );

    assert.match(ui, /author\.commitment\.public\.proposeAnother/);
    assert.match(ui, /author\.commitment\.public\.transfer/);
    assert.match(ui, /viewerIsSteward/);
    assert.match(ui, /reproposeInitiativeImplementationCommitment/);
    assert.match(ui, /initiateImplementationCommitmentTransfer/);
    assert.match(ui, /author\.commitment\.messages\.transferSuccess/);
    assert.match(ui, /viewState === "declined"/);
    assert.match(ui, /viewState === "accepted"/);
    assert.match(ui, /authorActionMode === "repropose"/);
    assert.match(ui, /authorActionMode === "transfer"/);
  });

  it("transfer_pending view-state display label resolves", async () => {
    const en = await loadUiMessagesForLocale("en");
    assert.equal(
      resolveCommitmentViewStateDisplayLabel("transfer_pending", en.messages),
      "Transfer pending",
    );
  });

  it("proposal actions support pending transfer invitee without a second engine", () => {
    const actions = read("notifications/components/ImplementationCommitmentProposalActions.tsx");

    assert.match(actions, /pendingProposedParticipantId/);
    assert.match(actions, /Accept transfer\?/);
    assert.match(actions, /acceptInitiativeImplementationCommitment/);
    assert.match(actions, /declineInitiativeImplementationCommitment/);
  });

  it("client API exposes repropose and transfer endpoints", () => {
    const api = read("initiative-implementation-commitment-lifecycle/api.ts");
    assert.match(api, /\/repropose/);
    assert.match(api, /\/transfer/);
  });
});
