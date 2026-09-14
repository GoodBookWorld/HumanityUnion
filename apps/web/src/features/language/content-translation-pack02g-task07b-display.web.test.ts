/**
 * Pack 02G Task 07B — async translation display mode lifecycle.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

import {
  resolveTranslatedContentViewModeLifecycle,
  translatedContentHasDistinctTranslation,
} from "./translated-content-view-mode";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readWeb(rel: string): string {
  return readFileSync(path.join(webRoot, rel), "utf8");
}

describe("Production Completion Pack 02G Task 07B — async translation display", () => {
  it("A. async distinct translation auto-selects translation mode", () => {
    const before = resolveTranslatedContentViewModeLifecycle({
      hasDistinctTranslation: false,
      previouslyHadDistinctTranslation: false,
      currentMode: "original",
      userPrefersOriginal: false,
    });
    assert.equal(before.mode, "original");
    assert.equal(before.previouslyHadDistinctTranslation, false);

    const after = resolveTranslatedContentViewModeLifecycle({
      hasDistinctTranslation: true,
      previouslyHadDistinctTranslation: before.previouslyHadDistinctTranslation,
      currentMode: before.mode,
      userPrefersOriginal: before.userPrefersOriginal,
    });
    assert.equal(after.mode, "translation");
    assert.equal(after.previouslyHadDistinctTranslation, true);
    assert.equal(after.userPrefersOriginal, false);
  });

  it("B. View Original is preserved across ordinary rerenders", () => {
    let state = resolveTranslatedContentViewModeLifecycle({
      hasDistinctTranslation: true,
      previouslyHadDistinctTranslation: false,
      currentMode: "original",
      userPrefersOriginal: false,
    });
    assert.equal(state.mode, "translation");

    // Participant chooses View Original.
    state = {
      mode: "original",
      previouslyHadDistinctTranslation: true,
      userPrefersOriginal: true,
    };

    const rerender = resolveTranslatedContentViewModeLifecycle({
      hasDistinctTranslation: true,
      previouslyHadDistinctTranslation: state.previouslyHadDistinctTranslation,
      currentMode: state.mode,
      userPrefersOriginal: state.userPrefersOriginal,
    });
    assert.equal(rerender.mode, "original");
    assert.equal(rerender.userPrefersOriginal, true);

    const anotherRerender = resolveTranslatedContentViewModeLifecycle({
      hasDistinctTranslation: true,
      previouslyHadDistinctTranslation: rerender.previouslyHadDistinctTranslation,
      currentMode: rerender.mode,
      userPrefersOriginal: rerender.userPrefersOriginal,
    });
    assert.equal(anotherRerender.mode, "original");
  });

  it("C. no distinct translation stays original without toggle eligibility", () => {
    assert.equal(
      translatedContentHasDistinctTranslation({
        content: "Same English title",
        originalContent: "Same English title",
        canViewOriginal: true,
      }),
      false,
    );
    assert.equal(
      translatedContentHasDistinctTranslation({
        content: "Ukrainian title",
        originalContent: "Same English title",
        canViewOriginal: false,
      }),
      false,
    );

    const state = resolveTranslatedContentViewModeLifecycle({
      hasDistinctTranslation: false,
      previouslyHadDistinctTranslation: false,
      currentMode: "original",
      userPrefersOriginal: false,
    });
    assert.equal(state.mode, "original");
  });

  it("D. translation unavailable falls back to original and clears manual preference", () => {
    const unavailable = resolveTranslatedContentViewModeLifecycle({
      hasDistinctTranslation: false,
      previouslyHadDistinctTranslation: true,
      currentMode: "original",
      userPrefersOriginal: true,
    });
    assert.equal(unavailable.mode, "original");
    assert.equal(unavailable.previouslyHadDistinctTranslation, false);
    assert.equal(unavailable.userPrefersOriginal, false);

    // When translation returns later, auto-select translation again.
    const returned = resolveTranslatedContentViewModeLifecycle({
      hasDistinctTranslation: true,
      previouslyHadDistinctTranslation: unavailable.previouslyHadDistinctTranslation,
      currentMode: unavailable.mode,
      userPrefersOriginal: unavailable.userPrefersOriginal,
    });
    assert.equal(returned.mode, "translation");
  });

  it("wires lifecycle helper into TranslatedContentView (no forced remount key)", () => {
    const view = readWeb("src/features/language/components/TranslatedContentView.tsx");
    assert.match(view, /resolveTranslatedContentViewModeLifecycle/);
    assert.match(view, /userPrefersOriginal/);
    assert.match(view, /previouslyHadDistinctTranslation/);
    assert.doesNotMatch(view, /key=\{.*activeLanguage/);
  });
});
