/**
 * Read-only WEB_UI linguistic quality report.
 *
 *   pnpm --filter @hu/api report:web-ui-linguistic-quality -- --out-dir ../../tmp/linguistic-quality-report
 *
 * GET requests only. Does not publish, write catalogs, or call a translation provider.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadLinguisticQualityPolicy,
  loadWebUiLinguisticQualityReport,
  parsePublicLanguageRegistry,
  type LinguisticQualityFilter,
} from "../src/modules/web-ui-message-packs/linguistic-quality-report-run.js";
import {
  renderLinguisticQualityReportJson,
  renderLinguisticQualityReportMarkdown,
} from "../src/modules/web-ui-message-packs/linguistic-quality-report.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");

function readFlag(argv: readonly string[], name: string): string | undefined {
  const withEquals = argv.find((arg) => arg.startsWith(`${name}=`));
  if (withEquals) return withEquals.slice(name.length + 1);
  const index = argv.indexOf(name);
  if (index >= 0) return argv[index + 1];
  return undefined;
}

const argv = process.argv.slice(2);
const apiBase = (readFlag(argv, "--api-base") ?? "https://api.huws.org").replace(/\/$/, "");
const outDir = path.resolve(readFlag(argv, "--out-dir") ?? path.join(repoRoot, "tmp/linguistic-quality-report"));
const policyFile = readFlag(argv, "--policy");
const loadedPolicy = policyFile
  ? loadLinguisticQualityPolicy(path.resolve(policyFile))
  : loadLinguisticQualityPolicy();

const filter: LinguisticQualityFilter = {};
const locale = readFlag(argv, "--locale");
const category = readFlag(argv, "--category");
const severity = readFlag(argv, "--severity");
const reviewStatus = readFlag(argv, "--review-status");
const pathPrefix = readFlag(argv, "--path-prefix");
const divergence = readFlag(argv, "--divergence");
if (locale) filter.locale = locale;
if (category) filter.category = category;
if (severity === "high" || severity === "review" || severity === "informational" || severity === "none") {
  filter.severity = severity;
}
if (
  reviewStatus === "confirmed" ||
  reviewStatus === "human_review_required" ||
  reviewStatus === "approved" ||
  reviewStatus === "not_verified"
) {
  filter.reviewStatus = reviewStatus;
}
if (pathPrefix) filter.pathPrefix = pathPrefix;
if (divergence === "true") filter.publishedPackagedDivergence = true;
if (divergence === "false") filter.publishedPackagedDivergence = false;

const registryResponse = await fetch(`${apiBase}/api/v1/languages`);
if (!registryResponse.ok) {
  throw new Error(`Language registry HTTP ${registryResponse.status}`);
}
const registry = parsePublicLanguageRegistry(await registryResponse.json());
const report = await loadWebUiLinguisticQualityReport({
  policy: loadedPolicy.policy,
  policySha256: loadedPolicy.sha256,
  registry: registry.locales,
  textDirectionDefaultedLocales: registry.textDirectionDefaultedLocales,
  apiBaseUrl: apiBase,
  registrySource: "public-api",
  filter: Object.keys(filter).length > 0 ? filter : undefined,
});

mkdirSync(outDir, { recursive: true });
const jsonPath = path.join(outDir, "web-ui-linguistic-quality.json");
const markdownPath = path.join(outDir, "web-ui-linguistic-quality.md");
writeFileSync(jsonPath, renderLinguisticQualityReportJson(report));
writeFileSync(markdownPath, renderLinguisticQualityReportMarkdown(report));

const lines = [
  "WEB_UI linguistic quality report",
  `locales: ${report.coverage.localesDiscovered}`,
  `published entries: ${report.coverage.publishedEntriesExamined}`,
  `findings: ${report.coverage.findingCount}`,
  `unique entries: ${report.coverage.uniqueEntryCount}`,
  `review queue findings: ${report.coverage.reviewQueueFindingCount}`,
  `review queue unique entries: ${report.coverage.reviewQueueUniqueEntryCount}`,
  `identical technical: ${report.coverage.identicalTechnical}`,
  `identical suspicious before exceptions: ${report.coverage.identicalSuspiciousBeforeExceptions}`,
  `identical suspicious suppressed: ${report.coverage.identicalSuspiciousSuppressed}`,
  `identical suspicious after exceptions: ${report.coverage.identicalSuspiciousAfterExceptions}`,
  `published/packaged differences: ${report.coverage.publishedPackagedDifferenceCount}`,
  `WEB/API differences: ${report.coverage.webApiDifferenceCount}`,
  "",
];
for (const row of report.localeSummaries) {
  lines.push(
    `${row.locale}\t${row.textDirection}\trev ${row.publishedRevision ?? "-"}\tleaves ${row.publishedLeafCount}\tsuspicious ${row.identicalSuspiciousCount}\ttechnical ${row.identicalTechnicalCount}\tdiff ${row.publishedPackagedDifferenceCount}\tconfirmed ${row.confirmedDefectCount}\treview ${row.reviewCandidateCount}`,
  );
}
lines.push("", jsonPath, markdownPath);
process.stdout.write(`${lines.join("\n")}\n`);
