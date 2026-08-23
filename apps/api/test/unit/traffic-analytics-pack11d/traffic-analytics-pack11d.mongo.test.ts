/**
 * Pack 11D — Mongo aggregate + insights report (isolated hu_test_* DB).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { Request, Response } from "express";

import { isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import {
  dropIsolatedTestDatabase,
  TEST_DATABASE_ENV_VAR,
} from "../../../scripts/test-mongo-isolation.js";
import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import {
  deleteAuthUsersByEmailPrefix,
  insertAuthUser,
} from "../../../src/modules/auth/auth-user.repository.js";
import { AdministrationForbiddenError } from "../../../src/modules/administration/administration.errors.js";
import { TRAFFIC_SESSION_INACTIVITY_MS } from "../../../src/modules/traffic-analytics/traffic-analytics.constants.js";
import { ingestTrafficPageview } from "../../../src/modules/traffic-analytics/traffic-analytics.ingest.js";
import { getTrafficInsightsReport } from "../../../src/modules/traffic-analytics/traffic-insights.admin.service.js";
import {
  countAllTimeTrafficVisitors,
  getTrafficAnalyticsMeta,
} from "../../../src/modules/traffic-analytics/traffic-aggregate.repository.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../../");
const testRunId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const emailPrefix = `pack11d-${testRunId}`;

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function mockReqRes(input: {
  cookies?: Record<string, string>;
  body: unknown;
  headers?: Record<string, string>;
}): { req: Request; res: Response; cookies: Record<string, string> } {
  const cookies = { ...(input.cookies ?? {}) };
  const req = {
    cookies,
    headers: {
      "user-agent": "Mozilla/5.0 (Macintosh) Chrome/120.0",
      ...(input.headers ?? {}),
    },
    body: input.body,
    secure: false,
    socket: { remoteAddress: "127.0.0.1" },
  } as unknown as Request;

  const res = {
    cookie(name: string, value: string) {
      cookies[name] = value;
    },
  } as unknown as Response;

  return { req, res, cookies };
}

describe("Pack 11D — traffic aggregates & insights", () => {
  let adminUserId = "";
  let memberUserId = "";

  before(async () => {
    assert.match(process.env[TEST_DATABASE_ENV_VAR] ?? "", /^hu_test_/);
    await connectMongoClient();
    await ensureMongoIndexes();

    const admin = await insertAuthUser(
      {
        email: `${emailPrefix}-admin@example.com`,
        password: "Password123!",
        displayName: "Insights Admin",
        role: "admin",
      },
      `member-admin-${testRunId}`,
    );
    adminUserId = admin.userId;

    const member = await insertAuthUser(
      {
        email: `${emailPrefix}-member@example.com`,
        password: "Password123!",
        displayName: "Insights Member",
        role: "member",
      },
      `member-user-${testRunId}`,
    );
    memberUserId = member.userId;
  });

  after(async () => {
    try {
      await deleteAuthUsersByEmailPrefix(emailPrefix);
    } catch {
      // best effort
    }
    const isolatedName = process.env[TEST_DATABASE_ENV_VAR]?.trim();
    const uri = process.env.MONGODB_URI?.trim();
    if (isolatedName?.startsWith("hu_test_") && uri) {
      try {
        await dropIsolatedTestDatabase({ databaseName: isolatedName, uri });
      } catch {
        // best-effort
      }
    }
    await disconnectMongoClient();
  });

  it("adds only stable aggregate collections (no dynamic names)", () => {
    const collections = readRepo("apps/api/src/infrastructure/mongodb/mongo-collections.ts");
    assert.match(collections, /trafficDailyAggregates:\s*"traffic_daily_aggregates"/);
    assert.match(collections, /trafficVisitorRegistry:\s*"traffic_visitor_registry"/);
    assert.doesNotMatch(collections, /traffic_daily_\d{4}/);
    assert.equal(MONGO_COLLECTIONS.trafficDailyAggregates, "traffic_daily_aggregates");
    assert.equal(MONGO_COLLECTIONS.trafficVisitorRegistry, "traffic_visitor_registry");
  });

  it("updates aggregates idempotently and reports exact all-time visitors", async () => {
    const t0 = new Date("2026-08-20T12:00:00.000Z");
    const pathA = `/pack11d/${testRunId}/a`;
    const pathB = `/pack11d/${testRunId}/b`;

    const first = mockReqRes({
      body: { pathname: pathA, navigationId: `11d-a-${testRunId}`, referrer: "" },
      headers: { "cf-ipcountry": "CA" },
    });
    assert.equal(
      (
        await ingestTrafficPageview({
          req: first.req,
          res: first.res,
          body: first.req.body,
          now: t0,
        })
      ).accepted,
      true,
    );

    const dup = mockReqRes({
      cookies: { ...first.cookies },
      body: { pathname: pathA, navigationId: `11d-a-${testRunId}` },
      headers: { "cf-ipcountry": "CA" },
    });
    assert.equal(
      (
        await ingestTrafficPageview({
          req: dup.req,
          res: dup.res,
          body: dup.req.body,
          now: new Date(t0.getTime() + 50),
        })
      ).duplicate,
      true,
    );

    const sameDay = mockReqRes({
      cookies: { ...first.cookies },
      body: {
        pathname: pathB,
        navigationId: `11d-b-${testRunId}`,
        referrer: "https://google.com/",
      },
      headers: { "cf-ipcountry": "CA" },
    });
    assert.equal(
      (
        await ingestTrafficPageview({
          req: sameDay.req,
          res: sameDay.res,
          body: sameDay.req.body,
          now: new Date(t0.getTime() + 60_000),
        })
      ).accepted,
      true,
    );

    const newSession = mockReqRes({
      cookies: { ...first.cookies },
      body: { pathname: pathA, navigationId: `11d-c-${testRunId}` },
      headers: { "cf-ipcountry": "US" },
    });
    assert.equal(
      (
        await ingestTrafficPageview({
          req: newSession.req,
          res: newSession.res,
          body: newSession.req.body,
          now: new Date(t0.getTime() + 60_000 + TRAFFIC_SESSION_INACTIVITY_MS + 1_000),
        })
      ).accepted,
      true,
    );

    const other = mockReqRes({
      body: {
        pathname: pathA,
        navigationId: `11d-d-${testRunId}`,
        referrer: "https://facebook.com/x",
      },
      headers: { "cf-ipcountry": "US" },
    });
    await ingestTrafficPageview({
      req: other.req,
      res: other.res,
      body: other.req.body,
      now: new Date(t0.getTime() + 5_000),
    });

    const meta = await getTrafficAnalyticsMeta();
    assert.ok(meta);
    assert.equal(meta.allTimeViews, 4);
    assert.equal(meta.allTimeSessions, 3);
    assert.equal(await countAllTimeTrafficVisitors(), 2);

    const report = await getTrafficInsightsReport({
      actorUserId: adminUserId,
      period: "30d",
      now: new Date(t0.getTime() + TRAFFIC_SESSION_INACTIVITY_MS + 120_000),
    });

    assert.equal(report.allTime.views, 4);
    assert.equal(report.allTime.visitors, 2);
    assert.equal(report.allTime.sessions, 3);
    assert.ok(report.allTime.collectionStartedAt);
    assert.ok(report.trend.length >= 1);
    assert.ok(report.geography.some((row) => row.countryCode === "CA"));
    assert.ok(report.referrers.some((row) => row.host === "facebook.com" || row.host === "google.com"));
    assert.equal(report.sessions.averageDurationSeconds, null);
    assert.doesNotMatch(JSON.stringify(report), /tv_[a-f0-9]{32}|ts_[a-f0-9]{32}|\b\d+\.\d+\.\d+\.\d+\b/);

    await assert.rejects(
      () => getTrafficInsightsReport({ actorUserId: memberUserId, period: "all" }),
      AdministrationForbiddenError,
    );
  });
});
