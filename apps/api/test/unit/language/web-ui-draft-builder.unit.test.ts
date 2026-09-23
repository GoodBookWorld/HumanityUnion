/**
 * Offline WEB_UI draft builder — deterministic provider only.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { isOrdinaryWebUiRequiredPath, isPublicReaderWebUiRequiredPath, type TranslationProviderId } from "@hu/types";

import { DeterministicTranslationProvider } from "../../../src/modules/language/providers/deterministic-translation-provider.js";
import { TranslationProviderError } from "../../../src/modules/language/translation.config.js";
import type {
  TranslationProviderRequest,
  TranslationProviderResult,
} from "../../../src/modules/language/translation-provider.js";
import {
  assertCompletePublicWebUiDraft,
  canonicalizeWebUiDraftLocale,
  planWebUiDraftBatches,
  resolveOfflineWebUiProviderTimeoutMs,
  runWebUiDraftBuilder,
} from "../../../src/modules/web-ui-message-packs/web-ui-draft-builder.js";
import {
  protectWebUiMessageForProvider,
  restoreWebUiMessageFromProvider,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-structure-protect.js";
import {
  collectStringPaths,
  inspectMessageStructure,
  selectEnglishWebUiMessages,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.validate.js";

const prepared = selectEnglishWebUiMessages("public");
const flat = Object.fromEntries(
  prepared.selectedPaths.map((pathKey) => {
    let current: unknown = prepared.messages;
    for (const segment of pathKey.split(".")) {
      current = (current as Record<string, unknown>)[segment];
    }
    return [pathKey, current as string];
  }),
);

function navigationPaths(count: number): string[] {
  return prepared.selectedPaths.filter((pathKey) => pathKey.startsWith("navigation.")).slice(0, count);
}

function samplePaths(): string[] {
  const icu = prepared.selectedPaths.find((pathKey) => flat[pathKey]?.includes("plural"));
  const rich = prepared.selectedPaths.find((pathKey) => /<[A-Za-z]/.test(flat[pathKey] ?? ""));
  const brand = prepared.selectedPaths.find((pathKey) => (flat[pathKey] ?? "").includes("{siteName}"));
  assert.ok(icu && rich && brand);
  return [...new Set([...navigationPaths(7), icu, rich, brand])];
}

function echo(request: TranslationProviderRequest): TranslationProviderResult {
  return {
    translatedText: request.text,
    providerId: "deterministic" as TranslationProviderId,
    isPlaceholder: false,
  };
}

function translateOutsideSentinels(value: string): string {
  return value
    .split(/(⟦w\d+⟧)/)
    .map((part) => (part.startsWith("⟦") ? part : part.replace(/[A-Za-z][A-Za-z' ]*/g, (words) => `ტ${words}`)))
    .join("");
}

function flatPayload(request: TranslationProviderRequest): Record<string, string> {
  const parsed = JSON.parse(request.text) as Record<string, unknown>;
  assert.equal(Array.isArray(parsed.translations), false);
  const flatMap: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    assert.equal(typeof value, "string");
    flatMap[key] = value;
  }
  return flatMap;
}

function translatingEcho(request: TranslationProviderRequest): TranslationProviderResult {
  const parsed = flatPayload(request);
  return {
    translatedText: JSON.stringify(
      Object.fromEntries(
        Object.entries(parsed).map(([key, value]) => [key, translateOutsideSentinels(value)]),
      ),
    ),
    providerId: "deterministic",
    isPlaceholder: false,
  };
}

function tempRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "web-ui-draft-"));
}

const executeEnv = { TRANSLATION_PROVIDER: "gemini" };

const localeMeta = {
  englishName: "Esperanto",
  nativeName: "Esperanto",
  textDirection: "ltr" as const,
};


