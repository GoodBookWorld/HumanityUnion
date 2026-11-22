/**
 * HU-RRP-FINAL-01B — funding filter allowlist + RRP write rate limits.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { NextFunction, Request, Response } from "express";

import { ADMIN_RRP_DIRECTORY_CLASSIFICATIONS } from "@hu/types";

import {
  clearRrpApplicationRateLimitBucketsForTests,
  rrpAdminWriteRateLimiter,
  rrpParticipantWriteRateLimiter,
  RRP_ADMIN_WRITE_RATE_LIMIT_FOR_TESTS,
  RRP_PARTICIPANT_WRITE_RATE_LIMIT_FOR_TESTS,
  setRrpApplicationRateLimitNowMsForTests,
} from "../../../src/modules/rrp-application/rrp-application-rate-limit.js";
import { isRrpApplicationWritesEnabled } from "../../../src/modules/rrp-application/rrp-application-writes.activation.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");

function readRepo(...parts: string[]): string {
  return readFileSync(path.join(repoRoot, ...parts), "utf8");
}

function mockRes(): Response & {
  statusCode: number;
  body: unknown;
} {
  const state = { statusCode: 200, body: null as unknown };
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

function mockReq(userId: string): Request {
  return {
    auth: { id: userId },
    headers: {},
    socket: { remoteAddress: "127.0.0.1" },
  } as unknown as Request;
}

describe("HU-RRP-FINAL-01B hardening", () => {
  afterEach(() => {
    clearRrpApplicationRateLimitBucketsForTests();
    setRrpApplicationRateLimitNowMsForTests(null);
  });

  it("admin participant directory route allows applicant_funding_unspecified", () => {
    const routes = readRepo(
      "apps/api/src/modules/administration/admin-participant-directory.routes.ts",
    );
    // Route allowlist is the shared type constant (includes unspecified) — not a partial hardcode.
    assert.match(routes, /ADMIN_RRP_DIRECTORY_CLASSIFICATIONS/);
    assert.match(routes, /Invalid rrpClassification filter/);
    assert.deepEqual([...ADMIN_RRP_DIRECTORY_CLASSIFICATIONS], [
      "applicant_self_funded",
      "applicant_partial_funding",
      "applicant_full_funding",
      "applicant_funding_unspecified",
      "representative",
    ]);
    assert.equal(
      (ADMIN_RRP_DIRECTORY_CLASSIFICATIONS as readonly string[]).includes("not_a_classification"),
      false,
    );
  });

  it("service keeps unspecified funding separate from SELF", () => {
    const service = readRepo(
      "apps/api/src/modules/administration/admin-participant-directory.service.ts",
    );
    assert.match(service, /applicant_funding_unspecified/);
    assert.match(service, /findUserIdsForApplicantUnspecifiedFundingClassification/);
    assert.match(service, /fundingModel === "SELF"/);
    assert.match(service, /applicant_self_funded/);
  });

  it("wires participant and admin write rate limiters after authentication", () => {
    const participant = readRepo(
      "apps/api/src/modules/rrp-application/rrp-application.routes.ts",
    );
    const admin = readRepo(
      "apps/api/src/modules/rrp-application/rrp-application-admin.routes.ts",
    );
    assert.match(participant, /rrpParticipantWriteRateLimiter/);
    assert.match(participant, /requireJwtAuthenticationMiddleware,\s*\n\s*rrpParticipantWriteRateLimiter/);
    assert.match(participant, /\/:applicationId\/submit[\s\S]*rrpParticipantWriteRateLimiter/);
    assert.match(participant, /\/:applicationId\/withdraw[\s\S]*rrpParticipantWriteRateLimiter/);
    assert.doesNotMatch(participant, /get\("\/me"[\s\S]{0,120}rrpParticipantWriteRateLimiter/);

    assert.match(admin, /rrpAdminWriteRateLimiter/);
    assert.match(admin, /\/:applicationId\/review[\s\S]*rrpAdminWriteRateLimiter/);
    assert.match(admin, /confirm-appointment[\s\S]*rrpAdminWriteRateLimiter/);
    assert.match(admin, /revoke-appointment[\s\S]*rrpAdminWriteRateLimiter/);
    assert.doesNotMatch(admin, /adminRrpApplicationRouter\.get\("\/"[\s\S]{0,80}rrpAdminWriteRateLimiter/);
  });

  it("enforces participant write ceiling with 429 and allows retries under the limit", () => {
    const max = RRP_PARTICIPANT_WRITE_RATE_LIMIT_FOR_TESTS.maxPerWindow;
    let nextCount = 0;
    const next: NextFunction = () => {
      nextCount += 1;
    };

    for (let i = 0; i < max; i += 1) {
      const res = mockRes();
      rrpParticipantWriteRateLimiter(mockReq("user-a"), res, next);
      assert.equal(res.statusCode, 200);
    }
    assert.equal(nextCount, max);

    const limited = mockRes();
    rrpParticipantWriteRateLimiter(mockReq("user-a"), limited, next);
    assert.equal(limited.statusCode, 429);
    assert.equal(nextCount, max);
    assert.equal(
      (limited.body as { message?: string }).message?.includes("Regional Representative"),
      true,
    );

    // Different user is not blocked by the first user's bucket.
    const other = mockRes();
    rrpParticipantWriteRateLimiter(mockReq("user-b"), other, next);
    assert.equal(other.statusCode, 200);
    assert.equal(nextCount, max + 1);
  });

  it("enforces admin write ceiling separately from participant bucket", () => {
    const max = RRP_ADMIN_WRITE_RATE_LIMIT_FOR_TESTS.maxPerWindow;
    let nextCount = 0;
    const next: NextFunction = () => {
      nextCount += 1;
    };

    for (let i = 0; i < max; i += 1) {
      rrpAdminWriteRateLimiter(mockReq("admin-1"), mockRes(), next);
    }
    assert.equal(nextCount, max);

    const limited = mockRes();
    rrpAdminWriteRateLimiter(mockReq("admin-1"), limited, next);
    assert.equal(limited.statusCode, 429);
    assert.equal(nextCount, max);

    // Participant limiter for same auth id uses a different scope bucket.
    const participantOk = mockRes();
    rrpParticipantWriteRateLimiter(mockReq("admin-1"), participantOk, next);
    assert.equal(participantOk.statusCode, 200);
    assert.equal(nextCount, max + 1);
  });

  it("resets participant window after expiry so legitimate later retries succeed", () => {
    setRrpApplicationRateLimitNowMsForTests(1_000_000);
    let nextCount = 0;
    const next: NextFunction = () => {
      nextCount += 1;
    };
    const max = RRP_PARTICIPANT_WRITE_RATE_LIMIT_FOR_TESTS.maxPerWindow;
    for (let i = 0; i < max; i += 1) {
      rrpParticipantWriteRateLimiter(mockReq("user-retry"), mockRes(), next);
    }
    const blocked = mockRes();
    rrpParticipantWriteRateLimiter(mockReq("user-retry"), blocked, next);
    assert.equal(blocked.statusCode, 429);

    setRrpApplicationRateLimitNowMsForTests(
      1_000_000 + RRP_PARTICIPANT_WRITE_RATE_LIMIT_FOR_TESTS.windowMs + 1,
    );
    const afterWindow = mockRes();
    rrpParticipantWriteRateLimiter(mockReq("user-retry"), afterWindow, next);
    assert.equal(afterWindow.statusCode, 200);
    assert.equal(nextCount, max + 1);
  });

  it("keeps RRP writes flag default OFF (exact true required)", () => {
    assert.equal(isRrpApplicationWritesEnabled({}), false);
    assert.equal(isRrpApplicationWritesEnabled({ RRP_APPLICATIONS_WRITES_ENABLED: "1" }), false);
    assert.equal(
      isRrpApplicationWritesEnabled({ RRP_APPLICATIONS_WRITES_ENABLED: "true" }),
      true,
    );
  });

  it("does not change appointment uniqueness or privacy/consent constants", () => {
    const appointment = readRepo(
      "apps/api/src/modules/rrp-application/rrp-appointment.constants.ts",
    );
    const typesLegal = readRepo("packages/types/src/domain/legal-localization.ts");
    const typesRrp = readRepo("packages/types/src/domain/rrp-application.ts");
    assert.match(appointment, /participantId: 1, representCountryCode: 1/);
    assert.match(appointment, /status: "active"/);
    assert.match(typesLegal, /privacy: "privacy-2026-11-v2"/);
    assert.match(typesLegal, /terms-2026-03-v1/);
    assert.match(typesRrp, /rrp-application-consent-v2/);
  });
});
