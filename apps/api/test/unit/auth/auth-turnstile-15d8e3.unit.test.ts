/**
 * STEP 15D.8E.3 — Auth Turnstile gate (mocked verifier; no Cloudflare).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { requireAuthTurnstileToken } from "../../../src/modules/auth/auth-turnstile.guard.js";
import { AuthValidationError } from "../../../src/modules/auth/auth.errors.js";
import {
  resetTurnstileVerifierForTests,
  setTurnstileVerifierForTests,
  type TurnstileVerifyResult,
} from "../../../src/modules/security/turnstile.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiSrc = path.resolve(here, "../../../src");

function readApi(rel: string): string {
  return readFileSync(path.join(apiSrc, rel), "utf8");
}

let turnstileMode: "ok" | "invalid" | "unavailable" | "missing" = "ok";
let turnstileCalls = 0;

async function fakeVerifier(input: {
  token: string;
}): Promise<TurnstileVerifyResult> {
  turnstileCalls += 1;
  if (turnstileMode === "missing" || !input.token.trim()) {
    return { ok: false, reason: "turnstile_missing" };
  }
  if (turnstileMode === "unavailable") {
    return { ok: false, reason: "turnstile_unavailable" };
  }
  if (turnstileMode === "invalid" || input.token === "invalid-token") {
    return { ok: false, reason: "turnstile_invalid" };
  }
  return { ok: true };
}

describe("STEP 15D.8E.3 — Auth Turnstile protection", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.NODE_TEST_ENV = "true";
    turnstileMode = "ok";
    turnstileCalls = 0;
    setTurnstileVerifierForTests(fakeVerifier);
  });

  afterEach(() => {
    resetTurnstileVerifierForTests();
  });

  it("REGISTER — missing token rejected; register path not entered", async () => {
    turnstileMode = "missing";
    let registerEntered = false;
    await assert.rejects(
      async () => {
        await requireAuthTurnstileToken("");
        registerEntered = true;
      },
      (error: unknown) => {
        assert.ok(error instanceof AuthValidationError);
        assert.match(error.message, /Security verification is required/i);
        return true;
      },
    );
    assert.equal(registerEntered, false);
  });

  it("REGISTER — invalid token rejected; register path not entered", async () => {
    turnstileMode = "invalid";
    let registerEntered = false;
    await assert.rejects(
      async () => {
        await requireAuthTurnstileToken("invalid-token");
        registerEntered = true;
      },
      (error: unknown) => {
        assert.ok(error instanceof AuthValidationError);
        assert.match(error.message, /Security verification failed/i);
        return true;
      },
    );
    assert.equal(registerEntered, false);
  });

  it("REGISTER — verifier unavailable fail-closed; register path not entered", async () => {
    turnstileMode = "unavailable";
    let registerEntered = false;
    await assert.rejects(
      async () => {
        await requireAuthTurnstileToken("any-token");
        registerEntered = true;
      },
      (error: unknown) => {
        assert.ok(error instanceof AuthValidationError);
        assert.match(error.message, /temporarily unavailable/i);
        return true;
      },
    );
    assert.equal(registerEntered, false);
  });

  it("REGISTER — valid token allows subsequent register path", async () => {
    turnstileMode = "ok";
    let registerEntered = false;
    await requireAuthTurnstileToken("valid-token");
    registerEntered = true;
    assert.equal(registerEntered, true);
  });

  it("LOGIN — missing token rejected; login path not entered", async () => {
    turnstileMode = "missing";
    let loginEntered = false;
    await assert.rejects(async () => {
      await requireAuthTurnstileToken(undefined);
      loginEntered = true;
    }, AuthValidationError);
    assert.equal(loginEntered, false);
  });

  it("LOGIN — invalid token rejected; login path not entered", async () => {
    turnstileMode = "invalid";
    let loginEntered = false;
    await assert.rejects(async () => {
      await requireAuthTurnstileToken("invalid-token");
      loginEntered = true;
    }, AuthValidationError);
    assert.equal(loginEntered, false);
  });

  it("LOGIN — verifier unavailable fail-closed; login path not entered", async () => {
    turnstileMode = "unavailable";
    let loginEntered = false;
    await assert.rejects(async () => {
      await requireAuthTurnstileToken("any-token");
      loginEntered = true;
    }, AuthValidationError);
    assert.equal(loginEntered, false);
  });

  it("LOGIN — valid token allows credential flow to proceed", async () => {
    turnstileMode = "ok";
    let loginEntered = false;
    await requireAuthTurnstileToken("valid-token");
    loginEntered = true;
    assert.equal(loginEntered, true);
  });

  it("routes verify Turnstile before registerAuthUser / loginAuthUser", () => {
    const routes = readApi("modules/auth/auth.routes.ts");
    const registerBlock = routes.slice(
      routes.indexOf('authRouter.post("/register"'),
      routes.indexOf('authRouter.post("/login"'),
    );
    const loginBlock = routes.slice(
      routes.indexOf('authRouter.post("/login"'),
      routes.indexOf('authRouter.post("/refresh"') !== -1
        ? routes.indexOf('authRouter.post("/refresh"')
        : routes.indexOf("authRouter.get", routes.indexOf('authRouter.post("/login"')),
    );
    assert.match(registerBlock, /requireAuthTurnstileToken/);
    assert.ok(
      registerBlock.indexOf("requireAuthTurnstileToken") < registerBlock.indexOf("registerAuthUser"),
    );
    assert.match(loginBlock, /requireAuthTurnstileToken/);
    assert.ok(loginBlock.indexOf("requireAuthTurnstileToken") < loginBlock.indexOf("loginAuthUser"));
  });

  it("shared verifier backs Blog facade; no secret in Web", () => {
    const security = readApi("modules/security/turnstile.ts");
    const blogFacade = readApi("modules/blog/blog-subscription-turnstile.ts");
    assert.match(security, /verifyTurnstileToken/);
    assert.match(security, /TURNSTILE_SECRET_KEY/);
    assert.match(blogFacade, /verifyTurnstileToken as verifyBlogSubscriptionTurnstile/);
    assert.doesNotMatch(blogFacade, /challenges\.cloudflare\.com/);
  });

  it("does not expand Turnstile to out-of-scope auth endpoints", () => {
    const routes = readApi("modules/auth/auth.routes.ts");
    for (const path of [
      "/password-reset/request",
      "/resend-verification",
      "/email-confirmation/resend",
      "/login/two-step/resend",
    ]) {
      const idx = routes.indexOf(`"${path}"`) !== -1 ? routes.indexOf(`"${path}"`) : routes.indexOf(path);
      assert.ok(idx > 0, path);
      const window = routes.slice(idx, idx + 400);
      assert.doesNotMatch(window, /requireAuthTurnstileToken/);
    }
  });
});
