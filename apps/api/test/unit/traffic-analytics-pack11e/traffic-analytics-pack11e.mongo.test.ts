/**
 * Pack 11E — Mongo certification: exact all-time visitors, aggregates, privacy.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
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
import {
  TRAFFIC_SESSION_COOKIE,
  TRAFFIC_VISITOR_COOKIE,
} from "../../../src/modules/traffic-analytics/traffic-analytics.constants.js";
import { ingestTrafficPageview } from "../../../src/modules/traffic-analytics/traffic-analytics.ingest.js";
import { getTrafficAdminReport } from "../../../src/modules/traffic-analytics/traffic-analytics.admin.service.js";
import { getTrafficInsightsReport } from "../../../src/modules/traffic-analytics/traffic-insights.admin.service.js";
import {
  countAllTimeTrafficVisitors,
  getTrafficAnalyticsMeta,
  sumTotalAggregatesBetween,
} from "../../../src/modules/traffic-analytics/traffic-aggregate.repository.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const testRunId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const emailPrefix = `pack11e-${testRunId}`;

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

describe("Pack 11E — Mongo Admin Views certification", () => {
  let adminUserId = "";
  let memberUserId = "";
  let cleanupSucceeded = false;

  before(async () => {
    assert.match(process.env[TEST_DATABASE_ENV_VAR] ?? "", /^hu_test_/);
    await connectMongoClient();
    await ensureMongoIndexes();

    adminUserId = (
      await insertAuthUser(
        {
          email: `${emailPrefix}-admin@example.com`,
          password: "Password123!",
          displayName: "Cert Admin",
          role: "admin",
        },
        `member-admin-${testRunId}`,
      )
    ).userId;

    memberUserId = (
      await insertAuthUser(
        {
          email: `${emailPrefix}-member@example.com`,
          password: "Password123!",
          displayName: "Cert Member",
          role: "member",
        },
        `member-user-${testRunId}`,
      )
    ).userId;
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
        cleanupSucceeded = true;
      } catch {
        cleanupSucceeded = false;
      }
    }
    await disconnectMongoClient();
    assert.equal(cleanupSucceeded, true, "isolated hu_test_* database must be dropped");
  });

  it("canonical collections exist with expected names", () => {
    assert.equal(MONGO_COLLECTIONS.trafficEvents, "traffic_events");
    assert.equal(MONGO_COLLECTIONS.trafficSessions, "traffic_sessions");
    assert.equal(MONGO_COLLECTIONS.trafficDailyAggregates, "traffic_daily_aggregates");
    assert.equal(MONGO_COLLECTIONS.trafficVisitorRegistry, "traffic_visitor_registry");
  });

  it("Visitor A multi-day + Visitor B once => all-time Visitors exactly 2", async () => {
    const day1 = new Date("2026-08-10T12:00:00.000Z");
    const day2 = new Date("2026-08-11T12:00:00.000Z");
    const pathMedia = `/pack11e/${testRunId}/media`;
    const pathSearch = `/pack11e/${testRunId}/search`;
    const pathCountry = `/pack11e/${testRunId}/countries/ca`;
    const pathWorkspace = `/pack11e/${testRunId}/workspace`;

    // Visitor A — day 1: /media, /search (same session)
    const a1 = mockReqRes({
      body: { pathname: pathMedia, navigationId: `e-a1-${testRunId}`, referrer: "" },
      headers: { "cf-ipcountry": "CA" },
    });
    assert.equal(
      (await ingestTrafficPageview({ req: a1.req, res: a1.res, body: a1.req.body, now: day1 }))
        .accepted,
      true,
    );
    assert.match(a1.cookies[TRAFFIC_VISITOR_COOKIE] ?? "", /^tv_/);
    assert.match(a1.cookies[TRAFFIC_SESSION_COOKIE] ?? "", /^ts_/);

    const a2 = mockReqRes({
      cookies: { ...a1.cookies },
      body: {
        pathname: pathSearch,
        navigationId: `e-a2-${testRunId}`,
        referrer: "https://google.com/q",
      },
      headers: { "cf-ipcountry": "CA" },
    });
    assert.equal(
      (
        await ingestTrafficPageview({
          req: a2.req,
          res: a2.res,
          body: a2.req.body,
          now: new Date(day1.getTime() + 60_000),
        })
      ).accepted,
      true,
    );
    assert.equal(a2.cookies[TRAFFIC_SESSION_COOKIE], a1.cookies[TRAFFIC_SESSION_COOKIE]);

    // Duplicate navigationId — must not increment
    const dup = mockReqRes({
      cookies: { ...a1.cookies },
      body: { pathname: pathSearch, navigationId: `e-a2-${testRunId}` },
      headers: { "cf-ipcountry": "CA" },
    });
    assert.equal(
      (
        await ingestTrafficPageview({
          req: dup.req,
          res: dup.res,
          body: dup.req.body,
          now: new Date(day1.getTime() + 90_000),
        })
      ).duplicate,
      true,
    );

    // Visitor A — day 2 after session timeout: /countries/ca (new session, same visitor)
    const a3 = mockReqRes({
      cookies: { ...a1.cookies },
      body: { pathname: pathCountry, navigationId: `e-a3-${testRunId}` },
      headers: { "cf-ipcountry": "CA" },
    });
    assert.equal(
      (
        await ingestTrafficPageview({
          req: a3.req,
          res: a3.res,
          body: a3.req.body,
          now: new Date(day2.getTime()),
        })
      ).accepted,
      true,
    );
    assert.notEqual(a3.cookies[TRAFFIC_SESSION_COOKIE], a1.cookies[TRAFFIC_SESSION_COOKIE]);
    assert.equal(a3.cookies[TRAFFIC_VISITOR_COOKIE], a1.cookies[TRAFFIC_VISITOR_COOKIE]);

    // Visitor B once
    const b1 = mockReqRes({
      body: {
        pathname: pathWorkspace,
        navigationId: `e-b1-${testRunId}`,
        referrer: "https://facebook.com/x",
      },
      headers: { "cf-ipcountry": "US" },
    });
    assert.equal(
      (
        await ingestTrafficPageview({
          req: b1.req,
          res: b1.res,
          body: b1.req.body,
          now: new Date(day1.getTime() + 5_000),
        })
      ).accepted,
      true,
    );

    // Exclusions
    assert.equal(
      (
        await ingestTrafficPageview({
          req: mockReqRes({
            cookies: { ...a1.cookies },
            body: { pathname: "/api/v1/health", navigationId: `e-api-${testRunId}` },
          }).req,
          res: mockReqRes({ body: {} }).res,
          body: { pathname: "/api/v1/health", navigationId: `e-api-${testRunId}` },
          now: day1,
        })
      ).accepted,
      false,
    );
    assert.equal(
      (
        await ingestTrafficPageview({
          req: mockReqRes({
            cookies: { ...a1.cookies },
            body: { pathname: pathMedia, navigationId: `e-bot-${testRunId}` },
            headers: { "user-agent": "curl/8.0" },
          }).req,
          res: mockReqRes({ body: {} }).res,
          body: { pathname: pathMedia, navigationId: `e-bot-${testRunId}` },
          now: day1,
        })
      ).accepted,
      false,
    );

    // Exact all-time visitors = 2 (NOT sum of daily uniques which would be 3: A day1, B day1, A day2)
    assert.equal(await countAllTimeTrafficVisitors(), 2);
    const meta = await getTrafficAnalyticsMeta();
    assert.ok(meta);
    assert.equal(meta.allTimeViews, 4);
    assert.equal(meta.allTimeSessions, 3);
    assert.ok(meta.collectionStartedAt);

    const dailySum = await sumTotalAggregatesBetween("2026-08-10", "2026-08-11");
    assert.equal(dailySum.views, 4);
    assert.equal(dailySum.sessions, 3);
    // Daily unique sum = 3 (A on day1, B on day1, A on day2) — must not equal all-time visitors
    assert.equal(dailySum.visitors, 3);
    assert.notEqual(dailySum.visitors, await countAllTimeTrafficVisitors());

    const now = new Date("2026-08-12T00:00:00.000Z");
    const traffic = await getTrafficAdminReport({
      actorUserId: adminUserId,
      period: "30d",
      now,
    });
    const insights = await getTrafficInsightsReport({
      actorUserId: adminUserId,
      period: "30d",
      now,
    });

    assert.equal(insights.allTime.visitors, 2);
    assert.equal(insights.allTime.views, 4);
    assert.equal(insights.allTime.sessions, 3);
    assert.ok(insights.allTime.collectionStartedAt);
    assert.equal(insights.sessions.averageDurationSeconds, null);

    // Raw Traffic Views/Sessions agree with aggregate totals for overlapping window
    assert.ok(traffic.summary.views >= 4);
    assert.ok(traffic.summary.sessions >= 3);
    assert.ok(traffic.summary.visitors >= 2);

    const serialized = JSON.stringify({ traffic, insights });
    assert.doesNotMatch(serialized, /tv_[a-f0-9]{32}|ts_[a-f0-9]{32}/);
    assert.doesNotMatch(serialized, /hu_initiative_visitor|visitorKey|"ip"|passwordHash/);
    assert.doesNotMatch(serialized, /google\.com\/q|facebook\.com\/x/);

    assert.ok(traffic.referrers.some((row) => row.host === "google.com" || row.label === "Direct"));
    assert.ok(insights.referrers.some((row) => row.host === "facebook.com" || row.host === "google.com"));
    assert.ok(insights.geography.some((row) => row.countryCode === "CA"));

    await assert.rejects(
      () => getTrafficAdminReport({ actorUserId: memberUserId, period: "today" }),
      AdministrationForbiddenError,
    );
    await assert.rejects(
      () => getTrafficInsightsReport({ actorUserId: memberUserId, period: "all" }),
      AdministrationForbiddenError,
    );
  });
});
