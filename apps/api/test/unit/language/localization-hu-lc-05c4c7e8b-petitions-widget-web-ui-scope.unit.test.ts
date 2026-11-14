/**
 * HU-LC-05C.4C.7E.8B — public Initiative Petitions widget WEB_UI scope.
 * The widget keys are public-reader required, so generated packs for new
 * languages include them. Deterministic. No provider. No Mongo.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  classifyWebUiCoveragePath,
  isParticipantWebUiRequiredPath,
  isPublicReaderWebUiRequiredPath,
  listUnknownWebUiCoveragePaths,
  PARTICIPANT_WEB_UI_REQUIRED_PREFIXES,
  PUBLIC_READER_WEB_UI_REQUIRED_PREFIXES,
} from "@hu/types";

import { assessWebUiMessageTreeReadiness } from "../../../src/modules/language/language-localization-activation/assess-web-ui-catalog-readiness.js";
import { loadPackagedWebUiCatalog } from "../../../src/modules/web-ui-message-packs/packaged-web-ui-catalog.js";
import {
  assertCompletePublicWebUiDraft,
  loadPublicWebUiEnglishCorpus,
  planWebUiDraftBatches,
} from "../../../src/modules/web-ui-message-packs/web-ui-draft-builder.js";
import {
  collectStringPaths,
  loadBundledEnglishWebUiMessagePack,
  selectEnglishWebUiMessages,
  validateWebUiMessageTreeAgainstEnglish,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.validate.js";

const WIDGET = "initiativeExperience.petitionsWidget.";
const WIDGET_KEYS = [
  "initiativeExperience.petitionsWidget.countAria",
  "initiativeExperience.petitionsWidget.empty",
  "initiativeExperience.petitionsWidget.listAria",
  "initiativeExperience.petitionsWidget.loadFailed",
  "initiativeExperience.petitionsWidget.loading",
  "initiativeExperience.petitionsWidget.signatures",
  "initiativeExperience.petitionsWidget.title",
] as const;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");

function englishWidgetPaths(): string[] {
  return collectStringPaths(loadBundledEnglishWebUiMessagePack())
    .filter((pathKey) => pathKey.startsWith(WIDGET))
    .sort();
}

describe("HU-LC-05C.4C.7E.8B Petitions widget public WEB_UI scope", () => {
  it("the English catalog has exactly the seven widget keys", () => {
    assert.deepEqual(englishWidgetPaths(), [...WIDGET_KEYS]);
  });

  it("every widget key is public-reader required and classified", () => {
    for (const pathKey of WIDGET_KEYS) {
      assert.equal(isPublicReaderWebUiRequiredPath(pathKey), true, pathKey);
      assert.equal(isParticipantWebUiRequiredPath(pathKey), false, pathKey);
      const classification = classifyWebUiCoveragePath(pathKey);
      assert.equal(classification.kind, "public_required", pathKey);
      assert.equal(classification.unknown, false, pathKey);
      assert.equal(classification.privileged, false, pathKey);
    }
  });

  it("adds one public prefix and leaves participant scope unchanged", () => {
    assert.deepEqual(
      PUBLIC_READER_WEB_UI_REQUIRED_PREFIXES.filter((prefix) => prefix.includes("petitionsWidget")),
      [WIDGET],
    );
    assert.equal(new Set(PUBLIC_READER_WEB_UI_REQUIRED_PREFIXES).size, PUBLIC_READER_WEB_UI_REQUIRED_PREFIXES.length);
    assert.deepEqual(
      PARTICIPANT_WEB_UI_REQUIRED_PREFIXES.filter((prefix) => prefix.includes("petitionsWidget")),
      [],
    );
    assert.equal(isParticipantWebUiRequiredPath("initiativeExperience.petitionEditing.intro"), true);
    assert.equal(isPublicReaderWebUiRequiredPath("initiativeExperience.petitionEditing.intro"), false);
  });

  it("no English catalog path remains unclassified", () => {
    assert.deepEqual(
      listUnknownWebUiCoveragePaths(collectStringPaths(loadBundledEnglishWebUiMessagePack())),
      [],
    );
  });

  it("language-pack generation discovers the widget keys for a new language", () => {
    const corpus = loadPublicWebUiEnglishCorpus();
    const selected = selectEnglishWebUiMessages("public").selectedPaths;
    const planned = new Set(planWebUiDraftBatches(corpus.flat).flatMap((batch) => batch.keys));
    for (const pathKey of WIDGET_KEYS) {
      assert.ok(corpus.requiredPaths.includes(pathKey), pathKey);
      assert.ok(selected.includes(pathKey), pathKey);
      assert.ok(planned.has(pathKey), pathKey);
    }
    assert.equal(new Set(corpus.requiredPaths).size, corpus.requiredPaths.length);
  });

  it("packaged uk, ar and zh-Hant catalogs remain adoptable", () => {
    const { requiredPaths } = loadPublicWebUiEnglishCorpus();
    for (const locale of ["uk", "ar", "zh-Hant"]) {
      const packaged = loadPackagedWebUiCatalog(locale);
      assert.ok(packaged, locale);
      const validation = validateWebUiMessageTreeAgainstEnglish(packaged);
      assert.deepEqual(validation.rejectedUnknownPaths, [], locale);
      assert.deepEqual(validation.placeholderMismatchPaths, [], locale);
      assert.deepEqual(validation.emptyPaths, [], locale);
      assertCompletePublicWebUiDraft({ messages: packaged, requiredPaths });
      const publicReady = assessWebUiMessageTreeReadiness({ messages: packaged, scope: "public" });
      assert.equal(publicReady.dataReady, true, `${locale} public`);
      const participantReady = assessWebUiMessageTreeReadiness({
        messages: packaged,
        scope: "participant",
      });
      assert.equal(participantReady.dataReady, true, `${locale} participant`);
    }
  });

  it("a pack without the widget keys is not public-ready", () => {
    const { requiredPaths } = loadPublicWebUiEnglishCorpus();
    const packaged = structuredClone(loadPackagedWebUiCatalog("uk")) as Record<string, unknown>;
    delete (packaged.initiativeExperience as Record<string, unknown>).petitionsWidget;
    const readiness = assessWebUiMessageTreeReadiness({ messages: packaged as never, scope: "public" });
    assert.equal(readiness.dataReady, false);
    assert.equal(readiness.missingKeyCount, WIDGET_KEYS.length);
    assert.throws(() => assertCompletePublicWebUiDraft({ messages: packaged as never, requiredPaths }));
  });

  it("the public hero widget reads the petitionsWidget namespace", () => {
    const widget = readFileSync(
      path.join(
        repoRoot,
        "apps/web/src/features/initiative-petition-lifecycle/components/InitiativePetitionsHeroWidget.tsx",
      ),
      "utf8",
    );
    for (const pathKey of WIDGET_KEYS) {
      assert.ok(widget.includes(`"${pathKey.replace("initiativeExperience.", "")}"`), pathKey);
    }
  });
});
