/**
 * HU-MEM-04B — system health storage, admin authorization, and public redaction.
 * Uses the in-memory repository. It does not connect to MongoDB.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { describe, it, before, after } from "node:test";
import { fileURLToPath } from "node:url";

import express from "express";

import { AdministrationForbiddenError, AdministrationUnauthorizedError } from "../../../src/modules/administration/administration.errors.js";
import { WEB_SYSTEM_HEALTH_EVENT_INDEXES } from "../../../src/modules/system-health/web-system-health-event.js";
import {
  countStoredWebSystemHealthEventsForTests,
  listWebSystemHealthEvents,
  resetWebSystemHealthEventMemoryForTests,
  setWebSystemHealthEventForceMemoryForTests,
} from "../../../src/modules/system-health/web-system-health-event.repository.js";
import { internalWebSystemHealthRouter } from "../../../src/modules/system-health/web-system-health.routes.js";
import {
  acceptWebSystemHealthEvent,
  readAdminWebMemorySnapshot,
  readAdminWebSystemHealthEvents,
} from "../../../src/modules/system-health/web-system-health.service.js";

process.env.NODE_TEST_ENV = "true";

const TOKEN = "api-system-health-test-token-0123456789";
const SECRET = "https://user:secret@evil.example/private?token=abc";
const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function eventBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    source: "web",
    operation: "sitemap_build",
    eventTypes: ["sitemap_failure"],
    occurredAt: now,
    instanceId: "srv-web-1",
    pid: 42,
    processStartedAt: now,
    uptimeSeconds: 10,
    durationMs: 25,
    memory: {
      rss: 10,
      heapUsed: 4,
      heapTotal: 8,
      external: 1,
      limitBytes: null,
      pressure: "unknown",
    },
    phases: {
      start: {
        rss: 10,
        heapUsed: 4,
        heapTotal: 8,
        external: 1,
        limitBytes: null,
        pressure: "unknown",
      },
      afterInventory: null,
      afterEligibility: null,
    },
    counts: {
      canonicalPathCount: 3,
      seoLocaleCount: 2,
      entityResolveCount: 4,
      failedProviderCount: 1,
      partialProviderCount: 0,
      overlappingSitemapBuilds: 1,
    },
    failedProviderIds: ["blog-posts"],
    partialProviderIds: [],
    message: SECRET,
    url: SECRET,
    cookie: "session=secret",
    userId: "user-123",
    stack: SECRET,
    ...overrides,
  };
}

describe("HU-MEM-04B system health API", () => {
  before(() => {
    process.env.NODE_TEST_ENV = "true";
    setWebSystemHealthEventForceMemoryForTests(true);
  });

  after(() => {
    resetWebSystemHealthEventMemoryForTests();
    setWebSystemHealthEventForceMemoryForTests(false);
  });

  it("declares a seven-day TTL index separate from the 100-event cap", () => {
    const ttl = WEB_SYSTEM_HEALTH_EVENT_INDEXES.find((index) => index.name === "web_system_health_events_expires_at_ttl");
    assert.equal(ttl?.expireAfterSeconds, 0);
    assert.deepEqual(ttl?.key, { expiresAt: 1 });
    const indexes = readFileSync(
      path.join(apiRoot, "src/infrastructure/mongodb/mongo-indexes.ts"),
      "utf8",
    );
    const collections = readFileSync(
      path.join(apiRoot, "src/infrastructure/mongodb/mongo-collections.ts"),
      "utf8",
    );
    assert.match(indexes, /webSystemHealthEvents/);
    assert.match(collections, /web_system_health_events/);
    const health = readFileSync(path.join(apiRoot, "src/routes/health.routes.ts"), "utf8");
    assert.doesNotMatch(health, /heapUsed|system-health|rss/);
  });

  it("rejects non-admins before reading memory or events", async () => {
    let fetches = 0;
    await assert.rejects(
      () =>
        readAdminWebSystemHealthEvents({
          actorUserId: " ",
          loadUser: async () => null,
        }),
      (error: unknown) => error instanceof AdministrationUnauthorizedError,
    );
    await assert.rejects(
      () =>
        readAdminWebMemorySnapshot({
          actorUserId: "member-1",
          loadUser: async () => ({ status: "active", role: "member" }),
          fetchImpl: async () => {
            fetches += 1;
            throw new Error("must not run");
          },
          env: { WEB_SYSTEM_HEALTH_TOKEN: TOKEN, CORS_ORIGIN: "https://web.example" },
        }),
      (error: unknown) => error instanceof AdministrationForbiddenError,
    );
    assert.equal(fetches, 0);

    const reading = await readAdminWebMemorySnapshot({
      actorUserId: "admin-1",
      loadUser: async () => ({ status: "active", role: "admin" }),
      env: {},
      fetchImpl: async () => {
        throw new Error("bridge is closed");
      },
    });
    assert.equal(reading.available, false);
    assert.equal(reading.unavailableReason, "NOT_CONFIGURED");
    assert.equal(reading.renderTerminationReason, "UNKNOWN");
    assert.equal(reading.snapshot, null);

    const loaded = await readAdminWebMemorySnapshot({
      actorUserId: "admin-1",
      loadUser: async () => ({ status: "active", role: "admin" }),
      env: { WEB_SYSTEM_HEALTH_TOKEN: TOKEN, CORS_ORIGIN: "https://web.example" },
      fetchImpl: async (input, init) => {
        assert.equal(String(input), "https://web.example/api/internal/system-health/snapshot");
        const headers = init?.headers as Record<string, string>;
        assert.equal(headers["x-hu-system-health-token"], TOKEN);
        return Response.json({
          rss: 10,
          heapUsed: 2,
          heapTotal: 3,
          external: 4,
          pid: 7,
          uptimeSeconds: 8,
          processStartedAt: "2026-10-18T00:00:00.000Z",
          instanceId: "srv-web-1",
          limitBytes: 1000,
          pressure: "below",
          message: SECRET,
          url: SECRET,
        });
      },
    });
    assert.equal(loaded.available, true);
    assert.equal(loaded.snapshot?.pressure, "below");
    assert.equal(loaded.snapshot?.instanceId, "srv-web-1");
    assert.equal(JSON.stringify(loaded).includes(SECRET), false);
    assert.equal(JSON.stringify(loaded).includes("message"), false);
  });

  it("stores only allowlisted fields and caps history at 100", async () => {
    resetWebSystemHealthEventMemoryForTests();
    const closed = await acceptWebSystemHealthEvent({
      presentedToken: TOKEN,
      body: eventBody(),
      env: {},
    });
    assert.equal(closed, "closed");

    const denied = await acceptWebSystemHealthEvent({
      presentedToken: "wrong-token-value-0123456789abcdef",
      body: eventBody(),
      env: { WEB_SYSTEM_HEALTH_TOKEN: TOKEN },
    });
    assert.equal(denied, "unauthorized");

    const invalid = await acceptWebSystemHealthEvent({
      presentedToken: TOKEN,
      body: eventBody({ failedProviderIds: [SECRET] }),
      env: { WEB_SYSTEM_HEALTH_TOKEN: TOKEN },
    });
    assert.equal(invalid, "invalid");
    assert.equal(await countStoredWebSystemHealthEventsForTests(), 0);

    const stored = await acceptWebSystemHealthEvent({
      presentedToken: TOKEN,
      body: eventBody(),
      env: { WEB_SYSTEM_HEALTH_TOKEN: TOKEN },
    });
    assert.equal(stored, "stored");
    const events = await listWebSystemHealthEvents();
    assert.equal(events.length, 1);
    const serialized = JSON.stringify(events[0]);
    assert.equal(serialized.includes(SECRET), false);
    assert.equal(serialized.includes("user-123"), false);
    assert.equal(serialized.includes("session=secret"), false);
    assert.equal(serialized.includes("message"), false);
    assert.deepEqual(events[0]?.failedProviderIds, ["blog-posts"]);
    assert.equal(events[0]?.source, "web");
    assert.equal(events[0]?.operation, "sitemap_build");
    const expiresMs = Date.parse(events[0]?.expiresAt ?? "");
    const occurredMs = Date.parse(events[0]?.occurredAt ?? "");
    assert.equal(expiresMs - occurredMs, 7 * 24 * 60 * 60 * 1000);

    const later = new Date(occurredMs + 8 * 24 * 60 * 60 * 1000);
    assert.deepEqual(await listWebSystemHealthEvents(later), []);

    resetWebSystemHealthEventMemoryForTests();
    for (let index = 0; index < 105; index += 1) {
      const accepted = await acceptWebSystemHealthEvent({
        presentedToken: TOKEN,
        body: eventBody({ pid: index }),
        env: { WEB_SYSTEM_HEALTH_TOKEN: TOKEN },
      });
      assert.equal(accepted, "stored");
    }
    assert.equal(await countStoredWebSystemHealthEventsForTests(), 100);
    const adminList = await readAdminWebSystemHealthEvents({
      actorUserId: "admin-1",
      loadUser: async () => ({ status: "active", role: "admin" }),
    });
    assert.equal(adminList.events.length, 100);
    assert.equal(adminList.maxEvents, 100);
    assert.equal(adminList.renderTerminationReason, "UNKNOWN");
  });

  it("keeps ingest closed over HTTP until the token is configured", async () => {
    const previous = process.env.WEB_SYSTEM_HEALTH_TOKEN;
    delete process.env.WEB_SYSTEM_HEALTH_TOKEN;
    const app = express();
    app.use(express.json());
    app.use("/api/v1/internal/system-health", internalWebSystemHealthRouter);
    const server = await listen(app);
    try {
      const closed = await fetch(`${baseUrl(server)}/api/v1/internal/system-health/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventBody()),
      });
      assert.equal(closed.status, 404);
      const closedBody = await closed.text();
      assert.equal(closedBody.includes("rss"), false);
      assert.equal(closedBody.includes(SECRET), false);

      process.env.WEB_SYSTEM_HEALTH_TOKEN = TOKEN;
      const denied = await fetch(`${baseUrl(server)}/api/v1/internal/system-health/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hu-system-health-token": "wrong-token-value-0123456789abcdef",
        },
        body: JSON.stringify(eventBody()),
      });
      assert.equal(denied.status, 401);
    } finally {
      await closeServer(server);
      if (previous === undefined) delete process.env.WEB_SYSTEM_HEALTH_TOKEN;
      else process.env.WEB_SYSTEM_HEALTH_TOKEN = previous;
    }
  });
});

function listen(app: express.Express): Promise<Server> {
  return new Promise((resolve) => {
    const server = createServer(app);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function baseUrl(server: Server): string {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("test server did not bind a port");
  }
  return `http://127.0.0.1:${address.port}`;
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
