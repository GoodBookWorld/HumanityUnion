/**
 * Localization Simplification Step 04E —
 * Superseded by Step 06A.3 shared applyPresentationLocale path.
 * Kept as a thin continuity check that Preferences still applies locale after save.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readWeb(rel: string): string {
  return readFileSync(path.join(webRoot, rel), "utf8");
}

describe("Localization Simplification Step 04E — immediate locale refresh after prefs save", () => {
  it("successful save still applies presentation locale after prefs persist", () => {
    const src = readWeb("src/features/preferences/components/PreferencesWorkspace.tsx");
    const handleSubmit = src.slice(src.indexOf("async function handleSubmit"));

    assert.match(handleSubmit, /updateMyPreferences/);
    assert.match(handleSubmit, /setPreferences\(updated\)/);
    assert.match(handleSubmit, /applyPresentationLocale/);
    assert.match(handleSubmit, /forceSamePathRecompose:\s*true/);

    const persistIdx = handleSubmit.search(/await updateMyPreferences/);
    const applyIdx = handleSubmit.search(/await applyPresentationLocale/);
    assert.ok(persistIdx >= 0 && applyIdx >= 0);
    assert.ok(persistIdx < applyIdx, "prefs persist before presentation apply");
  });

  it("failed save/cookie path does not apply locale outside success block", () => {
    const src = readWeb("src/features/preferences/components/PreferencesWorkspace.tsx");
    const handleSubmit = src.slice(src.indexOf("async function handleSubmit"));
    const catchIdx = handleSubmit.indexOf("} catch (saveError)");
    assert.ok(catchIdx > 0);
    const successBlock = handleSubmit.slice(0, catchIdx);
    const catchBlock = handleSubmit.slice(catchIdx);

    assert.match(successBlock, /applyPresentationLocale/);
    assert.doesNotMatch(catchBlock, /applyPresentationLocale/);
  });

  it("does not hard-reload the window on Preferences save", () => {
    const src = readWeb("src/features/preferences/components/PreferencesWorkspace.tsx");
    const handleSubmit = src.slice(src.indexOf("async function handleSubmit"));

    assert.doesNotMatch(handleSubmit, /window\.location/);
    assert.doesNotMatch(handleSubmit, /location\.reload/);
  });
});
