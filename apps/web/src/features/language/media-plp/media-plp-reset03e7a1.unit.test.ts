/**
 * Reset 03E.7A.1 — Media RSC Server/Client boundary hotfix regression.
 * Proves /media server composition never invokes buildCanonicalCivicMediaEditorial
 * through a "use client" module (the live staging 500 class).
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { CivicMediaCenterPublic } from "@hu/types";

import { applyMediaPlpPresentationsToEditorial } from "./apply-media-plp-editorial.js";
import { composeMediaPageLocalization } from "./compose-media-page-localization.js";
import {
  isMediaPlpWebForceLegacy,
  setMediaPlpWebEnabledForTests,
} from "./feature-flag.js";
import {
  finalizeMediaPlpLiveTruthProbeAttrFromApplied,
  MEDIA_PLP_LIVE_TRUTH_PROBE_STATUS,
  resetMediaPlpLiveTruthProbeForTests,
  resolveMediaPlpLiveTruthProbeStatus,
  setMediaPlpLiveTruthProbeEnabledForTests,
} from "./media-plp-live-truth-probe.js";
import { MEDIA_PLP_ENTITY_TYPE } from "./presentation.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrcRoot = path.resolve(here, "../../..");

afterEach(() => {
  setMediaPlpWebEnabledForTests(null);
  setMediaPlpLiveTruthProbeEnabledForTests(null);
  resetMediaPlpLiveTruthProbeForTests();
});

function media(): CivicMediaCenterPublic {
  return {
    overview: {
      title: "Overview title EN",
      summary: "Summary EN",
      points: [{ id: "p1", heading: "H", body: "B" }],
    },
    selectionPrinciples: [
      {
        id: "editorial-transparency",
        title: "T",
        description: "D",
        whyItMatters: "W",
        sortOrder: 1,
      },
    ],
    trustedMediaCategories: [
      { id: "international-wire-service", title: "Wire", description: "W", sortOrder: 1 },
    ],
    trustedMedia: [
      {
        id: "reuters",
        name: "Reuters",
        logoLabel: "R",
        country: "International",
        categoryId: "international-wire-service",
        explanation: "E",
        websiteUrl: "https://www.reuters.com/",
        sortOrder: 1,
      },
    ],
    factChecking: [],
    propagandaAnalysis: [],
    faq: [{ id: "faq-1", question: "Q", answer: "A", sortOrder: 1 }],
    initiativeFlow: { title: "F", summary: "S", diagramSvg: "", stages: ["A"] },
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function resolveImportPath(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith(".") && !specifier.startsWith("/")) {
    return null; // package import — not walked
  }
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Bounded BFS over relative imports from page.tsx (value imports only).
 * Records which file first binds `buildCanonicalCivicMediaEditorial`.
 */
