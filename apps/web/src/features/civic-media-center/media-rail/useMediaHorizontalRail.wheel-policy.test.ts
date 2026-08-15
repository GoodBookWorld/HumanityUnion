/**
 * UX Stability Pack 01 — Part 3/4/14 regression guard for the horizontal
 * rail wheel policy.
 *
 * Root cause of the vertical-scroll "dead zone" (Part 2): the shared rail
 * hook used to attach a non-passive `wheel` listener that called
 * `event.preventDefault()` whenever `abs(deltaY) > abs(deltaX)` and then
 * added `deltaY` onto `viewport.scrollLeft` — i.e. it hijacked ordinary
 * vertical mouse-wheel/trackpad scrolling and converted it into horizontal
 * rail movement, blocking the page from scrolling while the pointer was
 * over any rail built on this hook (MediaHorizontalRail, MediaRailViewport,
 * PublicNewsRail, HorizontalContentSection, and every Hux*Section).
 *
 * The fix removes wheel interception entirely: horizontal-dominant wheel
 * input already scrolls the `overflow-x: auto` viewport natively, and
 * vertical-dominant input is left completely untouched for the browser to
 * scroll the page. There is no passive-vs-non-passive listener trade-off to
 * make because there is no listener at all.
 *
 * `apps/web` has no DOM/React test harness to dispatch a real `WheelEvent`
 * against a rendered rail and assert `window.scrollY` changed, so this test
 * guards the fix at the source level: it fails if a `wheel` listener,
 * `preventDefault`, or `scrollLeft` mutation is ever reintroduced into the
 * shared hook.
 *
 * Run with (from apps/web):
 *   npx tsx --test "src/features/civic-media-center/media-rail/useMediaHorizontalRail.wheel-policy.test.ts"
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const hookSourcePath = fileURLToPath(
  new URL("./useMediaHorizontalRail.ts", import.meta.url),
);
const hookSource = readFileSync(hookSourcePath, "utf8");

describe("useHorizontalRail wheel policy (no vertical-scroll dead zone)", () => {
  it("never attaches a wheel event listener", () => {
    assert.ok(
      !/addEventListener\(\s*["']wheel["']/.test(hookSource),
      "the shared rail hook must not attach a wheel listener; horizontal-dominant input is already handled natively by the overflow-x viewport, and vertical-dominant input must reach the page untouched",
    );
  });

  it("never calls preventDefault on wheel input", () => {
    assert.ok(
      !hookSource.includes("preventDefault") || !hookSource.toLowerCase().includes("wheel"),
      "the shared rail hook must not call preventDefault() in response to wheel input",
    );
  });

  it("never converts deltaY into scrollLeft", () => {
    assert.ok(
      !/deltaY/.test(hookSource),
      "the shared rail hook must not read WheelEvent.deltaY at all — converting vertical wheel delta into horizontal scrollLeft movement is exactly the dead-zone regression this guards against",
    );
    assert.ok(
      !/scrollLeft\s*[+]?=/.test(hookSource),
      "the shared rail hook must not mutate viewport.scrollLeft from a wheel handler",
    );
  });

  it("does not use a non-passive event listener option (no { passive: false })", () => {
    assert.ok(
      !/passive:\s*false/.test(hookSource),
      "no listener in the shared rail hook should be registered non-passive; that combination is what allowed preventDefault() to block the browser's default scroll",
    );
  });
});
