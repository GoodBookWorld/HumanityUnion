/**
 * Read-only WEB_UI pre-release gate CLI.
 *
 * Live (published packs via public API — release target):
 *   node --import tsx apps/api/scripts/check-web-ui-release-gate.ts \
 *     --source live-public-api \
 *     --api-base https://api-staging.huws.org
 *
 * Local packaged diagnostic only (NOT published Mongo; never a live release PASS substitute):
 *   node --import tsx apps/api/scripts/check-web-ui-release-gate.ts \
 *     --source local-packaged-diagnostic \
 *     --locales uk,ar,es
 *
 * Exit 0 only for a true release PASS (live-public-api), or packaged diagnostic when
 * explicitly opted in with --allow-packaged-diagnostic-pass.
 * Never publishes, translates, or calls Gemini.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadPackagedWebUiCatalog } from "../src/modules/web-ui-message-packs/packaged-web-ui-catalog.js";
import {
  assessWebUiReleaseGateLocale,
  formatWebUiReleaseGateReport,
  listEnabledLocalesFromPublicApi,
  loadPublishedWebUiPackFromPublicApi,
  runWebUiReleaseGate,
  WebUiReleaseGateError,
  type WebUiReleaseGateReport,
  type WebUiReleaseGateSourceKind,
} from "../src/modules/web-ui-message-packs/web-ui-release-gate.js";
import {
  collectStringPaths,
  loadBundledEnglishWebUiMessagePack,
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

function parseLocales(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function packagedAssetsRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../assets/packaged-web-ui-catalogs");
}

function englishKeyCountOrZero(): number {
  try {
    return collectStringPaths(loadBundledEnglishWebUiMessagePack() as never).length;
  } catch {
    return 0;
  }
}

function finalizeReport(
  sourceKind: WebUiReleaseGateSourceKind,
  requiredLocales: readonly string[],
  locales: WebUiReleaseGateReport["locales"],
): WebUiReleaseGateReport {
  const englishKeyCount = englishKeyCountOrZero();
  const failedLocales = locales.filter((entry) => !entry.pass).map((entry) => entry.locale);
  return {
    sourceKind,
    englishKeyCount,
    requiredLocales,
    locales,
    pass: failedLocales.length === 0 && englishKeyCount > 0,
    failedLocales,
  };
}

async function main(argv: readonly string[]): Promise<number> {
  const sourceRaw = (readFlag(argv, "--source") ?? "").trim();
  if (sourceRaw !== "live-public-api" && sourceRaw !== "local-packaged-diagnostic") {
    throw new WebUiReleaseGateError(
      "Required --source live-public-api | local-packaged-diagnostic",
    );
  }
  const sourceKind = sourceRaw as WebUiReleaseGateSourceKind;
  const localesFlag = parseLocales(readFlag(argv, "--locales"));

  if (sourceKind === "live-public-api") {
    const apiBase = (readFlag(argv, "--api-base") ?? "").trim();
    if (!apiBase) {
      throw new WebUiReleaseGateError("--api-base is required for live-public-api.");
    }

    let requiredLocales = localesFlag;
    if (requiredLocales.length === 0) {
      const listed = await listEnabledLocalesFromPublicApi({ apiBaseUrl: apiBase });
      if (!listed.ok) {
        const report = finalizeReport(sourceKind, [], [
          {
            locale: "(languages)",
            catalogStatus: "source_unavailable",
            sourceKind,
            publishedRevision: null,
            public: null,
            participant: null,
            full: null,
            missingKeySamples: [],
            pass: false,
            detail: listed.reason,
          },
        ]);
        console.error(formatWebUiReleaseGateReport(report));
        return 1;
      }
      requiredLocales = [...listed.locales];
    }

    const locales = [];
    for (const locale of requiredLocales) {
      const catalog = await loadPublishedWebUiPackFromPublicApi({
        apiBaseUrl: apiBase,
        locale,
      });
      locales.push(
        assessWebUiReleaseGateLocale({
          locale,
          sourceKind,
          catalog,
        }),
      );
    }
    const report = finalizeReport(sourceKind, requiredLocales, locales);
    console.log(formatWebUiReleaseGateReport(report));
    return report.pass ? 0 : 1;
  }

  // local-packaged-diagnostic — explicit non-authority check
  if (localesFlag.length === 0) {
    throw new WebUiReleaseGateError(
      "--locales is required for local-packaged-diagnostic (never auto-assumes live enabled set).",
    );
  }
  if (!existsSync(packagedAssetsRoot())) {
    throw new WebUiReleaseGateError(
      `Packaged catalog directory missing: ${packagedAssetsRoot()}`,
    );
  }
  readFileSync(path.join(packagedAssetsRoot(), "en.json"), "utf8");

  const report = runWebUiReleaseGate({
    sourceKind,
    requiredLocales: localesFlag,
    loadCatalog: (locale) => {
      const packaged = loadPackagedWebUiCatalog(locale);
      if (!packaged) {
        return { status: "missing_published_pack" };
      }
      return { status: "ok", messages: packaged, publishedRevision: null };
    },
  });
  console.log(formatWebUiReleaseGateReport(report));
  if (argv.includes("--allow-packaged-diagnostic-pass")) {
    return report.pass ? 0 : 1;
  }
  console.error(
    "REFUSED as release exit: local-packaged-diagnostic is not published Mongo. Re-run with --source live-public-api --api-base <release-target>.",
  );
  return 1;
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "WEB_UI release gate failed.",
  );
  process.exitCode = 1;
}