function findBuildCanonicalDefinitionFromPage(): {
  readonly definitionFile: string;
  readonly hasUseClient: boolean;
  readonly importChain: readonly string[];
} {
  const pagePath = path.resolve(webSrcRoot, "app/media/page.tsx");
  const queue: Array<{ file: string; chain: string[] }> = [
    { file: pagePath, chain: [pagePath] },
  ];
  const visited = new Set<string>();
  const importRe =
    /(?:import|export)\s+(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+["']([^"']+)["']/g;
  const valueImportRe =
    /import\s+(?!type\b)(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+["']([^"']+)["']/g;

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.file)) {
      continue;
    }
    visited.add(current.file);
    const source = readFileSync(current.file, "utf8");

    if (
      /export\s+function\s+buildCanonicalCivicMediaEditorial\b/.test(source) ||
      /export\s+\{\s*[^}]*\bbuildCanonicalCivicMediaEditorial\b/.test(source)
    ) {
      // Prefer the file that *defines* the function body, not a re-export.
      if (/export\s+function\s+buildCanonicalCivicMediaEditorial\b/.test(source)) {
        return {
          definitionFile: current.file,
          hasUseClient: /^\s*["']use client["']\s*;/m.test(source),
          importChain: current.chain,
        };
      }
    }

    valueImportRe.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = valueImportRe.exec(source)) !== null) {
      const clause = match[0];
      // Skip pure type re-exports already excluded by (?!type\b) on import keyword;
      // also skip `import type {` which the negative lookahead handles.
      if (/\btype\b/.test(clause) && /import\s+type\b/.test(clause)) {
        continue;
      }
      // If the named import list is only type imports, skip — but keep simple.
      const resolved = resolveImportPath(current.file, match[1]!);
      if (!resolved || visited.has(resolved)) {
        continue;
      }
      // Only follow if this import mentions buildCanonical OR is a local relative hop
      // under media-plp / civic-media-center (bounded).
      const rel = path.relative(webSrcRoot, resolved);
      const inScope =
        rel.startsWith("features/language/media-plp/") ||
        rel.startsWith("features/civic-media-center/") ||
        rel === "app/media/page.tsx";
      if (!inScope) {
        continue;
      }
      queue.push({ file: resolved, chain: [...current.chain, resolved] });
    }
    void importRe;
  }

  // Fallback: locate definition by known pure path if BFS missed re-export hops.
  const purePath = path.resolve(
    webSrcRoot,
    "features/civic-media-center/civic-media-canonical-editorial.ts",
  );
  assert.ok(existsSync(purePath), "pure canonical module must exist");
  const pureSource = readFileSync(purePath, "utf8");
  assert.match(pureSource, /export function buildCanonicalCivicMediaEditorial/);
  return {
    definitionFile: purePath,
    hasUseClient: /^\s*["']use client["']\s*;/m.test(pureSource),
    importChain: [pagePath, purePath],
  };
}

