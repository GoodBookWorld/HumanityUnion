/**
 * HU-RRP-02A — Regional Program application entry (flagged navigation).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { resolveSafeReturnTo } from "../auth/lib/resolve-safe-return-to.js";
import { REGIONAL_PROGRAM_JOIN_MAILTO } from "./regional-program.constants.js";
import {
  buildRrpApplicationConfirmEmailHref,
  buildRrpApplicationLoginHref,
  hasRrpApplicationEntryIntent,
  isRrpApplicationEntryEnabled,
  RRP_APPLICATION_ENTRY_FLAG_ENV,
  RRP_APPLICATION_ENTRY_HREF,
  withSafeReturnTo,
} from "./rrp-application-entry.js";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

describe("HU-RRP-02A regional program application entry", () => {
  it("defaults the application-entry flag to disabled", () => {
    assert.equal(isRrpApplicationEntryEnabled({}), false);
    assert.equal(
      isRrpApplicationEntryEnabled({ [RRP_APPLICATION_ENTRY_FLAG_ENV]: "false" }),
      false,
    );
    assert.equal(
      isRrpApplicationEntryEnabled({ [RRP_APPLICATION_ENTRY_FLAG_ENV]: "1" }),
      false,
    );
    assert.equal(
      isRrpApplicationEntryEnabled({ [RRP_APPLICATION_ENTRY_FLAG_ENV]: "true" }),
      true,
    );
  });

  it("defines the canonical Workspace destination with nested query", () => {
    assert.equal(RRP_APPLICATION_ENTRY_HREF, "/workspace?rrp=apply");
    assert.equal(hasRrpApplicationEntryIntent(new URLSearchParams("rrp=apply")), true);
    assert.equal(hasRrpApplicationEntryIntent(new URLSearchParams("rrp=other")), false);
    assert.equal(
      resolveSafeReturnTo(RRP_APPLICATION_ENTRY_HREF, "/workspace"),
      RRP_APPLICATION_ENTRY_HREF,
    );
  });

  it("builds login and confirm-email hrefs that preserve rrp=apply", () => {
    assert.equal(
      buildRrpApplicationLoginHref(),
      `/login?returnTo=${encodeURIComponent(RRP_APPLICATION_ENTRY_HREF)}`,
    );
    assert.equal(
      buildRrpApplicationConfirmEmailHref(),
      `/confirm-email?returnTo=${encodeURIComponent(RRP_APPLICATION_ENTRY_HREF)}`,
    );
    assert.equal(
      withSafeReturnTo("/register", RRP_APPLICATION_ENTRY_HREF),
      `/register?returnTo=${encodeURIComponent(RRP_APPLICATION_ENTRY_HREF)}`,
    );
  });

  it("rejects unsafe external returnTo values", () => {
    assert.equal(resolveSafeReturnTo("https://evil.example", "/workspace"), "/workspace");
    assert.equal(resolveSafeReturnTo("//evil.example", "/workspace"), "/workspace");
    assert.equal(resolveSafeReturnTo("/\\evil", "/workspace"), "/workspace");
    assert.equal(resolveSafeReturnTo("/login?returnTo=/workspace", "/workspace"), "/workspace");
    assert.equal(
      resolveSafeReturnTo("/workspace?rrp=apply", "/workspace"),
      "/workspace?rrp=apply",
    );
  });

  it("keeps mailto Join CTA when the flag is OFF", () => {
    const content = read("features/regional-program/components/RegionalProgramPageContent.tsx");
    assert.equal(REGIONAL_PROGRAM_JOIN_MAILTO, "mailto:info@huws.org");
    assert.match(content, /isRrpApplicationEntryEnabled\(\)/);
    assert.match(content, /REGIONAL_PROGRAM_JOIN_MAILTO/);
    assert.match(content, /JoinProgramApplicationEntryLink/);
    assert.match(content, /RRP_APPLICATION_ENTRY_HREF/);
  });

  it("wires returnTo through login, register, and confirm-email", () => {
    const login = read("features/auth/components/LoginForm.tsx");
    const register = read("features/auth/components/RegisterForm.tsx");
    const confirm = read("features/auth/components/ConfirmEmailForm.tsx");
    const gate = read("features/auth/components/WorkspaceAuthGate.tsx");
    const home = read("app/workspace/WorkspaceHomePage.tsx");

    assert.match(login, /buildAuthPathWithReturnTo\("\/confirm-email"/);
    assert.match(login, /buildAuthPathWithReturnTo\("\/register"/);
    assert.match(register, /buildAuthPathWithReturnTo\("\/confirm-email"/);
    assert.match(register, /hasReturnTo \? returnTo : "\/profile"/);
    assert.match(confirm, /completedDestination/);
    assert.match(confirm, /buildAuthPathWithReturnTo\("\/register"/);
    assert.match(gate, /searchParams\.toString\(\)/);
    assert.match(gate, /resolveSafeReturnTo\(destination/);
    assert.match(home, /hasRrpApplicationEntryIntent/);
    assert.match(home, /buildAuthPathWithReturnTo\("\/confirm-email"/);
    assert.match(home, /emailVerificationStatus !== "verified"/);
    assert.match(home, /RrpApplicationModal/);
    assert.match(home, /isRrpApplicationEntryEnabled\(\)/);
  });

  it("enables only when the env value is exactly true", () => {
    const entry = read("features/regional-program/rrp-application-entry.ts");
    assert.match(entry, /NEXT_PUBLIC_RRP_APPLICATION_ENTRY_ENABLED/);
    assert.match(entry, /env\[RRP_APPLICATION_ENTRY_FLAG_ENV\] === "true"/);
  });
});
