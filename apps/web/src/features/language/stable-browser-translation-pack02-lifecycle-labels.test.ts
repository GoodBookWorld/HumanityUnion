/**
 * Stable Browser Translation Pack 2 —
 * Ordinary lifecycle stage labels are browser-translation eligible.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = path.resolve(webSrc, "../..");

function readFeatures(rel: string): string {
  return readFileSync(path.join(webSrc, rel), "utf8");
}

function readWeb(rel: string): string {
  return readFileSync(path.join(webRoot, rel), "utf8");
}

const ORDINARY_LIFECYCLE_LABEL_SURFACES = [
  "public-initiative-experience/components/PublicInitiativeLifecycleNav.tsx",
  "initiative-lifecycle-stage-workspace/components/InitiativeLifecycleStageWorkspace.tsx",
  "initiative-lifecycle-stage-workspace/components/InitiativeLifecyclePublicResultPanel.tsx",
  "public-initiative-experience/components/CurrentLifecycleStageBanner.tsx",
  "public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
  "public-initiative-experience/components/PublicExperienceHero.tsx",
  "public-initiative-experience/components/YourParticipationPanel.tsx",
  "public-experience/components/LatestInitiativeCard.tsx",
  "initiative-civic-archive-lifecycle/components/InitiativeCivicArchiveDocumentRenderer.tsx",
] as const;

describe("Stable Browser Translation Pack 2 — ordinary lifecycle labels", () => {
  it("ordinary lifecycle stage-label surfaces are not blanket-wrapped in ProtectedAuthoritativeText", () => {
    for (const rel of ORDINARY_LIFECYCLE_LABEL_SURFACES) {
      const src = readFeatures(rel);
      assert.doesNotMatch(
        src,
        /ProtectedAuthoritativeText/,
        `${rel} must not blanket-protect ordinary lifecycle stage labels`,
      );
      assert.doesNotMatch(
        src,
        /wrapAuthoritativeTermInMessage/,
        `${rel} must not wrap ordinary lifecycle stage tokens as authoritative`,
      );
    }
  });

  it("stage label resolvers remain in place (ordinary readable content)", () => {
    const nav = readFeatures(
      "public-initiative-experience/components/PublicInitiativeLifecycleNav.tsx",
    );
    assert.match(nav, /resolveLifecycleStageDisplayLabel/);

    const banner = readFeatures(
      "public-initiative-experience/components/CurrentLifecycleStageBanner.tsx",
    );
    assert.match(banner, /resolveLifecycleStageDisplayLabel/);

    const workspace = readFeatures(
      "initiative-lifecycle-stage-workspace/components/InitiativeLifecycleStageWorkspace.tsx",
    );
    assert.match(workspace, /resolveLifecycleStageDisplayLabel/);
  });

  it("Brand protection remains translate=no", () => {
    const protect = readFeatures("language/components/ProtectedAuthoritativeText.tsx");
    assert.match(protect, /translate:\s*"no"/);

    const header = readWeb("src/design-system/components/HumanityHeader.tsx");
    assert.match(header, /ProtectedAuthoritativeText/);
    assert.match(header, /translate=["']no["']/);

    const footer = readFeatures("public-experience/components/PublicExperienceFooter.tsx");
    assert.match(footer, /ProtectedAuthoritativeText/);
  });

  it("Legal protection remains", () => {
    const legal = readFeatures("legal/components/LegalPageShell.tsx");
    assert.match(legal, /ProtectedAuthoritativeText/);
  });

  it("Glossary / Controlled Vocabulary authority infrastructure remains", () => {
    const i18n = readFeatures(
      "public-initiative-experience/initiative-experience-i18n.ts",
    );
    assert.match(i18n, /getControlledLifecyclePreferredTerm/);
    assert.match(i18n, /resolveControlledLifecycleLabel|resolvePublicPresentationField/);

    const cache = readFeatures("language/controlled-lifecycle-preferred-terms.ts");
    assert.match(cache, /getControlledLifecyclePreferredTerm|preferredTerm/);

    const protect = readFeatures("language/components/ProtectedAuthoritativeText.tsx");
    assert.match(protect, /export function ProtectedAuthoritativeText/);
    assert.match(protect, /export function wrapAuthoritativeTermInMessage/);
  });

  it("Pack 1 PublicTranslatedFields ordinary reading behavior remains intact", () => {
    const fields = readFeatures("language/components/PublicTranslatedFields.tsx");
    assert.doesNotMatch(fields, /resolveTranslatedContent/);
    assert.doesNotMatch(fields, /setFields\s*\(/);
    assert.match(fields, /data-hu-reading-owner="browser-native"/);
    assert.match(fields, /const fields = fallbackFields/);
  });

  it("no language-specific assumptions in Pack 2 surfaces", () => {
    for (const rel of ORDINARY_LIFECYCLE_LABEL_SURFACES) {
      const src = readFeatures(rel);
      assert.doesNotMatch(
        src,
        /Ukrainian|Arabic|Georgian|Hebrew|["']ka["']|["']he["']/,
        `${rel} must not hardcode language-specific assumptions`,
      );
    }
  });
});
