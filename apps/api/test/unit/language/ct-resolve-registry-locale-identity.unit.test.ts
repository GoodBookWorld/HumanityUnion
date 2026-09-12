/**
 * CT resolve must preserve Registry locale identity (zh-Hant ≠ zh).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, "../../..");

function read(relative: string): string {
  return readFileSync(path.join(apiRoot, relative), "utf8");
}

describe("CT resolve Registry locale identity", () => {
  it("translations/resolve does not collapse zh-Hant via normalizeLanguageCode", () => {
    const routes = read("src/modules/language/language.routes.ts");
    assert.match(routes, /coercePreferredReadingLanguageQuery/);
    assert.match(routes, /Preserve Registry locale identity/);
    assert.doesNotMatch(
      routes,
      /preferredReadingLanguage\s*=\s*req\.query\.language[\s\S]{0,80}normalizeLanguageCode/,
    );
    const display = read("src/modules/language/resolve-translated-display.ts");
    assert.match(display, /normalizeLanguageRegistryLocaleKey/);
    assert.match(display, /Do not use[\s\S]*normalizeLanguageCode/);
  });

  it("warm operator bootstrap avoids language-registry barrel", () => {
    const bootstrap = read(
      "src/infrastructure/mongodb/bootstrap-content-translation-operator-persistence.ts",
    );
    assert.match(
      bootstrap,
      /language-registry\/language-registry\.repository/,
    );
    assert.doesNotMatch(bootstrap, /language-registry\/index/);
    const warmTargets = read(
      "src/modules/language/content-translation-warm-targets.ts",
    );
    assert.match(
      warmTargets,
      /language-registry\/language-registry\.repository/,
    );
    assert.doesNotMatch(warmTargets, /language-registry\/index/);
    const service = read("src/modules/language/content-translation.service.ts");
    assert.doesNotMatch(
      service,
      /import \{ invalidateGlobalSearchIndex \} from/,
    );
    assert.match(service, /invalidateGlobalSearchIndexLazy/);
    assert.match(service, /await import\(\s*["']\.\.\/global-search\/global-search\.index/);
    const registryRuntime = read(
      "src/modules/language/language-registry-runtime.ts",
    );
    assert.match(
      registryRuntime,
      /language-registry\/language-registry\.repository/,
    );
    assert.doesNotMatch(registryRuntime, /language-registry\/index/);
  });

  it("warm discovery skips initiative corpus for blog_post-only kinds", () => {
    const backfill = read(
      "src/modules/language/content-translation-staging-warm-backfill.ts",
    );
    assert.match(backfill, /needsInitiativeWalk/);
    assert.match(
      backfill,
      /allInitiatives = needsInitiativeWalk \? listInitiativesFn\(\) : \[\]/,
    );
  });
});
