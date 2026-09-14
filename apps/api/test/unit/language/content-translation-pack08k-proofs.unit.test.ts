/**
 * Pack 08K — PublicLocalizedPresentation proof tests.
 *
 * Uses `localizePublicPresentation` from the language module.
 * `pack08k-localize-for-proofs.ts` remains as a contract mirror / fallback helper
 * for `buildFullProofTranslations` + `collectAutoTranslatableNodes` utilities.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isPublicProtectedValue,
  unwrapPublicPresentationValue,
  type PublicLocalizedPresentation,
  type PublicPresentationNode,
} from "@hu/types";

import {
  collectAutoTranslatableNodes,
  localizePublicPresentation,
} from "../../../src/modules/language/public-localized-presentation.js";
import {
  buildPack08kBlogFixture,
  buildPack08kFutureArtifactFixture,
  buildPack08kLifecycleFixture,
  buildPack08kMediaFixture,
} from "./pack08k-fixtures.js";
import {
  buildFullProofTranslations,
  buildPresentationIdentity,
} from "./pack08k-localize-for-proofs.js";

function readNodeAtPath(tree: PublicPresentationNode, pathExpr: string): PublicPresentationNode {
  const tokens = pathExpr
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);
  let current: PublicPresentationNode = tree;
  for (const token of tokens) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    if (Array.isArray(current)) {
      current = current[Number(token)] as PublicPresentationNode;
      continue;
    }
    if (isPublicProtectedValue(current)) {
      return undefined;
    }
    current = (current as Record<string, PublicPresentationNode>)[token];
  }
  return current;
}

function assertProtectedUnchanged(
  original: PublicPresentationNode,
  localized: PublicPresentationNode,
  pathExpr: string,
): void {
  const before = readNodeAtPath(original, pathExpr);
  const after = readNodeAtPath(localized, pathExpr);
  assert.ok(isPublicProtectedValue(before), `expected protected at ${pathExpr}`);
  assert.ok(isPublicProtectedValue(after), `expected protected after localize at ${pathExpr}`);
  assert.equal(after, before, `protected wrapper must be byte-identical at ${pathExpr}`);
  assert.equal(unwrapPublicPresentationValue(after), unwrapPublicPresentationValue(before));
}

function assertNoProtectedValuesMutatedInMap(
  tree: PublicPresentationNode,
  translations: Readonly<Record<string, string>>,
): void {
  const protectedValues = new Set<string>();
  function walk(node: PublicPresentationNode): void {
    if (node == null) return;
    if (isPublicProtectedValue(node)) {
      protectedValues.add(node.value);
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
  const autoPaths = new Set(collectAutoTranslatableNodes(tree).map((n) => n.path));
  for (const [pathKey, translated] of Object.entries(translations)) {
    assert.ok(
      !protectedValues.has(pathKey),
      `protected identity/id must never appear as a mutated translation map key: ${pathKey}`,
    );
    assert.ok(autoPaths.has(pathKey), `translation map path must be AUTO only, got ${pathKey}`);
    assert.ok(
      !protectedValues.has(translated) || translated.startsWith("["),
      `translation map must not smuggle bare protected values as translations`,
    );
  }
}

describe("Pack 08K — PublicLocalizedPresentation proofs", () => {
  it("Blog 5 posts: full translations → COMPLETE; protected unchanged", () => {
    const blogs = buildPack08kBlogFixture();
    assert.equal(blogs.length, 5);

    for (const fixture of blogs) {
      const translations = buildFullProofTranslations(fixture.presentation, "uk");
      assertNoProtectedValuesMutatedInMap(fixture.presentation, translations);

      const result = localizePublicPresentation({
        identity: fixture.identity,
        sourceLanguage: "en",
        targetLanguage: "uk",
        presentation: fixture.presentation,
        translations,
      });

      assert.equal(fixture.identity.sourceKind, "blog_post");
      assert.equal(result.coverage.status, "COMPLETE");
      assert.equal(result.coverage.canonicalFallbackNodeCount, 0);
      assert.equal(result.coverage.semanticNodeCount, result.coverage.localizedNodeCount);
      assert.ok(result.coverage.semanticNodeCount > 0);

      if (fixture.identity.sourceRecordId === "pack08k-blog-author-04") {
        assertProtectedUnchanged(fixture.presentation, result.presentation, "authorName");
      }
      if (fixture.identity.sourceRecordId === "pack08k-blog-url-05") {
        assertProtectedUnchanged(fixture.presentation, result.presentation, "url");
      }
    }

    const ids = new Set(blogs.map((b) => b.identity.sourceRecordId));
    assert.equal(ids.size, 5);
  });

  it("Lifecycle: full translations → COMPLETE; petition 5 paragraphs localized", () => {
    const fixture = buildPack08kLifecycleFixture();
    const petition = (fixture.presentation as { petition: { paragraphs: string[] } }).petition;
    assert.equal(petition.paragraphs.length, 5, "CRITICAL: petition must have 5 paragraphs");

    const translations = buildFullProofTranslations(fixture.presentation, "uk");
    assertNoProtectedValuesMutatedInMap(fixture.presentation, translations);

    const result = localizePublicPresentation({
      identity: fixture.identity,
      sourceLanguage: "en",
      targetLanguage: "uk",
      presentation: fixture.presentation,
      translations,
    });

    assert.equal(result.coverage.status, "COMPLETE");
    assert.equal(result.coverage.canonicalFallbackNodeCount, 0);

    for (let i = 0; i < 5; i += 1) {
      const localizedPara = readNodeAtPath(result.presentation, `petition.paragraphs[${i}]`);
      assert.equal(typeof localizedPara, "string");
      assert.match(String(localizedPara), /^\[uk\] /);
    }

    assertProtectedUnchanged(
      fixture.presentation,
      result.presentation,
      "initiative.initiativeId",
    );
    assertProtectedUnchanged(
      fixture.presentation,
      result.presentation,
      "discussion.comments[0].authorName",
    );
  });

  it("Petition incomplete: 4/5 paragraphs → FALLBACK_CANONICAL, not COMPLETE", () => {
    const fixture = buildPack08kLifecycleFixture();
    const full = buildFullProofTranslations(fixture.presentation, "uk");
    const incomplete: Record<string, string> = { ...full };
    delete incomplete["petition.paragraphs[4]"];

    const result = localizePublicPresentation({
      identity: fixture.identity,
      sourceLanguage: "en",
      targetLanguage: "uk",
      presentation: fixture.presentation,
      translations: incomplete,
    });

    assert.notEqual(result.coverage.status, "COMPLETE");
    assert.equal(result.coverage.status, "FALLBACK_CANONICAL");
    assert.equal(result.coverage.canonicalFallbackNodeCount, 1);
    assert.deepEqual(result.coverage.canonicalFallbackPaths, ["petition.paragraphs[4]"]);

    const p4 = readNodeAtPath(result.presentation, "petition.paragraphs[4]");
    assert.equal(p4, "Petition paragraph five commits to follow-through tracking.");
  });

  it("Media: explanations localize; names/URLs protected", () => {
    const fixture = buildPack08kMediaFixture();
    const translations = buildFullProofTranslations(fixture.presentation, "uk");
    assertNoProtectedValuesMutatedInMap(fixture.presentation, translations);

    const result = localizePublicPresentation({
      identity: fixture.identity,
      sourceLanguage: "en",
      targetLanguage: "uk",
      presentation: fixture.presentation,
      translations,
    });

    assert.equal(result.coverage.status, "COMPLETE");

    const explanation = readNodeAtPath(result.presentation, "trustedCards[0].explanation");
    assert.match(String(explanation), /^\[uk\] /);

    assertProtectedUnchanged(
      fixture.presentation,
      result.presentation,
      "trustedCards[0].outletName",
    );
    assertProtectedUnchanged(
      fixture.presentation,
      result.presentation,
      "trustedCards[0].websiteUrl",
    );
    assertProtectedUnchanged(
      fixture.presentation,
      result.presentation,
      "trustedCards[1].outletName",
    );
  });

  it("Future artifact: new keys translate without allowlist", () => {
    const fixture = buildPack08kFutureArtifactFixture();
    const translations = buildFullProofTranslations(fixture.presentation, "uk");
    assertNoProtectedValuesMutatedInMap(fixture.presentation, translations);

    assert.deepEqual(Object.keys(translations).sort(), [
      "completelyNewSemanticProperty",
      "nested.anotherNeverSeenBeforeField",
      "title",
    ]);

    const result: PublicLocalizedPresentation = localizePublicPresentation({
      identity: fixture.identity,
      sourceLanguage: "en",
      targetLanguage: "uk",
      presentation: fixture.presentation,
      translations,
    });

    assert.equal(result.coverage.status, "COMPLETE");
    assert.equal(readNodeAtPath(result.presentation, "title"), "[uk] Canonical title");
    assert.equal(
      readNodeAtPath(result.presentation, "completelyNewSemanticProperty"),
      "[uk] Canonical new prose",
    );
    assert.equal(
      readNodeAtPath(result.presentation, "nested.anotherNeverSeenBeforeField"),
      "[uk] Canonical nested prose",
    );
    assertProtectedUnchanged(fixture.presentation, result.presentation, "id");
    assertProtectedUnchanged(fixture.presentation, result.presentation, "creatorName");
  });

  it("Names/IDs never appear in translation maps as mutated protected paths", () => {
    const fixture = buildPack08kLifecycleFixture();
    const translations = buildFullProofTranslations(fixture.presentation, "uk");
    const autoPaths = collectAutoTranslatableNodes(fixture.presentation).map((n) => n.path);

    assert.ok(!autoPaths.includes("initiative.initiativeId"));
    assert.ok(!autoPaths.some((p) => p.endsWith("authorName")));
    assert.ok(!Object.prototype.hasOwnProperty.call(translations, "initiative.initiativeId"));
    assertNoProtectedValuesMutatedInMap(fixture.presentation, translations);

    const id = buildPresentationIdentity("blog_post", "x");
    assert.equal(id.sourceKind, "blog_post");
  });
});
