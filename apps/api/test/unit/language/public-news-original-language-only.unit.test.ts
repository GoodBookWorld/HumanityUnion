/**
 * Reset 01 — public_news PLP MACHINE policy (replaces Closure 02 original-only).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PUBLIC_NEWS_FIELD_OWNERSHIP,
  PUBLIC_NEWS_MACHINE_CONTENT_PATHS,
  LANGUAGE_ACTIVATION_PROTECTED_EXCLUDED_KINDS,
  LANGUAGE_ACTIVATION_PLP_OWNED_MEDIA_ENTITY_TYPES,
} from "@hu/types";

describe("Reset 01 — public_news PLP MACHINE policy", () => {
  it("title/summary are MACHINE; protected fields remain protected", () => {
    assert.equal(PUBLIC_NEWS_FIELD_OWNERSHIP.title, "MACHINE_CONTENT");
    assert.equal(PUBLIC_NEWS_FIELD_OWNERSHIP.summary, "MACHINE_CONTENT");
    assert.equal(PUBLIC_NEWS_FIELD_OWNERSHIP.category, "CONTROLLED_VOCABULARY");
    assert.equal(PUBLIC_NEWS_FIELD_OWNERSHIP.sourceName, "PROTECTED_SOURCE_VALUE");
    assert.equal(PUBLIC_NEWS_FIELD_OWNERSHIP.articleUrl, "PROTECTED_SOURCE_VALUE");
    assert.deepEqual([...PUBLIC_NEWS_MACHINE_CONTENT_PATHS], ["title", "summary"]);
  });

  it("activation lists place public_news under PLP, not protected-excluded", () => {
    assert.equal(LANGUAGE_ACTIVATION_PROTECTED_EXCLUDED_KINDS.length, 0);
    assert.ok(
      (LANGUAGE_ACTIVATION_PLP_OWNED_MEDIA_ENTITY_TYPES as readonly string[]).includes(
        "public_news",
      ),
    );
  });
});
