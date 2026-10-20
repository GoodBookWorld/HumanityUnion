/**
 * Profile → Privacy and Preferences expose the same three visibility choices.
 * Labels come from the bundled English catalog. The option list is not
 * filtered by platform mode.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function readNested(messages: Record<string, unknown>, dottedPath: string): string {
  let cursor: unknown = messages;
  for (const part of dottedPath.split(".")) {
    assert.ok(cursor && typeof cursor === "object" && !Array.isArray(cursor), dottedPath);
    cursor = (cursor as Record<string, unknown>)[part];
  }
  if (typeof cursor !== "string") {
    assert.fail(`${dottedPath} is not a string`);
  }
  return cursor;
}

describe("Profile privacy visibility options", () => {
  it("offers Public, Members only, and Private in Profile and Preferences", () => {
    const profile = readWeb("features/member-profile/components/MemberProfileWorkspace.tsx");
    const preferences = readWeb("features/preferences/components/PreferencesWorkspace.tsx");
    const messages = JSON.parse(readWeb("features/i18n/messages/en.json")) as Record<string, unknown>;

    assert.match(profile, /VISIBILITY_OPTION_KEYS = \["public", "members_only", "private"\]/);
    assert.match(profile, /t\(`visibility\.\$\{value\}`\)/);
    assert.match(preferences, /VISIBILITY_OPTIONS: MemberProfileVisibility\[] = \["public", "members_only", "private"\]/);
    assert.match(preferences, /t\(`visibilityOptions\.\$\{option\}`\)/);

    assert.equal(readNested(messages, "memberProfile.visibility.public"), "Public");
    assert.equal(readNested(messages, "memberProfile.visibility.members_only"), "Members only");
    assert.equal(readNested(messages, "memberProfile.visibility.private"), "Private");
    assert.equal(readNested(messages, "preferences.visibilityOptions.public"), "Public");
    assert.equal(readNested(messages, "preferences.visibilityOptions.members_only"), "Members only");
    assert.equal(readNested(messages, "preferences.visibilityOptions.private"), "Private");
  });
});
