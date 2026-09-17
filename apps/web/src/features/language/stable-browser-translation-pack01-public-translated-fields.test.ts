/**
 * Stable Browser Translation Pack 1 —
 * PublicTranslatedFields ordinary WEB reading stays browser-native.
 * PWA Pack 01 may cache-only resolve behind the ownership gate only.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { resolveOrdinaryReadingOwner } from "./ordinary-reading-ownership.js";

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
  const persistedHook = readFeatures("language/use-hu-persisted-ordinary-fields.ts");

  it("ordinary WEB reading does not apply CT without hu-persisted ownership", () => {
    assert.equal(
      resolveOrdinaryReadingOwner({
        presentationMode: "browser",
        preferredReadingLanguage: "uk",
        sourceKind: "collaborative_analysis",
      }),
      "browser-native",
    );
    assert.match(fields, /useHuPersistedOrdinaryFields/);
    assert.match(fields, /persisted\.owner === "hu-persisted"/);
    assert.match(persistedHook, /owner !== "hu-persisted"/);
    assert.doesNotMatch(persistedHook, /generateContentTranslation\(/);
  });

  it("CT infrastructure remains available outside ordinary reading presentation", () => {
    const translationApi = readFeatures("language/translation-api.ts");
    assert.match(translationApi, /export async function resolveTranslatedContent/);

    const resolveDisplay = readFeatures("language/resolve-public-content-translation-display.ts");
    assert.match(resolveDisplay, /resolveTranslatedContent/);

    assert.match(translationApi, /\/api\/v1\/translations\/resolve\//);
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
