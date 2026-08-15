/**
 * UX Stability Pack 01 — focused tests for the pure horizontal-rail
 * navigation math (horizontal-rail-navigation.ts) that drives arrow-button
 * enabled/disabled state and the "Showing X-Y of Z" summary.
 *
 * `apps/web` has no React/DOM test harness (no jsdom, no @testing-library),
 * so this hook's `WheelEvent`/`PointerEvent` handling and rendering cannot be
 * exercised via a rendered component in this repo today. Per the pure-logic
 * extraction convention already used in this app (see
 * public-initiative-experience/components/discussion-comment-presentation.test.ts),
 * the framework-free arrow/breakpoint math is tested directly here, and the
 * absence of any wheel-to-scrollLeft conversion in the shared hook is guarded
 * by a source-level regression test in useMediaHorizontalRail.wheel-policy.test.ts.
 *
 * Run with (from apps/web):
 *   npx tsx --test src/features/civic-media-center/media-rail/horizontal-rail-navigation.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeRailNavigationState,
  getDefaultVisibleCount,
  resolveVisibleCountForBreakpoints,
} from "./horizontal-rail-navigation.js";

describe("getDefaultVisibleCount", () => {
  it("shows 4 cards for four-column layouts", () => {
    assert.equal(getDefaultVisibleCount("four-two-one"), 4);
    assert.equal(getDefaultVisibleCount("four-three-one"), 4);
  });

  it("shows 3 cards for the default three-column layout", () => {
    assert.equal(getDefaultVisibleCount("three-two-one"), 3);
  });
});

describe("resolveVisibleCountForBreakpoints (drives arrow state on resize — Part 8)", () => {
  it("shows exactly 1 card on mobile regardless of layout", () => {
    assert.equal(
      resolveVisibleCountForBreakpoints("four-two-one", { isMobile: true, isTablet: true }),
      1,
    );
  });

  it("shows 2 cards on tablet for most layouts", () => {
    assert.equal(
      resolveVisibleCountForBreakpoints("three-two-one", { isMobile: false, isTablet: true }),
      2,
    );
    assert.equal(
      resolveVisibleCountForBreakpoints("four-two-one", { isMobile: false, isTablet: true }),
      2,
    );
  });

  it("shows 3 cards on tablet for the four-three-one layout", () => {
    assert.equal(
      resolveVisibleCountForBreakpoints("four-three-one", { isMobile: false, isTablet: true }),
      3,
    );
  });

  it("falls back to the layout default on desktop", () => {
    assert.equal(
      resolveVisibleCountForBreakpoints("three-two-one", { isMobile: false, isTablet: false }),
      3,
    );
    assert.equal(
      resolveVisibleCountForBreakpoints("four-two-one", { isMobile: false, isTablet: false }),
      4,
    );
  });
});

describe("computeRailNavigationState (arrow enabled/disabled — Part 8)", () => {
  it("disables both arrows and marks all items visible when everything fits", () => {
    const state = computeRailNavigationState(3, 3, 0);
    assert.equal(state.allItemsVisible, true);
    assert.equal(state.canScrollPrevious, false);
    assert.equal(state.canScrollNext, false);
    assert.equal(state.visibleEnd, 3);
  });

  it("enables only the next arrow at the start of a longer list", () => {
    const state = computeRailNavigationState(10, 3, 0);
    assert.equal(state.allItemsVisible, false);
    assert.equal(state.canScrollPrevious, false);
    assert.equal(state.canScrollNext, true);
    assert.equal(state.maxStart, 7);
    assert.equal(state.visibleEnd, 3);
  });

  it("enables only the previous arrow at the end of the list", () => {
    const state = computeRailNavigationState(10, 3, 7);
    assert.equal(state.canScrollPrevious, true);
    assert.equal(state.canScrollNext, false);
    assert.equal(state.visibleEnd, 10);
  });

  it("enables both arrows in the middle of the list", () => {
    const state = computeRailNavigationState(10, 3, 4);
    assert.equal(state.canScrollPrevious, true);
    assert.equal(state.canScrollNext, true);
    assert.equal(state.visibleEnd, 7);
  });

  it("clamps a stale startIndex (e.g. after content shrinks on resize) instead of going negative or out of range", () => {
    const shrunkAfterResize = computeRailNavigationState(4, 3, 7);
    assert.equal(shrunkAfterResize.canScrollNext, false);
    assert.equal(shrunkAfterResize.visibleEnd, 4);

    const neverNegative = computeRailNavigationState(4, 3, -5);
    assert.equal(neverNegative.canScrollPrevious, false);
  });

  it("treats an empty rail as having no scrollable content", () => {
    const state = computeRailNavigationState(0, 3, 0);
    assert.equal(state.allItemsVisible, true);
    assert.equal(state.canScrollPrevious, false);
    assert.equal(state.canScrollNext, false);
    assert.equal(state.visibleEnd, 0);
  });
});
