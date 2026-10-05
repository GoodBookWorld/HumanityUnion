/**
 * F.3.37 — the Initiative page renders before Related Initiatives load.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const featuresRoot = path.resolve(here, "..");

function readFeatures(rel: string): string {
  return readFileSync(path.join(featuresRoot, rel), "utf8");
}

describe("F.3.37 deferred related initiatives", () => {
  const loader = readFeatures(
    "public-initiative-experience/components/CanonicalInitiativeExperienceLoader.tsx",
  );
  const page = readFeatures(
    "public-initiative-experience/components/PublicInitiativeExperiencePage.tsx",
  );
  const sidebar = readFeatures(
    "public-initiative-experience/components/PublicExperienceSidebar.tsx",
  );
  const deferred = readFeatures(
    "community-intelligence/components/DeferredRelatedInitiatives.tsx",
  );
  const widget = readFeatures(
    "community-intelligence/components/RelatedInitiativesWidget.tsx",
  );
  const relatedApi = readFeatures("community-intelligence/api.ts");

  it("A/F. the experience loader does not wait for related discovery", () => {
    assert.match(loader, /getPublicInitiativeExperience\(initiativeId\)/);
    assert.match(loader, /getInitiativeOwnerAccess\(initiativeId\)/);
    assert.equal(loader.includes("fetchRelatedInitiatives"), false);
    assert.equal(loader.includes("findRelatedInitiativesForInitiative"), false);
    assert.equal(page.includes("relatedInitiatives="), false);
  });

  it("C/D. related cards load once from the existing public endpoint", () => {
    assert.match(sidebar, /<DeferredRelatedInitiatives initiativeId=\{initiativeId\} \/>/);
    assert.equal(sidebar.includes("RelatedInitiativesWidget"), false);
    assert.match(deferred, /fetchRelatedInitiatives\(initiativeId\)/);
    assert.equal((deferred.match(/fetchRelatedInitiatives\(/g) ?? []).length, 1);
    assert.match(
      relatedApi,
      /\/api\/v1\/public\/community-intelligence\/initiatives\/\$\{encodeURIComponent\(initiativeId\)\}\/related/,
    );
    assert.equal(deferred.includes("setInterval"), false);
    assert.equal(deferred.includes("setTimeout"), false);
  });

  it("F. a related fetch failure stays inside the section", () => {
    assert.match(deferred, /\.catch\(\(\) => \{[\s\S]*setItems\(\[\]\)/);
    assert.equal(deferred.includes("setUnavailable"), false);
    assert.equal(loader.includes("fetchRelatedInitiatives"), false);
  });

  it("G/H. related presentation stays on ordinary reading without locale branches", () => {
    assert.match(widget, /useCivicInitiativeLocalizedTitle\(/);
    assert.equal(deferred.includes("generateContentTranslation"), false);
    assert.equal(widget.includes("generateContentTranslation"), false);
    assert.doesNotMatch(deferred, /locale\s*===/);
    assert.doesNotMatch(widget, /locale\s*===/);
    assert.doesNotMatch(deferred, /=== ["'](?:he|uk|ar|zh-Hant)["']/);
  });
});
