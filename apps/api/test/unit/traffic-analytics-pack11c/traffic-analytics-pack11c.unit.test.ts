/**
 * Pack 11C — traffic analytics path/referrer/period unit tests (no Mongo).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  TRAFFIC_EVENT_RETENTION_DAYS,
  TRAFFIC_SESSION_INACTIVITY_MS,
  TRAFFIC_SESSION_COOKIE,
  TRAFFIC_VISITOR_COOKIE,
  classifyTrafficReferrer,
  isExcludedTrafficPath,
  isObviousBotUserAgent,
  normalizeTrafficPathname,
  parseTrafficPeriod,
  resolveTrafficPeriodWindow,
} from "../../../src/modules/traffic-analytics/index.js";

describe("Pack 11C — traffic definitions & normalization", () => {
  it("session inactivity is 30 minutes and raw retention is 90 days", () => {
    assert.equal(TRAFFIC_SESSION_INACTIVITY_MS, 30 * 60 * 1000);
    assert.equal(TRAFFIC_EVENT_RETENTION_DAYS, 90);
    assert.equal(TRAFFIC_VISITOR_COOKIE, "hu_traffic_vid");
    assert.equal(TRAFFIC_SESSION_COOKIE, "hu_traffic_sid");
    assert.notEqual(TRAFFIC_VISITOR_COOKIE, "hu_initiative_visitor");
  });

  it("excludes API, Next, assets, health-like paths", () => {
    assert.equal(isExcludedTrafficPath("/api/v1/health"), true);
    assert.equal(isExcludedTrafficPath("/_next/static/chunk.js"), true);
    assert.equal(isExcludedTrafficPath("/favicon.ico"), true);
    assert.equal(isExcludedTrafficPath("/robots.txt"), true);
    assert.equal(normalizeTrafficPathname("/api/v1/public/analytics/pageview"), null);
    assert.equal(normalizeTrafficPathname("/media"), "/media");
    assert.equal(normalizeTrafficPathname("/search?q=secret"), "/search");
  });

  it("normalizes initiative public ids to route family", () => {
    assert.equal(
      normalizeTrafficPathname("/initiatives/public/abc-123-def"),
      "/initiatives/public/:initiativeId",
    );
    assert.equal(normalizeTrafficPathname("/countries/ca"), "/countries/ca");
    assert.equal(normalizeTrafficPathname("/admin/views/insights"), "/admin/views");
  });

  it("classifies Direct / Internal / External hostname-only", () => {
    assert.deepEqual(classifyTrafficReferrer(""), {
      referrerType: "DIRECT",
      referrerHost: null,
    });
    assert.deepEqual(classifyTrafficReferrer("https://localhost:3000/search"), {
      referrerType: "INTERNAL",
      referrerHost: null,
    });
    assert.deepEqual(classifyTrafficReferrer("https://www.google.com/search?q=hu"), {
      referrerType: "EXTERNAL",
      referrerHost: "google.com",
    });
  });

  it("detects obvious bots without fingerprinting", () => {
    assert.equal(isObviousBotUserAgent("Mozilla/5.0 Compatible Googlebot"), true);
    assert.equal(isObviousBotUserAgent("curl/8.0"), true);
    assert.equal(isObviousBotUserAgent("Mozilla/5.0 (Macintosh) Chrome/120"), false);
  });

  it("Today period uses UTC midnight boundary", () => {
    const now = new Date("2026-08-22T15:30:00.000Z");
    const window = resolveTrafficPeriodWindow("today", now);
    assert.equal(window.periodLabel, "Today");
    assert.equal(window.start.toISOString(), "2026-08-22T00:00:00.000Z");
    assert.equal(window.end.toISOString(), now.toISOString());
    assert.equal(parseTrafficPeriod("7d"), "7d");
    assert.equal(parseTrafficPeriod("nope"), null);
  });
});
