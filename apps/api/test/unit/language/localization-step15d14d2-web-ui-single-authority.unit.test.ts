/**
 * Step 15D.14.D.2 — WEB_UI single authority (API effective resolver).
 *
 * Published Mongo wins over bundled FS. Draft is not authority.
 * No locale-specific branches.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, beforeEach } from "node:test";
import { fileURLToPath } from "node:url";

import {
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
  upsertWebUiMessagePack,
  getPublishedWebUiMessagePackByLocale,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";
import { resolveEffectiveWebUiMessagePack } from "../../../src/modules/web-ui-message-packs/resolve-effective-web-ui-message-pack.js";
import {
  loadBundledEnglishWebUiMessagePack,
  loadBundledWebUiMessagePackFromFs,
  selectEnglishWebUiMessages,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.validate.js";
import { assessWebUiCatalogReadinessForLocale } from "../../../src/modules/language/language-localization-activation/assess-web-ui-catalog-readiness.js";
import { tryAdoptPackagedWebUiCatalog } from "../../../src/modules/web-ui-message-packs/adopt-packaged-web-ui-catalog.js";
import { resetWebUiControlledLabelCacheForTests } from "../../../src/modules/language/controlled-lifecycle-web-ui-labels.js";

describe("Step 15D.14.D.2 — WEB_UI single authority (API)", () => {
  beforeEach(() => {
    setWebUiMessagePackForceMemoryForTests(true);
    resetWebUiMessagePackStoreForTests();
    resetWebUiControlledLabelCacheForTests();
  });

  it("H. effective resolver uses published-Mongo-first over bundled FS", async () => {
    const english = loadBundledEnglishWebUiMessagePack();
    const marker = {
      ...(english as Record<string, unknown>),
      common: {
        ...((english as { common?: Record<string, unknown> }).common ?? {}),
        language: "MONGO_MARKER_LANGUAGE",
      },
    };
    await upsertWebUiMessagePack({
      locale: "uk",
      status: "published",
      messages: marker as never,
      sourceNote: "d2 authority fixture",
    });
    const effective = await resolveEffectiveWebUiMessagePack("uk");
    assert.equal(effective?.source, "remote");
    assert.equal(
      (effective?.messages as { common?: { language?: string } }).common?.language,
      "MONGO_MARKER_LANGUAGE",
    );
    const bundled = loadBundledWebUiMessagePackFromFs("uk");
    assert.ok(bundled);
    assert.notEqual(
      (bundled as { common?: { language?: string } }).common?.language,
      "MONGO_MARKER_LANGUAGE",
    );
  });

  it("B. bundled FS used when published Mongo is absent", async () => {
    const effective = await resolveEffectiveWebUiMessagePack("uk");
    assert.ok(effective);
    assert.equal(effective?.source, "bundled");
  });

  it("C. draft Mongo does not override bundled", async () => {
    const prepared = selectEnglishWebUiMessages("public");
    await upsertWebUiMessagePack({
      locale: "uk",
      status: "draft",
      messages: {
        ...prepared.messages,
        common: {
          ...((prepared.messages as { common?: Record<string, unknown> }).common ?? {}),
          language: "DRAFT_MUST_NOT_WIN",
        },
      } as never,
    });
    assert.equal(await getPublishedWebUiMessagePackByLocale("uk"), null);
    const effective = await resolveEffectiveWebUiMessagePack("uk");
    assert.equal(effective?.source, "bundled");
    assert.notEqual(
      (effective?.messages as { common?: { language?: string } }).common?.language,
      "DRAFT_MUST_NOT_WIN",
    );
  });

  it("F. Mongo-only clean-room locale works", async () => {
    const english = loadBundledEnglishWebUiMessagePack();
    await upsertWebUiMessagePack({
      locale: "eo",
      status: "published",
      messages: english as never,
      sourceNote: "clean-room fixture",
    });
    const effective = await resolveEffectiveWebUiMessagePack("eo");
    assert.equal(effective?.source, "remote");
    assert.equal(effective?.locale, "eo");
    const readiness = await assessWebUiCatalogReadinessForLocale({ locale: "eo" });
    assert.equal(readiness.dataReady, true);
  });

  it("G. neither localized source → null effective", async () => {
    const effective = await resolveEffectiveWebUiMessagePack("zz-missing");
    assert.equal(effective, null);
    const readiness = await assessWebUiCatalogReadinessForLocale({ locale: "zz-missing" });
    assert.equal(readiness.dataReady, false);
  });

  it("N. Admin published import is effective on next resolve; draft is not", async () => {
    const english = loadBundledEnglishWebUiMessagePack();
    await upsertWebUiMessagePack({
      locale: "eo",
      status: "draft",
      messages: english as never,
      sourceNote: "admin draft",
    });
    assert.equal(await resolveEffectiveWebUiMessagePack("eo"), null);

    await upsertWebUiMessagePack({
      locale: "eo",
      status: "published",
      messages: {
        ...(english as Record<string, unknown>),
        common: {
          ...((english as { common?: Record<string, unknown> }).common ?? {}),
          language: "ADMIN_PUBLISHED",
        },
      } as never,
      sourceNote: "admin published",
    });
    const effective = await resolveEffectiveWebUiMessagePack("eo");
    assert.equal(effective?.source, "remote");
    assert.equal(
      (effective?.messages as { common?: { language?: string } }).common?.language,
      "ADMIN_PUBLISHED",
    );
  });

  it("I. packaged adoption still publishes durable Mongo shape selected by effective resolver", async () => {
    const packaged = loadBundledWebUiMessagePackFromFs("uk");
    assert.ok(packaged);
    const adopted = await tryAdoptPackagedWebUiCatalog({
      locale: "uk",
      generation: 0,
      deps: {
        loadPackagedWebUiCatalog: () => packaged as never,
      },
    });
    assert.equal(adopted.outcome, "adopted");
    const published = await getPublishedWebUiMessagePackByLocale("uk");
    assert.ok(published);
    assert.equal(published?.status, "published");
    assert.match(published?.sourceNote ?? "", /packaged catalog adoption/);
    const effective = await resolveEffectiveWebUiMessagePack("uk");
    assert.equal(effective?.source, "remote");
    assert.equal(effective?.revision, published?.revision ?? null);
  });

  it("O. no locale-specific branches in effective resolver / web loader precedence", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const resolveSrc = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/web-ui-message-packs/resolve-effective-web-ui-message-pack.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(resolveSrc, /locale === ["']uk["']|locale === ["']ar["']|locale === ["']ka["']|locale === ["']he["']/);
    assert.match(resolveSrc, /getPublishedWebUiMessagePackByLocale/);
    assert.match(resolveSrc, /loadBundledWebUiMessagePackFromFs/);
    // Published path must appear before bundled fallback in source order.
    const publishedIdx = resolveSrc.indexOf("getPublishedWebUiMessagePackByLocale");
    const bundledIdx = resolveSrc.indexOf("loadBundledWebUiMessagePackFromFs(tag)");
    assert.ok(publishedIdx > 0 && bundledIdx > publishedIdx);
  });
});
