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
  biography: "MACHINE_CONTENT",
  organization: "PROTECTED_CANONICAL",
  skills: "MACHINE_CONTENT",
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
    assert.ok(machinePaths.includes("biography"));
    assert.ok(machinePaths.includes("skills[0]"));

    const autoValues: Record<string, string> = {};
    for (const node of collectAutoPaths(presentation)) {
      if (isCollectedPathMachineEligible(node.path, PARTICIPANT_PUBLIC_POLICY)) {
        autoValues[node.path] = node.value;
      }
    }
    assert.equal("organization" in autoValues, false);

    const accepted = validateMediaPlpProviderLocalizationValues({
      locale: "uk",
      autoValues,
      translated: {
        biography: "Українська біографія для локалізації.",
        "skills[0]": "Навичка Альфа",
        "skills[1]": "Навичка Бета",
      },
    });
    assert.equal(accepted.ok, true);
  });
});
