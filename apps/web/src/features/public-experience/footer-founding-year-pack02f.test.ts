/**
 * Pack 02F staging hotfix — public footer founding-year copyright.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { FOOTER_COPYRIGHT } from "../public-experience/constants";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("Pack 02F staging hotfix — footer founding year", () => {
  it("footer renders © 2024 founding year, not © 2026", () => {
    assert.equal(FOOTER_COPYRIGHT, "© 2024 Humanity Union. All rights reserved.");
    assert.match(FOOTER_COPYRIGHT, /© 2024/);
    assert.doesNotMatch(FOOTER_COPYRIGHT, /© 2026/);

    const constants = readFileSync(
      path.join(webSrc, "features/public-experience/constants.ts"),
      "utf8",
    );
    assert.match(constants, /FOOTER_COPYRIGHT\s*=\s*"© 2024 Humanity Union/);
    assert.doesNotMatch(constants, /© 2026 Humanity Union/);

    const footer = readFileSync(
      path.join(webSrc, "features/public-experience/components/PublicExperienceFooter.tsx"),
      "utf8",
    );
    assert.match(footer, /FOOTER_COPYRIGHT/);
    assert.doesNotMatch(footer, /new Date\(\)|getFullYear/);
  });
});
