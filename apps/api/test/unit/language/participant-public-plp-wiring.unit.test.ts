/**
 * Participant public PLP — production adapter loads MemberProfile; overlay is
 * provider-free CURRENT resolve with coherent canonical fallback.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, "../../..");

function read(relative: string): string {
  return readFileSync(path.join(apiRoot, relative), "utf8");
}

describe("participant_public PLP production wiring", () => {
  it("adapter includes skills MACHINE_CONTENT and Mongo live source", () => {
    const adapter = read(
      "src/modules/language/published-localized-presentation/universal/adapters/participant-public-adapter.ts",
    );
    assert.match(adapter, /skills:\s*"MACHINE_CONTENT"/);
    assert.match(adapter, /biography:\s*"MACHINE_CONTENT"/);
    assert.match(adapter, /findMemberProfileByProfileId/);
    assert.match(adapter, /members_only/);
  });

  it("profile mutations enqueue PLP builds; reads overlay CURRENT only", () => {
    const service = read("src/modules/member-profile/member-profile.service.ts");
    const apply = read(
      "src/modules/language/published-localized-presentation/universal/adapters/apply-participant-public-plp.ts",
    );
    assert.match(service, /enqueueParticipantPublicPlpBuilds/);
    assert.match(service, /applyParticipantPublicPlpToProjection/);
    assert.match(apply, /mode !== "PUBLISHED_LOCALIZED"/);
    assert.doesNotMatch(apply, /gemini|provider-on-read/i);
  });
});
