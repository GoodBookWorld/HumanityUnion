/**
 * Reset 03E.9 — parse diagnose:media-plp-carousel args.
 */

import type { LanguageCode } from "@hu/types";

import { normalizeMediaPlpRegistryLocaleIdentity } from "../media-plp-materializer/locale-identity.js";

export type MediaPlpCarouselArgs = {
  readonly mongo: true;
  readonly locale: LanguageCode;
  /** Optional ISO country for country-media-rail discovery. */
  readonly countryCode: string | null;
};

function flagValue(argv: readonly string[], flag: string): string | null {
  const idx = argv.indexOf(flag);
  if (idx < 0) {
    return null;
  }
  const value = argv[idx + 1];
  if (!value || value.startsWith("--")) {
    return null;
  }
  return value.trim();
}

export function parseMediaPlpCarouselArgs(
  argv: readonly string[],
):
  | { readonly ok: true; readonly args: MediaPlpCarouselArgs }
  | { readonly ok: false; readonly errorMessage: string } {
  if (!argv.includes("--mongo")) {
    return {
      ok: false,
      errorMessage: "diagnose:media-plp-carousel requires --mongo",
    };
  }
  if (
    argv.includes("--all") ||
    argv.includes("--corpus") ||
    argv.includes("--execute") ||
    argv.includes("--write")
  ) {
    return {
      ok: false,
      errorMessage:
        "diagnose:media-plp-carousel is READ-ONLY; omit --all/--corpus/--execute/--write",
    };
  }

  const localeRaw = flagValue(argv, "--locale");
  if (!localeRaw) {
    return {
      ok: false,
      errorMessage: "diagnose:media-plp-carousel requires --locale <code>",
    };
  }
  if (argv.filter((arg) => arg === "--locale").length > 1 || localeRaw.includes(",")) {
    return {
      ok: false,
      errorMessage: "diagnose:media-plp-carousel accepts exactly one --locale",
    };
  }

  const countryRaw = flagValue(argv, "--country-code");
  return {
    ok: true,
    args: {
      mongo: true,
      locale: normalizeMediaPlpRegistryLocaleIdentity(localeRaw),
      countryCode: countryRaw ? countryRaw.toUpperCase() : null,
    },
  };
}
