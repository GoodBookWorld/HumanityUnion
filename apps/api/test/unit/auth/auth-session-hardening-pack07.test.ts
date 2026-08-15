import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  getAuthCookieSecuritySnapshot,
  parseDurationToMs,
  AUTH_COOKIE_PATH,
} from "../../../src/modules/auth/auth-session.cookies.js";
import { resolveAuthConfig } from "../../../src/config/auth.config.js";
import { buildAuthCookieHeader } from "../../helpers/test-auth-cookies.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiSrc = path.resolve(here, "../../../src");
const webSrc = path.resolve(here, "../../../../web/src");

function readApi(relative: string): string {
  return readFileSync(path.join(apiSrc, relative), "utf8");
}

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

describe("Launch Readiness Pack 07 — Auth & Session Hardening", () => {
  it("1–4 — cookie security snapshot (HttpOnly, SameSite, path, bounded lifetime)", () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      const snapshot = getAuthCookieSecuritySnapshot();
      assert.equal(snapshot.httpOnly, true);
      assert.equal(snapshot.secure, true);
      assert.equal(snapshot.sameSite, "lax");
      assert.equal(snapshot.path, AUTH_COOKIE_PATH);
      assert.equal(snapshot.path, "/");
      assert.ok(snapshot.accessMaxAgeMs > 0);
      assert.ok(snapshot.accessMaxAgeMs <= 24 * 60 * 60 * 1000);
      assert.ok(snapshot.refreshMaxAgeMs > 0);
      assert.ok(snapshot.refreshMaxAgeMs <= 90 * 24 * 60 * 60 * 1000);
      assert.equal(snapshot.accessCookieName, resolveAuthConfig().accessCookieName);
      assert.equal(snapshot.refreshCookieName, resolveAuthConfig().refreshCookieName);
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  it("5 — duration parser bounds access/refresh lifetimes", () => {
    assert.equal(parseDurationToMs("15m", 0), 15 * 60_000);
    assert.equal(parseDurationToMs("7d", 0), 7 * 86_400_000);
  });

  it("6 — login/refresh/confirm set access+refresh cookies", () => {
    const routes = readApi("modules/auth/auth.routes.ts");
    assert.match(routes, /setAuthSessionCookies/);
    assert.match(routes, /clearAuthSessionCookies/);
    assert.match(routes, /\/session/);
  });

  it("7 — middleware accepts Bearer or access cookie", () => {
    const middleware = readApi("modules/auth/auth.middleware.ts");
    assert.match(middleware, /extractAccessToken/);
    assert.match(middleware, /accessCookieName/);
    assert.match(middleware, /Bearer/);
  });

  it("8 — browser origin guard rejects foreign Origin", () => {
    const guard = readApi("modules/auth/auth-browser-origin.middleware.ts");
    assert.match(guard, /AUTH_ORIGIN_FORBIDDEN/);
    assert.match(guard, /isAllowedWebOrigin/);
    const app = readApi("app.ts");
    assert.match(app, /browserOriginGuardMiddleware/);
    assert.match(app, /cookieParser/);
  });

  it("9 — CORS credentials use configured origin (not *)", () => {
    const app = readApi("app.ts");
    assert.match(app, /credentials:\s*true/);
    assert.match(app, /resolveCorsOriginOption/);
    assert.doesNotMatch(app, /origin:\s*["']\*["']/);
  });

  it("10 — Web API client uses credentials include without Bearer from storage", () => {
    const client = readWeb("lib/api-client.ts");
    assert.match(client, /credentials:\s*"include"/);
    assert.doesNotMatch(client, /Authorization:\s*`Bearer \$\{/);
    assert.doesNotMatch(client, /getStoredAccessToken/);
  });

  it("11 — Web token store no longer persists credentials", () => {
    const store = readWeb("features/auth/auth-token-store.ts");
    assert.match(store, /clearLegacyAuthTokenStorage/);
    assert.match(store, /return null/);
    assert.doesNotMatch(store, /localStorage\.setItem\(LEGACY_ACCESS/);
    assert.doesNotMatch(store, /localStorage\.setItem\(ACCESS/);
  });

  it("12 — refresh is cookie-only", () => {
    const refresh = readWeb("features/auth/auth-token-refresh.ts");
    assert.match(refresh, /credentials:\s*"include"/);
    assert.doesNotMatch(refresh, /getStoredRefreshToken/);
    assert.doesNotMatch(refresh, /storeAuthTokens\(/);
  });

  it("13 — client auth status uses session endpoint", () => {
    // Auth Recovery Hotfix routes session probing through the shared resolver.
    const status = readWeb("features/auth/use-client-auth-status.ts");
    const resolver = readWeb("features/auth/client-auth-status-resolver.ts");
    assert.match(status, /resolveClientAuthStatus/);
    assert.match(resolver, /fetchAuthSession/);
    assert.doesNotMatch(status, /getStoredAccessToken\(\)/);
    assert.doesNotMatch(resolver, /getStoredAccessToken\(\)/);
  });

  it("14 — pending challenge tokens not stored in sessionStorage", () => {
    const pending = readWeb("features/auth/auth-pending-confirmation-store.ts");
    const twoStep = readWeb("features/auth/auth-pending-login-two-step-store.ts");
    assert.doesNotMatch(pending, /sessionStorage\.setItem\([^,]+TOKEN/);
    assert.doesNotMatch(twoStep, /sessionStorage\.setItem\(/);
  });

  it("15 — media upload uses cookie credentials", () => {
    const media = readWeb("features/media-upload/media-upload-api.ts");
    assert.match(media, /credentials:\s*"include"/);
    assert.doesNotMatch(media, /Authorization/);
    assert.doesNotMatch(media, /getStoredAccessToken/);
  });

  it("16 — shared documents download uses cookie credentials", () => {
    const docs = readWeb("features/shared-documents/api.ts");
    assert.match(docs, /credentials:\s*"include"/);
    assert.doesNotMatch(docs, /getStoredAccessToken/);
    assert.doesNotMatch(docs, /Authorization/);
  });

  it("17 — test cookie helper builds Cookie header", () => {
    const header = buildAuthCookieHeader({
      accessToken: "access.jwt",
      refreshToken: "refresh.jwt",
      expiresIn: "15m",
    });
    assert.match(header, /hu_access_token=access\.jwt/);
    assert.match(header, /hu_refresh_token=refresh\.jwt/);
  });

  it("18 — capability resolver not redesigned by Pack 07", () => {
    // Presence check: Admin foundation capability resolver remains separate.
    const resolver = readApi("modules/administration/capability-resolver.ts");
    assert.match(resolver, /resolve/);
  });
});
