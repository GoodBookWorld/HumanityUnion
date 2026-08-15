import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveAuthConfig } from "../../../src/config/auth.config.js";
import {
  parseDurationToMs,
  resolveRefreshCookieMaxAgeMs,
} from "../../../src/modules/auth/auth-session.cookies.js";

describe("PWA Experience Pack 01 — remembered refresh session", () => {
  it("default refresh lifetime is ~30 days when env unset", () => {
    const previous = process.env.JWT_REFRESH_EXPIRES_IN;
    delete process.env.JWT_REFRESH_EXPIRES_IN;

    try {
      const config = resolveAuthConfig();
      assert.equal(config.jwtRefreshExpiresIn, "30d");
      assert.equal(parseDurationToMs("30d", 0), 30 * 86_400_000);
      assert.equal(resolveRefreshCookieMaxAgeMs(), 30 * 86_400_000);
    } finally {
      if (previous === undefined) {
        delete process.env.JWT_REFRESH_EXPIRES_IN;
      } else {
        process.env.JWT_REFRESH_EXPIRES_IN = previous;
      }
    }
  });

  it("access token remains short-lived by default", () => {
    const previous = process.env.JWT_ACCESS_EXPIRES_IN;
    const previousMinutes = process.env.JWT_ACCESS_TOKEN_TTL_MINUTES;
    delete process.env.JWT_ACCESS_EXPIRES_IN;
    delete process.env.JWT_ACCESS_TOKEN_TTL_MINUTES;

    try {
      const config = resolveAuthConfig();
      assert.equal(config.jwtAccessExpiresIn, "15m");
    } finally {
      if (previous === undefined) {
        delete process.env.JWT_ACCESS_EXPIRES_IN;
      } else {
        process.env.JWT_ACCESS_EXPIRES_IN = previous;
      }
      if (previousMinutes === undefined) {
        delete process.env.JWT_ACCESS_TOKEN_TTL_MINUTES;
      } else {
        process.env.JWT_ACCESS_TOKEN_TTL_MINUTES = previousMinutes;
      }
    }
  });
});
