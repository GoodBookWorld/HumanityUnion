/**
 * Reset 03A / 03A.1 — require one Media PLP identity OR --sample-one (mutually exclusive).
 */

import {
  isMediaPlpEntityType,
  MEDIA_PLP_ENTITY_TYPES,
  type MediaPlpEntityType,
} from "@hu/types";
import { normalizeLanguageCode, type LanguageCode } from "@hu/types";

export type MediaPlpPreflightIdentityArgs = {
  readonly mode: "identity";
  readonly mongo: true;
  readonly entityType: MediaPlpEntityType;
  readonly entityId: string;
  readonly locale: LanguageCode;
};

export type MediaPlpPreflightSampleArgs = {
  readonly mode: "sample-one";
  readonly mongo: true;
  readonly entityType: MediaPlpEntityType;
  /** Optional for sample-one (unused by discovery). */
  readonly locale: LanguageCode | null;
};

export type MediaPlpPreflightArgs =
  | MediaPlpPreflightIdentityArgs
  | MediaPlpPreflightSampleArgs;

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
        "diagnose:media-plp-preflight refuses corpus/all modes; pass one --entity-type and --entity-id (or --sample-one)",
    };
  }

  const sampleOne = argv.includes("--sample-one");
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

  if (sampleOne && entityIdRaw) {
    return {
      ok: false,
      errorMessage:
        "diagnose:media-plp-preflight: --sample-one and --entity-id are mutually exclusive",
    };
  }

  if (sampleOne) {
    return {
      ok: true,
      args: {
        mode: "sample-one",
        mongo: true,
        entityType: entityTypeRaw,
        locale: localeRaw ? normalizeLanguageCode(localeRaw, "en") : null,
      },
    };
  }

  if (!entityIdRaw) {
    return {
      ok: false,
      errorMessage:
        "diagnose:media-plp-preflight requires explicit --entity-id <id> or --sample-one",
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
      mode: "identity",
      mongo: true,
      entityType: entityTypeRaw,
      entityId: entityIdRaw,
      locale: normalizeLanguageCode(localeRaw, "en"),
    },
  };
}
