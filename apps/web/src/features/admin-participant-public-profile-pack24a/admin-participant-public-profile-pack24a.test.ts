/**
 * Pack 24A — Admin Participant stable public-profile link (web).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  adminParticipantPublicProfilePath,
} from "../administration/admin-participant-directory-api.js";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

describe("Pack 24A — Admin Participant public-profile link (web)", () => {
  it("1–4 — View profile uses stable Admin resolver path, not /member/{uniqueName}", () => {
    const section = read("features/administration/components/AdminParticipantsSection.tsx");
    assert.match(section, /adminParticipantPublicProfilePath\(row\.memberId\)/);
    assert.match(section, /row\.publicName/);
    assert.match(section, /View profile/);
    assert.doesNotMatch(section, /\/member\/\$\{encodeURIComponent\(row\.uniqueName\)\}/);
    assert.doesNotMatch(section, /row\.uniqueName\s*\?\s*`\/member\//);

    assert.equal(
      adminParticipantPublicProfilePath("member-abc"),
      "/admin/participants/member-abc/public-profile",
    );
  });

  it("2–3 — resolver redirects to CURRENT /member/{publicName}; never uniqueName", () => {
    const redirect = read(
      "features/administration/components/AdminParticipantPublicProfileRedirect.tsx",
    );
    assert.match(redirect, /resolveAdminParticipantPublicProfile/);
    assert.match(redirect, /router\.replace\(resolved\.publicHref\)/);
    assert.match(redirect, /publicHref\.startsWith\("\/member\/"\)/);
    assert.doesNotMatch(redirect, /row\.uniqueName|member\.uniqueName|\/member\/\$\{.*uniqueName/);

    const page = read("app/admin/participants/[participantId]/public-profile/page.tsx");
    assert.match(page, /AdminAccessGate/);
    assert.match(page, /AdminParticipantPublicProfileRedirect/);
  });

  it("5 — missing public profile does not fabricate URL", () => {
    const section = read("features/administration/components/AdminParticipantsSection.tsx");
    assert.match(section, /Profile unavailable/);
    assert.match(section, /canViewPublicProfile = Boolean\(row\.publicName/);
    assert.doesNotMatch(section, /\/member\/undefined/);

    const redirect = read(
      "features/administration/components/AdminParticipantPublicProfileRedirect.tsx",
    );
    assert.match(redirect, /Profile unavailable/);
  });

  it("7 — API client and resolve response omit private fields", () => {
    const api = read("features/administration/admin-participant-directory-api.ts");
    assert.match(api, /\/public-profile/);
    assert.doesNotMatch(api, /passwordHash|refreshToken|accessToken/);
  });

  it("8 — Actions layout reserved for Pack 24B pair", () => {
    const section = read("features/administration/components/AdminParticipantsSection.tsx");
    assert.match(section, /admin-participants-table__actions/);
    assert.match(
      section,
      /admin-participants-table__action-slot|>\s*Suspend\s*</,
    );
    assert.match(section, /hu-button--secondary|variant="secondary"/);

    const css = read("features/administration/components/admin-participants-table.css");
    assert.match(css, /\.admin-participants-table__actions/);
    assert.match(css, /min-width:\s*12\.5rem/);
  });

  it("6 — Admin page remains access-gated", () => {
    const page = read("app/admin/participants/page.tsx");
    assert.match(page, /AdminAccessGate/);
  });
});
