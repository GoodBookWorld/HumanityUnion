/**
 * Preferences responsive overflow — assistant launcher must not force page width.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readFeatures(rel: string): string {
  return readFileSync(path.join(webSrc, rel), "utf8");
}

describe("Preferences responsive overflow", () => {
  it("Preferences workspace allows assistant launcher labels to wrap within card width", () => {
    const css = readFeatures("preferences/components/preferences-workspace.css");
    assert.match(css, /\.preferences-workspace \.hu-assistant-open-button/);
    assert.match(css, /max-width:\s*100%/);
    assert.match(
      css,
      /\.preferences-workspace \.hu-assistant-open-button__label[\s\S]*white-space:\s*normal/,
    );
    assert.match(css, /max-width:\s*min\(28rem,\s*100%\)/);
  });

  it("Preferred Reading help text remains the concise browser-match guidance", () => {
    const en = JSON.parse(
      readFileSync(
        path.join(webSrc, "i18n/messages/en.json"),
        "utf8",
      ),
    ) as { preferences: { language: { preferredReadingHelp: string } } };
    assert.equal(
      en.preferences.language.preferredReadingHelp,
      "Select the language you prefer to read the platform in. For the best experience, match it with your browser’s translation language.",
    );
  });
});
