/**
 * Media soft-locale-transition — Implementation 03
 * Soft navigation must refresh Server Component PLP payloads (hard-reload parity).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { resolveLocaleSwitchNavigationHref } from "../resolve-locale-switch-navigation-href.js";
import { runLocaleSwitchNavigation } from "../run-locale-switch-navigation.js";
import { mediaSsrPlpAlignedWithRequestedLocale } from "./media-ssr-plp-locale-alignment.js";

const here = dirname(fileURLToPath(import.meta.url));
const webSrc = join(here, "../../..");

describe("Implementation 03 — Media soft locale transition", () => {
  it("1. SEO locale switch replace is always followed by refresh (hard-reload parity)", () => {
    const calls: string[] = [];
    const router = {
      replace: (href: string) => {
        calls.push(`replace:${href}`);
      },
      refresh: () => {
        calls.push("refresh");
      },
    };

    const href = resolveLocaleSwitchNavigationHref({
      pathname: "/uk/media",
      nextLocale: "ar",
    });
    assert.equal(href, "/ar/media");

    const result = runLocaleSwitchNavigation({
      router,
      pathname: "/uk/media",
      href,
    });
    assert.equal(result.didReplace, true);
    assert.equal(result.didRefresh, true);
    assert.deepEqual(calls, ["replace:/ar/media", "refresh"]);

    // Future Registry locale — same mechanism, no per-language branch.
    const deHref = resolveLocaleSwitchNavigationHref({
      pathname: "/uk/media",
      nextLocale: "de",
    });
    assert.equal(deHref, "/de/media");
    calls.length = 0;
    const deResult = runLocaleSwitchNavigation({
      router,
      pathname: "/uk/media",
      href: deHref,
    });
    assert.equal(deResult.didReplace, true);
    assert.deepEqual(calls, ["replace:/de/media", "refresh"]);

    const selector = readFileSync(
      join(webSrc, "features/language/components/LanguageSelector.tsx"),
      "utf8",
    );
    assert.match(selector, /runLocaleSwitchNavigation/);
    assert.doesNotMatch(
      selector,
      /if\s*\(\s*href\s*&&\s*href\s*!==\s*pathname\s*\)\s*\{\s*router\.replace\(href\);\s*\}/,
    );
  });

  it("2. same-document / non-SEO switch refreshes without replace", () => {
    const calls: string[] = [];
    const router = {
      replace: (href: string) => {
        calls.push(`replace:${href}`);
      },
      refresh: () => {
        calls.push("refresh");
      },
    };

    const workspace = runLocaleSwitchNavigation({
      router,
      pathname: "/workspace",
      href: null,
    });
    assert.equal(workspace.didReplace, false);
    assert.equal(workspace.didRefresh, true);
    assert.deepEqual(calls, ["refresh"]);

    calls.length = 0;
    const same = runLocaleSwitchNavigation({
      router,
      pathname: "/ar/media",
      href: "/ar/media",
    });
    assert.equal(same.didReplace, false);
    assert.deepEqual(calls, ["refresh"]);
  });

  it("3. previous-locale SSR PLP batch cannot stay authoritative under new requested locale", () => {
    assert.equal(
      mediaSsrPlpAlignedWithRequestedLocale({
        batchLocale: "uk",
        requestedLocale: "ar",
      }),
      false,
    );
    assert.equal(
      mediaSsrPlpAlignedWithRequestedLocale({
        batchLocale: "ar",
        requestedLocale: "ar",
      }),
      true,
    );
    assert.equal(
      mediaSsrPlpAlignedWithRequestedLocale({
        batchLocale: "de",
        requestedLocale: "de",
      }),
      true,
    );
    // Legacy / unstamped batch still allowed — per-entity Imp02 guard applies.
    assert.equal(
      mediaSsrPlpAlignedWithRequestedLocale({
        batchLocale: null,
        requestedLocale: "ar",
      }),
      true,
    );

    const page = readFileSync(
      join(
        webSrc,
        "features/civic-media-center/components/CivicMediaCenterPageContent.tsx",
      ),
      "utf8",
    );
    assert.match(page, /mediaSsrPlpAlignedWithRequestedLocale/);
    assert.match(page, /effectiveTrustedById/);
  });
});
