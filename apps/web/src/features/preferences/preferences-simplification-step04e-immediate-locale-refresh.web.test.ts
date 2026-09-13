/**
 * Localization Simplification Step 04E —
 * Preferred Reading Language save applies document locale via one controlled refresh.
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
  it("successful save writes hu_lang, updates sync latch, then refreshes", () => {
    const src = readWeb("src/features/preferences/components/PreferencesWorkspace.tsx");
    const handleSubmit = src.slice(src.indexOf("async function handleSubmit"));

    assert.match(handleSubmit, /updateMyPreferences/);
    assert.match(handleSubmit, /setPreferences\(updated\)/);
    assert.match(
      handleSubmit,
      /writeHuLangCookieViaWebRoute\(\s*updated\.experiencePreferences\.interfaceLanguage/,
    );
    assert.match(
      handleSubmit,
      /markInterfaceLanguageCookieSynced\(\s*updated\.experiencePreferences\.interfaceLanguage/,
    );
    assert.match(handleSubmit, /router\.refresh\(\)/);

    const cookieIdx = handleSubmit.search(/await writeHuLangCookieViaWebRoute/);
    const latchIdx = handleSubmit.search(/markInterfaceLanguageCookieSynced/);
    const refreshIdx = handleSubmit.search(/router\.refresh\(\)/);
    assert.ok(cookieIdx >= 0 && latchIdx >= 0 && refreshIdx >= 0);
    assert.ok(cookieIdx < latchIdx, "cookie write before sync latch");
    assert.ok(latchIdx < refreshIdx, "sync latch before router.refresh");
  });

  it("refresh is not called before cookie write", () => {
    const src = readWeb("src/features/preferences/components/PreferencesWorkspace.tsx");
    const handleSubmit = src.slice(src.indexOf("async function handleSubmit"));
    const cookieIdx = handleSubmit.search(/await writeHuLangCookieViaWebRoute/);
    const refreshIdx = handleSubmit.search(/router\.refresh\(\)/);
    assert.ok(cookieIdx < refreshIdx);
  });

  it("failed save/cookie path does not introduce an unconditional refresh outside success block", () => {
    const src = readWeb("src/features/preferences/components/PreferencesWorkspace.tsx");
    const handleSubmit = src.slice(src.indexOf("async function handleSubmit"));
    const catchIdx = handleSubmit.indexOf("} catch (saveError)");
    assert.ok(catchIdx > 0);
    const successBlock = handleSubmit.slice(0, catchIdx);
    const catchBlock = handleSubmit.slice(catchIdx);

    assert.match(successBlock, /router\.refresh\(\)/);
    assert.doesNotMatch(catchBlock, /router\.refresh/);
    assert.equal((handleSubmit.match(/router\.refresh\(\)/g) || []).length, 1);
  });

  it("does not introduce route replacement or pathname navigation on Preferences save", () => {
    const src = readWeb("src/features/preferences/components/PreferencesWorkspace.tsx");
    const handleSubmit = src.slice(src.indexOf("async function handleSubmit"));

    assert.match(src, /useRouter/);
    assert.doesNotMatch(handleSubmit, /router\.replace/);
    assert.doesNotMatch(handleSubmit, /router\.push/);
    assert.doesNotMatch(handleSubmit, /runLocaleSwitchNavigation/);
    assert.doesNotMatch(handleSubmit, /window\.location/);
    assert.doesNotMatch(handleSubmit, /location\.reload/);
  });
});
