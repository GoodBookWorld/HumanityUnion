/**
 * Stable Browser Translation Pack 1 —
 * PublicTranslatedFields ordinary reading does not apply CT post-mount.
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

describe("Stable Browser Translation Pack 1 — PublicTranslatedFields reading path", () => {
  const fields = readFeatures("language/components/PublicTranslatedFields.tsx");

  it("ordinary public reading does not resolve or apply CT into visible fields", () => {
    assert.doesNotMatch(fields, /resolveTranslatedContent/);
    assert.doesNotMatch(fields, /setFields\s*\(/);
    assert.doesNotMatch(fields, /setPresentationMode\(\s*"localized"\s*\)/);
    assert.match(fields, /data-hu-reading-owner="browser-native"/);
    assert.match(fields, /const fields = fallbackFields/);
    assert.match(fields, /presentationMode = "original"/);
  });

  it("CT infrastructure remains available outside ordinary reading presentation", () => {
    const translationApi = readFeatures("language/translation-api.ts");
    assert.match(translationApi, /export async function resolveTranslatedContent/);

    const resolveDisplay = readFeatures("language/resolve-public-content-translation-display.ts");
    assert.match(resolveDisplay, /resolveTranslatedContent/);

    // Warm / Search discovery consumers are API-side; Web still exports the GET helper.
    assert.match(translationApi, /\/api\/v1\/translations\/resolve\//);
  });

  it("no language-specific assumptions in the reading presentation path", () => {
    assert.doesNotMatch(fields, /Ukrainian|Arabic|Georgian|Hebrew|["']ka["']|["']he["']|\buk\b|\bar\b/);
  });

  it("IP public result still supplies presentation fallbackFields (system frames)", () => {
    const ip = readFeatures(
      "initiative-improvement-proposals-stage/components/InitiativeImprovementProposalsPublicResult.tsx",
    );
    assert.match(ip, /buildImprovementProposalPublicPresentationFields/);
    assert.match(ip, /fallbackFields=\{fallbackFields\}/);
    assert.match(ip, /PublicTranslatedFields/);
  });

  it("Brand / Legal / Glossary authority wrappers remain translate=no", () => {
    const protect = readFeatures("language/components/ProtectedAuthoritativeText.tsx");
    assert.match(protect, /translate:\s*"no"/);

    const legal = readFeatures("legal/components/LegalPageShell.tsx");
    assert.match(legal, /ProtectedAuthoritativeText/);

    const header = readWeb("src/design-system/components/HumanityHeader.tsx");
    assert.match(header, /translate=["']no["']/);
  });
});
