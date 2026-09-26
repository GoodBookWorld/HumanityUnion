/**
 * Participant public PLP — SOURCE_ORIGINAL biography/skills (15D.14.B.2.1).
 * No machine-localization obligation; historical overlays are not applied.
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
  it("adapter marks biography/skills SOURCE_ORIGINAL; organization stays protected", () => {
    const adapter = read(
      "src/modules/language/published-localized-presentation/universal/adapters/participant-public-adapter.ts",
    );
    assert.match(adapter, /skills:\s*"SOURCE_ORIGINAL"/);
    assert.match(adapter, /biography:\s*"SOURCE_ORIGINAL"/);
    assert.match(adapter, /organization:\s*"PROTECTED_CANONICAL"/);
    assert.match(adapter, /organization:\s*protectedIdentity/);
    assert.match(adapter, /findMemberProfileByProfileId/);
    assert.match(adapter, /members_only/);
    assert.doesNotMatch(adapter, /biography:\s*"MACHINE_CONTENT"/);
  });

  it("profile reads keep apply boundary; enqueue is retired no-op", () => {
    const service = read("src/modules/member-profile/member-profile.service.ts");
    const apply = read(
      "src/modules/language/published-localized-presentation/universal/adapters/apply-participant-public-plp.ts",
    );
    const enqueue = read(
      "src/modules/language/published-localized-presentation/universal/adapters/enqueue-participant-public-plp.ts",
    );
    assert.match(service, /enqueueParticipantPublicPlpBuilds/);
    assert.match(service, /applyParticipantPublicPlpToProjection/);
    assert.match(apply, /SOURCE_ORIGINAL|return input\.projection/);
    assert.doesNotMatch(apply, /PUBLISHED_LOCALIZED/);
    assert.doesNotMatch(enqueue, /enqueuePlpBuildRequest/);
    assert.doesNotMatch(apply, /gemini|provider-on-read/i);
  });
});
