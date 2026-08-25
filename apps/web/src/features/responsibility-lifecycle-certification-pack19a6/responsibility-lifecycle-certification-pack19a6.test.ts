import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("Pack 19A.6 — responsibility lifecycle certification UX audit", () => {
  it("proposal actions reconcile terminal status and transfer pending", () => {
    const actions = read("notifications/components/ImplementationCommitmentProposalActions.tsx");

    assert.match(actions, /projection\.status === "completed"/);
    assert.match(actions, /pendingProposedParticipantId/);
    assert.match(actions, /acceptInitiativeImplementationCommitment/);
    assert.match(actions, /declineInitiativeImplementationCommitment/);
  });

  it("Notification Center still dual-wires Reminder and proposed notification surfaces", () => {
    const page = read("notifications/components/NotificationCenterPageContent.tsx");

    assert.match(page, /implementation_commitment_proposed/);
    assert.match(page, /ImplementationCommitmentProposalActions/);
    assert.match(page, /relatedEntityType === IMPLEMENTATION_COMMITMENT_ENTITY/);
  });

  it("Complete/Withdraw clear pending transfer fields", () => {
    const service = readFileSync(
      join(
        root,
        "../../../api/src/modules/initiative-implementation-commitment/initiative-implementation-commitment.service.ts",
      ),
      "utf8",
    );

    assert.match(service, /pendingProposedParticipantId: null/);
    assert.match(service, /Pack 19A\.6/);
  });
});
