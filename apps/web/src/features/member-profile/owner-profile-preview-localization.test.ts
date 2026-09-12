/**
 * `/profile` owner-preview: privacy-filtered shape + localized Biography/Skills
 * from the same public member projection `/member/{publicName}` uses.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { PublicMemberProfile } from "@hu/types";

import { mergeOwnerPreviewLocalizedFields } from "./merge-owner-preview-localized-fields.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

describe("/profile owner-preview Biography/Skills localization", () => {
  it("wires locale through preview + anonymous public by-name merge (no locale hardcoding)", () => {
    const preview = readWeb("features/member-profile/components/OwnerProfilePreview.tsx");
    const api = readWeb("features/member-profile/member-profile-api.ts");

    assert.match(preview, /getMyPublicMemberProfilePreview\(locale\)/);
    assert.match(preview, /getPublicMemberProfileByPublicName/);
    assert.match(preview, /credentials:\s*"omit"/);
    assert.match(preview, /mergeOwnerPreviewLocalizedFields/);
    assert.match(api, /X-HU-Presentation-Locale/);
    assert.doesNotMatch(preview, /locale\s*===\s*["'](?:uk|ar|zh-Hant)["']/);
    assert.doesNotMatch(api, /locale\s*===\s*["'](?:uk|ar|zh-Hant)["']/);
  });

  it("arbitrary non-source locale: public CURRENT fields win; privacy-hidden fields stay omitted; absent CURRENT keeps canonical", () => {
    const locale = "xx-Future";
    void locale; // documents Registry-driven contract — merge is locale-agnostic

    const privacyFiltered: PublicMemberProfile = {
      profileId: "profile-owner-preview-1",
      publicName: "owner-preview-public",
      displayName: "Owner Preview",
      biography: "Canonical English biography.",
      skills: ["Skill Alpha", "Skill Beta"],
      // organization intentionally omitted — Privacy hide
      messagingAvailability: "hidden",
    };

    const localizedPublic: PublicMemberProfile = {
      profileId: "profile-owner-preview-1",
      publicName: "owner-preview-public",
      displayName: "Owner Preview",
      biography: "Localized biography for xx-Future.",
      organization: "Should not leak when privacy hid it",
      skills: ["Localized Alpha", "Localized Beta"],
      messagingAvailability: "hidden",
    };

    const merged = mergeOwnerPreviewLocalizedFields({
      privacyFiltered,
      localizedPublic,
    });

    assert.equal(merged.biography, "Localized biography for xx-Future.");
    assert.deepEqual(merged.skills, ["Localized Alpha", "Localized Beta"]);
    assert.equal(merged.organization, undefined);

    const canonicalFallback = mergeOwnerPreviewLocalizedFields({
      privacyFiltered,
      localizedPublic: {
        ...privacyFiltered,
        // no usable CURRENT → public read also returns canonical
        biography: "Canonical English biography.",
        skills: ["Skill Alpha", "Skill Beta"],
      },
    });
    assert.equal(canonicalFallback.biography, "Canonical English biography.");
    assert.deepEqual(canonicalFallback.skills, ["Skill Alpha", "Skill Beta"]);
  });
});
