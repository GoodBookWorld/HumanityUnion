import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { Request, Response } from "express";

import {
  clearMediaUploadRateLimitBucketsForTests,
  mediaUploadRateLimiter,
} from "../../../src/modules/media-upload/media-upload-rate-limit.js";

/** UX Evolution Pack 03 Part 8/12 — media upload rate limiting (test #23). */

function buildRequest(userId: string): Request {
  return {
    auth: { id: userId } as Request["auth"],
    headers: {},
    socket: { remoteAddress: "127.0.0.1" },
  } as unknown as Request;
}

function buildResponse(): { res: Response; statusCode: number | null; body: unknown } {
  const state = { res: null as unknown as Response, statusCode: null as number | null, body: undefined as unknown };
  const res = {
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      state.body = payload;
      return res;
    },
  } as unknown as Response;
  state.res = res;
  return state as { res: Response; statusCode: number | null; body: unknown };
}

describe("UX Evolution Pack 03 — mediaUploadRateLimiter", () => {
  beforeEach(() => {
    clearMediaUploadRateLimitBucketsForTests();
  });

  it("allows requests under the per-user limit", () => {
    const req = buildRequest("rate-limit-user-1");
    let nextCalls = 0;

    for (let i = 0; i < 20; i += 1) {
      const { res } = buildResponse();
      mediaUploadRateLimiter(req, res, () => {
        nextCalls += 1;
      });
    }

    assert.equal(nextCalls, 20);
  });

  it("rejects with 429 once the per-user limit is exceeded", () => {
    const req = buildRequest("rate-limit-user-2");

    for (let i = 0; i < 20; i += 1) {
      const { res } = buildResponse();
      mediaUploadRateLimiter(req, res, () => undefined);
    }

    const blocked = buildResponse();
    let nextCalled = false;
    mediaUploadRateLimiter(req, blocked.res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(blocked.statusCode, 429);
  });

  it("tracks separate buckets per user, so one user cannot exhaust another's quota", () => {
    const userA = buildRequest("rate-limit-user-a");
    const userB = buildRequest("rate-limit-user-b");

    for (let i = 0; i < 20; i += 1) {
      const { res } = buildResponse();
      mediaUploadRateLimiter(userA, res, () => undefined);
    }

    const stillBlockedA = buildResponse();
    let nextForA = false;
    mediaUploadRateLimiter(userA, stillBlockedA.res, () => {
      nextForA = true;
    });
    assert.equal(nextForA, false);
    assert.equal(stillBlockedA.statusCode, 429);

    const allowedB = buildResponse();
    let nextForB = false;
    mediaUploadRateLimiter(userB, allowedB.res, () => {
      nextForB = true;
    });
    assert.equal(nextForB, true);
  });
});
