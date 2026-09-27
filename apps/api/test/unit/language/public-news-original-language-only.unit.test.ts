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
  it("title/summary are SOURCE_ORIGINAL; protected fields remain protected", () => {
    assert.equal(PUBLIC_NEWS_FIELD_OWNERSHIP.title, "SOURCE_ORIGINAL");
    assert.equal(PUBLIC_NEWS_FIELD_OWNERSHIP.summary, "SOURCE_ORIGINAL");
    assert.equal(PUBLIC_NEWS_FIELD_OWNERSHIP.category, "CONTROLLED_VOCABULARY");
    assert.equal(PUBLIC_NEWS_FIELD_OWNERSHIP.sourceName, "PROTECTED_SOURCE_VALUE");
    assert.equal(PUBLIC_NEWS_FIELD_OWNERSHIP.articleUrl, "PROTECTED_SOURCE_VALUE");
    assert.deepEqual([...PUBLIC_NEWS_MACHINE_CONTENT_PATHS], []);
  });

  it("activation lists place public_news outside machine PLP owners", () => {
    assert.equal(LANGUAGE_ACTIVATION_PROTECTED_EXCLUDED_KINDS.length, 0);
    assert.equal(
      (LANGUAGE_ACTIVATION_PLP_OWNED_MEDIA_ENTITY_TYPES as readonly string[]).includes(
        "public_news",
      ),
      false,
    );
  });
});
