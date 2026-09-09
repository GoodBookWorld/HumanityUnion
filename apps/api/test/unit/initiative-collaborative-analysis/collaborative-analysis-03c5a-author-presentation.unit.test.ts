/**
 * Localization Closure 03C.5A — Author Mode lifecycle-token presentation + save merge.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  lifecycleStageToken,
  mergeCollaborativeAnalysisAuthorSaveFields,
  presentLifecycleStageTokenFieldsAsEnglish,
  presentLifecycleStageTokensAsEnglish,
  preserveLifecycleStageTokensWhenPresentationUnchanged,
  textContainsLifecycleStageToken,
} from "@hu/types";

import { generateAnalysisDraft } from "../../../src/modules/initiative-collaborative-analysis/initiative-analysis-draft-builder.js";
import type { InitiativeAnalysisSourceSnapshot } from "@hu/types";

const ANALYSIS = lifecycleStageToken("analysis");
const DISCUSSION = lifecycleStageToken("discussion");

const EMPTY_SNAPSHOT: InitiativeAnalysisSourceSnapshot = {
  initiativeId: "03c5a-empty",
  generatedAt: new Date().toISOString(),
  discussionStatistics: { commentCount: 0, helpfulCount: 0, notHelpfulCount: 0 },
  mostDiscussedTopics: [],
  openQuestions: [],
  repeatedArguments: [],
  repeatedConcerns: [],
  proposalCandidates: [],
  activeAlliesCount: 0,
  readyToCollaborateCount: 0,
  discussionUrl: "/initiatives/public/03c5a-empty#discussion",
  isEmpty: true,
};

describe("Localization Closure 03C.5A — Author Mode token presentation", () => {
  it("generated persisted CA content contains semantic lifecycle tokens", async () => {
    const draft = await generateAnalysisDraft({
      initiativeTitle: "Garden",
      snapshot: EMPTY_SNAPSHOT,
    });
    assert.equal(draft.title, `${ANALYSIS}: Garden`);
    assert.match(draft.summary, new RegExp(DISCUSSION.replace(/[{}]/g, "\\$&")));
    assert.ok(textContainsLifecycleStageToken(draft.title));
  });

  it("Author Mode presentation contains English lifecycle labels, never raw tokens", () => {
    const canonical = {
      title: `${ANALYSIS}: Garden`,
      summary: `No ${DISCUSSION} activity yet.`,
      references: `(see ${DISCUSSION})`,
    };
    const presented = presentLifecycleStageTokenFieldsAsEnglish(canonical);
    assert.equal(presented.title, "Collaborative Analysis: Garden");
    assert.equal(presented.summary, "No Discussion activity yet.");
    assert.equal(presented.references, "(see Discussion)");
    for (const value of Object.values(presented)) {
      assert.equal(textContainsLifecycleStageToken(value), false);
      assert.doesNotMatch(value, /\{lifecycleStage:/);
    }
  });

  it("unchanged Author presentation preserves semantic tokens on save merge", () => {
    const canonical = {
      title: `${ANALYSIS}: Garden`,
      summary: `No ${DISCUSSION} activity yet.`,
    };
    const presented = {
      title: presentLifecycleStageTokensAsEnglish(canonical.title),
      summary: presentLifecycleStageTokensAsEnglish(canonical.summary),
    };
    const merged = mergeCollaborativeAnalysisAuthorSaveFields({
      canonical,
      presented,
    });
    assert.equal(merged.title, canonical.title);
    assert.equal(merged.summary, canonical.summary);
    assert.ok(textContainsLifecycleStageToken(merged.title));
  });

  it("intentional Author label+prose edit that keeps lifecycle anchors preserves the token (03C.5B.3)", () => {
    const canonical = {
      title: `${ANALYSIS}: Garden`,
    };
    // Right-anchor token "Garden" remains immediately after the label; extra prose follows.
    const merged = mergeCollaborativeAnalysisAuthorSaveFields({
      canonical,
      presented: { title: "Collaborative Analysis: Garden (revised)" },
    });
    assert.equal(merged.title, `${ANALYSIS}: Garden (revised)`);
    assert.ok(textContainsLifecycleStageToken(merged.title));
  });

  it("title rewrite that breaks right anchors fails closed to literal (03C.5B.3)", () => {
    const merged = mergeCollaborativeAnalysisAuthorSaveFields({
      canonical: { title: `${ANALYSIS}: Garden` },
      presented: { title: "Collaborative Analysis: Renamed Garden" },
    });
    assert.equal(merged.title, "Collaborative Analysis: Renamed Garden");
    assert.equal(textContainsLifecycleStageToken(merged.title), false);
  });

  it("preserveLifecycleStageTokensWhenPresentationUnchanged keeps tokens across prose edits", () => {
    const kept = preserveLifecycleStageTokensWhenPresentationUnchanged({
      canonicalField: `see ${DISCUSSION}`,
      presentedEdit: "see Discussion",
    });
    assert.equal(kept, `see ${DISCUSSION}`);

    const proseEdit = preserveLifecycleStageTokensWhenPresentationUnchanged({
      canonicalField: `see ${DISCUSSION}`,
      presentedEdit: "see Discussion and notes",
    });
    assert.equal(proseEdit, `see ${DISCUSSION} and notes`);
  });

  it("CT build path still receives tokenized canonical bags (composition is presentation-only)", () => {
    const persistedTitle = `${ANALYSIS}: Garden`;
    const authorPresented = presentLifecycleStageTokensAsEnglish(persistedTitle);
    assert.equal(authorPresented, "Collaborative Analysis: Garden");
    // Persisted / CT source remains tokenized independently of Author presentation.
    assert.ok(textContainsLifecycleStageToken(persistedTitle));
    assert.equal(textContainsLifecycleStageToken(authorPresented), false);
  });
});
