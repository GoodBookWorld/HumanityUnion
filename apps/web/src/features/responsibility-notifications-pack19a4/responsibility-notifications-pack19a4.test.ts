import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("Pack 19A.4 — notification-first Accept/Decline UX", () => {
  it("proposal actions use commitmentId and canonical Accept/Decline APIs", () => {
    const actions = read("notifications/components/ImplementationCommitmentProposalActions.tsx");

    assert.match(actions, /commitmentId/);
    assert.match(actions, /acceptInitiativeImplementationCommitment/);
    assert.match(actions, /declineInitiativeImplementationCommitment/);
    assert.match(actions, /Accept responsibility\?/);
    assert.match(actions, /ConfirmDialog/);
    assert.doesNotMatch(actions, /acceptedAt:\s*["'`]/);
  });

  it("Notification Center wires proposal actions for notification and reminder", () => {
    const page = read("notifications/components/NotificationCenterPageContent.tsx");

    assert.match(page, /implementation_commitment_proposed/);
    assert.match(page, /ImplementationCommitmentProposalActions/);
    assert.match(page, /relatedEntityType === IMPLEMENTATION_COMMITMENT_ENTITY/);
  });

  it("publish still creates Reminder with relatedEntityId = commitmentId", () => {
    const service = readFileSync(
      join(
        root,
        "../../../api/src/modules/initiative-implementation-commitment-lifecycle/initiative-implementation-commitment-lifecycle.service.ts",
      ),
      "utf8",
    );

    assert.match(service, /You have a proposed responsibility/);
    assert.match(service, /relatedEntityType: "implementation_commitment"/);
    assert.match(service, /relatedEntityId: input\.commitment\.commitmentId/);
    assert.match(service, /implementation_commitment_proposed/);
  });
});
