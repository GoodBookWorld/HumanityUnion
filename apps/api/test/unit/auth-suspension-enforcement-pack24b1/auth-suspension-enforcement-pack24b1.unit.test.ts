/**
 * Pack 24B.1 — Auth suspension enforcement on residual JWT (mutation gate).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { Request, Response } from "express";

import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.types.js";
import {
  ACCOUNT_ACCESS_SUSPENDED_MESSAGE,
  requireActiveAccountForMutationsMiddleware,
  requireVerifiedEmailForMutationsMiddleware,
  setAuthUserLookupOverrideForTests,
} from "../../../src/modules/auth/auth-workspace-gate.js";
import { resolveAuthConfig } from "../../../src/config/auth.config.js";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const apiSrc = path.join(apiRoot, "src");

function read(relativePath: string): string {
  return readFileSync(path.resolve(apiSrc, relativePath), "utf8");
}

function makeUser(overrides: Partial<AuthUserRecord> & Pick<AuthUserRecord, "userId" | "status">): AuthUserRecord {
  return {
    email: `${overrides.userId}@example.com`,
    passwordHash: "hash",
    displayName: overrides.displayName ?? overrides.userId,
    role: overrides.role ?? "member",
    emailVerificationStatus: overrides.emailVerificationStatus ?? "verified",
    memberId: overrides.memberId ?? `member-${overrides.userId}`,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function createMockResponse(): Response & {
  statusCode: number;
  body: unknown;
} {
  const state: { statusCode: number; body: unknown } = { statusCode: 200, body: null };
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      state.statusCode = code;
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      state.body = payload;
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

afterEach(() => {
  setAuthUserLookupOverrideForTests(null);
});

describe("Pack 24B.1 — residual JWT mutation enforcement (behavior)", () => {
  it("1 — active user + valid identity can mutate", async () => {
    setAuthUserLookupOverrideForTests(async () =>
      makeUser({ userId: "user-active", status: "active", emailVerificationStatus: "verified" }),
    );

    const req = {
      method: "POST",
      path: "/draft",
      auth: { id: "user-active", memberId: "member-active" },
    } as unknown as Request;
    const res = createMockResponse();
    let nextCalled = false;

    await requireActiveAccountForMutationsMiddleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, 200);
  });

  it("2–3 — disabled user + residual JWT cannot mutate; effect is immediate", async () => {
    setAuthUserLookupOverrideForTests(async () =>
      makeUser({ userId: "user-disabled", status: "disabled", emailVerificationStatus: "verified" }),
    );

    const req = {
      method: "POST",
      path: "/draft",
      auth: { id: "user-disabled", memberId: "member-disabled" },
    } as unknown as Request;
    const res = createMockResponse();
    let nextCalled = false;

    await requireActiveAccountForMutationsMiddleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(
      (res.body as { message?: string }).message,
      ACCOUNT_ACCESS_SUSPENDED_MESSAGE,
    );
  });

  it("4–8 — workspace email gate blocks disabled writes (initiative/prefs/media class)", async () => {
    setAuthUserLookupOverrideForTests(async () =>
      makeUser({ userId: "user-disabled", status: "disabled", emailVerificationStatus: "verified" }),
    );

    const req = {
      method: "PATCH",
      path: "/me",
      auth: { id: "user-disabled", memberId: "member-disabled" },
    } as unknown as Request;
    const res = createMockResponse();
    let nextCalled = false;

    await requireVerifiedEmailForMutationsMiddleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(
      (res.body as { message?: string }).message,
      ACCOUNT_ACCESS_SUSPENDED_MESSAGE,
    );
    assert.doesNotMatch(JSON.stringify(res.body), /community_standards|reviewToken|adminNote/i);
  });

  it("9 — safe reads are not blocked by the active-account mutation gate", async () => {
    setAuthUserLookupOverrideForTests(async () => {
      throw new Error("lookup must not run for GET");
    });

    const req = {
      method: "GET",
      path: "/mine",
      auth: { id: "user-disabled", memberId: "member-disabled" },
    } as unknown as Request;
    const res = createMockResponse();
    let nextCalled = false;

    await requireActiveAccountForMutationsMiddleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
  });

  it("14 — restore to active allows mutations again", async () => {
    let status: "active" | "disabled" = "disabled";
    setAuthUserLookupOverrideForTests(async () =>
      makeUser({ userId: "user-1", status, emailVerificationStatus: "verified" }),
    );

    const req = {
      method: "POST",
      path: "/",
      auth: { id: "user-1", memberId: "member-1" },
    } as unknown as Request;

    const blocked = createMockResponse();
    let nextBlocked = false;
    await requireActiveAccountForMutationsMiddleware(req, blocked, () => {
      nextBlocked = true;
    });
    assert.equal(nextBlocked, false);
    assert.equal(blocked.statusCode, 403);

    status = "active";
    const allowed = createMockResponse();
    let nextAllowed = false;
    await requireActiveAccountForMutationsMiddleware(req, allowed, () => {
      nextAllowed = true;
    });
    assert.equal(nextAllowed, true);
  });

  it("15 — Admin acting account that is active passes the gate (target may be suspended)", async () => {
    setAuthUserLookupOverrideForTests(async (userId) => {
      assert.equal(userId, "admin-1");
      return makeUser({
        userId: "admin-1",
        status: "active",
        role: "admin",
        emailVerificationStatus: "verified",
      });
    });

    const req = {
      method: "POST",
      path: "/participant-1/suspend",
      auth: { id: "admin-1", memberId: "participant-admin-1" },
    } as unknown as Request;
    const res = createMockResponse();
    let nextCalled = false;

    await requireActiveAccountForMutationsMiddleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
  });

  it("logout / revoke-all remain allowed for disabled residual JWT", async () => {
    setAuthUserLookupOverrideForTests(async () => {
      throw new Error("lookup must not run for session teardown");
    });

    for (const pathName of ["/logout", "/sessions/revoke-all"]) {
      const req = {
        method: "POST",
        path: pathName,
        auth: { id: "user-disabled", memberId: "member-disabled" },
      } as unknown as Request;
      const res = createMockResponse();
      let nextCalled = false;
      await requireActiveAccountForMutationsMiddleware(req, res, () => {
        nextCalled = true;
      });
      assert.equal(nextCalled, true, pathName);
    }
  });
});

describe("Pack 24B.1 — residual JWT mutation enforcement (contracts)", () => {
  it("10 — review-token endpoint stays token-only (no shared mutation gate)", () => {
    const review = read("modules/participant-suspension/participant-suspension-review.routes.ts");
    assert.doesNotMatch(review, /requireJwtAuthenticationMiddleware|authenticatedWorkspaceWriteMiddleware/);
    assert.doesNotMatch(review, /requireActiveAccountForMutationsMiddleware/);
    assert.match(review, /token/);
  });

  it("11–13 — login / 2FA / refresh still reject disabled", () => {
    const authService = read("modules/auth/auth.service.ts");
    const twoStep = read("modules/auth/auth-login-two-step.service.ts");
    assert.match(authService, /loginAuthUser[\s\S]*status === "disabled"/);
    assert.match(authService, /refreshAuthSession[\s\S]*status === "disabled"/);
    assert.match(twoStep, /status === "disabled"/);
  });

  it("16 — no second suspension / blocked flag introduced", () => {
    const gate = read("modules/auth/auth-active-account-gate.ts");
    assert.doesNotMatch(gate, /blocked\s*[:=]|isBlocked|suspensionStore/);
    assert.match(gate, /status !== "active"/);
    assert.match(gate, /auth_users\.status|status === "active"/);
  });

  it("17 — access token lifetime unchanged (still ~15m default)", () => {
    const config = read("config/auth.config.ts");
    assert.match(config, /JWT_ACCESS_EXPIRES_IN \?\? "15m"/);
    assert.match(config, /Short-lived access JWT \(~15m\)/);
    const expiresIn = resolveAuthConfig().jwtAccessExpiresIn;
    assert.match(expiresIn, /^\d+m$/);
  });

  it("wires active-account recheck into JWT + workspace mutation gates", () => {
    const middleware = read("modules/auth/auth.middleware.ts");
    const workspace = read("modules/auth/auth-workspace-gate.ts");
    assert.match(middleware, /requireActiveAccountForMutationsMiddleware/);
    assert.match(middleware, /requireJwtAuthenticationMiddleware/);
    assert.match(workspace, /status !== "active"/);
    assert.match(workspace, /ACCOUNT_ACCESS_SUSPENDED_MESSAGE/);
  });

  it("4–8 — representative mutation surfaces use protected gates", () => {
    const initiatives = read("modules/initiatives/initiative.routes.ts");
    const decisions = read("modules/decision-session/decision-session.routes.ts");
    const votes = read("modules/civic-nomination-vote/civic-nomination-vote.routes.ts");
    const prefs = read("modules/preferences/preferences.routes.ts");
    const media = read("modules/media-upload/media-upload.routes.ts");
    const membership = read("modules/membership/membership.routes.ts");
    const notifications = read("modules/notifications/notification.routes.ts");
    const collectiveVotes = read(
      "modules/initiative-collective-decision/initiative-collective-decision-vote.routes.ts",
    );

    assert.match(initiatives, /authenticatedWorkspaceWriteMiddleware/);
    assert.match(decisions, /authenticatedWorkspaceWriteMiddleware/);
    assert.match(votes, /authenticatedWorkspaceWriteMiddleware/);
    assert.match(prefs, /authenticatedWorkspaceWriteMiddleware/);
    assert.match(collectiveVotes, /authenticatedWorkspaceWriteMiddleware/);
    assert.match(media, /requireJwtAuthenticationMiddleware/);
    assert.match(membership, /requireJwtAuthenticationMiddleware/);
    assert.match(notifications, /requireJwtAuthenticationMiddleware/);
  });

  it("claims helper documents non-authoritative status for mutations", () => {
    const service = read("modules/auth/auth.service.ts");
    assert.match(service, /authIdentityFromAccessTokenClaims/);
    assert.match(service, /NOT authoritative for mutations|not authoritative for mutations/i);
  });
});
