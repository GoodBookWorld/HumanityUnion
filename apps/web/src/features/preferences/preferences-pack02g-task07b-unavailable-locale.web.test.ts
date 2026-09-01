/**
 * Pack 02G Task 07B — Preferences UI must not impersonate English for an
 * unavailable persisted reading locale.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readWeb(rel: string): string {
  return readFileSync(path.join(webRoot, rel), "utf8");
}

describe("Production Completion Pack 02G Task 07B — Preferences unavailable reading locale", () => {
  it("F. does not silently display English when persisted reading locale is absent from options", () => {
    const src = readWeb(
      "src/features/preferences/components/PreferencesWorkspace.tsx",
    );

    assert.match(src, /temporarily unavailable in catalog/);
    assert.match(src, /Saved reading language/);
    assert.doesNotMatch(
      src,
      /readingLanguages\[0\] \?\? "en"[\s\S]{0,120}languageOptions\[0\]\?\.code \?\? "en"/,
    );
  });
});
