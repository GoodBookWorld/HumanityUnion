/**
 * RESET 05B.1 — parse diagnose/materialize Initiative PLP args.
 */

import { normalizeLanguageCode, type LanguageCode } from "@hu/types";

import { INITIATIVE_PLP_PUBLIC_CHOICE_DISCOVERY_DEFAULT_LIMIT } from "./constants.js";

export type InitiativePlpIdentityArgs = {
  readonly mode: "identity";
  readonly mongo: true;
  readonly execute: boolean;
  readonly initiativeId: string;
  readonly locale: LanguageCode;
};

export type InitiativePlpListPublicChoiceArgs = {
  readonly mode: "list_public_choice";
  readonly mongo: true;
  readonly limit: number;
};

export type InitiativePlpOperatorArgs =
  | InitiativePlpIdentityArgs
  | InitiativePlpListPublicChoiceArgs;

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

export function parseInitiativePlpOperatorArgs(
  argv: readonly string[],
  operation: "diagnose" | "materialize",
):
  | { readonly ok: true; readonly args: InitiativePlpOperatorArgs }
  | { readonly ok: false; readonly errorMessage: string } {
  const cmd =
    operation === "diagnose"
      ? "diagnose:initiative-plp"
      : "materialize:initiative-plp";

  if (!argv.includes("--mongo")) {
    return { ok: false, errorMessage: `${cmd} requires --mongo` };
  }
  if (
    argv.includes("--all") ||
    argv.includes("--corpus") ||
    argv.includes("--sample-one")
  ) {
    return {
      ok: false,
      errorMessage: `${cmd} refuses --all/--corpus/--sample-one`,
    };
  }
  if (operation === "diagnose" && argv.includes("--execute")) {
    return {
      ok: false,
      errorMessage: `${cmd} is READ-ONLY; omit --execute`,
    };
  }

  const listPublicChoice = argv.includes("--list-public-choice");
  if (listPublicChoice) {
    if (operation !== "diagnose") {
      return {
        ok: false,
        errorMessage: `${cmd} refuses --list-public-choice; use diagnose:initiative-plp`,
      };
    }
    if (flagValue(argv, "--initiative-id")) {
      return {
        ok: false,
        errorMessage: `${cmd}: --list-public-choice and --initiative-id are mutually exclusive`,
      };
    }
    if (flagValue(argv, "--locale")) {
      return {
        ok: false,
        errorMessage: `${cmd}: --list-public-choice does not accept --locale (discovery is identity-only)`,
      };
    }
    const limitRaw = flagValue(argv, "--limit");
    let limit = INITIATIVE_PLP_PUBLIC_CHOICE_DISCOVERY_DEFAULT_LIMIT;
    if (limitRaw) {
      const parsed = Number(limitRaw);
      if (!Number.isInteger(parsed) || parsed < 1) {
        return {
          ok: false,
          errorMessage: `${cmd}: --limit must be a positive integer`,
        };
      }
      if (parsed > INITIATIVE_PLP_PUBLIC_CHOICE_DISCOVERY_DEFAULT_LIMIT) {
        return {
          ok: false,
          errorMessage: `${cmd}: --limit max is ${INITIATIVE_PLP_PUBLIC_CHOICE_DISCOVERY_DEFAULT_LIMIT}`,
        };
      }
      limit = parsed;
    }
    return {
      ok: true,
      args: {
        mode: "list_public_choice",
        mongo: true,
        limit,
      },
    };
  }

  const initiativeId = flagValue(argv, "--initiative-id");
  const localeRaw = flagValue(argv, "--locale");

  if (!initiativeId) {
    return {
      ok: false,
      errorMessage: `${cmd} requires --initiative-id <id> (or diagnose --list-public-choice)`,
    };
  }
  if (initiativeId.toLowerCase() === "all" || initiativeId === "*") {
    return {
      ok: false,
      errorMessage: `${cmd} refuses initiative-id all/*`,
    };
  }
  if (!localeRaw) {
    return {
      ok: false,
      errorMessage: `${cmd} requires --locale <code>`,
    };
  }
  if (argv.filter((arg) => arg === "--locale").length > 1) {
    return {
      ok: false,
      errorMessage: `${cmd} accepts exactly one --locale`,
    };
  }

  return {
    ok: true,
    args: {
      mode: "identity",
      mongo: true,
      execute: operation === "materialize" && argv.includes("--execute"),
      initiativeId,
      locale: normalizeLanguageCode(localeRaw, "en"),
    },
  };
}