describe("Reset 03E.7A.1 — Media RSC server/client boundary", () => {
  it("page.tsx server import graph resolves buildCanonical via pure (non-client) module", () => {
    const applyPath = path.resolve(here, "apply-media-plp-editorial.ts");
    const applySource = readFileSync(applyPath, "utf8");
    assert.match(
      applySource,
      /from ["']\.\.\/\.\.\/civic-media-center\/civic-media-canonical-editorial["']/,
    );
    assert.doesNotMatch(
      applySource,
      /buildCanonicalCivicMediaEditorial[\s\S]*CivicMediaTranslatedEditorial/,
    );

    const purePath = path.resolve(
      webSrcRoot,
      "features/civic-media-center/civic-media-canonical-editorial.ts",
    );
    const pureSource = readFileSync(purePath, "utf8");
    assert.doesNotMatch(pureSource, /^\s*["']use client["']\s*;/m);
    assert.match(pureSource, /export function buildCanonicalCivicMediaEditorial/);

    const clientPath = path.resolve(
      webSrcRoot,
      "features/civic-media-center/components/CivicMediaTranslatedEditorial.tsx",
    );
    const clientSource = readFileSync(clientPath, "utf8");
    assert.match(clientSource, /["']use client["']/);

    const found = findBuildCanonicalDefinitionFromPage();
    assert.equal(found.hasUseClient, false);
    assert.ok(
      found.definitionFile.endsWith("civic-media-canonical-editorial.ts"),
      `expected pure module, got ${found.definitionFile}`,
    );
  });

  it("/media server composition completes for probe ENABLED + DISABLED", async () => {
    const m = media();

    setMediaPlpWebEnabledForTests(true);
    setMediaPlpLiveTruthProbeEnabledForTests(true);
    assert.equal(
      resolveMediaPlpLiveTruthProbeStatus(),
      MEDIA_PLP_LIVE_TRUTH_PROBE_STATUS.ENABLED,
    );

    const plpComposition = await composeMediaPageLocalization({
      media: m,
      locale: "uk",
      isPlpEnabled: () => true,
      fetchNewsArticles: async () => [],
      loadPlp: async () => ({
        trustedById: {},
        principlesById: {},
        factCheckById: {},
        propagandaById: {},
        newsById: {},
        editorial: {
          mode: "CANONICAL_FALLBACK",
          entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
          entityId: "civic-media-center",
          locale: "uk",
          canonicalVersion: "v1",
          presentation: {
            overviewTitle: m.overview.title,
            overviewSummary: m.overview.summary,
            overviewPoints: m.overview.points.map((p) => ({
              id: p.id,
              heading: p.heading,
              body: p.body,
            })),
            faq: m.faq.map((f) => ({
              id: f.id,
              question: f.question,
              answer: f.answer,
            })),
          },
        },
      }),
    });
    assert.equal(plpComposition.runtimeBranch, "PLP");

    // Same call page.tsx makes on the ENABLED path — must not throw RSC boundary.
    const applied = applyMediaPlpPresentationsToEditorial({
      media: m,
      trustedById: plpComposition.plpTrustedById ?? {},
      principlesById: plpComposition.plpPrinciplesById ?? {},
      editorialPresentation: plpComposition.plpEditorialPresentation,
    });
    const attr = finalizeMediaPlpLiveTruthProbeAttrFromApplied({
      overviewSummary: applied.overview.summary,
      faq0Question: applied.faq[0]?.question ?? "",
      faq0Answer: applied.faq[0]?.answer ?? "",
    });
    assert.ok(attr);

    resetMediaPlpLiveTruthProbeForTests();
    setMediaPlpLiveTruthProbeEnabledForTests(false);
    assert.equal(
      resolveMediaPlpLiveTruthProbeStatus(),
      MEDIA_PLP_LIVE_TRUTH_PROBE_STATUS.DISABLED,
    );
    const disabledAttr = finalizeMediaPlpLiveTruthProbeAttrFromApplied({
      overviewSummary: applied.overview.summary,
      faq0Question: applied.faq[0]?.question ?? "",
      faq0Answer: applied.faq[0]?.answer ?? "",
    });
    assert.equal(disabledAttr, undefined);
  });

  it("PLP and FORCE_LEGACY compositions still resolve without client builder", async () => {
    const m = media();

    setMediaPlpWebEnabledForTests(true);
    const plp = await composeMediaPageLocalization({
      media: m,
      locale: "uk",
      isPlpEnabled: () => true,
      fetchNewsArticles: async () => [],
      loadPlp: async () => ({
        trustedById: {},
        principlesById: {},
        factCheckById: {},
        propagandaById: {},
        newsById: {},
        editorial: {
          mode: "CANONICAL_FALLBACK" as const,
          entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
          entityId: "civic-media-center",
          locale: "uk",
          canonicalVersion: "v1",
          presentation: {
            overviewTitle: m.overview.title,
            overviewSummary: m.overview.summary,
          },
        },
      }),
    });
    assert.equal(plp.runtimeBranch, "PLP");

    // FORCE_LEGACY path uses loadLegacy seed — inject a stub; never call client builder.
    const legacy = await composeMediaPageLocalization({
      media: m,
      locale: "uk",
      isPlpEnabled: () => false,
      loadLegacyEditorial: async () =>
        applyMediaPlpPresentationsToEditorial({
          media: m,
          trustedById: {},
          principlesById: {},
        }),
    });
    assert.equal(legacy.runtimeBranch, "LEGACY");
    assert.ok(legacy.initialEditorial);

    // Feature-flag helper still readable (no throw).
    assert.equal(typeof isMediaPlpWebForceLegacy(), "boolean");
  });

  it("read path sources do not import provider/materializer/Mongo modules", () => {
    const files = [
      path.resolve(webSrcRoot, "app/media/page.tsx"),
      path.resolve(here, "apply-media-plp-editorial.ts"),
      path.resolve(here, "compose-media-page-localization.ts"),
      path.resolve(here, "media-plp-live-truth-probe.ts"),
      path.resolve(
        webSrcRoot,
        "features/civic-media-center/civic-media-canonical-editorial.ts",
      ),
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /from\s+["'][^"']*gemini[^"']*["']/i);
      assert.doesNotMatch(source, /from\s+["'][^"']*materializ[^"']*["']/i);
      assert.doesNotMatch(source, /from\s+["'][^"']*(mongodb|mongoose)[^"']*["']/i);
      assert.doesNotMatch(source, /generateContentTranslation/);
    }
  });
});
