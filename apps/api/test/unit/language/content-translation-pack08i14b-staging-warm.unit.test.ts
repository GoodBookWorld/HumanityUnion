/**
 * Pack 08I.14B — staging warm backfill module contract (no Mongo / no provider).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { STAGING_INITIATIVE_PATH_WARM_SOURCE_KINDS } from "../../../src/modules/language/content-translation-staging-warm-backfill.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function readApi(relative: string): string {
  return readFileSync(path.resolve(here, "../../../", relative), "utf8");
}

describe("Pack 08I.14B — staging content translation warm backfill", () => {
  it("enumerates Initiative-path kinds and excludes Blog/Media", () => {
    assert.ok(STAGING_INITIATIVE_PATH_WARM_SOURCE_KINDS.includes("initiative"));
    assert.ok(STAGING_INITIATIVE_PATH_WARM_SOURCE_KINDS.includes("discussion_comment"));
    assert.ok(STAGING_INITIATIVE_PATH_WARM_SOURCE_KINDS.includes("collaborative_analysis"));
    assert.ok(!STAGING_INITIATIVE_PATH_WARM_SOURCE_KINDS.includes("blog_post" as never));
    assert.ok(!STAGING_INITIATIVE_PATH_WARM_SOURCE_KINDS.includes("civic_media" as never));
  });

  it("script is staging-guarded, bootstraps Mongo persistence, and uses operator_backfill", () => {
    const script = readApi("src/scripts/warm-staging-content-translations.ts");
    assert.match(script, /humanity_union_staging/);
    assert.match(script, /ALLOW_STAGING_CONTENT_TRANSLATION_WARM/);
    assert.match(script, /--execute/);
    assert.match(script, /bootstrapContentTranslationOperatorPersistence/);
    assert.doesNotMatch(script, /blog_post/);

    const moduleSource = readApi(
      "src/modules/language/content-translation-staging-warm-backfill.ts",
    );
    assert.match(moduleSource, /operator_backfill/);
    assert.match(moduleSource, /enqueueContentTranslationWarmRequested/);
    assert.match(moduleSource, /canExposePublicInitiativeProjection/);
    assert.match(moduleSource, /SOURCE_RECORDS_DISCOVERED|sourceRecordsDiscovered/);
  });

  it("discussion_comment create still schedules warm; removed comments are not loadable", () => {
    const commentService = readApi(
      "src/modules/initiative-comments/initiative-comment.service.ts",
    );
    assert.match(commentService, /sourceKind:\s*"discussion_comment"/);
    assert.match(commentService, /scheduleContentTranslationWarmAfterMutation/);

    const loader = readApi("src/modules/language/content-translation.service.ts");
    assert.match(
      loader,
      /comment\.status !== "approved" \|\| comment\.deletedAt/,
    );
  });

  it("Initiative publish/update warm hooks remain connected", () => {
    const initiative = readApi("src/modules/initiatives/initiative.service.ts");
    assert.match(initiative, /sourceKind:\s*"initiative"/);
    assert.match(initiative, /scheduleContentTranslationWarmAfterMutation/);
  });
});
