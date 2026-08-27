/**
 * Pack 24B — Admin Participant suspension & review UI contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  PARTICIPANT_SUSPENSION_REASON_OPTIONS,
} from "../administration/admin-participant-suspension-api.js";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

describe("Pack 24B — Admin Participant suspension UI", () => {
  it("20–22 — Actions show View + Suspend / Review Restore; balanced layout", () => {
    const section = read("features/administration/components/AdminParticipantsSection.tsx");
    assert.match(section, /View profile/);
    assert.match(section, />\s*Suspend\s*</);
    assert.match(section, /Review \/ Restore/);
    assert.match(section, /variant="danger"/);
    assert.match(section, /variant="secondary"/);
    assert.match(section, /admin-participants-table__actions/);
    assert.match(section, /ConfirmDialog/);
    assert.match(section, /Suspend Participant/);
    assert.match(section, /Restore Participant/);

    const css = read("features/administration/components/admin-participants-table.css");
    assert.match(css, /\.admin-participants-table__actions/);
    assert.match(css, /\.admin-participants-table__action/);
  });

  it("3 — exactly three reason choices", () => {
    assert.equal(PARTICIPANT_SUSPENSION_REASON_OPTIONS.length, 3);
    assert.deepEqual(
      PARTICIPANT_SUSPENSION_REASON_OPTIONS.map((option) => option.label),
      [
        "Community standards violation",
        "Spam or abusive activity",
        "Security or account integrity concern",
      ],
    );
    const section = read("features/administration/components/AdminParticipantsSection.tsx");
    assert.match(section, /PARTICIPANT_SUSPENSION_REASON_OPTIONS/);
  });

  it("9 — review page is token-only with textarea + Send unblocking request", () => {
    const page = read("app/account/suspension-review/page.tsx");
    assert.match(page, /Request an account review/);
    assert.match(page, /SuspensionReviewRequestForm/);

    const form = read("features/administration/components/SuspensionReviewRequestForm.tsx");
    assert.match(form, /Explain why you are requesting restoration of access/);
    assert.match(form, /Send unblocking request/);
    assert.match(form, /textarea/);
    assert.match(form, /fetchPublicSuspensionReview|submitPublicSuspensionReview/);
    assert.doesNotMatch(form, /getMe|AdminAccessGate/);
  });

  it("18 — notification/audit UI does not dump appeal body into directory chrome", () => {
    const section = read("features/administration/components/AdminParticipantsSection.tsx");
    assert.match(section, /reviewExplanation/);
    assert.doesNotMatch(section, /passwordHash|refreshToken|reviewToken/);
  });

  it("API client hits Admin suspend/restore and public review routes", () => {
    const api = read("features/administration/admin-participant-suspension-api.ts");
    assert.match(api, /\/suspend/);
    assert.match(api, /\/restore/);
    assert.match(api, /\/api\/v1\/public\/suspension-review/);
  });
});
