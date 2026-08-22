import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assertOptionalStructuredGeography } from "./initiative-geography.validators.js";

describe("Pack 09F1 initiative geography validators", () => {
  it("accepts Canada + CA-BC", () => {
    assert.doesNotThrow(() =>
      assertOptionalStructuredGeography(
        { countrySlug: "CA", regionSlug: "CA-BC" },
        { strictParents: true },
      ),
    );
  });

  it("rejects Canada + US-CA structured region", () => {
    assert.throws(
      () =>
        assertOptionalStructuredGeography(
          { countrySlug: "CA", regionSlug: "US-CA" },
          { strictParents: true },
        ),
      /regionSlug must belong/,
    );
  });

  it("requires region when community is present in strict mode", () => {
    assert.throws(
      () =>
        assertOptionalStructuredGeography(
          { countrySlug: "CA", communitySlug: "16735" },
          { strictParents: true },
        ),
      /regionSlug is required/,
    );
  });

  it("allows legacy free-text community without numeric code enforcement", () => {
    assert.doesNotThrow(() =>
      assertOptionalStructuredGeography(
        {
          countrySlug: "CA",
          regionSlug: "CA-BC",
          communitySlug: "nelson-community-garden",
        },
        { strictParents: true },
      ),
    );
  });

  it("skips parent checks on partial saves without country", () => {
    assert.doesNotThrow(() =>
      assertOptionalStructuredGeography({ communitySlug: "16735" }),
    );
  });
});
