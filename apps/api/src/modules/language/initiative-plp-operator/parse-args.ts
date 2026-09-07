/**
 * RESET 05B — parse diagnose/materialize Initiative PLP args.
 */

import { normalizeLanguageCode, type LanguageCode } from "@hu/types";

export type InitiativePlpOperatorArgs = {
  readonly mongo: true;
  readonly execute: boolean;
  readonly initiativeId: string;
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
      errorMessage: `${cmd} refuses --all/--corpus/--sample-one; pass one --initiative-id`,
    };
  }

  const initiativeId = flagValue(argv, "--initiative-id");
  const localeRaw = flagValue(argv, "--locale");

  if (!initiativeId) {
    return {
      ok: false,
      errorMessage: `${cmd} requires --initiative-id <id>`,
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
  if (operation === "diagnose" && argv.includes("--execute")) {
    return {
      ok: false,
      errorMessage: `${cmd} is READ-ONLY; omit --execute`,
    };
  }

  return {
    ok: true,
    args: {
      mongo: true,
      execute: operation === "materialize" && argv.includes("--execute"),
      initiativeId,
      locale: normalizeLanguageCode(localeRaw, "en"),
    },
  };
}
