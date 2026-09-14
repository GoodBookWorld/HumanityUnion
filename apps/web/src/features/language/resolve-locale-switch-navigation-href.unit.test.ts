/**
 * Locale-switch href — SEO prefix only when Registry seoIndexingEnabled.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveLocaleSwitchNavigationHref } from "./resolve-locale-switch-navigation-href.js";
import { runLocaleSwitchNavigation } from "./run-locale-switch-navigation.js";

describe("resolveLocaleSwitchNavigationHref — SEO gate", () => {
  it("enabled + seoIndexingEnabled=true non-English → prefixed SEO path", () => {
    assert.equal(
      resolveLocaleSwitchNavigationHref({
        pathname: "/media",
        nextLocale: "uk",
        seoIndexingEnabled: true,
      }),
      "/uk/media",
    );
    assert.equal(
      resolveLocaleSwitchNavigationHref({
        pathname: "/uk/media",
        nextLocale: "ar",
        seoIndexingEnabled: true,
      }),
      "/ar/media",
    );
    assert.equal(
      resolveLocaleSwitchNavigationHref({
        pathname: "/uk/media",
        nextLocale: "zh-Hant",
        seoIndexingEnabled: true,
      }),
      "/zh-hant/media",
    );
  });

  it("enabled + seoIndexingEnabled=false → locale-free path, never /{locale}/…", () => {
    assert.equal(
      resolveLocaleSwitchNavigationHref({
        pathname: "/media",
        nextLocale: "ka",
        seoIndexingEnabled: false,
      }),
      "/media",
    );
    assert.equal(
      resolveLocaleSwitchNavigationHref({
        pathname: "/uk/media",
        nextLocale: "ka",
        seoIndexingEnabled: false,
      }),
      "/media",
    );
    assert.equal(
      resolveLocaleSwitchNavigationHref({
        pathname: "/",
        nextLocale: "ka",
        seoIndexingEnabled: false,
      }),
      "/",
    );
    const href = resolveLocaleSwitchNavigationHref({
      pathname: "/ar/initiatives",
      nextLocale: "es",
      seoIndexingEnabled: false,
    });
    assert.equal(href, "/initiatives");
    assert.doesNotMatch(href ?? "", /^\/(ka|es)\b/);
  });

  it("arbitrary Registry locale works without locale-specific branches", () => {
    assert.equal(
      resolveLocaleSwitchNavigationHref({
        pathname: "/uk/media",
        nextLocale: "de",
        seoIndexingEnabled: true,
      }),
      "/de/media",
    );
    assert.equal(
      resolveLocaleSwitchNavigationHref({
        pathname: "/uk/media",
        nextLocale: "ka",
        seoIndexingEnabled: false,
      }),
      "/media",
    );
    assert.equal(
      resolveLocaleSwitchNavigationHref({
        pathname: "/media",
        nextLocale: "ka",
        seoIndexingEnabled: false,
      }),
      "/media",
    );
  });

  it("English/default stays locale-free; workspace stays refresh-only", () => {
    assert.equal(
      resolveLocaleSwitchNavigationHref({
        pathname: "/uk/media",
        nextLocale: "en",
        seoIndexingEnabled: true,
      }),
      "/media",
    );
    assert.equal(
      resolveLocaleSwitchNavigationHref({
        pathname: "/workspace",
        nextLocale: "ka",
        seoIndexingEnabled: false,
      }),
      null,
    );
    assert.equal(
      resolveLocaleSwitchNavigationHref({
        pathname: "/workspace",
        nextLocale: "uk",
        seoIndexingEnabled: true,
      }),
      null,
    );
  });

  it("non-SEO switch from prefixed URL replaces to locale-free then refreshes", () => {
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
      nextLocale: "ka",
      seoIndexingEnabled: false,
    });
    assert.equal(href, "/media");
    const result = runLocaleSwitchNavigation({
      router,
      pathname: "/uk/media",
      href,
    });
    assert.equal(result.didReplace, true);
    assert.equal(result.didRefresh, true);
    assert.deepEqual(calls, ["replace:/media", "refresh"]);
  });

  it("non-SEO switch already on locale-free path refreshes without replace", () => {
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
      pathname: "/media",
      nextLocale: "ka",
      seoIndexingEnabled: false,
    });
    assert.equal(href, "/media");
    const result = runLocaleSwitchNavigation({
      router,
      pathname: "/media",
      href,
    });
    assert.equal(result.didReplace, false);
    assert.equal(result.didRefresh, true);
    assert.deepEqual(calls, ["refresh"]);
  });
});
