/**
 * Regression: identical organization under MACHINE_CONTENT → PATH_STATES 1:1:0:0:1
 * and CONTENT_INTEGRITY_FAILURE. participant_public treats organization as
 * PROTECTED_CANONICAL identity so it is not an integrity subject.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { PlpFieldPolicyMap, PublicPresentationNode } from "@hu/types";
import { protectedIdentity, protectedTechnical } from "@hu/types";

import {
  classifyNewsPathForensics,
  formatNewsPathForensicCompact,
} from "../../../src/modules/language/media-plp-materializer/provider-boundary-forensics.js";
import { validateMediaPlpProviderLocalizationValues } from "../../../src/modules/language/media-plp-materializer/provider-boundary.js";
import {
  collectAutoPaths,
  isCollectedPathMachineEligible,
} from "../../../src/modules/language/published-localized-presentation/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, "../../..");

const PARTICIPANT_PUBLIC_POLICY: PlpFieldPolicyMap = {
  profileId: "PROTECTED_CANONICAL",
  displayName: "PROTECTED_CANONICAL",
  biography: "SOURCE_ORIGINAL",
  organization: "PROTECTED_CANONICAL",
  skills: "SOURCE_ORIGINAL",
};

describe("participant_public organization integrity (PATH_STATES 1:1:0:0:1)", () => {
  it("identical organization as MACHINE path yields 1:1:0:0:1 and fails provider integrity", () => {
    const org = "Humanity Union";
    const forensic = classifyNewsPathForensics({
      path: "organization",
      canonicalSource: org,
      returnedValue: org,
      locale: "uk",
      mappedToExpectedPath: true,
    });
    assert.equal(formatNewsPathForensicCompact(forensic), "organization:1:1:0:0:1");
    assert.equal(forensic.TARGET_LANGUAGE_ACCEPTED, false);
    assert.equal(forensic.INTEGRITY_ACCEPTED, false);

    const rejected = validateMediaPlpProviderLocalizationValues({
      locale: "uk",
      autoValues: {
        biography: "English biography text for localization.",
        organization: org,
        "skills[0]": "Skill Alpha",
      },
      translated: {
        biography: "Українська біографія для локалізації.",
        organization: org,
        "skills[0]": "Навичка Альфа",
      },
    });
    assert.equal(rejected.ok, false);
    assert.equal(rejected.reason, "LOCALIZATION_CONTENT_INTEGRITY_FAILED");
    assert.match(rejected.message ?? "", /CONTENT_INTEGRITY_FAILURE/);
  });

  it("participant_public organization is PROTECTED_CANONICAL and excluded from machine integrity", () => {
    const adapterSrc = readFileSync(
      path.join(
        apiRoot,
        "src/modules/language/published-localized-presentation/universal/adapters/participant-public-adapter.ts",
      ),
      "utf8",
    );
    assert.match(adapterSrc, /organization:\s*"PROTECTED_CANONICAL"/);
    assert.match(adapterSrc, /organization:\s*protectedIdentity/);
    assert.equal(
      isCollectedPathMachineEligible("organization", PARTICIPANT_PUBLIC_POLICY),
      false,
    );

    const presentation: PublicPresentationNode = {
      profileId: protectedTechnical("profile-org-integrity"),
      displayName: protectedIdentity("Vlad"),
      biography: "English biography text for localization.",
      organization: protectedIdentity("Humanity Union"),
      skills: ["Skill Alpha", "Skill Beta"],
    };
    const machinePaths = collectAutoPaths(presentation)
      .filter((n) => isCollectedPathMachineEligible(n.path, PARTICIPANT_PUBLIC_POLICY))
      .map((n) => n.path);
    assert.equal(machinePaths.includes("organization"), false);
    assert.equal(machinePaths.includes("biography"), false);
    assert.equal(machinePaths.includes("skills[0]"), false);
    assert.deepEqual(machinePaths, []);

    const autoValues: Record<string, string> = {};
    for (const node of collectAutoPaths(presentation)) {
      if (isCollectedPathMachineEligible(node.path, PARTICIPANT_PUBLIC_POLICY)) {
        autoValues[node.path] = node.value;
      }
    }
    assert.equal("organization" in autoValues, false);
    assert.equal(Object.keys(autoValues).length, 0);

    // No MACHINE_CONTENT auto paths → provider integrity N/A for this owner.
    assert.match(adapterSrc, /biography:\s*"SOURCE_ORIGINAL"/);
    assert.match(adapterSrc, /skills:\s*"SOURCE_ORIGINAL"/);
  });
});
