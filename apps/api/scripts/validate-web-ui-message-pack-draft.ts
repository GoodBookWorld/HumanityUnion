/**
 * Validate a local WEB_UI draft artifact against canonical English public scope.
 *
 *   node --import tsx apps/api/scripts/validate-web-ui-message-pack-draft.ts --locale <locale>
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertCompletePublicWebUiDraft,
  canonicalizeWebUiDraftLocale,
} from "../src/modules/web-ui-message-packs/web-ui-draft-builder.js";
import { classifyEnglishIdenticalWebUiTree } from "../src/modules/web-ui-message-packs/web-ui-identical-classification.js";
import {
  selectEnglishWebUiMessages,
  validateWebUiMessageTreeAgainstEnglish,
} from "../src/modules/web-ui-message-packs/web-ui-message-pack.validate.js";

function readFlag(argv: readonly string[], name: string): string | undefined {
  const withEquals = argv.find((arg) => arg.startsWith(`${name}=`));
  if (withEquals) {
    return withEquals.slice(name.length + 1);
  }
  const index = argv.indexOf(name);
  if (index >= 0) {
    return argv[index + 1];
  }
  return undefined;
}

function readPath(messages: Record<string, unknown>, dottedPath: string): unknown {
  let current: unknown = messages;
  for (const segment of dottedPath.split(".")) {
    if (current == null || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

const argv = process.argv.slice(2);
try {
  const locale = canonicalizeWebUiDraftLocale(readFlag(argv, "--locale") ?? "");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const artifactPath = path.resolve(here, "../../../tmp", `web-ui-${locale}-draft.json`);
  if (!existsSync(artifactPath)) {
    throw new Error(`Draft artifact not found: ${artifactPath}`);
  }
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as {
    locale: string;
    status: string;
    messages: Record<string, unknown>;
  };
  if (artifact.locale !== locale || artifact.status !== "draft") {
    throw new Error("Artifact locale/status is invalid.");
  }
  const prepared = selectEnglishWebUiMessages("public");
  assertCompletePublicWebUiDraft({
    messages: artifact.messages as never,
    requiredPaths: prepared.selectedPaths,
  });
  const report = validateWebUiMessageTreeAgainstEnglish(artifact.messages as never);
  const englishFlat: Record<string, string> = {};
  const localizedFlat: Record<string, string> = {};
  for (const pathKey of prepared.selectedPaths) {
    const english = readPath(prepared.messages as Record<string, unknown>, pathKey);
    const localized = readPath(artifact.messages, pathKey);
    if (typeof english === "string") {
      englishFlat[pathKey] = english;
    }
    if (typeof localized === "string") {
      localizedFlat[pathKey] = localized;
    }
  }
  const classification = classifyEnglishIdenticalWebUiTree({
    englishFlat,
    localizedFlat,
  });
  console.log(
    [
      "WEB_UI draft validation",
      `locale: ${locale}`,
      `acceptedKeys: ${report.acceptedKeyCount}`,
      `unknownPaths: ${report.rejectedUnknownPaths.length}`,
      `nonStringPaths: ${report.rejectedNonStringPaths.length}`,
      `emptyPaths: ${report.emptyPaths.length}`,
      `placeholderMismatches: ${report.placeholderMismatchPaths.length}`,
      `acceptedIdentical: ${classification.acceptedTechnical.length}`,
      `suspiciousIdentical: ${classification.suspiciousHuman.length}`,
      `artifact: ${artifactPath}`,
    ].join("\n"),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : "WEB_UI draft validation failed.");
  process.exitCode = 1;
}
