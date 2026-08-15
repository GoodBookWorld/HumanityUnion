import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  isAllowedWebOrigin,
  resolveConfiguredWebOrigins,
  resolveCorsOriginOption,
} from "../../../src/config/web-origins.js";
import { getAuthCookieSecuritySnapshot } from "../../../src/modules/auth/auth-session.cookies.js";
import { resolveAuthConfig } from "../../../src/config/auth.config.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../..");

function readRepo(relative: string): string {
  return readFileSync(path.join(repoRoot, relative), "utf8");
}

describe("Launch Blocker Recovery Pack 01 — origin/CORS + session", () => {
  it("1–4 — allowlisted origins pass; foreign origin blocked; CORS never *", () => {
    const previousCors = process.env.CORS_ORIGIN;
    const previousWeb = process.env.WEB_ORIGIN;
    const previousNode = process.env.NODE_ENV;

    try {
      process.env.NODE_ENV = "development";
      process.env.CORS_ORIGIN = "http://localhost:3000,http://localhost:3010";
      delete process.env.WEB_ORIGIN;

      const configured = resolveConfiguredWebOrigins();
      assert.deepEqual(configured, ["http://localhost:3000", "http://localhost:3010"]);
      assert.equal(isAllowedWebOrigin("http://localhost:3000"), true);
      assert.equal(isAllowedWebOrigin("http://localhost:3010"), true);
      assert.equal(isAllowedWebOrigin("http://localhost:3011"), true); // loopback in development
      assert.equal(isAllowedWebOrigin("https://evil.example"), false);

      process.env.NODE_ENV = "production";
      assert.equal(isAllowedWebOrigin("http://localhost:3011"), false);
      assert.equal(isAllowedWebOrigin("http://localhost:3000"), true);

      let reflected: boolean | string | undefined;
      resolveCorsOriginOption("http://localhost:3010", (_err, origin) => {
        reflected = origin;
      });
      assert.equal(reflected, "http://localhost:3010");

      let denied: boolean | string | undefined;
      resolveCorsOriginOption("https://evil.example", (_err, origin) => {
        denied = origin;
      });
      assert.equal(denied, false);
    } finally {
      if (previousCors === undefined) {
        delete process.env.CORS_ORIGIN;
      } else {
        process.env.CORS_ORIGIN = previousCors;
      }
      if (previousWeb === undefined) {
        delete process.env.WEB_ORIGIN;
      } else {
        process.env.WEB_ORIGIN = previousWeb;
      }
      process.env.NODE_ENV = previousNode;
    }

    const app = readRepo("apps/api/src/app.ts");
    assert.doesNotMatch(app, /origin:\s*["']\*["']/);
  });

  it("12 — 30-day refresh policy remains the default", () => {
    const previous = process.env.JWT_REFRESH_EXPIRES_IN;
    delete process.env.JWT_REFRESH_EXPIRES_IN;

    try {
      assert.equal(resolveAuthConfig().jwtRefreshExpiresIn, "30d");
      const snapshot = getAuthCookieSecuritySnapshot();
      assert.equal(snapshot.httpOnly, true);
      assert.equal(snapshot.sameSite, "lax");
      assert.equal(snapshot.path, "/");
    } finally {
      if (previous === undefined) {
        delete process.env.JWT_REFRESH_EXPIRES_IN;
      } else {
        process.env.JWT_REFRESH_EXPIRES_IN = previous;
      }
    }
  });

  it("10 — SW excludes auth routes from persistent cache", () => {
    const sw = readRepo("apps/web/public/sw.js");
    assert.match(sw, /\/api\/v1\/auth/);
    assert.match(sw, /isPrivateApiRequest/);
    assert.match(sw, /hu_access_token/);
  });
});
