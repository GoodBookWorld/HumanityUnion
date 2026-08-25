import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("Pack 19A.5 — re-propose / transfer UX", () => {
  it("Public Result exposes state-driven re-propose and transfer Author actions", () => {
    const ui = read(
      "initiative-implementation-commitment-lifecycle/components/InitiativeImplementationCommitmentPublicResult.tsx",
    );

    assert.match(ui, /Propose Another Participant/);
    assert.match(ui, /Transfer Responsibility/);
    assert.match(ui, /viewerIsSteward/);
    assert.match(ui, /reproposeInitiativeImplementationCommitment/);
    assert.match(ui, /initiateImplementationCommitmentTransfer/);
    assert.match(ui, /Transfer pending/);
    assert.match(ui, /current responsible Participant stays responsible until the replacement Accepts/);
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
