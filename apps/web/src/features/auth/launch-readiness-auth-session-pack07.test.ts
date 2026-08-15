import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  clearLegacyAuthTokenStorage,
  getStoredAccessToken,
  getStoredRefreshToken,
  hasLegacyAuthTokenStorage,
  storeAuthTokens,
} from "./auth-token-store.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function read(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

describe("Launch Readiness Pack 07 — Web auth session (browser storage)", () => {
  it("never returns or stores access/refresh tokens in localStorage helpers", () => {
    // jsdom/window may be absent under node:test — helpers no-op safely.
    storeAuthTokens("should-not-persist", "should-not-persist");
    assert.equal(getStoredAccessToken(), null);
    assert.equal(getStoredRefreshToken(), null);
    assert.equal(hasLegacyAuthTokenStorage(), false);
    clearLegacyAuthTokenStorage();
  });

  it("api client never builds Authorization from storage", () => {
    const client = read("lib/api-client.ts");
    assert.match(client, /credentials:\s*"include"/);
    assert.doesNotMatch(client, /getStoredAccessToken/);
    assert.doesNotMatch(client, /Authorization:\s*`Bearer/);
  });

  it("auth-api accepts browser session without persisting tokens", () => {
    const api = read("features/auth/auth-api.ts");
    assert.match(api, /acceptBrowserSession/);
    assert.match(api, /fetchAuthSession/);
    assert.doesNotMatch(api, /storeAuthTokens\(result\.tokens/);
  });

  it("Assistant session memory remains non-credential sessionStorage", () => {
    const memory = read("features/humanity-union-assistant/assistant-session-memory.ts");
    assert.match(memory, /sessionStorage/);
    assert.doesNotMatch(memory, /hu_access_token|hu_refresh_token/);
  });

  it("no active production path sets localStorage auth credentials", () => {
    const store = read("features/auth/auth-token-store.ts");
    assert.doesNotMatch(store, /localStorage\.setItem/);
    assert.match(store, /removeItem/);
  });
});
