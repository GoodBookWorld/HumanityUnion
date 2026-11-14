/**
 * HU-LC-05C.4C.7D.2A — Petition WEB_UI localization scope and readiness safety.
 * Editing Petition keys join the ordinary corpus so every activated and future
 * language translates them. Deterministic. No provider. No Mongo.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyWebUiCoveragePath,
  isParticipantWebUiRequiredPath,
  isPublicReaderWebUiRequiredPath,
  PARTICIPANT_WEB_UI_REQUIRED_PREFIXES,
  PUBLIC_READER_WEB_UI_REQUIRED_PREFIXES,
} from "@hu/types";

import {
  emptyPendingDomains,
  isLanguageActivationWebUiReadyForHistoricalEnqueue,
} from "../../../src/modules/language/language-localization-activation/language-activation-job.domains.js";
import { assessWebUiMessageTreeReadiness } from "../../../src/modules/language/language-localization-activation/assess-web-ui-catalog-readiness.js";
import {
  buildWebUiSourceFingerprintsByPath,
  loadPublicWebUiEnglishCorpus,
  planWebUiDraftBatches,
  unflattenWebUiMessageMap,
} from "../../../src/modules/web-ui-message-packs/web-ui-draft-builder.js";
import { classifyWebUiCatalogLeaves } from "../../../src/modules/web-ui-message-packs/web-ui-leaf-reuse.js";
import {
  loadBundledEnglishWebUiMessagePack,
  loadBundledWebUiMessagePackFromFs,
  selectEnglishWebUiMessages,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.validate.js";

const EDITING = "initiativeExperience.petitionEditing.";
const TABS = "initiativeExperience.petitionEditing.tabs.";

function flatten(messages: unknown, prefix = "", out: Record<string, string> = {}) {
  for (const [key, value] of Object.entries(messages as Record<string, unknown>)) {
    const pathKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      out[pathKey] = value;
    } else if (value != null && typeof value === "object" && !Array.isArray(value)) {
      flatten(value, pathKey, out);
    }
  }
  return out;
}

function englishEditingPaths(): string[] {
  return Object.keys(flatten(loadBundledEnglishWebUiMessagePack()))
    .filter((pathKey) => pathKey.startsWith(EDITING))
    .sort();
}

function withLeaf(
  tree: unknown,
  dottedPath: string,
  edit: (parent: Record<string, unknown>, leaf: string) => void,
): unknown {
  const copy = structuredClone(tree) as Record<string, unknown>;
  const segments = dottedPath.split(".");
  let cursor = copy;
  for (const segment of segments.slice(0, -1)) {
    cursor = cursor[segment] as Record<string, unknown>;
  }
  edit(cursor, segments[segments.length - 1] ?? "");
  return copy;
}

function withoutPath(tree: unknown, dottedPath: string): unknown {
  return withLeaf(tree, dottedPath, (parent, leaf) => {
    delete parent[leaf];
  });
}

function withValue(tree: unknown, dottedPath: string, value: string): unknown {
  return withLeaf(tree, dottedPath, (parent, leaf) => {
    parent[leaf] = value;
  });
}

describe("HU-LC-05C.4C.7D.2A — Petition WEB_UI scope", () => {
  it("Editing Petition keys are Participant-required; only the view tabs are also public-required", () => {
    const paths = englishEditingPaths();
    assert.ok(paths.length > 0);
    for (const pathKey of paths) {
      const isTab = pathKey.startsWith(TABS);
      assert.equal(isParticipantWebUiRequiredPath(pathKey), true, pathKey);
      assert.equal(isPublicReaderWebUiRequiredPath(pathKey), isTab, pathKey);
      const classification = classifyWebUiCoveragePath(pathKey);
      assert.equal(classification.unknown, false, pathKey);
      assert.equal(classification.privileged, false, pathKey);
      assert.equal(classification.kind, isTab ? "ordinary_shared" : "participant_required", pathKey);
    }
    assert.deepEqual(
      paths.filter((pathKey) => pathKey.startsWith(TABS)),
      [`${TABS}aria`, `${TABS}editing`, `${TABS}status`],
    );
  });

  it("the namespaces planned for Petition Status are already public-required", () => {
    for (const pathKey of [
      "initiativeExperience.author.petition.public.status.sectionTitle",
      "initiativeExperience.petitionSignature.checkingStatus",
    ]) {
      assert.equal(isPublicReaderWebUiRequiredPath(pathKey), true, pathKey);
      assert.equal(classifyWebUiCoveragePath(pathKey).kind, "public_required", pathKey);
      assert.equal(classifyWebUiCoveragePath(pathKey).privileged, false, pathKey);
    }
  });

  it("adds no unrelated scope", () => {
    assert.deepEqual(
      PUBLIC_READER_WEB_UI_REQUIRED_PREFIXES.filter((prefix) => prefix.includes("petitionEditing")),
      [TABS],
    );
    assert.deepEqual(
      PARTICIPANT_WEB_UI_REQUIRED_PREFIXES.filter((prefix) => prefix.includes("petitionEditing")),
      [EDITING],
    );
    for (const pathKey of [
      "initiativeExperience.petitionEditing.intro",
      "initiativeExperience.petitionEditing.confirm.publish.title",
      "initiativeExperience.petitionEditing.errors.slotLimit",
    ]) {
      assert.equal(isPublicReaderWebUiRequiredPath(pathKey), false, pathKey);
    }
    for (const pathKey of [
      "initiativeExperience.author.petition.messages.published",
      "initiativeExperience.author.sidebar.title",
      "workspace.editorialPage.title",
    ]) {
      assert.equal(isParticipantWebUiRequiredPath(pathKey), false, pathKey);
      assert.equal(isPublicReaderWebUiRequiredPath(pathKey), false, pathKey);
      assert.equal(classifyWebUiCoveragePath(pathKey).kind, "privileged", pathKey);
    }

    const editing = new Set(englishEditingPaths());
    const corpus = loadPublicWebUiEnglishCorpus();
    const newlyRequired = corpus.requiredPaths.filter((pathKey) => pathKey.startsWith(EDITING));
    assert.deepEqual([...newlyRequired].sort(), [...editing].sort());
  });

  it("a future language's activation corpus contains every Editing Petition key", () => {
    const editing = englishEditingPaths();
    const corpus = loadPublicWebUiEnglishCorpus();
    const required = new Set(corpus.requiredPaths);
    const batched = new Set(planWebUiDraftBatches(corpus.flat).flatMap((batch) => batch.keys));
    const selected = new Set(selectEnglishWebUiMessages("public").selectedPaths);
    for (const pathKey of editing) {
      assert.equal(required.has(pathKey), true, pathKey);
      assert.equal(batched.has(pathKey), true, pathKey);
      assert.equal(selected.has(pathKey), true, pathKey);
      assert.equal(typeof corpus.flat[pathKey], "string", pathKey);
    }
  });

  it("a pack published before Editing Petition keeps every translation; only the new keys go to the provider", () => {
    const corpus = loadPublicWebUiEnglishCorpus();
    const editing = englishEditingPaths();
    const editingSet = new Set(editing);
    const oldPaths = corpus.requiredPaths.filter((pathKey) => !editingSet.has(pathKey));
    const fingerprints = buildWebUiSourceFingerprintsByPath(corpus.flat, oldPaths);
    const localized: Record<string, string> = {};
    for (const pathKey of oldPaths) {
      localized[pathKey] = corpus.flat[pathKey] ?? "";
    }

    const decisions = classifyWebUiCatalogLeaves({
      englishFlat: corpus.flat,
      mongo: unflattenWebUiMessageMap(localized),
      mongoSourceFingerprintsByPath: fingerprints,
      packaged: null,
      bundled: null,
    });
    for (const pathKey of oldPaths) {
      assert.equal(decisions.get(pathKey)?.classification, "REUSE_CURRENT", pathKey);
    }
    const residual = planWebUiDraftBatches(corpus.flat)
      .flatMap((batch) => batch.keys)
      .filter((key) => decisions.get(key)?.classification !== "REUSE_CURRENT")
      .sort();
    assert.deepEqual(residual, editing);
    for (const pathKey of editing) {
      assert.equal(decisions.get(pathKey)?.classification, "MISSING", pathKey);
    }

    const publicPaths = corpus.requiredPaths.filter((pathKey) =>
      isPublicReaderWebUiRequiredPath(pathKey),
    );
    const participantPaths = corpus.requiredPaths.filter((pathKey) =>
      isParticipantWebUiRequiredPath(pathKey),
    );
    const publicBefore = assessWebUiMessageTreeReadiness({
      messages: unflattenWebUiMessageMap(localized),
      requiredPaths: publicPaths,
    });
    const participantBefore = assessWebUiMessageTreeReadiness({
      messages: unflattenWebUiMessageMap(localized),
      requiredPaths: participantPaths,
    });
    assert.equal(publicBefore.dataReady, false);
    assert.equal(publicBefore.missingKeyCount, 3);
    assert.deepEqual([...publicBefore.sampleMissingPaths].sort(), [
      `${TABS}aria`,
      `${TABS}editing`,
      `${TABS}status`,
    ]);
    assert.equal(participantBefore.dataReady, false);
    assert.equal(participantBefore.missingKeyCount, editing.length);
    assert.ok(participantBefore.sampleMissingPaths.every((pathKey) => editingSet.has(pathKey)));

    const otherwiseReady = {
      ...emptyPendingDomains().webUi,
      status: "ready" as const,
      dataReady: true,
      preparationPhase: "ready" as const,
    };
    assert.equal(
      isLanguageActivationWebUiReadyForHistoricalEnqueue({
        webUi: otherwiseReady,
        publicWebUiDataReady: publicBefore.dataReady,
        participantWebUiDataReady: participantBefore.dataReady,
      }),
      false,
    );

    const completed = { ...localized };
    for (const pathKey of editing) {
      completed[pathKey] = `«${corpus.flat[pathKey]}»`;
    }
    const publicAfter = assessWebUiMessageTreeReadiness({
      messages: unflattenWebUiMessageMap(completed),
      requiredPaths: publicPaths,
    });
    const participantAfter = assessWebUiMessageTreeReadiness({
      messages: unflattenWebUiMessageMap(completed),
      requiredPaths: participantPaths,
    });
    assert.equal(publicAfter.dataReady, true);
    assert.equal(participantAfter.dataReady, true);
    assert.equal(
      isLanguageActivationWebUiReadyForHistoricalEnqueue({
        webUi: otherwiseReady,
        publicWebUiDataReady: publicAfter.dataReady,
        participantWebUiDataReady: participantAfter.dataReady,
      }),
      true,
    );
  });

  it("detects a missing or empty Editing Petition key in a bundled language", () => {
    const ukrainian = loadBundledWebUiMessagePackFromFs("uk");
    assert.ok(ukrainian);
    const baselinePublic = assessWebUiMessageTreeReadiness({ messages: ukrainian, scope: "public" });

    const missingIntro = withoutPath(ukrainian, `${EDITING}intro`);
    const participant = assessWebUiMessageTreeReadiness({
      messages: missingIntro as typeof ukrainian,
      scope: "participant",
    });
    assert.equal(participant.dataReady, false);
    assert.equal(participant.missingKeyCount, 1);
    assert.deepEqual(participant.sampleMissingPaths, [`${EDITING}intro`]);
    const publicAfterIntro = assessWebUiMessageTreeReadiness({
      messages: missingIntro as typeof ukrainian,
      scope: "public",
    });
    assert.equal(publicAfterIntro.missingKeyCount, baselinePublic.missingKeyCount);

    const emptyTab = withValue(ukrainian, `${TABS}status`, " ") as typeof ukrainian;
    const publicEmpty = assessWebUiMessageTreeReadiness({ messages: emptyTab, scope: "public" });
    const participantEmpty = assessWebUiMessageTreeReadiness({
      messages: emptyTab,
      scope: "participant",
    });
    assert.equal(publicEmpty.dataReady, false);
    assert.equal(publicEmpty.emptyKeyCount, baselinePublic.emptyKeyCount + 1);
    assert.equal(participantEmpty.dataReady, false);
    assert.equal(participantEmpty.emptyKeyCount, 1);
  });

  it("bundled uk, ar and zh-Hant cover the expanded Participant scope with real translations", () => {
    const editing = englishEditingPaths();
    for (const locale of ["uk", "ar", "zh-Hant"]) {
      const messages = loadBundledWebUiMessagePackFromFs(locale);
      assert.ok(messages, locale);
      const participant = assessWebUiMessageTreeReadiness({ messages, scope: "participant" });
      assert.equal(participant.dataReady, true, locale);
      const editingOnly = assessWebUiMessageTreeReadiness({
        messages,
        requiredPaths: editing,
        flagEnglishIdenticalAsFallback: true,
      });
      assert.equal(editingOnly.dataReady, true, locale);
      assert.equal(editingOnly.englishFallbackKeyCount, 0, locale);
    }
  });
});
