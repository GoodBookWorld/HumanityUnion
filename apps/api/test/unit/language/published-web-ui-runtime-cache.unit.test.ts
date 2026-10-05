/**
 * F.3.42 — published WEB_UI runtime payload cache.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, beforeEach } from "node:test";
import { fileURLToPath } from "node:url";

import {
  getPublishedWebUiRuntimeCacheSizeForTests,
  PUBLISHED_WEB_UI_RUNTIME_CACHE_MAX_ENTRIES,
} from "../../../src/modules/web-ui-message-packs/published-web-ui-runtime-cache.js";
import { WebUiMessagePackValidationError } from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.errors.js";
import {
  getPublishedWebUiRuntimePayload,
  getPublishedWebUiRuntimeStoreReadCountForTests,
  PUBLISHED_WEB_UI_RUNTIME_PROJECTION,
  resetWebUiMessagePackStoreForTests,
  setPublishedWebUiRuntimeStoreReaderForTests,
  setWebUiMessagePackForceMemoryForTests,
  upsertWebUiMessagePack,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";
import { loadBundledEnglishWebUiMessagePack } from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.validate.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const packsDir = path.resolve(here, "../../../src/modules/web-ui-message-packs");

function readPackFile(name: string): string {
  return readFileSync(path.join(packsDir, name), "utf8");
}

function sliceFunction(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, startMarker);
  assert.ok(end > start, endMarker);
  return source.slice(start, end);
}

describe("published WEB_UI runtime cache", () => {
  beforeEach(() => {
    setWebUiMessagePackForceMemoryForTests(true);
    resetWebUiMessagePackStoreForTests();
  });

  it("A — first public read is a miss and reads the store", async () => {
    const english = loadBundledEnglishWebUiMessagePack();
    await upsertWebUiMessagePack({
      locale: "ka",
      status: "published",
      messages: english,
    });
    assert.equal(getPublishedWebUiRuntimeStoreReadCountForTests(), 0);

    const first = await getPublishedWebUiRuntimePayload("ka");
    assert.equal(first?.revision, 1);
    assert.equal(getPublishedWebUiRuntimeStoreReadCountForTests(), 1);
  });

  it("B — second public read for the same locale is a hit", async () => {
    const english = loadBundledEnglishWebUiMessagePack();
    await upsertWebUiMessagePack({
      locale: "ka",
      status: "published",
      messages: english,
    });
    await getPublishedWebUiRuntimePayload("ka");
    const second = await getPublishedWebUiRuntimePayload("KA");
    assert.equal(second?.revision, 1);
    assert.equal(second?.locale, "ka");
    assert.equal(getPublishedWebUiRuntimeStoreReadCountForTests(), 1);
  });

  it("C — different locales have separate entries", async () => {
    const english = loadBundledEnglishWebUiMessagePack();
    await upsertWebUiMessagePack({
      locale: "ka",
      status: "published",
      messages: english,
    });
    await upsertWebUiMessagePack({
      locale: "am",
      status: "published",
      messages: english,
    });
    const ka = await getPublishedWebUiRuntimePayload("ka");
    const am = await getPublishedWebUiRuntimePayload("am");
    assert.equal(ka?.locale, "ka");
    assert.equal(am?.locale, "am");
    assert.equal(getPublishedWebUiRuntimeCacheSizeForTests(), 2);
    assert.equal(getPublishedWebUiRuntimeStoreReadCountForTests(), 2);
    await getPublishedWebUiRuntimePayload("ka");
    await getPublishedWebUiRuntimePayload("am");
    assert.equal(getPublishedWebUiRuntimeStoreReadCountForTests(), 2);
  });

  it("D — cache is bounded", async () => {
    let reads = 0;
    setPublishedWebUiRuntimeStoreReaderForTests(async (localeKey) => {
      reads += 1;
      return {
        locale: localeKey,
        revision: 1,
        messages: { common: { ok: localeKey } },
        source: "remote",
      };
    });

    const max = PUBLISHED_WEB_UI_RUNTIME_CACHE_MAX_ENTRIES;
    for (let index = 0; index < max + 1; index += 1) {
      const payload = await getPublishedWebUiRuntimePayload(`loc-${index}`);
      assert.equal(payload?.locale, `loc-${index}`);
    }
    assert.equal(getPublishedWebUiRuntimeCacheSizeForTests(), max);
    assert.equal(reads, max + 1);

    const evicted = await getPublishedWebUiRuntimePayload("loc-0");
    assert.equal(evicted?.locale, "loc-0");
    assert.equal(reads, max + 2);
    assert.equal(getPublishedWebUiRuntimeCacheSizeForTests(), max);
  });

  it("E — only published packs enter the public cache", async () => {
    const english = loadBundledEnglishWebUiMessagePack();
    await upsertWebUiMessagePack({
      locale: "ka",
      status: "draft",
      messages: english,
    });
    assert.equal(await getPublishedWebUiRuntimePayload("ka"), null);
    assert.equal(await getPublishedWebUiRuntimePayload("ka"), null);
    assert.equal(getPublishedWebUiRuntimeStoreReadCountForTests(), 2);
    assert.equal(getPublishedWebUiRuntimeCacheSizeForTests(), 0);
  });

  it("F/H — successful update invalidates and the next read loads the new revision", async () => {
    const english = loadBundledEnglishWebUiMessagePack();
    await upsertWebUiMessagePack({
      locale: "ka",
      status: "published",
      messages: english,
    });
    const first = await getPublishedWebUiRuntimePayload("ka");
    assert.equal(first?.revision, 1);

    await upsertWebUiMessagePack({
      locale: "ka",
      status: "published",
      messages: english,
      sourceNote: "replacement",
    });
    assert.equal(getPublishedWebUiRuntimeCacheSizeForTests(), 0);

    const next = await getPublishedWebUiRuntimePayload("ka");
    assert.equal(next?.revision, 2);
    assert.equal(getPublishedWebUiRuntimeStoreReadCountForTests(), 2);
  });

  it("G — failed update keeps the previous cached payload", async () => {
    const english = loadBundledEnglishWebUiMessagePack();
    await upsertWebUiMessagePack({
      locale: "ka",
      status: "published",
      messages: english,
    });
    const cached = await getPublishedWebUiRuntimePayload("ka");
    assert.equal(cached?.revision, 1);

    await assert.rejects(
      () =>
        upsertWebUiMessagePack({
          locale: "ka",
          status: "published",
          messages: { notARealNamespace: { foo: "bar" } } as never,
        }),
      WebUiMessagePackValidationError,
    );

    const still = await getPublishedWebUiRuntimePayload("ka");
    assert.equal(still?.revision, 1);
    assert.equal(still, cached);
    assert.equal(getPublishedWebUiRuntimeStoreReadCountForTests(), 1);
    assert.equal(getPublishedWebUiRuntimeCacheSizeForTests(), 1);
  });

  it("I — public runtime Mongo projection does not request fingerprints", () => {
    assert.equal("sourceFingerprintsByPath" in PUBLISHED_WEB_UI_RUNTIME_PROJECTION, false);
    assert.equal(PUBLISHED_WEB_UI_RUNTIME_PROJECTION.messages, 1);
    assert.equal(PUBLISHED_WEB_UI_RUNTIME_PROJECTION.status, 1);
    assert.equal(PUBLISHED_WEB_UI_RUNTIME_PROJECTION.revision, 1);

    const source = readPackFile("web-ui-message-pack.repository.ts");
    const mongoRead = sliceFunction(
      source,
      "async function readPublishedWebUiRuntimeFromMongo",
      "async function readPublishedWebUiRuntimeFromStore",
    );
    assert.match(mongoRead, /projection:\s*PUBLISHED_WEB_UI_RUNTIME_PROJECTION/);
    assert.equal(mongoRead.includes("sourceFingerprintsByPath"), false);
  });

  it("J — admin and preparation reads keep the full document", () => {
    const repository = readPackFile("web-ui-message-pack.repository.ts");
    const fullRead = sliceFunction(
      repository,
      "export async function getWebUiMessagePackByLocale",
      "export async function getPublishedWebUiMessagePackByLocale",
    );
    assert.match(fullRead, /findOne\(\{ localeKey \}\)/);
    assert.equal(fullRead.includes("PUBLISHED_WEB_UI_RUNTIME_PROJECTION"), false);
    assert.match(fullRead, /fromWebUiMessagePackMongoDocument/);

    const fingerprintWrite = sliceFunction(
      repository,
      "export async function writePublishedWebUiSourceFingerprints",
      "export async function requireWebUiMessagePackByLocale",
    );
    assert.match(fingerprintWrite, /getPublishedWebUiMessagePackByLocale/);
    assert.match(fingerprintWrite, /sourceFingerprintsByPath/);

    const activation = readPackFile("web-ui-activation-preparation.ts");
    assert.match(activation, /getPublishedWebUiMessagePackByLocale/);
    assert.equal(activation.includes("getPublishedWebUiRuntimePayload"), false);

    const stamp = readPackFile("web-ui-leaf-source-stamp.ts");
    assert.match(stamp, /getPublishedWebUiMessagePackByLocale/);
    assert.match(stamp, /sourceFingerprintsByPath/);
    assert.equal(stamp.includes("getPublishedWebUiRuntimePayload"), false);
  });

  it("K — response contract stays locale, revision, messages, and remote source", async () => {
    const english = loadBundledEnglishWebUiMessagePack();
    await upsertWebUiMessagePack({
      locale: "ka",
      status: "published",
      messages: english,
    });
    const payload = await getPublishedWebUiRuntimePayload("ka");
    assert.deepEqual(Object.keys(payload ?? {}).sort(), [
      "locale",
      "messages",
      "revision",
      "source",
    ]);
    assert.equal(payload?.source, "remote");
    assert.equal(payload?.messages, english);

    const route = readPackFile("public-web-ui-message-pack.routes.ts");
    assert.match(route, /getPublishedWebUiRuntimePayload/);
    assert.match(route, /locale: pack\.locale/);
    assert.match(route, /revision: pack\.revision/);
    assert.match(route, /messages: pack\.messages/);
    assert.match(route, /source: pack\.source/);
  });

  it("L/M — no locale-specific branches and no provider call on the public read", () => {
    const cache = readPackFile("published-web-ui-runtime-cache.ts");
    const route = readPackFile("public-web-ui-message-pack.routes.ts");
    const repository = readPackFile("web-ui-message-pack.repository.ts");
    const runtime = sliceFunction(
      repository,
      "function toPublishedRuntimePayload",
      "export async function upsertWebUiMessagePack",
    );
    const combined = `${cache}\n${route}\n${runtime}`;
    assert.equal(/locale\s*===\s*["'](uk|he|en)["']/.test(combined), false);
    assert.equal(/gemini|TranslationProvider|generateContent/i.test(combined), false);
  });

  it("invalidation is after the durable write", () => {
    const repository = readPackFile("web-ui-message-pack.repository.ts");
    const upsert = sliceFunction(
      repository,
      "export async function upsertWebUiMessagePack",
      "export async function writePublishedWebUiSourceFingerprints",
    );
    const memoryWrite = upsert.indexOf("upsertWebUiMessagePackMemory");
    const memoryInvalidate = upsert.indexOf("invalidatePublishedWebUiRuntimeCache");
    const mongoWrite = upsert.indexOf("collection().updateOne");
    const mongoInvalidate = upsert.lastIndexOf("invalidatePublishedWebUiRuntimeCache");
    assert.ok(memoryWrite >= 0 && memoryInvalidate > memoryWrite);
    assert.ok(mongoWrite >= 0 && mongoInvalidate > mongoWrite);
    assert.equal(upsert.includes("sourceFingerprintsByPath"), true);
  });
});
