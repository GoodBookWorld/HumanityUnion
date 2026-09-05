/**
 * Pack 08K — browser acceptance harness (no Playwright).
 *
 * Uses react-dom/server renderToStaticMarkup + HTML string scan.
 * Viewports 375 / 900 / 1280 are documented in test names; SSR markup is
 * viewport-agnostic — wrappers carry data-viewport for case identity.
 */
import assert from "node:assert/strict";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";

import {
  isPublicProtectedValue,
  type PublicLocalizedPresentation,
  type PublicPresentationNode,
} from "@hu/types";

import { localizePublicPresentation } from "./public-localized-presentation.js";
import {
  buildFullLocaleTranslations,
  buildPack08kBlogFixtures,
  buildPack08kKnowledgeSearchCiDiscussionFixtures,
  buildPack08kLifecycleFixture,
  buildPack08kMediaFixture,
  type Pack08kWebFixture,
} from "./pack08k-web-fixtures.js";

const VIEWPORTS = [375, 900, 1280] as const;
const LOCALES = ["uk", "zh-Hant", "ar"] as const;

function renderSemanticNode(node: PublicPresentationNode, path = ""): ReactNode {
  if (node === null || node === undefined) {
    return null;
  }
  if (isPublicProtectedValue(node)) {
    return createElement(
      "span",
      { "data-hu-semantic": "protected", "data-hu-path": path },
      node.value,
    );
  }
  if (typeof node === "string") {
    if (!path || !node.trim()) {
      return null;
    }
    return createElement(
      "span",
      { "data-hu-semantic": "auto", "data-hu-path": path },
      node,
    );
  }
  if (Array.isArray(node)) {
    return node.map((entry, index) => {
      const childPath = path ? `${path}[${index}]` : `[${index}]`;
      return createElement(
        "div",
        { key: childPath, "data-hu-path": childPath },
        renderSemanticNode(entry, childPath),
      );
    });
  }
  if (typeof node === "object") {
    return Object.entries(node).map(([key, value]) => {
      const childPath = path ? `${path}.${key}` : key;
      return createElement(
        "div",
        { key: childPath, "data-hu-path": childPath },
        renderSemanticNode(value as PublicPresentationNode, childPath),
      );
    });
  }
  return null;
}

function Pack08kAcceptanceSurface(props: {
  readonly viewport: number;
  readonly locale: string;
  readonly fixtures: readonly {
    readonly localized: PublicLocalizedPresentation;
  }[];
}): ReactNode {
  return createElement(
    "div",
    {
      "data-hu-pack": "08K",
      "data-viewport": String(props.viewport),
      "data-locale": props.locale,
    },
    props.fixtures.map(({ localized }) =>
      createElement(
        "article",
        {
          key: `${localized.identity.sourceKind}:${localized.identity.sourceRecordId}`,
          "data-hu-source-kind": localized.identity.sourceKind,
          "data-hu-source-record-id": localized.identity.sourceRecordId,
          "data-hu-coverage": localized.coverage.status,
        },
        renderSemanticNode(localized.presentation),
      ),
    ),
  );
}

function collectAttrTexts(html: string, semantic: "auto" | "protected"): string[] {
  const re = new RegExp(
    `data-hu-semantic="${semantic}"[^>]*>([\\s\\S]*?)</span>`,
    "g",
  );
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    out.push(match[1] ?? "");
  }
  return out;
}

function collectProtectedCanonicals(tree: PublicPresentationNode): string[] {
  const out: string[] = [];
  function walk(node: PublicPresentationNode): void {
    if (node == null) return;
    if (isPublicProtectedValue(node)) {
      out.push(node.value);
      return;
    }
    if (typeof node === "string") return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node === "object") {
      Object.values(node).forEach((v) => walk(v as PublicPresentationNode));
    }
  }
  walk(tree);
  return out;
}

function localizeFixture(
  fixture: Pack08kWebFixture,
  locale: string,
  translations: Record<string, string>,
): PublicLocalizedPresentation {
  return localizePublicPresentation({
    identity: fixture.identity,
    sourceLanguage: "en",
    targetLanguage: locale,
    presentation: fixture.presentation,
    translations,
  });
}

