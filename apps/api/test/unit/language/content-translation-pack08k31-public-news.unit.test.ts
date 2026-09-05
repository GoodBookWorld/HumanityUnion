/**
 * Pack 08K.3.1 — public_news source registration (deterministic, no warm-backfill import).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  CONTENT_TRANSLATION_FIELD_ALLOWLIST,
  PUBLIC_CONTENT_TRANSLATION_SOURCE_KINDS,
} from "../../../src/modules/language/content-translation-eligibility.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiSrc = join(__dirname, "../../../src");

describe("Pack 08K.3.1 public_news registration", () => {
  it("allowlist + public kinds include public_news", () => {
    assert.deepEqual([...CONTENT_TRANSLATION_FIELD_ALLOWLIST.public_news], [
      "title",
      "summary",
      "category",
    ]);
    assert.ok(PUBLIC_CONTENT_TRANSLATION_SOURCE_KINDS.includes("public_news"));
  });

  it("loader + service + routes + thin + upsert scheduling + recovery kinds are wired", () => {
    const loaders = readFileSync(
      join(apiSrc, "modules/language/content-translation-civic-loaders.ts"),
      "utf8",
    );
    const service = readFileSync(
      join(apiSrc, "modules/language/content-translation.service.ts"),
      "utf8",
    );
    const routes = readFileSync(join(apiSrc, "modules/language/language.routes.ts"), "utf8");
    const thin = readFileSync(
      join(apiSrc, "modules/language/thin-localization-diagnostic/parse-residual-args.ts"),
      "utf8",
    );
    const mongo = readFileSync(
      join(apiSrc, "modules/language/thin-localization-diagnostic/mongo-lookups.ts"),
      "utf8",
    );
    const newsService = readFileSync(
      join(apiSrc, "modules/public-news/public-news.service.ts"),
      "utf8",
    );
    const warm = readFileSync(
      join(apiSrc, "modules/language/content-translation-staging-warm-backfill.ts"),
      "utf8",
    );
    assert.match(loaders, /loadPublicNewsTranslationSource/);
    assert.match(loaders, /discoverPublicNewsTranslationRecordIds/);
    assert.match(service, /sourceKind === "public_news"/);
    assert.match(routes, /"public_news"/);
    assert.match(thin, /"public_news"/);
    assert.match(mongo, /case "public_news"/);
    assert.match(newsService, /notifyPublicPresentationChanged/);
    assert.match(newsService, /sourceKind: "public_news"/);
    assert.match(warm, /"public_news"/);
    assert.match(warm, /discoverPublicNewsTranslationRecordIds/);
  });
});
