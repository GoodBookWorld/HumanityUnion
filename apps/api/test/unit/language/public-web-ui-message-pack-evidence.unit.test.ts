/**
 * HU-MEM-14C.1B — public WEB_UI evidence route on the memory adapter.
 * Aggregation equivalence is covered by the isolated MongoDB test.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { once } from "node:events";
import http from "node:http";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import express, { type Router } from "express";

import { getPublishedWebUiRuntimeCacheSizeForTests } from "../../../src/modules/web-ui-message-packs/published-web-ui-runtime-cache.js";
import { WebUiMessagePackPersistenceError } from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.errors.js";
import {
  compareAndSetWebUiMessagePack,
  getPublishedWebUiRuntimeEvidence,
  getPublishedWebUiRuntimePayload,
  publishedWebUiMessagesTopLevelKeyCount,
  resetWebUiMessagePackStoreForTests,
  setPublishedWebUiRuntimeEvidenceReaderForTests,
  setWebUiMessagePackForceMemoryForTests,
  upsertWebUiMessagePack,
  writePublishedWebUiSourceFingerprints,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";
import publicWebUiMessagePackRouter from "../../../src/modules/web-ui-message-packs/public-web-ui-message-pack.routes.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../..");
const packsDir = path.resolve(here, "../../../src/modules/web-ui-message-packs");

type HttpResult = {
  readonly status: number;
  readonly body: {
    success?: boolean;
    data?: Record<string, unknown> | null;
    message?: string;
  };
  readonly raw: string;
};

async function getJson(router: Router, requestPath: string): Promise<HttpResult> {
  const app = express();
  app.use("/api/v1/web-ui-message-packs", router);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  try {
    const response = await fetch(`http://127.0.0.1:${port}${requestPath}`);
    const raw = await response.text();
    return {
      status: response.status,
      body: raw ? (JSON.parse(raw) as HttpResult["body"]) : {},
      raw,
    };
  } finally {
    server.close();
    await once(server, "close");
  }
}

async function loadStagingRoute(): Promise<Router> {
  const source = execFileSync(
    "git",
    ["show", "HEAD:apps/api/src/modules/web-ui-message-packs/public-web-ui-message-pack.routes.ts"],
    { cwd: repoRoot, encoding: "utf8" },
  );
  const rewritten = source
    .replaceAll('from "../../shared/http-response.js"', 'from "../../../src/shared/http-response.js"')
    .replaceAll(
      'from "./web-ui-message-pack.errors.js"',
      'from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.errors.js"',
    )
    .replaceAll(
      'from "./web-ui-message-pack.repository.js"',
      'from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js"',
    );
  const file = path.join(here, ".staging-public-web-ui-message-pack.routes.ts");
  writeFileSync(file, rewritten);
  const loaded = (await import("./.staging-public-web-ui-message-pack.routes.ts")) as { default: Router };
  return loaded.default;
}

describe("public WEB_UI evidence route", { concurrency: false }, () => {
  beforeEach(() => {
    setWebUiMessagePackForceMemoryForTests(true);
    resetWebUiMessagePackStoreForTests();
  });

  after(() => {
    setPublishedWebUiRuntimeEvidenceReaderForTests(null);
    setWebUiMessagePackForceMemoryForTests(false);
    resetWebUiMessagePackStoreForTests();
    rmSync(path.join(here, ".staging-public-web-ui-message-pack.routes.ts"), { force: true });
  });

  it("counts JSON object keys and rejects values the full route cannot serve", () => {
    assert.equal(publishedWebUiMessagesTopLevelKeyCount({ greeting: "Hello", other: "" }), 2);
    assert.equal(publishedWebUiMessagesTopLevelKeyCount({}), 0);
    assert.equal(publishedWebUiMessagesTopLevelKeyCount({ common: {} }), 1);
    assert.equal(publishedWebUiMessagesTopLevelKeyCount({ common: { language: "" } }), 1);
    assert.equal(publishedWebUiMessagesTopLevelKeyCount({ count: 1, ok: false, empty: null }), 3);
    assert.equal(publishedWebUiMessagesTopLevelKeyCount(["one"]), 1);
    assert.equal(publishedWebUiMessagesTopLevelKeyCount([]), 0);
    assert.equal(publishedWebUiMessagesTopLevelKeyCount(null), 0);
    assert.equal(publishedWebUiMessagesTopLevelKeyCount(undefined), 0);
    assert.equal(publishedWebUiMessagesTopLevelKeyCount("text"), 0);
    assert.equal(publishedWebUiMessagesTopLevelKeyCount(12), 0);
    assert.equal(publishedWebUiMessagesTopLevelKeyCount(new Date("2026-01-01T00:00:00.000Z")), 0);
    assert.equal(publishedWebUiMessagesTopLevelKeyCount({ bad: 1n }), 0);
  });

  it("keeps the default full pack and adds compact evidence", async () => {
    await upsertWebUiMessagePack({
      locale: "uk",
      status: "published",
      messages: { common: { language: "Language" } },
    });

    const full = await getJson(publicWebUiMessagePackRouter, "/api/v1/web-ui-message-packs?locale=uk");
    assert.equal(full.status, 200);
    assert.equal(full.body.success, true);
    assert.equal(full.body.data?.locale, "uk");
    assert.equal(full.body.data?.revision, 1);
    assert.deepEqual(full.body.data?.messages, { common: { language: "Language" } });
    assert.equal(full.body.data?.source, "remote");

    const evidence = await getJson(
      publicWebUiMessagePackRouter,
      "/api/v1/web-ui-message-packs?locale=UK&view=evidence",
    );
    assert.equal(evidence.status, 200);
    assert.equal(evidence.body.data?.locale, "uk");
    assert.equal(evidence.body.data?.revision, 1);
    assert.equal(evidence.body.data?.topLevelKeyCount, 1);
    assert.equal(Object.prototype.hasOwnProperty.call(evidence.body.data, "messages"), false);
    assert.equal(evidence.raw.includes("sourceFingerprints"), false);
    assert.equal(evidence.raw.includes("Language"), false);
  });

  it("preserves missing, draft, unknown view, and empty-locale responses", async () => {
    assert.equal(
      (await getJson(publicWebUiMessagePackRouter, "/api/v1/web-ui-message-packs")).status,
      400,
    );
    assert.equal(
      (await getJson(publicWebUiMessagePackRouter, "/api/v1/web-ui-message-packs?locale=uk&view=full")).status,
      400,
    );
    assert.equal(
      (await getJson(publicWebUiMessagePackRouter, "/api/v1/web-ui-message-packs?locale=uk&view=evidence")).status,
      404,
    );

    await upsertWebUiMessagePack({
      locale: "uk",
      status: "draft",
      messages: { common: { language: "Language" } },
    });
    const draft = await getJson(
      publicWebUiMessagePackRouter,
      "/api/v1/web-ui-message-packs?locale=uk&view=evidence",
    );
    assert.equal(draft.status, 404);
    assert.equal(draft.raw.includes("Language"), false);
    const draftFull = await getJson(publicWebUiMessagePackRouter, "/api/v1/web-ui-message-packs?locale=uk");
    assert.equal(draftFull.status, 404);
  });

  it("follows publication, unpublish, fingerprint writes, and cache hits", async () => {
    await upsertWebUiMessagePack({
      locale: "zz-Future",
      status: "published",
      messages: {},
    });
    const empty = await getPublishedWebUiRuntimeEvidence("ZZ-FUTURE");
    assert.equal(empty?.locale, "zz-Future");
    assert.equal(empty?.revision, 1);
    assert.equal(empty?.topLevelKeyCount, 0);
    assert.equal(getPublishedWebUiRuntimeCacheSizeForTests(), 0);

    const replaced = await compareAndSetWebUiMessagePack({
      locale: "zz-Future",
      messages: { common: {} },
      status: "published",
      expectedRevision: 1,
    });
    const nonempty = await getPublishedWebUiRuntimeEvidence("zz-future");
    assert.equal(replaced.revision, 2);
    assert.equal(nonempty?.revision, 2);
    assert.equal(nonempty?.topLevelKeyCount, 1);

    await getPublishedWebUiRuntimePayload("zz-Future");
    assert.equal(getPublishedWebUiRuntimeCacheSizeForTests(), 1);
    const cached = await getPublishedWebUiRuntimeEvidence("zz-Future");
    assert.equal(cached?.revision, 2);
    assert.equal(cached?.topLevelKeyCount, 1);

    await writePublishedWebUiSourceFingerprints({
      locale: "zz-Future",
      sourceFingerprintsByPath: { "common.language": "abc" },
      updatedAt: "2026-11-24T00:00:00.000Z",
    });
    const stamped = await getPublishedWebUiRuntimeEvidence("zz-Future");
    assert.equal(stamped?.revision, 2);
    assert.equal(stamped?.topLevelKeyCount, 1);

    await compareAndSetWebUiMessagePack({
      locale: "zz-Future",
      messages: {},
      status: "published",
      expectedRevision: 2,
    });
    const cleared = await getPublishedWebUiRuntimeEvidence("zz-Future");
    assert.equal(cleared?.revision, 3);
    assert.equal(cleared?.topLevelKeyCount, 0);

    await compareAndSetWebUiMessagePack({
      locale: "zz-Future",
      messages: { common: { language: "Language" } },
      status: "draft",
      expectedRevision: 3,
    });
    assert.equal(await getPublishedWebUiRuntimeEvidence("zz-Future"), null);

    await compareAndSetWebUiMessagePack({
      locale: "zz-Future",
      messages: { common: { language: "Language" } },
      status: "published",
      expectedRevision: 4,
    });
    const republished = await getPublishedWebUiRuntimeEvidence("zz-Future");
    assert.equal(republished?.revision, 5);
    assert.equal(republished?.topLevelKeyCount, 1);
    assert.equal(getPublishedWebUiRuntimeCacheSizeForTests(), 0);
  });

  it("keeps each concurrent read consistent with the revision it observed", async () => {
    await upsertWebUiMessagePack({
      locale: "uk",
      status: "published",
      messages: { common: { language: "Language" }, navigation: { home: "Home" } },
    });
    const counts = new Map<number, number>([
      [1, 2],
      [2, 0],
    ]);
    const reads = Array.from({ length: 6 }, () => getPublishedWebUiRuntimeEvidence("uk"));
    const update = compareAndSetWebUiMessagePack({
      locale: "uk",
      messages: {},
      status: "published",
      expectedRevision: 1,
    });
    const [results, written] = await Promise.all([Promise.all(reads), update]);
    assert.equal(written.revision, 2);
    for (const result of results) {
      assert.ok(result);
      assert.equal(result?.topLevelKeyCount, counts.get(result?.revision ?? 0));
    }
  });

  it("maps persistence failures and does not describe them as a missing pack", async () => {
    setPublishedWebUiRuntimeEvidenceReaderForTests(async () => {
      throw new WebUiMessagePackPersistenceError("MongoDB is not configured.");
    });
    const unavailable = await getJson(
      publicWebUiMessagePackRouter,
      "/api/v1/web-ui-message-packs?locale=uk&view=evidence",
    );
    assert.equal(unavailable.status, 503);

    setPublishedWebUiRuntimeEvidenceReaderForTests(async () => {
      throw new Error("evidence aggregation failed");
    });
    const failed = await getJson(
      publicWebUiMessagePackRouter,
      "/api/v1/web-ui-message-packs?locale=uk&view=evidence",
    );
    assert.equal(failed.status, 500);
    assert.equal(getPublishedWebUiRuntimeCacheSizeForTests(), 0);
  });

  it("runs the staging route and still returns the full pack when view=evidence is present", async () => {
    await upsertWebUiMessagePack({
      locale: "uk",
      status: "published",
      messages: { common: { language: "Language" } },
    });
    const stagingRoute = await loadStagingRoute();
    const legacy = await getJson(
      stagingRoute,
      "/api/v1/web-ui-message-packs?locale=uk&view=evidence",
    );
    assert.equal(legacy.status, 200);
    assert.deepEqual(legacy.body.data?.messages, { common: { language: "Language" } });
    assert.equal(Object.prototype.hasOwnProperty.call(legacy.body.data, "topLevelKeyCount"), false);

    const current = await getJson(
      publicWebUiMessagePackRouter,
      "/api/v1/web-ui-message-packs?locale=uk&view=evidence",
    );
    assert.equal(current.body.data?.topLevelKeyCount, 1);
    assert.equal(Object.prototype.hasOwnProperty.call(current.body.data, "messages"), false);
    assert.equal(readFileSync(path.join(packsDir, "public-web-ui-message-pack.routes.ts"), "utf8").includes("view=evidence"), true);
  });
});
