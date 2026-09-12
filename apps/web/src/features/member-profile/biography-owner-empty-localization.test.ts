/**
 * `/profile` Biography empty-state must use WEB_UI catalog, not hardcoded English.
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

function messages(locale: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(path.join(webSrc, `features/i18n/messages/${locale}.json`), "utf8"),
  ) as Record<string, unknown>;
}

function participantPublic(locale: string): Record<string, unknown> {
  const root = messages(locale).participantPublic as Record<string, unknown>;
  return root;
}

describe("/profile Biography owner empty-state WEB_UI", () => {
  it("ParticipantProfileSurface uses catalog key; no hardcoded English empty prompt", () => {
    const surface = readWeb(
      "features/member-profile/components/ParticipantProfileSurface.tsx",
    );
    assert.match(surface, /t\.rich\("ownerEmpty\.biography"/);
    assert.match(surface, /editLink:/);
    assert.doesNotMatch(
      surface,
      /Add a biography to introduce yourself to collaborators/,
    );
    assert.doesNotMatch(
      surface.replace(/t\.rich\([\s\S]*?\}/g, ""),
      />Edit Profile</,
    );
    assert.doesNotMatch(surface, /locale\s*===\s*["'](?:uk|ar|zh-Hant)["']/);
  });

  it("ownerEmpty.biography exists for enabled locales and is not English-identical", () => {
    const en = (participantPublic("en").ownerEmpty as Record<string, string>).biography;
    const uk = (participantPublic("uk").ownerEmpty as Record<string, string>).biography;
    const ar = (participantPublic("ar").ownerEmpty as Record<string, string>).biography;
    const zh = (participantPublic("zh-Hant").ownerEmpty as Record<string, string>).biography;

    assert.equal(typeof en, "string");
    assert.equal(typeof uk, "string");
    assert.equal(typeof ar, "string");
    assert.equal(typeof zh, "string");

    assert.match(en!, /<editLink>/);
    assert.match(uk!, /<editLink>/);
    assert.match(ar!, /<editLink>/);
    assert.match(zh!, /<editLink>/);

    assert.notEqual(uk, en);
    assert.notEqual(ar, en);
    assert.notEqual(zh, en);
    assert.match(uk!, /біограф/i);
  });
});
