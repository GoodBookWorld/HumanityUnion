/**
 * HU-LC-05C.4C.7F.7V.1 — Missing-only WEB_UI catalog builder (mock provider only).
 */
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  isOrdinaryWebUiRequiredPath,
  isPublicReaderWebUiRequiredPath,
  type TranslationProviderId,
  type WebUiMessageTree,
} from "@hu/types";

import type {
  TranslationProviderRequest,
  TranslationProviderResult,
} from "../../../src/modules/language/translation-provider.js";
import { TranslationProviderError } from "../../../src/modules/language/translation.config.js";
import {
  computeWebUiMissingOnlyPlan,
  parseWebUiPublishedPackSnapshot,
  runWebUiMissingOnlyCatalogBuilder,
  selectWebUiMissingOnlyPilotPaths,
  WebUiMissingOnlyCatalogError,
} from "../../../src/modules/web-ui-message-packs/web-ui-missing-only-catalog-builder.js";
import {
  collectStringPaths,
  loadBundledEnglishWebUiMessagePack,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.validate.js";
import { unflattenWebUiMessageMap } from "../../../src/modules/web-ui-message-packs/web-ui-draft-builder.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const LIVE_ES = "/tmp/hu-7u-pack-es.json";
const LIVE_HE = "/tmp/hu-7u-pack-he.json";

function tempRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "web-ui-missing-only-"));
}