function buildCompleteSurfaceFixtures(locale: string): {
  readonly fixtures: Pack08kWebFixture[];
  readonly localized: PublicLocalizedPresentation[];
  readonly englishAuto: Set<string>;
  readonly expectedAuto: Set<string>;
  readonly expectedProtected: string[];
} {
  const fixtures: Pack08kWebFixture[] = [
    ...buildPack08kBlogFixtures(),
    buildPack08kLifecycleFixture(),
    buildPack08kMediaFixture(),
    ...buildPack08kKnowledgeSearchCiDiscussionFixtures(),
  ];
  const englishAuto = new Set<string>();
  const expectedAuto = new Set<string>();
  const expectedProtected: string[] = [];
  const localized: PublicLocalizedPresentation[] = [];

  for (const fixture of fixtures) {
    const translations = buildFullLocaleTranslations(fixture.presentation, locale);
    for (const value of Object.keys(translations).map(
      (path) =>
        // canonical from translation map reverse: "[locale] canonical"
        translations[path]!.slice(`[${locale}] `.length),
    )) {
      englishAuto.add(value);
      expectedAuto.add(`[${locale}] ${value}`);
    }
    // Also collect English from tree walk for empty-path safety
    for (const node of Object.values(translations)) {
      const canonical = node.slice(`[${locale}] `.length);
      englishAuto.add(canonical);
      expectedAuto.add(node);
    }
    expectedProtected.push(...collectProtectedCanonicals(fixture.presentation));
    localized.push(localizeFixture(fixture, locale, translations));
  }

  return { fixtures, localized, englishAuto, expectedAuto, expectedProtected };
}

function assertCompleteRender(input: {
  readonly viewport: number;
  readonly locale: string;
}): void {
  const built = buildCompleteSurfaceFixtures(input.locale);
  for (const item of built.localized) {
    assert.equal(
      item.coverage.status,
      "COMPLETE",
      `${item.identity.sourceRecordId} must be COMPLETE`,
    );
  }

  const html = renderToStaticMarkup(
    createElement(Pack08kAcceptanceSurface, {
      viewport: input.viewport,
      locale: input.locale,
      fixtures: built.localized.map((localized) => ({ localized })),
    }),
  );

  assert.match(html, new RegExp(`data-viewport="${input.viewport}"`));
  assert.match(html, new RegExp(`data-locale="${input.locale}"`));

  const autoTexts = collectAttrTexts(html, "auto");
  const protectedTexts = collectAttrTexts(html, "protected");

  assert.ok(autoTexts.length > 0, "expected AUTO_TRANSLATABLE nodes in markup");
  for (const text of autoTexts) {
    assert.ok(
      !built.englishAuto.has(text),
      `auto node must not equal English canonical: ${text}`,
    );
    assert.ok(
      built.expectedAuto.has(text),
      `auto node must match ${input.locale} translation: ${text}`,
    );
  }

  assert.equal(protectedTexts.length, built.expectedProtected.length);
  for (let i = 0; i < protectedTexts.length; i += 1) {
    assert.equal(
      protectedTexts[i],
      built.expectedProtected[i],
      "protected values must be byte-identical",
    );
  }
}

describe("Pack 08K — browser acceptance harness", () => {
  for (const viewport of VIEWPORTS) {
    for (const locale of LOCALES) {
      it(`viewport ${viewport}px / locale=${locale}: complete fixtures render localized AUTO + protected`, () => {
        assertCompleteRender({ viewport, locale });
      });
    }
  }

  it("viewport 375px / locale=uk: incomplete petition (4/5) → CANONICAL_FALLBACK, not COMPLETE", () => {
    const fixture = buildPack08kLifecycleFixture();
    const full = buildFullLocaleTranslations(fixture.presentation, "uk");
    const incomplete = { ...full };
    delete incomplete["petition.paragraphs[4]"];

    const localized = localizeFixture(fixture, "uk", incomplete);
    assert.ok(localized.coverage.canonicalFallbackNodeCount > 0);
    assert.notEqual(localized.coverage.status, "COMPLETE");
    assert.equal(localized.coverage.status, "FALLBACK_CANONICAL");

    const html = renderToStaticMarkup(
      createElement(Pack08kAcceptanceSurface, {
        viewport: 375,
        locale: "uk",
        fixtures: [{ localized }],
      }),
    );
    assert.match(html, /data-hu-coverage="FALLBACK_CANONICAL"/);
    const autoTexts = collectAttrTexts(html, "auto");
    assert.ok(
      autoTexts.includes("Petition paragraph five commits to follow-through tracking."),
      "missing translation falls back to English canonical in AUTO node",
    );
  });
});
