/**
 * Reset 03A — require exactly one Media PLP entity identity (no "all" mode).
 */

import {
  isMediaPlpEntityType,
  MEDIA_PLP_ENTITY_TYPES,
  type MediaPlpEntityType,
} from "@hu/types";
import { normalizeLanguageCode, type LanguageCode } from "@hu/types";

export type MediaPlpPreflightArgs = {
  readonly mongo: true;
  readonly entityType: MediaPlpEntityType;
  readonly entityId: string;
  readonly locale: LanguageCode;
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

export function parseMediaPlpPreflightArgs(
  argv: readonly string[],
):
  | { readonly ok: true; readonly args: MediaPlpPreflightArgs }
  | { readonly ok: false; readonly errorMessage: string } {
  if (!argv.includes("--mongo")) {
    return {
      ok: false,
      errorMessage: "diagnose:media-plp-preflight requires --mongo",
    };
  }
  if (argv.includes("--execute") || argv.includes("--write") || argv.includes("--publish")) {
    return {
      ok: false,
      errorMessage: "diagnose:media-plp-preflight is READ-ONLY; omit write flags",
    };
  }
  if (argv.includes("--all") || argv.includes("--corpus")) {
    return {
      ok: false,
      errorMessage:
        "diagnose:media-plp-preflight refuses corpus/all modes; pass one --entity-type and --entity-id",
    };
  }

  const entityTypeRaw = flagValue(argv, "--entity-type");
  const entityIdRaw = flagValue(argv, "--entity-id");
  const localeRaw = flagValue(argv, "--locale");

  if (!entityTypeRaw) {
    return {
      ok: false,
      errorMessage:
        "diagnose:media-plp-preflight requires --entity-type <public_news|civic_media_principle|civic_media_trusted>",
    };
  }
  if (!isMediaPlpEntityType(entityTypeRaw)) {
    return {
      ok: false,
      errorMessage: `Unsupported --entity-type "${entityTypeRaw}". Allowed: ${MEDIA_PLP_ENTITY_TYPES.join(", ")}`,
    };
  }
  if (!entityIdRaw) {
    return {
      ok: false,
      errorMessage: "diagnose:media-plp-preflight requires explicit --entity-id <id> (no all mode)",
    };
  }
  if (entityIdRaw.toLowerCase() === "all" || entityIdRaw === "*") {
    return {
      ok: false,
      errorMessage: "diagnose:media-plp-preflight refuses entity-id all/*; pass one explicit id",
    };
  }
  if (!localeRaw) {
    return {
      ok: false,
      errorMessage: "diagnose:media-plp-preflight requires --locale <code>",
    };
  }

  return {
    ok: true,
    args: {
      mongo: true,
      entityType: entityTypeRaw,
      entityId: entityIdRaw,
      locale: normalizeLanguageCode(localeRaw, "en"),
    },
  };
}
