import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

describe("Pack 04 media URL / Initiative image rendering", () => {
  it("rejects unusable localhost media on staging/production hosts", () => {
    const source = read("features/media-upload/media-url.ts");
    assert.match(source, /isUnusableLocalhostMediaUrl/);
    assert.match(source, /NEXT_PUBLIC_PLATFORM_MODE/);
    assert.match(source, /staging/);
  });

  it("InitiativeImage resets fallback when URL changes and sets referrerPolicy", () => {
    const source = read("features/initiatives/components/InitiativeImage.tsx");
    assert.match(source, /setUseFallback\(!resolvedStillUrl && !isExternalVideo\)/);
    assert.match(source, /referrerPolicy="no-referrer"/);
    assert.match(source, /useEffect/);
  });
});
