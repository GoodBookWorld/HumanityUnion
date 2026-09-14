/**
 * `/profile` owner-preview: localized Biography/Skills come only from
 * authenticated `/me/public-preview` (presentation locale). No anonymous
 * by-name merge — that 403s for default members_only profiles.
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

describe("/profile owner-preview Biography/Skills localization", () => {
  it("uses authenticated public-preview + locale only (no anonymous by-name merge)", () => {
    const preview = readWeb("features/member-profile/components/OwnerProfilePreview.tsx");
    const api = readWeb("features/member-profile/member-profile-api.ts");

    assert.match(preview, /getMyPublicMemberProfilePreview\(locale\)/);
    assert.doesNotMatch(preview, /getPublicMemberProfileByPublicName/);
    assert.doesNotMatch(preview, /credentials:\s*"omit"/);
    assert.doesNotMatch(preview, /mergeOwnerPreviewLocalizedFields/);
    assert.doesNotMatch(
      preview,
      /merge-owner-preview-localized-fields/,
    );

    assert.match(api, /\/api\/v1\/member-profile\/me\/public-preview/);
    assert.match(api, /\?locale=\$\{encodeURIComponent\(trimmed\)\}/);
    assert.match(api, /X-HU-Presentation-Locale/);
    assert.doesNotMatch(preview, /locale\s*===\s*["'](?:uk|ar|zh-Hant)["']/);
    assert.doesNotMatch(api, /locale\s*===\s*["'](?:uk|ar|zh-Hant)["']/);
  });

  it("does not keep a frontend merge helper for owner-preview localization", () => {
    let missing = false;
    try {
      readWeb("features/member-profile/merge-owner-preview-localized-fields.ts");
    } catch {
      missing = true;
    }
    assert.equal(missing, true);
  });
});
