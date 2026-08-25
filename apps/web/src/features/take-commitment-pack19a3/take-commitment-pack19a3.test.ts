import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("Pack 19A.3 — Take Commitment compact UX", () => {
  it("Public Result uses Take Commitment with ConfirmDialog and state labels", () => {
    const ui = read(
      "initiative-implementation-commitment-lifecycle/components/InitiativeImplementationCommitmentPublicResult.tsx",
    );

    assert.match(ui, /Take Commitment/);
    assert.match(ui, /ConfirmDialog/);
    assert.match(ui, /Available/);
    assert.match(ui, /Awaiting your response/);
    assert.match(ui, /Awaiting response/);
    assert.match(ui, /Commitment accepted\. You are now responsible/);
    assert.doesNotMatch(ui, /Take Action|Join|Accept Action/);
    // Proposed Accept/Decline stay out of the permanent public card (inbox/notification-first).
    assert.doesNotMatch(ui, /onClick=\{\(\) => void handleAccept/);
  });

  it("client API exposes take endpoint", () => {
    const api = read("initiative-implementation-commitment-lifecycle/api.ts");
    assert.match(api, /commitments\/\$\{encodeURIComponent\(commitmentId\)\}\/take/);
  });
});
