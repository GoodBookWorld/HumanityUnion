/**
 * Pack 19C.4F — Guest Message CTA with authentication redirect.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("Pack 19C.4F — Guest Message CTA with auth redirect", () => {
  it("guest sees Message CTA routed through /login?returnTo=/member/{publicName}", () => {
    const action = readWeb("features/direct-messaging/components/DirectMessageAction.tsx");

    assert.match(action, /authStatus === "unauthenticated"/);
    assert.match(action, /function buildGuestMessageLoginHref/);
    assert.match(action, /\/login\?returnTo=\$\{encodeURIComponent\(returnTo\)\}/);
    assert.match(action, /\/member\/\$\{encodeURIComponent\(publicName\)\}/);
    assert.match(
      action,
      /href=\{buildGuestMessageLoginHref\(publicName\)\}/,
    );
    assert.match(
      action,
      /className="direct-message-action__button hu-button hu-button--secondary"/,
    );
    // Guest branch returns an <a>; conversation open stays on the authenticated button only.
    assert.match(
      action,
      /if \(authStatus === "unauthenticated"\) \{[\s\S]*?<a[\s\S]*?<\/a>[\s\S]*?\}/m,
    );
    assert.match(
      action,
      /onClick=\{\(\) => openConversation\(\{ publicName \}\)\}/,
    );
  });

  it("authenticated eligible path still uses openConversation({ publicName })", () => {
    const action = readWeb("features/direct-messaging/components/DirectMessageAction.tsx");

    assert.match(action, /openConversation\(\{ publicName \}\)/);
    assert.match(action, /profile\.messagingAvailability/);
    assert.match(action, /availability === "hidden" \|\| availability === "unavailable"/);
    assert.doesNotMatch(action, /direct-message-action__unavailable/);
  });

  it("public profile mounts DirectMessageAction in hero; owner preview gate is mode===public", () => {
    const surface = readWeb("features/member-profile/components/ParticipantProfileSurface.tsx");

    assert.match(surface, /public-member-page__hero/);
    assert.match(
      surface,
      /\{mode === "public" \? \(\s*<div className="public-member-page__message-action">\s*<DirectMessageAction/m,
    );
  });

  it("reuses established returnTo auth pattern (resolveSafeReturnTo on login)", () => {
    const login = readWeb("features/auth/components/LoginForm.tsx");
    const resolve = readWeb("features/auth/lib/resolve-safe-return-to.ts");

    assert.match(login, /resolveSafeReturnTo\(searchParams\.get\("returnTo"\)/);
    assert.match(resolve, /export function resolveSafeReturnTo/);
  });
});