describe("offline WEB_UI draft builder", () => {
  it("round-trips placeholders, ICU text, rich tags, and brand tokens", () => {
    const samples = [
      "Showing {count} publication",
      "{count, plural, =0 {No proposals} one {# proposal} other {# proposals}}",
      "<link>Sign in</link> to post a comment.",
      "Questions about {siteName}? Email <email></email>.",
      "{gender, select, female {She voted} male {He voted} other {They voted}}",
    ];
    for (const sample of samples) {
      const protectedMessage = protectWebUiMessageForProvider(sample);
      assert.equal(restoreWebUiMessageFromProvider(protectedMessage.text, sample), sample);
      assert.equal(protectedMessage.text.includes("{count}"), false);
      assert.equal(protectedMessage.text.includes("<link>"), false);
      const restored = restoreWebUiMessageFromProvider(
        translateOutsideSentinels(protectedMessage.text),
        sample,
      );
      const source = inspectMessageStructure(sample);
      const target = inspectMessageStructure(restored);
      assert.equal(target.balanced, true);
      assert.deepEqual([...target.placeholders].sort(), [...source.placeholders].sort());
      assert.deepEqual([...target.richTags].sort(), [...source.richTags].sort());
    }
  });

  it("canonicalizes an arbitrary locale and rejects English", () => {
    assert.equal(canonicalizeWebUiDraftLocale("EO"), "eo");
    assert.equal(canonicalizeWebUiDraftLocale("zh-hant"), "zh-Hant");
    assert.throws(() => canonicalizeWebUiDraftLocale("en"), /English catalog/);
  });

  it("dry-run makes zero provider calls and writes nothing", async () => {
    const outRoot = tempRoot();
    let calls = 0;
    const result = await runWebUiDraftBuilder({
      locale: "eo",
      englishName: "Esperanto",
      nativeName: "Esperanto",
      textDirection: "ltr",
      outRoot,
      log: () => undefined,
      translator: () => {
        calls += 1;
        throw new Error("provider called");
      },
    });
    assert.equal(result.mode, "dry-run");
    assert.equal(result.providerCalls, 0);
    assert.equal(calls, 0);
    assert.equal(result.artifactPath, null);
    assert.equal(result.leafCount, prepared.selectedPaths.length);
    assert.ok(prepared.selectedPaths.length >= prepared.publicRequiredKeyCount);
    assert.ok(prepared.participantRequiredKeyCount > 0);
    rmSync(outRoot, { recursive: true, force: true });
  });

  it("execute requires gemini and refuses a read-only diagnostic", async () => {
    const outRoot = tempRoot();
    const paths = navigationPaths(2);
    let calls = 0;
    const translator = () => {
      calls += 1;
      return Promise.resolve(echo({} as TranslationProviderRequest));
    };
    await assert.rejects(
      () =>
        runWebUiDraftBuilder({
          locale: "eo",
          ...localeMeta,
          execute: true,
          includePaths: paths,
          outRoot,
          log: () => undefined,
          translator,
          env: {},
        }),
      /TRANSLATION_PROVIDER=gemini/,
    );
    await assert.rejects(
      () =>
        runWebUiDraftBuilder({
          locale: "eo",
          ...localeMeta,
          execute: true,
          includePaths: paths,
          outRoot,
          log: () => undefined,
          translator,
          env: { TRANSLATION_PROVIDER: "gemini", HU_READ_ONLY_DIAGNOSTIC: "1" },
        }),
      /read-only diagnostic/,
    );
    assert.equal(calls, 0);
    rmSync(outRoot, { recursive: true, force: true });
  });

  it("an arbitrary locale uses bounded sequential batches", async () => {
    const plans = planWebUiDraftBatches(flat);
    assert.ok(plans.length > 1);
    assert.ok(plans.every((batch) => batch.keys.length <= 6 && batch.keys.length > 0));
    assert.ok(
      plans.every((batch) =>
        batch.keys.every((key) =>
          isOrdinaryWebUiRequiredPath(key, isPublicReaderWebUiRequiredPath),
        ),
      ),
    );
    assert.equal(
      plans.some((batch) => batch.keys.some((key) => key.startsWith("initiativeExperience.author.sidebar"))),
      false,
    );
    const outRoot = tempRoot();
    let inFlight = 0;
    let peak = 0;
    const result = await runWebUiDraftBuilder({
      locale: "eo",
      ...localeMeta,
      execute: true,
      includePaths: samplePaths(),
      outRoot,
      log: () => undefined,
      retryDelayMs: 0,
      env: executeEnv,
      translator: async (request) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await Promise.resolve();
        inFlight -= 1;
        return translatingEcho(request);
      },
    });
    assert.equal(result.locale, "eo");
    assert.equal(peak, 1);
    assert.equal(result.providerCalls, result.batchCount);
    const artifact = JSON.parse(readFileSync(result.artifactPath ?? "", "utf8")) as {
      locale: string;
      status: string;
      sourceNote: string;
      messages: Record<string, unknown>;
    };
    assert.deepEqual(Object.keys(artifact).sort(), ["locale", "messages", "sourceNote", "status"]);
    assert.equal(artifact.status, "draft");
    assert.equal(artifact.locale, "eo");
    rmSync(outRoot, { recursive: true, force: true });
  });

  it("placeholders, ICU, and rich text survive a translating provider", async () => {
    const outRoot = tempRoot();
    const includePaths = samplePaths();
    await runWebUiDraftBuilder({
      locale: "eo",
      ...localeMeta,
      execute: true,
      includePaths,
      outRoot,
      log: () => undefined,
      retryDelayMs: 0,
      env: executeEnv,
      translator: async (request) => translatingEcho(request),
    });
    const icu = includePaths.find((pathKey) => flat[pathKey]?.includes("plural"));
    const rich = includePaths.find((pathKey) => /<[A-Za-z]/.test(flat[pathKey] ?? ""));
    const brand = includePaths.find((pathKey) => flat[pathKey]?.includes("{siteName}"));
    assert.ok(icu && rich && brand);
    const artifact = JSON.parse(
      readFileSync(path.join(outRoot, "web-ui-eo-draft.json"), "utf8"),
    ) as { messages: Record<string, unknown> };
    const read = (pathKey: string): string => {
      let current: unknown = artifact.messages;
      for (const segment of pathKey.split(".")) {
        current = (current as Record<string, unknown>)[segment];
      }
      return current as string;
    };
    for (const pathKey of [icu, rich, brand]) {
      const source = inspectMessageStructure(flat[pathKey] ?? "");
      const target = inspectMessageStructure(read(pathKey));
      assert.deepEqual([...target.placeholders].sort(), [...source.placeholders].sort());
      assert.deepEqual([...target.richTags].sort(), [...source.richTags].sort());
      assert.equal(target.balanced, true);
      assert.equal(read(pathKey).includes("⟦w"), false);
    }
    assert.equal(collectStringPaths(artifact.messages).includes(icu), true);
    rmSync(outRoot, { recursive: true, force: true });
  });

  it("missing, extra, malformed, and structural failures retry only that batch", async () => {
    const includePaths = navigationPaths(7);
    const batchCount = planWebUiDraftBatches(
      Object.fromEntries(includePaths.map((key) => [key, flat[key] ?? ""])),
    ).length;

    async function countCalls(
      respond: (request: TranslationProviderRequest, attempt: number) => TranslationProviderResult,
    ): Promise<number> {
      const root = tempRoot();
      const attempts = new Map<string, number>();
      let calls = 0;
      let targetKey: string | null = null;
      await runWebUiDraftBuilder({
        locale: "eo",
        ...localeMeta,
        execute: true,
        includePaths,
        outRoot: root,
        log: () => undefined,
        retryDelayMs: 0,
        sleep: async () => undefined,
        env: executeEnv,
        translator: async (request) => {
          calls += 1;
          const key = Object.keys(flatPayload(request)).sort().join("|");
          targetKey ??= key;
          const attempt = (attempts.get(key) ?? 0) + 1;
          attempts.set(key, attempt);
          if (key !== targetKey) {
            return echo(request);
          }
          return respond(request, attempt);
        },
      });
      rmSync(root, { recursive: true, force: true });
      return calls;
    }

    const missingCalls = await countCalls((request, attempt) => {
      if (attempt === 1) {
        const parsed = flatPayload(request);
        const [first] = Object.keys(parsed);
        delete parsed[first ?? ""];
        return {
          translatedText: JSON.stringify(parsed),
          providerId: "deterministic",
          isPlaceholder: false,
        };
      }
      return echo(request);
    });
    // Unexpected keys are discarded (Step 15C.8) — no retry when expected keys are intact.
    const extraCalls = await countCalls((request, attempt) => {
      if (attempt === 1) {
        const parsed = flatPayload(request);
        parsed["navigation.notARealKey"] = "x";
        return {
          translatedText: JSON.stringify(parsed),
          providerId: "deterministic",
          isPlaceholder: false,
        };
      }
      return echo(request);
    });
    const malformedCalls = await countCalls((request, attempt) => {
      if (attempt === 1) {
        return { translatedText: "not-json", providerId: "deterministic", isPlaceholder: false };
      }
      return echo(request);
    });
    const structureCalls = await countCalls((request, attempt) => {
      if (attempt === 1) {
        const parsed = flatPayload(request);
        return {
          translatedText: JSON.stringify(
            Object.fromEntries(Object.keys(parsed).map((key) => [key, "broken {extra}"])),
          ),
          providerId: "deterministic",
          isPlaceholder: false,
        };
      }
      return echo(request);
    });
    assert.equal(extraCalls, batchCount);
    for (const calls of [missingCalls, malformedCalls, structureCalls]) {
      assert.equal(calls, batchCount + 1);
    }
  });

  it("does not retry a provider safety block", async () => {
    const outRoot = tempRoot();
    let calls = 0;
    await assert.rejects(
      () =>
        runWebUiDraftBuilder({
          locale: "eo",
          ...localeMeta,
          execute: true,
          includePaths: navigationPaths(2),
          outRoot,
          log: () => undefined,
          retryDelayMs: 0,
          env: executeEnv,
          translator: () => {
            calls += 1;
            throw new TranslationProviderError("safety_rejected", "blocked");
          },
        }),
      /blocked/,
    );
    assert.equal(calls, 1);
    rmSync(outRoot, { recursive: true, force: true });
  });

  it("resume skips completed batches and refuses a different source hash", async () => {
    const outRoot = tempRoot();
    const includePaths = prepared.selectedPaths.filter((pathKey) => pathKey.startsWith("common.")).slice(0, 3);
    let calls = 0;
    await runWebUiDraftBuilder({
      locale: "eo",
      ...localeMeta,
      execute: true,
      includePaths,
      outRoot,
      log: () => undefined,
      retryDelayMs: 0,
      env: executeEnv,
      model: "test-model",
      translator: async (request) => {
        calls += 1;
        return echo(request);
      },
    });
    const firstCalls = calls;
    const second = await runWebUiDraftBuilder({
      locale: "eo",
      ...localeMeta,
      execute: true,
      includePaths,
      outRoot,
      log: () => undefined,
      retryDelayMs: 0,
      env: executeEnv,
      model: "test-model",
      translator: async () => {
        calls += 1;
        throw new Error("should have been skipped");
      },
    });
    assert.equal(second.providerCalls, 0);
    assert.equal(calls, firstCalls);
    const manifestPath = path.join(outRoot, "web-ui-eo-draft", "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { sourceHash: string };
    manifest.sourceHash = "different";
    writeFileSync(manifestPath, JSON.stringify(manifest));
    await assert.rejects(
      () =>
        runWebUiDraftBuilder({
          locale: "eo",
          ...localeMeta,
          execute: true,
          includePaths,
          outRoot,
          log: () => undefined,
          retryDelayMs: 0,
          env: executeEnv,
          model: "test-model",
          translator: async () => {
            throw new Error("should not call");
          },
        }),
      /source hash/,
    );
    rmSync(outRoot, { recursive: true, force: true });
  });

  it("incomplete public drafts are rejected", () => {
    assert.throws(
      () =>
        assertCompletePublicWebUiDraft({
          messages: { navigation: { home: "Home" } },
          requiredPaths: ["navigation.home", "navigation.missing"],
        }),
      /incomplete|Unknown WEB_UI/,
    );
  });

  it("live terminology is opt-in and default dry-run does not load it", async () => {
    let loads = 0;
    await runWebUiDraftBuilder({
      locale: "eo",
      ...localeMeta,
      useLiveTerminology: true,
      includePaths: navigationPaths(1),
      log: () => undefined,
      loadLiveTerminology: async () => {
        loads += 1;
        return "seed";
      },
    });
    assert.equal(loads, 0);
    const outRoot = tempRoot();
    await runWebUiDraftBuilder({
      locale: "eo",
      ...localeMeta,
      execute: true,
      useLiveTerminology: true,
      includePaths: navigationPaths(1),
      outRoot,
      log: () => undefined,
      retryDelayMs: 0,
      env: executeEnv,
      loadLiveTerminology: async () => {
        loads += 1;
        return "Participant (participant) => term";
      },
      translator: async (request) => {
        assert.match(request.terminologyContext ?? "", /Participant \(participant\) => term/);
        assert.match(request.terminologyContext ?? "", /Text direction: ltr/);
        return echo(request);
      },
    });
    assert.equal(loads, 1);
    const manifest = JSON.parse(
      readFileSync(path.join(outRoot, "web-ui-eo-draft", "manifest.json"), "utf8"),
    ) as { terminologyMode: string };
    assert.equal(manifest.terminologyMode, "live");
    rmSync(outRoot, { recursive: true, force: true });
  });

  it("accepts the TranslationProvider flat map and rejects a non-string row", async () => {
    const provider = new DeterministicTranslationProvider();
    const outRoot = tempRoot();
    const includePaths = navigationPaths(2);
    await runWebUiDraftBuilder({
      locale: "eo",
      ...localeMeta,
      execute: true,
      includePaths,
      outRoot,
      log: () => undefined,
      retryDelayMs: 0,
      env: executeEnv,
      translator: async (request) => {
        const parsed = JSON.parse(request.text) as Record<string, unknown>;
        assert.equal(Object.hasOwn(parsed, "translations"), false);
        assert.equal(request.contentType, "structured_json");
        for (const pathKey of includePaths) {
          assert.equal(typeof parsed[pathKey], "string");
        }
        return provider.translate(request);
      },
    });
    const artifact = JSON.parse(
      readFileSync(path.join(outRoot, "web-ui-eo-draft.json"), "utf8"),
    ) as { messages: Record<string, unknown> };
    for (const pathKey of includePaths) {
      let leaf: unknown = artifact.messages;
      for (const segment of pathKey.split(".")) {
        leaf = (leaf as Record<string, unknown>)[segment];
      }
      assert.equal(typeof leaf, "string");
      assert.match(leaf as string, /^\[eo\] /);
    }
    rmSync(outRoot, { recursive: true, force: true });

    const failedRoot = tempRoot();
    let calls = 0;
    await assert.rejects(
      () =>
        runWebUiDraftBuilder({
          locale: "eo",
          ...localeMeta,
          execute: true,
          includePaths: navigationPaths(1),
          outRoot: failedRoot,
          log: () => undefined,
          retryDelayMs: 0,
          sleep: async () => undefined,
          env: executeEnv,
          translator: () => {
            calls += 1;
            return Promise.resolve({
              translatedText: JSON.stringify({
                translations: [{ key: navigationPaths(1)[0], value: { nested: "not-a-string" } }],
              }),
              providerId: "deterministic" as TranslationProviderId,
              isPlaceholder: false,
            });
          },
        }),
      /Provider translation row must have string key and value/,
    );
    assert.equal(calls, 2);
    rmSync(failedRoot, { recursive: true, force: true });
  });

  it("resumes after a failed row-validation batch without repeating completed batches", async () => {
    const includePaths = navigationPaths(7);
    const plans = planWebUiDraftBatches(
      Object.fromEntries(includePaths.map((key) => [key, flat[key] ?? ""])),
    );
    assert.equal(plans.length, 2);
    const failedKeys = plans[1]?.keys.join("|");
    const outRoot = tempRoot();
    await assert.rejects(
      () =>
        runWebUiDraftBuilder({
          locale: "eo",
          ...localeMeta,
          execute: true,
          includePaths,
          outRoot,
          log: () => undefined,
          retryDelayMs: 0,
          sleep: async () => undefined,
          env: executeEnv,
          model: "test-model",
          translator: async (request) => {
            const key = Object.keys(flatPayload(request)).sort().join("|");
            if (key === failedKeys) {
              return {
                translatedText: JSON.stringify({
                  translations: [{ key: plans[1]?.keys[0], value: ["not-a-string"] }],
                }),
                providerId: "deterministic" as TranslationProviderId,
                isPlaceholder: false,
              };
            }
            return echo(request);
          },
        }),
      /Provider translation row must have string key and value/,
    );
    let resumeCalls = 0;
    const resumed = await runWebUiDraftBuilder({
      locale: "eo",
      ...localeMeta,
      execute: true,
      includePaths,
      outRoot,
      log: () => undefined,
      retryDelayMs: 0,
      env: executeEnv,
      model: "test-model",
      translator: async (request) => {
        resumeCalls += 1;
        assert.equal(Object.keys(flatPayload(request)).sort().join("|"), failedKeys);
        return echo(request);
      },
    });
    assert.equal(resumeCalls, 1);
    assert.equal(resumed.providerCalls, 1);
    assert.equal(resumed.completedBatchCount, plans.length);
    rmSync(outRoot, { recursive: true, force: true });
  });

  it("keeps the runtime provider timeout and raises only the offline draft timeout", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const configSource = readFileSync(
      path.resolve(here, "../../../src/modules/language/translation.config.ts"),
      "utf8",
    );
    const geminiSource = readFileSync(
      path.resolve(here, "../../../src/modules/language/providers/gemini-translation-provider.ts"),
      "utf8",
    );
    assert.match(configSource, /TRANSLATION_TIMEOUT_MS \?\? "25000"/);
    assert.match(geminiSource, /this\.config\.timeoutMs/);
    assert.doesNotMatch(geminiSource, /60_000/);
    assert.equal(resolveOfflineWebUiProviderTimeoutMs(25_000), 60_000);
    assert.equal(resolveOfflineWebUiProviderTimeoutMs(90_000), 90_000);
    const keys = [
      "civicMediaPublic.trustedCategoryDescriptions.academic-resource",
      "civicMediaPublic.trustedCategoryDescriptions.independent-investigative",
      "civicMediaPublic.trustedCategoryDescriptions.international-wire-service",
      "civicMediaPublic.trustedCategoryDescriptions.public-broadcaster",
      "civicMediaPublic.trustedCategoryDescriptions.regional-public-media",
      "civicMediaPublic.trustedCategoryDescriptions.scientific-publisher",
    ];
    const plans = planWebUiDraftBatches(
      Object.fromEntries(keys.map((key) => [key, flat[key] ?? ""])),
    );
    assert.equal(plans.length, 1);
    assert.equal(plans[0]?.id, "ad6cc334facf8f7f");
  });

  it("retries a provider timeout and skips batches already marked ok", async () => {
    const includePaths = navigationPaths(7);
    const plans = planWebUiDraftBatches(
      Object.fromEntries(includePaths.map((key) => [key, flat[key] ?? ""])),
    );
    assert.equal(plans.length, 2);
    const failedKeys = plans[1]?.keys.join("|");
    const outRoot = tempRoot();
    await assert.rejects(
      () =>
        runWebUiDraftBuilder({
          locale: "eo",
          ...localeMeta,
          execute: true,
          includePaths,
          outRoot,
          log: () => undefined,
          retryDelayMs: 0,
          sleep: async () => undefined,
          env: executeEnv,
          model: "test-model",
          translator: async (request) => {
            const key = Object.keys(flatPayload(request)).sort().join("|");
            if (key === failedKeys) {
              throw new TranslationProviderError("timeout", "Gemini translation timed out");
            }
            return echo(request);
          },
        }),
      /Gemini translation timed out/,
    );
    let resumeCalls = 0;
    const resumed = await runWebUiDraftBuilder({
      locale: "eo",
      ...localeMeta,
      execute: true,
      includePaths,
      outRoot,
      log: () => undefined,
      retryDelayMs: 0,
      env: executeEnv,
      model: "test-model",
      translator: async (request) => {
        resumeCalls += 1;
        assert.equal(Object.keys(flatPayload(request)).sort().join("|"), failedKeys);
        return echo(request);
      },
    });
    assert.equal(resumeCalls, 1);
    assert.equal(resumed.providerCalls, 1);
    assert.equal(resumed.completedBatchCount, plans.length);
    rmSync(outRoot, { recursive: true, force: true });
  });

  it("builder source does not import persistence, activation, or the Civic Media governor", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const builder = readFileSync(
      path.resolve(here, "../../../src/modules/web-ui-message-packs/web-ui-draft-builder.ts"),
      "utf8",
    );
    const script = readFileSync(
      path.resolve(here, "../../../scripts/prepare-web-ui-message-pack-draft.ts"),
      "utf8",
    );
    for (const source of [builder, script]) {
      assert.doesNotMatch(source, /content-translation\.service|upsertContentTranslation|content_translations/);
      assert.doesNotMatch(source, /thin-gemini-governor|thin-gemini-provider-state|upsertWebUiMessagePack/);
      assert.doesNotMatch(source, /activate-localization|locale === ["']ka["']|locale === ["']he["']/);
    }
    assert.match(builder, /resolveOfflineWebUiProviderTimeoutMs/);
    assert.doesNotMatch(builder, /resolveTranslationProvider/);
  });
});
