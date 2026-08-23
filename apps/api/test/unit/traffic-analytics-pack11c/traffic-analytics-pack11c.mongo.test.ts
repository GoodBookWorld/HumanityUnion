/**
 * Pack 11C — Mongo traffic ingest + admin aggregates (isolated hu_test_* DB).
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
import { insertAuthUser, deleteAuthUsersByEmailPrefix } from "../../../src/modules/auth/auth-user.repository.js";
import { getTrafficAdminReport } from "../../../src/modules/traffic-analytics/traffic-analytics.admin.service.js";
import {
  TRAFFIC_SESSION_COOKIE,
  TRAFFIC_SESSION_INACTIVITY_MS,
  TRAFFIC_VISITOR_COOKIE,
} from "../../../src/modules/traffic-analytics/traffic-analytics.constants.js";
import { ingestTrafficPageview } from "../../../src/modules/traffic-analytics/traffic-analytics.ingest.js";
import { AdministrationForbiddenError } from "../../../src/modules/administration/administration.errors.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../../");
const testRunId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const emailPrefix = `pack11c-${testRunId}`;

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

describe("Pack 11C — traffic Mongo ingest & admin report", () => {
  let adminUserId = "";
  let memberUserId = "";
  const pathSearch = `/pack11c/${testRunId}/search`;
  const pathMedia = `/pack11c/${testRunId}/media`;
  const pathCountry = `/pack11c/${testRunId}/countries/ca`;

  before(async () => {
    assert.match(process.env[TEST_DATABASE_ENV_VAR] ?? "", /^hu_test_/);
    await connectMongoClient();
    await ensureMongoIndexes();

    const admin = await insertAuthUser(
      {
        email: `${emailPrefix}-admin@example.com`,
        password: "Password123!",
        displayName: "Traffic Admin",
        role: "admin",
      },
      `member-admin-${testRunId}`,
    );
    adminUserId = admin.userId;

    const member = await insertAuthUser(
      {
        email: `${emailPrefix}-member@example.com`,
        password: "Password123!",
        displayName: "Traffic Member",
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
        // best-effort cleanup
      }
    }
    await disconnectMongoClient();
  });

  it("stable collection names only (no per-day collections)", () => {
    const collections = readRepo("apps/api/src/infrastructure/mongodb/mongo-collections.ts");
    assert.match(collections, /trafficEvents:\s*"traffic_events"/);
    assert.match(collections, /trafficSessions:\s*"traffic_sessions"/);
    assert.doesNotMatch(collections, /traffic_\d{4}/);
    assert.equal(MONGO_COLLECTIONS.trafficEvents, "traffic_events");
    assert.equal(MONGO_COLLECTIONS.trafficSessions, "traffic_sessions");
  });

  it("counts views/visitors/sessions with session timeout and privacy cookies", async () => {
    const t0 = new Date("2026-08-22T12:00:00.000Z");
    const first = mockReqRes({
      body: {
        pathname: pathSearch,
        referrer: "",
        navigationId: `nav-a-${testRunId}`,
      },
      headers: { "cf-ipcountry": "CA" },
    });

    const r1 = await ingestTrafficPageview({
      req: first.req,
      res: first.res,
      body: first.req.body,
      now: t0,
    });
    assert.equal(r1.accepted, true);
    assert.match(first.cookies[TRAFFIC_VISITOR_COOKIE] ?? "", /^tv_/);
    assert.match(first.cookies[TRAFFIC_SESSION_COOKIE] ?? "", /^ts_/);
    assert.doesNotMatch(JSON.stringify(first.cookies), /visitor-/);

    const sameNav = mockReqRes({
      cookies: { ...first.cookies },
      body: {
        pathname: pathSearch,
        referrer: "https://google.com/",
        navigationId: `nav-a-${testRunId}`,
      },
      headers: { "cf-ipcountry": "CA" },
    });
    const dup = await ingestTrafficPageview({
      req: sameNav.req,
      res: sameNav.res,
      body: sameNav.req.body,
      now: new Date(t0.getTime() + 100),
    });
    assert.equal(dup.duplicate, true);

    const secondPath = mockReqRes({
      cookies: { ...first.cookies },
      body: {
        pathname: pathMedia,
        referrer: "https://example.org/x",
        navigationId: `nav-b-${testRunId}`,
      },
      headers: { "cf-ipcountry": "CA" },
    });
    const r2 = await ingestTrafficPageview({
      req: secondPath.req,
      res: secondPath.res,
      body: secondPath.req.body,
      now: new Date(t0.getTime() + 60_000),
    });
    assert.equal(r2.accepted, true);
    assert.equal(secondPath.cookies[TRAFFIC_SESSION_COOKIE], first.cookies[TRAFFIC_SESSION_COOKIE]);

    const afterTimeout = mockReqRes({
      cookies: { ...first.cookies },
      body: {
        pathname: pathCountry,
        navigationId: `nav-c-${testRunId}`,
      },
      headers: { "cf-ipcountry": "CA" },
    });
    const r3 = await ingestTrafficPageview({
      req: afterTimeout.req,
      res: afterTimeout.res,
      body: afterTimeout.req.body,
      now: new Date(t0.getTime() + 60_000 + TRAFFIC_SESSION_INACTIVITY_MS + 1_000),
    });
    assert.equal(r3.accepted, true);
    assert.notEqual(
      afterTimeout.cookies[TRAFFIC_SESSION_COOKIE],
      first.cookies[TRAFFIC_SESSION_COOKIE],
    );

    const otherVisitor = mockReqRes({
      body: {
        pathname: pathSearch,
        referrer: "https://facebook.com/x",
        navigationId: `nav-d-${testRunId}`,
      },
      headers: { "cf-ipcountry": "US" },
    });
    await ingestTrafficPageview({
      req: otherVisitor.req,
      res: otherVisitor.res,
      body: otherVisitor.req.body,
      now: new Date(t0.getTime() + 5_000),
    });

    const excluded = await ingestTrafficPageview({
      req: mockReqRes({
        cookies: { ...first.cookies },
        body: { pathname: "/api/v1/health", navigationId: `nav-api-${testRunId}` },
      }).req,
      res: mockReqRes({ body: {} }).res,
      body: { pathname: "/api/v1/health", navigationId: `nav-api-${testRunId}` },
      now: t0,
    });
    assert.equal(excluded.accepted, false);

    const report = await getTrafficAdminReport({
      actorUserId: adminUserId,
      period: "30d",
      now: new Date(t0.getTime() + 60_000 + TRAFFIC_SESSION_INACTIVITY_MS + 60_000),
    });

    const scopedPages = report.topPages.filter((row) => row.path.includes(testRunId));
    const scopedViews = scopedPages.reduce((sum, row) => sum + row.views, 0);
    assert.equal(scopedViews, 4);
    assert.equal(scopedPages.find((row) => row.path === pathSearch)?.views, 2);
    assert.equal(scopedPages.find((row) => row.path === pathSearch)?.visitors, 2);
    assert.ok(report.referrers.some((row) => row.host === "facebook.com" || row.host === "example.org"));
    assert.ok(report.geography.some((row) => row.countryCode === "CA"));
    assert.doesNotMatch(JSON.stringify(report), /tv_[a-f0-9]{32}|ts_[a-f0-9]{32}/);
    assert.ok(report.summary.sessions >= 3);
    assert.ok(report.summary.visitors >= 2);
    assert.ok(report.summary.views >= 4);

    await assert.rejects(
      () => getTrafficAdminReport({ actorUserId: memberUserId, period: "today" }),
      AdministrationForbiddenError,
    );
  });

  it("does not persist raw IP fields on traffic documents", async () => {
    const repo = readRepo(
      "apps/api/src/modules/traffic-analytics/traffic-analytics.repository.ts",
    );
    const ingest = readRepo(
      "apps/api/src/modules/traffic-analytics/traffic-analytics.ingest.ts",
    );
    assert.doesNotMatch(repo, /\bipAddress\b|\brawIp\b|\bfingerprint\b/);
    assert.doesNotMatch(ingest, /visitorKey|hu_initiative_visitor/);
    assert.match(ingest, /resolveApproximateIpGeography/);
  });
});
