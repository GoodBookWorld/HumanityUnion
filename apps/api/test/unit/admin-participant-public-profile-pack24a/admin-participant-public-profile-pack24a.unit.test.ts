/**
 * Pack 24A — Admin Participant stable public-profile link contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const apiSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../src");

function read(relativePath: string): string {
  return readFileSync(path.resolve(apiSrc, relativePath), "utf8");
}

describe("Pack 24A — Admin Participant public-profile resolver (API)", () => {
  it("4–6 — Admin-only route uses stable participantId; never uniqueName for href", () => {
    const routes = read("modules/administration/admin-participant-directory.routes.ts");
    assert.match(routes, /\/:participantId\/public-profile/);
    assert.match(routes, /authenticationMiddleware/);
    assert.match(routes, /requireAuthenticationMiddleware/);
    assert.match(routes, /resolveAdminParticipantPublicProfile/);

    const service = read("modules/administration/admin-participant-directory.service.ts");
    assert.match(service, /findAuthUserByMemberId/);
    assert.match(service, /findMemberProfileByUserId/);
    assert.match(service, /toPublicMemberProfile/);
    assert.match(service, /publicHref:\s*`\/member\/\$\{encodeURIComponent\(publicName\)\}`/);
    assert.match(service, /assertAdminUser/);
    assert.doesNotMatch(service, /passwordHash|refreshToken|accessToken/);

    const resolveFn = service.slice(service.indexOf("resolveAdminParticipantPublicProfile"));
    assert.doesNotMatch(resolveFn, /\bemail\b/);
    assert.doesNotMatch(resolveFn, /member\?\.uniqueName|authUser\.uniqueName|findMembersByIdentityIds/);
    assert.match(resolveFn, /never members\.uniqueName/);
  });

  it("2–3 — resolver loads CURRENT publicName; ignores Member.uniqueName", () => {
    const service = read("modules/administration/admin-participant-directory.service.ts");
    assert.match(service, /Never Member\.uniqueName|never Member\.uniqueName|never members\.uniqueName/i);
    assert.match(service, /profile\?\.publicName/);
    assert.doesNotMatch(
      service,
      /resolveAdminParticipantPublicProfile[\s\S]*member\.uniqueName/,
    );
  });

  it("5–7 — missing/private profile unavailable; DTO is publicName + publicHref only", () => {
    const service = read("modules/administration/admin-participant-directory.service.ts");
    assert.match(service, /AdminParticipantPublicProfileUnavailableError/);
    assert.match(service, /AdminParticipantNotFoundError/);

    const types = readFileSync(
      path.resolve(apiSrc, "../../../packages/types/src/domain/administration.ts"),
      "utf8",
    );
    assert.match(types, /interface AdminParticipantPublicProfileResolve/);
    assert.match(types, /readonly publicName: string/);
    assert.match(types, /readonly publicHref: string/);
    assert.doesNotMatch(
      types,
      /AdminParticipantPublicProfileResolve[\s\S]{0,400}email/,
    );
  });

  it("directory list route remains mounted", () => {
    const app = read("app.ts");
    assert.match(app, /\/api\/v1\/admin\/participants/);
  });
});
