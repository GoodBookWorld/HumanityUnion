/**
 * Reset 03B — parse materialize:media-plp args (explicit identity only).
 */

import {
  isMediaPlpEntityType,
  MEDIA_PLP_ENTITY_TYPES,
  type MediaPlpEntityType,
} from "@hu/types";
import type { LanguageCode } from "@hu/types";

import { normalizeMediaPlpRegistryLocaleIdentity } from "./locale-identity.js";

export type MediaPlpMaterializerArgs = {
  readonly mongo: true;
  readonly execute: boolean;
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

export function parseMediaPlpMaterializerArgs(
  argv: readonly string[],
):
  | { readonly ok: true; readonly args: MediaPlpMaterializerArgs }
  | { readonly ok: false; readonly errorMessage: string } {
  if (!argv.includes("--mongo")) {
    return {
      ok: false,
      errorMessage: "materialize:media-plp requires --mongo",
    };
  }
  if (argv.includes("--all") || argv.includes("--corpus") || argv.includes("--sample-one")) {
    return {
      ok: false,
      errorMessage:
        "materialize:media-plp refuses --all/--corpus/--sample-one; pass one --entity-type and --entity-id",
    };
  }

  const entityTypeRaw = flagValue(argv, "--entity-type");
  const entityIdRaw = flagValue(argv, "--entity-id");
  const localeRaw = flagValue(argv, "--locale");

  if (!entityTypeRaw) {
    return {
      ok: false,
      errorMessage:
        `materialize:media-plp requires --entity-type <${MEDIA_PLP_ENTITY_TYPES.join("|")}>`,
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
      errorMessage: "materialize:media-plp requires explicit --entity-id <id>",
    };
  }
  if (entityIdRaw.toLowerCase() === "all" || entityIdRaw === "*") {
    return {
      ok: false,
      errorMessage: "materialize:media-plp refuses entity-id all/*",
    };
  }
  if (!localeRaw) {
    return {
      ok: false,
      errorMessage: "materialize:media-plp requires exactly one --locale <code>",
    };
  }
  // Reject repeated --locale flags (one locale only).
  const localeFlags = argv.filter((arg) => arg === "--locale");
  if (localeFlags.length > 1) {
    return {
      ok: false,
      errorMessage: "materialize:media-plp accepts exactly one --locale",
    };
  }

  return {
    ok: true,
    args: {
      mongo: true,
      execute: argv.includes("--execute"),
      entityType: entityTypeRaw,
      entityId: entityIdRaw,
      locale: normalizeMediaPlpRegistryLocaleIdentity(localeRaw),
    },
  };
}
