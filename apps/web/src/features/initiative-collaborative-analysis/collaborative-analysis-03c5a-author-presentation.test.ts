/**
 * Localization Closure 03C.5A — Author Mode web presentation boundary.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  lifecycleStageToken,
  textContainsLifecycleStageToken,
} from "@hu/types";

import {
  authorPresentedFieldsContainLifecycleTokens,
  buildCollaborativeAnalysisAuthorSaveInput,
  presentCollaborativeAnalysisForAuthorEditor,
} from "./collaborative-analysis-author-presentation";

const ANALYSIS = lifecycleStageToken("analysis");
const DISCUSSION = lifecycleStageToken("discussion");

const featureRoot = path.dirname(fileURLToPath(import.meta.url));

const tokenizedAnalysis = {
  title: `${ANALYSIS}: Community Garden`,
  summary: `No ${DISCUSSION} activity has been collected yet.`,
  supportingEvidence: "evidence",
  risks: "risks",
  openQuestions: "",
  suggestedImprovements: "improvements",
  references: `"quote" — Ally (see ${DISCUSSION})`,
};

describe("Localization Closure 03C.5A — Author editor presentation (web)", () => {
  it("Author Mode presentation contains English labels; raw tokens never reach presented fields", () => {
    const presented = presentCollaborativeAnalysisForAuthorEditor(tokenizedAnalysis);
    assert.equal(presented.title, "Collaborative Analysis: Community Garden");
    assert.equal(
      presented.summary,
      "No Discussion activity has been collected yet.",
    );
    assert.match(presented.references, /see Discussion/);
    assert.equal(authorPresentedFieldsContainLifecycleTokens(presented), false);
    for (const value of Object.values(presented)) {
      assert.equal(textContainsLifecycleStageToken(value), false);
    }
  });

  it("unchanged Author presentation does not destroy semantic identity on save", () => {
    const presented = presentCollaborativeAnalysisForAuthorEditor(tokenizedAnalysis);
    const saveInput = buildCollaborativeAnalysisAuthorSaveInput({
      analysis: tokenizedAnalysis,
      presented,
    });
    assert.equal(saveInput.title, tokenizedAnalysis.title);
    assert.equal(saveInput.summary, tokenizedAnalysis.summary);
    assert.equal(saveInput.references, tokenizedAnalysis.references);
    assert.ok(textContainsLifecycleStageToken(saveInput.title ?? ""));
    assert.ok(textContainsLifecycleStageToken(saveInput.references ?? ""));
  });

  it("prose-only Author edits preserve lifecycle tokens on save (03C.5B)", () => {
    const presented = presentCollaborativeAnalysisForAuthorEditor(tokenizedAnalysis);
    const saveInput = buildCollaborativeAnalysisAuthorSaveInput({
      analysis: tokenizedAnalysis,
      presented: {
        ...presented,
        summary: "Still no Discussion activity has been collected yet — check later.",
        references: `"quote" — Ally (see Discussion) with follow-up`,
      },
    });
    assert.equal(
      saveInput.summary,
      "Still no {lifecycleStage:discussion} activity has been collected yet — check later.",
    );
    assert.equal(
      saveInput.references,
      `"quote" — Ally (see {lifecycleStage:discussion}) with follow-up`,
    );
    assert.equal(saveInput.title, tokenizedAnalysis.title);
  });

  it("Form and DraftPreview bind Author presentation helpers (no raw analysis.* into fields)", () => {
    const form = readFileSync(
      path.join(featureRoot, "components/InitiativeCollaborativeAnalysisForm.tsx"),
      "utf8",
    );
    const preview = readFileSync(
      path.join(featureRoot, "components/InitiativeCollaborativeAnalysisDraftPreview.tsx"),
      "utf8",
    );
    assert.match(form, /presentCollaborativeAnalysisForAuthorEditor/);
    assert.match(form, /buildCollaborativeAnalysisAuthorSaveInput/);
    assert.doesNotMatch(form, /title:\s*analysis\.title/);
    assert.match(preview, /presentCollaborativeAnalysisForAuthorEditor/);
    assert.doesNotMatch(preview, /title=\{analysis\.title\}/);
  });
});
