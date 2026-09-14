/**
 * Reset 03E.10 — parse materialize:media-plp-carousel args.
 */

import type { LanguageCode } from "@hu/types";

import {
  MEDIA_PLP_CAROUSEL_MATERIALIZE_DEFAULT_LIMIT,
  MEDIA_PLP_CAROUSEL_MATERIALIZE_PLAN_MAX,
} from "../media-plp-carousel/constants.js";
import { normalizeMediaPlpRegistryLocaleIdentity } from "../media-plp-materializer/locale-identity.js";

export type MediaPlpCarouselMaterializerArgs = {
  readonly mongo: true;
  readonly execute: boolean;
  readonly locale: LanguageCode;
  readonly countryCode: string | null;
  readonly limit: number;
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

export function parseMediaPlpCarouselMaterializerArgs(
  argv: readonly string[],
):
  | { readonly ok: true; readonly args: MediaPlpCarouselMaterializerArgs }
  | { readonly ok: false; readonly errorMessage: string } {
  if (!argv.includes("--mongo")) {
    return {
      ok: false,
      errorMessage: "materialize:media-plp-carousel requires --mongo",
    };
  }
  if (
    argv.includes("--all") ||
    argv.includes("--corpus") ||
    argv.includes("--sample-one") ||
    argv.includes("--continue-on-error")
  ) {
    return {
      ok: false,
      errorMessage:
        "materialize:media-plp-carousel refuses --all/--corpus/--sample-one/--continue-on-error; fail-fast sequential only",
    };
  }

  const localeRaw = flagValue(argv, "--locale");
  if (!localeRaw) {
    return {
      ok: false,
      errorMessage: "materialize:media-plp-carousel requires --locale <code>",
    };
  }
  if (argv.filter((arg) => arg === "--locale").length > 1 || localeRaw.includes(",")) {
    return {
      ok: false,
      errorMessage: "materialize:media-plp-carousel accepts exactly one --locale",
    };
  }

  const limitRaw = flagValue(argv, "--limit");
  let limit = MEDIA_PLP_CAROUSEL_MATERIALIZE_DEFAULT_LIMIT;
  if (limitRaw != null) {
    const parsed = Number(limitRaw);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return {
        ok: false,
        errorMessage: "materialize:media-plp-carousel --limit must be a positive integer",
      };
    }
    if (parsed > MEDIA_PLP_CAROUSEL_MATERIALIZE_PLAN_MAX) {
      return {
        ok: false,
        errorMessage: `materialize:media-plp-carousel --limit max is ${MEDIA_PLP_CAROUSEL_MATERIALIZE_PLAN_MAX}`,
      };
    }
    limit = parsed;
  }

  const countryRaw = flagValue(argv, "--country-code");
  return {
    ok: true,
    args: {
      mongo: true,
      execute: argv.includes("--execute"),
      locale: normalizeMediaPlpRegistryLocaleIdentity(localeRaw),
      countryCode: countryRaw ? countryRaw.toUpperCase() : null,
      limit,
    },
  };
}