function readLeaf(messages: WebUiMessageTree, dottedPath: string): string | undefined {
  let current: unknown = messages;
  for (const segment of dottedPath.split(".")) {
    if (current == null || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === "string" ? current : undefined;
}

function flatten(messages: WebUiMessageTree): Map<string, string> {
  const out = new Map<string, string>();
  for (const pathKey of collectStringPaths(messages as never)) {
    const value = readLeaf(messages, pathKey);
    if (typeof value === "string") {
      out.set(pathKey, value);
    }
  }
  return out;
}

/** Tiny English foundation covering ordinary + non-ordinary + ICU + rich tags. */
const FIXTURE_EN: WebUiMessageTree = {
  common: {
    save: "Save",
    cancel: "Cancel",
  },
  navigation: {
    home: "Home",
  },
  initiativeExperience: {
    viewer: {
      title: "Petition",
      countLabel: "{count, plural, =0 {No signatures} one {# signature} other {# signatures}}",
      help: "Open <link>help</link> for {siteName}.",
    },
  },
  workspace: {
    drafts: {
      heading: "Drafts",
    },
  },
  seo: {
    title: "SEO Title",
  },
};

const FIXTURE_PATHS = collectStringPaths(FIXTURE_EN as never).sort();

function existingFromEn(omit: readonly string[]): WebUiMessageTree {
  const flat: Record<string, string> = {};
  for (const pathKey of FIXTURE_PATHS) {
    if (omit.includes(pathKey)) {
      continue;
    }
    flat[pathKey] = `EXISTING::${pathKey}`;
  }
  return unflattenWebUiMessageMap(flat);
}

function translateOutsideSentinels(value: string): string {
  return value
    .split(/(⟦w\d+⟧)/)
    .map((part) =>
      part.startsWith("⟦") ? part : part.replace(/[A-Za-z][A-Za-z' ]*/g, (words) => `ט${words}`),
    )
    .join("");
}

function translatingEcho(request: TranslationProviderRequest): TranslationProviderResult {
  const parsed = JSON.parse(request.text) as Record<string, unknown>;
  return {
    translatedText: JSON.stringify(
      Object.fromEntries(
        Object.entries(parsed).map(([key, value]) => {
          if (typeof value === "string") {
            return [key, translateOutsideSentinels(value)];
          }
          if (Array.isArray(value)) {
            return [
              key,
              value.map((span) =>
                typeof span === "string" ? translateOutsideSentinels(span) : span,
              ),
            ];
          }
          return [key, value];
        }),
      ),
    ),
    providerId: "deterministic" as TranslationProviderId,
    isPlaceholder: false,
  };
}

const executeEnv = { TRANSLATION_PROVIDER: "gemini" };

function isPlainLike(value: string): boolean {
  return value.trim().length > 0 && !value.includes("{") && !/<[A-Za-z]/.test(value);
}

function isPetitionRelatedLike(pathKey: string): boolean {
  return (
    pathKey.startsWith("initiativeExperience.") ||
    pathKey.includes(".petition") ||
    pathKey.includes("Petition")
  );
}

describe("WEB_UI missing-only catalog builder", () => {
  it("parses API envelopes and raw trees with locale identity checks", () => {
    const envelope = parseWebUiPublishedPackSnapshot(
      {
        success: true,
        data: {
          locale: "ES",
          revision: 2,
          messages: { common: { save: "Guardar" } },
        },
      },
      "es",
    );
    assert.equal(envelope.locale, "es");
    assert.equal(envelope.revision, 2);
    assert.equal((envelope.messages as { common: { save: string } }).common.save, "Guardar");

    const raw = parseWebUiPublishedPackSnapshot({ common: { save: "X" } }, "he");
    assert.equal(raw.locale, "he");
    assert.equal(raw.revision, null);

    assert.throws(
      () =>
        parseWebUiPublishedPackSnapshot(
          { locale: "fr", revision: 1, messages: { common: { save: "x" } } },
          "es",
        ),
      /does not match/,
    );
  });

  it("es missing-only plan matches live Staging shape (4126 / 1436)", function () {
    if (!existsSync(LIVE_ES)) {
      this.skip();
      return;
    }
    const pack = parseWebUiPublishedPackSnapshot(
      JSON.parse(readFileSync(LIVE_ES, "utf8")),
      "es",
    );
    const english = loadBundledEnglishWebUiMessagePack();
    const englishPaths = collectStringPaths(english as never).sort();
    const englishFlat = Object.fromEntries(
      englishPaths.map((pathKey) => [pathKey, readLeaf(english, pathKey) ?? ""]),
    );
    const plan = computeWebUiMissingOnlyPlan({
      locale: "es",
      englishName: "Spanish",
      nativeName: "Español",
      textDirection: "ltr",
      publishedRevision: pack.revision,
      existingMessages: pack.messages,
      englishFlat,
      englishPaths,
      englishSourceHash: "test-hash",
    });
    assert.equal(pack.revision, 2);
    assert.equal(plan.existingKeyCount, 4126);
    assert.equal(plan.missingPaths.length, 1436);
    assert.equal(plan.englishKeyCount, 5562);
    assert.equal(plan.missingOrdinaryCount + plan.missingNonOrdinaryCount, 1436);
    assert.ok(plan.missingOrdinaryCount > 0);
    assert.ok(plan.missingNonOrdinaryCount > 0);
    assert.ok(
      plan.missingPaths.every((pathKey) => englishPaths.includes(pathKey)),
    );
    assert.ok(
      plan.missingPaths.some(
        (pathKey) => !isOrdinaryWebUiRequiredPath(pathKey, isPublicReaderWebUiRequiredPath),
      ),
    );
  });

  it("he missing-only plan matches live Staging shape and RTL metadata", function () {
    if (!existsSync(LIVE_HE)) {
      this.skip();
      return;
    }
    const pack = parseWebUiPublishedPackSnapshot(
      JSON.parse(readFileSync(LIVE_HE, "utf8")),
      "he",
    );
    const english = loadBundledEnglishWebUiMessagePack();
    const englishPaths = collectStringPaths(english as never).sort();
    const englishFlat = Object.fromEntries(
      englishPaths.map((pathKey) => [pathKey, readLeaf(english, pathKey) ?? ""]),
    );
    const plan = computeWebUiMissingOnlyPlan({
      locale: "he",
      englishName: "Hebrew",
      nativeName: "עברית",
      textDirection: "rtl",
      publishedRevision: pack.revision,
      existingMessages: pack.messages,
      englishFlat,
      englishPaths,
      englishSourceHash: "test-hash",
    });
    assert.equal(pack.revision, 3);
    assert.equal(plan.existingKeyCount, 4126);
    assert.equal(plan.missingPaths.length, 1436);
    assert.equal(plan.textDirection, "rtl");
    assert.equal(plan.missingOrdinaryCount + plan.missingNonOrdinaryCount, 1436);
  });

  it("dry-run plans only missing paths, writes plan, makes zero provider calls", async () => {
    const outRoot = tempRoot();
    const omit = [
      "initiativeExperience.viewer.countLabel",
      "workspace.drafts.heading",
      "seo.title",
    ];
    let calls = 0;
    const result = await runWebUiMissingOnlyCatalogBuilder({
      locale: "eo",
      englishName: "Esperanto",
      nativeName: "Esperanto",
      textDirection: "ltr",
      publishedRevision: 2,
      existingPack: {
        locale: "eo",
        revision: 2,
        messages: existingFromEn(omit),
      },
      loadEnglishFoundation: () => FIXTURE_EN,
      outRoot,
      log: () => undefined,
      translator: async () => {
        calls += 1;
        throw new Error("provider called");
      },
    });
    assert.equal(result.mode, "dry-run");
    assert.equal(result.providerCalls, 0);
    assert.equal(calls, 0);
    assert.equal(result.missingKeyCount, 3);
    assert.equal(result.existingKeyCount, FIXTURE_PATHS.length - 3);
    assert.equal(result.finalKeyCount, FIXTURE_PATHS.length);
    assert.equal(result.artifactPath, null);
    assert.ok(result.planPath && existsSync(result.planPath));
    const planJson = JSON.parse(readFileSync(result.planPath!, "utf8")) as {
      missingPaths: string[];
      missingOrdinaryCount: number;
      missingNonOrdinaryCount: number;
      estimatedProviderCallsMin: number;
    };
    assert.deepEqual(planJson.missingPaths.sort(), omit.sort());
    assert.ok(planJson.missingOrdinaryCount >= 1);
    assert.ok(planJson.missingNonOrdinaryCount >= 1);
    assert.ok(planJson.estimatedProviderCallsMin >= 1);
    assert.equal(existsSync(path.join(outRoot, "web-ui-eo-missing-only-catalog.json")), false);
    rmSync(outRoot, { recursive: true, force: true });
  });

  it("execute preserves every existing leaf and translates only missing paths", async () => {
    const outRoot = tempRoot();
    const omit = [
      "initiativeExperience.viewer.countLabel",
      "initiativeExperience.viewer.help",
      "workspace.drafts.heading",
      "seo.title",
    ];
    const existing = existingFromEn(omit);
    const existingFlat = flatten(existing);
    const requested: string[] = [];
    const result = await runWebUiMissingOnlyCatalogBuilder({
      locale: "es",
      englishName: "Spanish",
      nativeName: "Español",
      textDirection: "ltr",
      publishedRevision: 2,
      existingPack: { locale: "es", revision: 2, messages: existing },
      loadEnglishFoundation: () => FIXTURE_EN,
      execute: true,
      env: executeEnv,
      outRoot,
      retryDelayMs: 0,
      log: () => undefined,
      translator: async (request) => {
        const payload = JSON.parse(request.text) as Record<string, unknown>;
        requested.push(...Object.keys(payload));
        assert.equal(request.targetLanguage, "es");
        return translatingEcho(request);
      },
    });
    assert.equal(result.mode, "execute");
    assert.equal(result.preservedExact, true);
    assert.equal(result.missingKeyCount, omit.length);
    assert.equal(result.finalKeyCount, FIXTURE_PATHS.length);
    assert.ok(result.artifactPath && existsSync(result.artifactPath));
    assert.deepEqual([...new Set(requested)].sort(), [...omit].sort());

    const artifact = JSON.parse(readFileSync(result.artifactPath!, "utf8")) as {
      status: string;
      messages: WebUiMessageTree;
      textDirection: string;
    };
    assert.equal(artifact.status, "catalog-candidate");
    assert.equal(artifact.textDirection, "ltr");
    for (const [pathKey, value] of existingFlat) {
      assert.equal(readLeaf(artifact.messages, pathKey), value, pathKey);
    }
    for (const pathKey of omit) {
      const value = readLeaf(artifact.messages, pathKey);
      assert.ok(typeof value === "string" && value.length > 0, pathKey);
      assert.notEqual(value, readLeaf(FIXTURE_EN, pathKey), `no English filler at ${pathKey}`);
      assert.notEqual(value, `EXISTING::${pathKey}`);
    }
    // ICU plural + rich tags retained structurally
    const plural = readLeaf(artifact.messages, "initiativeExperience.viewer.countLabel")!;
    assert.match(plural, /\{count,\s*plural/);
    const help = readLeaf(artifact.messages, "initiativeExperience.viewer.help")!;
    assert.match(help, /<link>/);
    assert.match(help, /\{siteName\}/);
    rmSync(outRoot, { recursive: true, force: true });
  });

  it("handles Hebrew RTL metadata and refuses English filler on missing keys", async () => {
    const outRoot = tempRoot();
    const omit = ["workspace.drafts.heading", "seo.title"];
    const result = await runWebUiMissingOnlyCatalogBuilder({
      locale: "he",
      englishName: "Hebrew",
      nativeName: "עברית",
      textDirection: "rtl",
      publishedRevision: 3,
      existingPack: {
        locale: "he",
        revision: 3,
        messages: existingFromEn(omit),
      },
      loadEnglishFoundation: () => FIXTURE_EN,
      execute: true,
      env: executeEnv,
      outRoot,
      retryDelayMs: 0,
      log: () => undefined,
      translator: translatingEcho,
    });
    assert.equal(result.textDirection, "rtl");
    const artifact = JSON.parse(readFileSync(result.artifactPath!, "utf8")) as {
      textDirection: string;
      nativeName: string;
      messages: WebUiMessageTree;
    };
    assert.equal(artifact.textDirection, "rtl");
    assert.equal(artifact.nativeName, "עברית");
    assert.notEqual(readLeaf(artifact.messages, "seo.title"), "SEO Title");
    rmSync(outRoot, { recursive: true, force: true });
  });

  it("refuses execute without gemini and refuses read-only diagnostic", async () => {
    const outRoot = tempRoot();
    let calls = 0;
    const translator = async () => {
      calls += 1;
      return translatingEcho({
        sourceLanguage: "en",
        targetLanguage: "es" as never,
        text: "{}",
        contentType: "structured_json",
        safetyCleared: true,
      });
    };
    // Explicit non-gemini provider — do not use env:{} (falls through to ambient process.env).
    await assert.rejects(
      () =>
        runWebUiMissingOnlyCatalogBuilder({
          locale: "es",
          englishName: "Spanish",
          nativeName: "Español",
          textDirection: "ltr",
          publishedRevision: 1,
          existingPack: {
            locale: "es",
            revision: 1,
            messages: existingFromEn(["seo.title"]),
          },
          loadEnglishFoundation: () => FIXTURE_EN,
          execute: true,
          env: { TRANSLATION_PROVIDER: "" },
          outRoot,
          log: () => undefined,
          translator,
        }),
      /TRANSLATION_PROVIDER=gemini/,
    );
    await assert.rejects(
      () =>
        runWebUiMissingOnlyCatalogBuilder({
          locale: "es",
          englishName: "Spanish",
          nativeName: "Español",
          textDirection: "ltr",
          publishedRevision: 1,
          existingPack: {
            locale: "es",
            revision: 1,
            messages: existingFromEn(["seo.title"]),
          },
          loadEnglishFoundation: () => FIXTURE_EN,
          execute: true,
          env: { TRANSLATION_PROVIDER: "gemini", HU_READ_ONLY_DIAGNOSTIC: "1" },
          outRoot,
          log: () => undefined,
          translator,
        }),
      /read-only diagnostic/,
    );
    assert.equal(calls, 0);
    rmSync(outRoot, { recursive: true, force: true });
  });

  it("detects English foundation drift and published revision drift on resume", async () => {
    const outRoot = tempRoot();
    const omit = ["seo.title"];
    await runWebUiMissingOnlyCatalogBuilder({
      locale: "fr",
      englishName: "French",
      nativeName: "Français",
      textDirection: "ltr",
      publishedRevision: 4,
      existingPack: {
        locale: "fr",
        revision: 4,
        messages: existingFromEn(omit),
      },
      loadEnglishFoundation: () => FIXTURE_EN,
      execute: true,
      env: executeEnv,
      outRoot,
      retryDelayMs: 0,
      log: () => undefined,
      translator: translatingEcho,
    });

    await assert.rejects(
      () =>
        runWebUiMissingOnlyCatalogBuilder({
          locale: "fr",
          englishName: "French",
          nativeName: "Français",
          textDirection: "ltr",
          publishedRevision: 5,
          existingPack: {
            locale: "fr",
            revision: 5,
            messages: existingFromEn(omit),
          },
          loadEnglishFoundation: () => FIXTURE_EN,
          execute: true,
          env: executeEnv,
          outRoot,
          retryDelayMs: 0,
          log: () => undefined,
          translator: translatingEcho,
        }),
      /Published revision drift/,
    );

    const driftedEn: WebUiMessageTree = {
      ...FIXTURE_EN,
      seo: { title: "SEO Title changed" },
    };
    await assert.rejects(
      () =>
        runWebUiMissingOnlyCatalogBuilder({
          locale: "fr",
          englishName: "French",
          nativeName: "Français",
          textDirection: "ltr",
          publishedRevision: 4,
          existingPack: {
            locale: "fr",
            revision: 4,
            messages: existingFromEn(omit),
          },
          loadEnglishFoundation: () => driftedEn,
          execute: true,
          env: executeEnv,
          outRoot,
          retryDelayMs: 0,
          log: () => undefined,
          translator: translatingEcho,
        }),
      /English foundation drift/,
    );
    rmSync(outRoot, { recursive: true, force: true });
  });

  it("records partial provider failure and resumes remaining batches", async () => {
    const outRoot = tempRoot();
    const omit = [
      "common.save",
      "navigation.home",
      "workspace.drafts.heading",
      "seo.title",
    ];
    let workspaceFailures = 0;
    let calls = 0;
    await assert.rejects(
      () =>
        runWebUiMissingOnlyCatalogBuilder({
          locale: "uk",
          englishName: "Ukrainian",
          nativeName: "Українська",
          textDirection: "ltr",
          publishedRevision: 1,
          existingPack: {
            locale: "uk",
            revision: 1,
            messages: existingFromEn(omit),
          },
          loadEnglishFoundation: () => FIXTURE_EN,
          execute: true,
          env: executeEnv,
          outRoot,
          retryDelayMs: 0,
          log: () => undefined,
          translator: async (request) => {
            calls += 1;
            const payload = JSON.parse(request.text) as Record<string, unknown>;
            const keys = Object.keys(payload);
            if (keys.some((key) => key.startsWith("workspace.")) && workspaceFailures < 2) {
              workspaceFailures += 1;
              throw new TranslationProviderError("unavailable", "temporary");
            }
            return translatingEcho(request);
          },
        }),
      WebUiMissingOnlyCatalogError,
    );
    assert.ok(calls >= 1);
    assert.equal(existsSync(path.join(outRoot, "web-ui-uk-missing-only-catalog.json")), false);

    const resumed = await runWebUiMissingOnlyCatalogBuilder({
      locale: "uk",
      englishName: "Ukrainian",
      nativeName: "Українська",
      textDirection: "ltr",
      publishedRevision: 1,
      existingPack: {
        locale: "uk",
        revision: 1,
        messages: existingFromEn(omit),
      },
      loadEnglishFoundation: () => FIXTURE_EN,
      execute: true,
      env: executeEnv,
      outRoot,
      retryDelayMs: 0,
      log: () => undefined,
      translator: translatingEcho,
    });
    assert.equal(resumed.mode, "execute");
    assert.equal(resumed.finalKeyCount, FIXTURE_PATHS.length);
    assert.ok(resumed.artifactPath && existsSync(resumed.artifactPath));
    rmSync(outRoot, { recursive: true, force: true });
  });

  it("rejects unknown existing paths and does not write live/CT/Registry side effects", async () => {
    const outRoot = tempRoot();
    await assert.rejects(
      () =>
        runWebUiMissingOnlyCatalogBuilder({
          locale: "eo",
          englishName: "Esperanto",
          nativeName: "Esperanto",
          textDirection: "ltr",
          publishedRevision: 1,
          existingPack: {
            locale: "eo",
            revision: 1,
            messages: {
              common: { save: "x" },
              notInEnglish: { ghost: "nope" },
            },
          },
          loadEnglishFoundation: () => FIXTURE_EN,
          outRoot,
          log: () => undefined,
        }),
      /outside the English foundation/,
    );
    // Future-language reuse: arbitrary locale works with the same API.
    const future = await runWebUiMissingOnlyCatalogBuilder({
      locale: "sw",
      englishName: "Swahili",
      nativeName: "Kiswahili",
      textDirection: "ltr",
      publishedRevision: 1,
      existingPack: {
        locale: "sw",
        revision: 1,
        messages: existingFromEn(["seo.title"]),
      },
      loadEnglishFoundation: () => FIXTURE_EN,
      outRoot,
      log: () => undefined,
    });
    assert.equal(future.locale, "sw");
    assert.equal(future.mode, "dry-run");
    assert.equal(future.missingKeyCount, 1);
    rmSync(outRoot, { recursive: true, force: true });
  });

  it("CLI entry script exists beside the offline draft script", () => {
    const script = path.resolve(
      here,
      "../../../scripts/prepare-web-ui-missing-only-catalog.ts",
    );
    assert.equal(existsSync(script), true);
    const source = readFileSync(script, "utf8");
    assert.match(source, /runWebUiMissingOnlyCatalogBuilder/);
    assert.match(source, /never Admin Import/);
    assert.match(source, /pilot-max-keys/);
  });

  it("pilot selection stays within 10 keys / 2 batches and covers message classes", function () {
    if (!existsSync(LIVE_ES)) {
      this.skip();
      return;
    }
    const english = loadBundledEnglishWebUiMessagePack();
    const englishPaths = collectStringPaths(english as never).sort();
    const englishFlat = Object.fromEntries(
      englishPaths.map((pathKey) => [pathKey, readLeaf(english, pathKey) ?? ""]),
    );
    const pack = parseWebUiPublishedPackSnapshot(
      JSON.parse(readFileSync(LIVE_ES, "utf8")),
      "es",
    );
    const missing = englishPaths.filter((pathKey) => !flatten(pack.messages).has(pathKey));
    const selected = selectWebUiMissingOnlyPilotPaths({
      missingPaths: missing,
      englishFlat,
      maxKeys: 10,
      maxBatches: 2,
    });
    assert.ok(selected.length <= 10);
    assert.ok(selected.length >= 4);
    const values = selected.map((pathKey) => englishFlat[pathKey] ?? "");
    assert.ok(values.some(isPlainLike));
    assert.ok(values.some((value) => /\{[A-Za-z_]/.test(value)));
    const plan = computeWebUiMissingOnlyPlan({
      locale: "es",
      englishName: "Spanish",
      nativeName: "Español",
      textDirection: "ltr",
      publishedRevision: 2,
      existingMessages: pack.messages,
      englishFlat,
      englishPaths,
      englishSourceHash: "hash",
      pilot: { maxKeys: 10, maxBatches: 2 },
    });
    assert.ok(plan.batchCount <= 2);
    assert.ok(plan.missingPaths.length <= 10);
    assert.equal(plan.pilot?.maxKeys, 10);
    assert.equal(plan.totalMissingKeyCount, 1436);
    assert.ok(plan.missingPaths.every(isPetitionRelatedLike));
  });

  it("pilot execute writes pilot-candidate only and never full catalog", async () => {
    const outRoot = tempRoot();
    const omit = [
      "initiativeExperience.viewer.countLabel",
      "initiativeExperience.viewer.help",
      "workspace.drafts.heading",
      "seo.title",
      "common.save",
      "navigation.home",
    ];
    const result = await runWebUiMissingOnlyCatalogBuilder({
      locale: "es",
      englishName: "Spanish",
      nativeName: "Español",
      textDirection: "ltr",
      publishedRevision: 2,
      existingPack: {
        locale: "es",
        revision: 2,
        messages: existingFromEn(omit),
      },
      loadEnglishFoundation: () => FIXTURE_EN,
      pilotMaxKeys: 4,
      pilotMaxBatches: 2,
      execute: true,
      env: executeEnv,
      outRoot,
      retryDelayMs: 0,
      log: () => undefined,
      translator: translatingEcho,
    });
    assert.equal(result.mode, "execute");
    assert.ok(result.missingKeyCount <= 4);
    assert.ok(result.batchCount <= 2);
    assert.ok(result.artifactPath);
    const artifact = JSON.parse(readFileSync(result.artifactPath!, "utf8")) as {
      status: string;
      translations: Record<string, string>;
      messages?: unknown;
    };
    assert.equal(artifact.status, "pilot-candidate");
    assert.equal(artifact.messages, undefined);
    assert.equal(Object.keys(artifact.translations).length, result.missingKeyCount);
    assert.equal(
      existsSync(path.join(outRoot, "web-ui-es-missing-only-catalog.json")),
      false,
    );
    rmSync(outRoot, { recursive: true, force: true });
  });
});
