/**
 * Read-only WEB_UI linguistic quality report.
 *
 * Reuses structure validation, English-identical classification, legal-name
 * protection, and catalog leaf comparison. It does not publish, write catalogs,
 * or call a translation provider.
 *
 * Partial-sentence translation is reported only where glossary evidence supports
 * it. Arbitrary partial translation is not detected.
 */

import { createHash } from "node:crypto";

import type { LanguageWebUiReadinessSlice } from "@hu/types";

import {
  WEB_UI_LEGAL_ENTITY_NAME,
  webUiLegalNameRequirementMatches,
} from "./plan-selected-packaged-web-ui-updates.js";
import { classifyEnglishIdenticalWebUiValue } from "./web-ui-identical-classification.js";
import { describeStructureMismatch } from "./web-ui-message-pack.validate.js";

const BIDI_CONTROL = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/u;
const SUPPRESSIBLE_CATEGORIES = new Set(["english_identical_suspicious"]);
const RULE_KINDS = new Set([
  "rejected-exact",
  "missing-accepted-phrase",
  "includes",
  "catalog-difference",
]);
const REVIEW_CLASSIFICATIONS = new Set(["CONFIRMED_DEFECT", "REVIEW_CANDIDATE"]);

const PARTIAL_TRANSLATION_LIMITATION =
  "Partial translation is reported only when a multi-word glossary term is extended by trailing letters other than a single s, or when a placeholder is glued directly to a glossary term. Arbitrary partly translated sentences are not detected.";

const MIXED_SCRIPT_LIMITATION =
  "Mixed-script rows are review candidates, not confirmed defects. URLs, placeholders, rich-text tags, short capital abbreviations, the legal entity name, and the published brand name are removed first. Han and Japanese kana count as one script family.";

const GLOSSARY_LIMITATION =
  "Glossary preferred terms are diagnostic evidence. They are not substitution rules. The public terminology map exposes controlled lifecycle terms only; a concept missing from that map is not treated as an approved English leftover.";

export class LinguisticQualityPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LinguisticQualityPolicyError";
  }
}

export type LinguisticQualityClassification =
  | "CONFIRMED_DEFECT"
  | "REVIEW_CANDIDATE"
  | "APPROVED_EXCEPTION"
  | "NOT_VERIFIED";

export type LinguisticQualitySeverity = "high" | "review" | "informational" | "none";

export type LinguisticQualityReviewStatus =
  | "confirmed"
  | "human_review_required"
  | "approved"
  | "not_verified";

export type LinguisticQualityEvidenceStrength =
  | "deterministic"
  | "classifier"
  | "glossary"
  | "configured-rule"
  | "script-difference";

export type GlossaryPreferredTermState = "published" | "absent-from-public-map" | "unavailable";

export type GlossaryConceptEvidence = {
  readonly conceptId: string;
  readonly canonicalEnglishTerm: string;
  readonly preferredTerm: string | null;
  readonly preferredTermState: GlossaryPreferredTermState;
};

export type LinguisticQualityException = {
  readonly id: string;
  readonly locales?: readonly string[];
  readonly paths: readonly string[];
  readonly value: string;
  readonly suppresses: readonly ["english_identical_suspicious"];
  readonly reason: string;
};

export type LinguisticQualityRule = {
  readonly id: string;
  readonly kind: "rejected-exact" | "missing-accepted-phrase" | "includes" | "catalog-difference";
  readonly locales?: readonly string[];
  readonly path?: string;
  readonly pathPrefix?: string;
  readonly pathSuffix?: string;
  readonly englishExact?: string;
  readonly publishedIncludes?: string;
  readonly publishedIncludesAny?: readonly string[];
  readonly rejectedExact?: readonly string[];
  readonly acceptedIncludesAny?: readonly string[];
  readonly classification: "CONFIRMED_DEFECT" | "REVIEW_CANDIDATE";
  readonly evidence: string;
};

export type LinguisticQualityPolicy = {
  readonly id: string;
  readonly exceptions: readonly LinguisticQualityException[];
  readonly terminologyRules: readonly LinguisticQualityRule[];
};

export type LinguisticQualityFilter = {
  readonly locale?: string;
  readonly category?: string;
  readonly severity?: LinguisticQualitySeverity;
  readonly reviewStatus?: LinguisticQualityReviewStatus;
  readonly publishedPackagedDivergence?: boolean;
  readonly pathPrefix?: string;
};

export type LinguisticQualityCatalog = {
  readonly locale: string;
  readonly textDirection: "ltr" | "rtl";
  readonly englishName: string;
  readonly nativeName: string;
  readonly web: ReadonlyMap<string, string> | null;
  readonly api: ReadonlyMap<string, string> | null;
  readonly published: ReadonlyMap<string, string> | null;
  readonly publishedRevision: number | null;
  readonly publishedStatus: "present" | "missing" | "unavailable";
  readonly publishedSource: string;
  readonly glossaryStatus: "present" | "unavailable";
  readonly glossary: readonly GlossaryConceptEvidence[];
  readonly brandStatus: "present" | "unavailable";
  readonly brandSiteName: string | null;
  readonly brandSource: string | null;
  readonly readiness: LanguageWebUiReadinessSlice | null;
};

export type LinguisticQualityFinding = {
  readonly id: string;
  readonly locale: string;
  readonly textDirection: "ltr" | "rtl";
  readonly path: string;
  readonly english: string | null;
  readonly published: string | null;
  readonly packagedWeb: string | null;
  readonly packagedApi: string | null;
  readonly publishedRevision: number | null;
  readonly category: string;
  readonly severity: LinguisticQualitySeverity;
  readonly classification: LinguisticQualityClassification;
  readonly evidence: string;
  readonly evidenceStrength: LinguisticQualityEvidenceStrength;
  readonly applicableTerminology: readonly string[];
  readonly exceptionStatus: string;
  readonly reviewStatus: LinguisticQualityReviewStatus;
  readonly recommendedWorkflow: string;
  readonly affectedSide: "published" | "packaged" | "both" | "catalog";
  readonly ruleId: string | null;
  readonly inReviewQueue: boolean;
};

export type LinguisticQualityLocaleSummary = {
  readonly locale: string;
  readonly textDirection: "ltr" | "rtl";
  readonly englishName: string;
  readonly nativeName: string;
  readonly publishedStatus: LinguisticQualityCatalog["publishedStatus"];
  readonly publishedRevision: number | null;
  readonly publishedSource: string;
  readonly publishedLeafCount: number;
  readonly pathSetEqual: boolean | null;
  readonly diagnosticsExamined: readonly string[];
  readonly diagnosticsNotRun: readonly string[];
  readonly missingPathCount: number;
  readonly emptyValueCount: number;
  readonly structureFindingCount: number;
  readonly bidirectionalControlCount: number;
  readonly hardcodedPlatformNameCount: number;
  readonly identicalTechnicalCount: number;
  readonly identicalSuspiciousCount: number;
  readonly identicalSuppressedCount: number;
  readonly webApiDifferenceCount: number;
  readonly publishedPackagedDifferenceCount: number;
  readonly glossaryFindingCount: number;
  readonly partialTranslationCount: number;
  readonly placeholderBoundaryCount: number;
  readonly terminologyRuleCount: number;
  readonly mixedScriptQueuedCount: number;
  readonly mixedScriptSecondaryCount: number;
  readonly confirmedDefectCount: number;
  readonly reviewCandidateCount: number;
  readonly readiness: LanguageWebUiReadinessSlice | null;
};

export type LinguisticQualityProvenance = {
  readonly registrySource: string;
  readonly publishedSource: string;
  readonly glossarySource: string;
  readonly brandSource: string;
  readonly catalogSource: string;
  readonly unjoinedGlossaryConceptIds: readonly string[];
  readonly englishFoundationMatchesPackaged: boolean | null;
  readonly webApiParityDiscrepancyCount: number | null;
  readonly textDirectionDefaultedLocales: readonly string[];
};

const SUPPLIED_PROVENANCE: LinguisticQualityProvenance = {
  registrySource: "supplied-snapshot",
  publishedSource: "supplied-snapshot",
  glossarySource: "supplied-snapshot",
  brandSource: "supplied-snapshot",
  catalogSource: "supplied-snapshot",
  unjoinedGlossaryConceptIds: [],
  englishFoundationMatchesPackaged: null,
  webApiParityDiscrepancyCount: null,
  textDirectionDefaultedLocales: [],
};

export type LinguisticQualityReport = {
  readonly reportId: "web-ui-linguistic-quality";
  readonly policyId: string;
  readonly policySha256: string;
  readonly provenance: LinguisticQualityProvenance;
  readonly canonicalLocale: string;
  readonly canonicalLeafCount: number;
  readonly canonicalSha256: string;
  readonly filter: LinguisticQualityFilter | null;
  readonly findings: readonly LinguisticQualityFinding[];
  readonly localeSummaries: readonly LinguisticQualityLocaleSummary[];
  readonly coverage: {
    readonly localesDiscovered: number;
    readonly publishedEntriesExamined: number;
    readonly localesWithoutPublishedSnapshot: number;
    readonly findingCount: number;
    readonly uniqueEntryCount: number;
    readonly reviewQueueFindingCount: number;
    readonly reviewQueueUniqueEntryCount: number;
    readonly filteredFindingCount: number;
    readonly filteredReviewQueueUniqueEntryCount: number;
    readonly identicalTechnical: number;
    readonly identicalSuspiciousBeforeExceptions: number;
    readonly identicalSuspiciousSuppressed: number;
    readonly identicalSuspiciousAfterExceptions: number;
    readonly identicalReasonCounts: Readonly<Record<string, number>>;
    readonly publishedPackagedDifferenceCount: number;
    readonly webApiDifferenceCount: number;
    readonly limitations: readonly string[];
  };
};

type DraftFinding = Omit<LinguisticQualityFinding, "id" | "inReviewQueue">;

const VALUE_DIAGNOSTICS = [
  "structure",
  "bidirectional-controls",
  "hardcoded-platform-name",
  "english-identical",
  "glossary",
  "partial-translation",
  "placeholder-boundary",
  "mixed-script",
  "published-packaged-difference",
  "terminology-rules",
] as const;

export function parseLinguisticQualityPolicy(value: unknown): LinguisticQualityPolicy {
  const errors: string[] = [];
  const record = asRecord(value, "policy", errors);
  if (!record) {
    throw new LinguisticQualityPolicyError(errors.join(" "));
  }
  const id = requiredString(record, "id", errors);
  rejectUnknown(record, ["id", "exceptions", "terminologyRules"], "policy", errors);
  const exceptions = asArray(record.exceptions, "exceptions", errors).map((entry, index) =>
    parseException(entry, index, errors),
  );
  const terminologyRules = asArray(record.terminologyRules, "terminologyRules", errors).map(
    (entry, index) => parseRule(entry, index, errors),
  );
  if (errors.length > 0 || !id) {
    throw new LinguisticQualityPolicyError(errors.join(" "));
  }
  return {
    id,
    exceptions: exceptions.filter((entry): entry is LinguisticQualityException => entry != null),
    terminologyRules: terminologyRules.filter((entry): entry is LinguisticQualityRule => entry != null),
  };
}

export function hashCatalogLeaves(leaves: ReadonlyMap<string, string>): string {
  const hash = createHash("sha256");
  for (const key of [...leaves.keys()].sort()) {
    hash.update(key);
    hash.update("\0");
    hash.update(leaves.get(key) ?? "");
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function buildLinguisticQualityReport(input: {
  readonly policy: LinguisticQualityPolicy;
  readonly policySha256: string;
  readonly canonicalLocale: string;
  readonly english: ReadonlyMap<string, string>;
  readonly catalogs: readonly LinguisticQualityCatalog[];
  readonly filter?: LinguisticQualityFilter;
  readonly provenance?: LinguisticQualityProvenance;
}): LinguisticQualityReport {
  const findings: LinguisticQualityFinding[] = [];
  const summaries: LinguisticQualityLocaleSummary[] = [];
  const reasonCounts = new Map<string, number>();
  let suspiciousBefore = 0;
  let suppressed = 0;

  const catalogs = [...input.catalogs].sort((left, right) =>
    left.locale.localeCompare(right.locale),
  );
  for (const catalog of catalogs) {
    const built = examineCatalog(input.english, catalog, input.policy);
    findings.push(...built.findings);
    summaries.push(built.summary);
    suspiciousBefore += built.suspiciousBefore;
    suppressed += built.suppressed;
    for (const [reason, count] of built.reasonCounts) {
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + count);
    }
  }

  findings.sort(compareFindings);
  const coverage = summarizeCoverage(findings, summaries, suspiciousBefore, suppressed, reasonCounts);
  const filtered = input.filter ? applyFilter(findings, input.filter) : findings;
  return {
    reportId: "web-ui-linguistic-quality",
    policyId: input.policy.id,
    policySha256: input.policySha256,
    provenance: input.provenance ?? SUPPLIED_PROVENANCE,
    canonicalLocale: input.canonicalLocale,
    canonicalLeafCount: input.english.size,
    canonicalSha256: hashCatalogLeaves(input.english),
    filter: input.filter ?? null,
    findings: filtered,
    localeSummaries: summaries,
    coverage: {
      ...coverage,
      filteredFindingCount: filtered.length,
      filteredReviewQueueUniqueEntryCount: uniquePaths(filtered.filter((finding) => finding.inReviewQueue)),
    },
  };
}

export function renderLinguisticQualityReportJson(report: LinguisticQualityReport): string {
  return `${JSON.stringify(sortJson(report), null, 2)}\n`;
}

export function renderLinguisticQualityReportMarkdown(report: LinguisticQualityReport): string {
  const lines: string[] = [
    "# WEB_UI linguistic quality report",
    "",
    `Policy \`${report.policyId}\`. Canonical locale \`${report.canonicalLocale}\` with ${report.canonicalLeafCount} leaves.`,
    "",
    "This report does not assign a translation-quality score. English-identical technical values stay approved by the existing classifier. Published and packaged differences are not treated as defects.",
    "",
    "## Per-locale summary",
    "",
    "| Locale | Direction | Revision | Published leaves | Suspicious identical | Technical identical | Published/packaged | Confirmed | Review candidates |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const row of report.localeSummaries) {
    lines.push(
      `| ${row.locale} | ${row.textDirection} | ${row.publishedRevision ?? ""} | ${row.publishedLeafCount} | ${row.identicalSuspiciousCount} | ${row.identicalTechnicalCount} | ${row.publishedPackagedDifferenceCount} | ${row.confirmedDefectCount} | ${row.reviewCandidateCount} |`,
    );
  }
  lines.push(
    "",
    "## Diagnostic coverage",
    "",
    `- Locales discovered: ${report.coverage.localesDiscovered}`,
    `- Published entries examined: ${report.coverage.publishedEntriesExamined}`,
    `- Locales without a published snapshot: ${report.coverage.localesWithoutPublishedSnapshot}`,
    `- Findings: ${report.coverage.findingCount}`,
    `- Unique locale/path entries: ${report.coverage.uniqueEntryCount}`,
    `- Review-queue findings: ${report.coverage.reviewQueueFindingCount}`,
    `- Review-queue unique locale/path entries: ${report.coverage.reviewQueueUniqueEntryCount}`,
    `- English-identical technical: ${report.coverage.identicalTechnical}`,
    `- English-identical suspicious before exceptions: ${report.coverage.identicalSuspiciousBeforeExceptions}`,
    `- English-identical suspicious suppressed by an exact exception: ${report.coverage.identicalSuspiciousSuppressed}`,
    `- English-identical suspicious after exceptions: ${report.coverage.identicalSuspiciousAfterExceptions}`,
    `- Published/packaged differences: ${report.coverage.publishedPackagedDifferenceCount}`,
    `- WEB/API packaged differences: ${report.coverage.webApiDifferenceCount}`,
    "",
    "### Limitations",
    "",
  );
  for (const limitation of report.coverage.limitations) {
    lines.push(`- ${limitation}`);
  }
  const queue = report.findings.filter((finding) => finding.inReviewQueue);
  lines.push(
    "",
    "## Prioritized human-review queue",
    "",
    `${queue.length} findings across ${uniquePaths(queue)} locale/path entries. Informational published/packaged differences stay in the JSON report and are not repeated here.`,
    "",
  );
  for (const finding of queue) {
    lines.push(
      `### ${finding.locale} ${finding.path}`,
      "",
      `- Category: ${finding.category}`,
      `- Classification: ${finding.classification}`,
      `- Severity: ${finding.severity}`,
      `- Evidence strength: ${finding.evidenceStrength}`,
      `- Review status: ${finding.reviewStatus}`,
      `- Exception status: ${finding.exceptionStatus}`,
      `- Workflow: ${finding.recommendedWorkflow}`,
      `- Applicable terminology: ${finding.applicableTerminology.join(", ") || "(none)"}`,
      `- Published revision: ${finding.publishedRevision ?? "(none)"}`,
      "",
      "Evidence:",
      "",
      indented(finding.evidence),
      "",
      "English:",
      "",
      indented(finding.english),
      "",
      "Published:",
      "",
      indented(finding.published),
      "",
      "Packaged WEB:",
      "",
      indented(finding.packagedWeb),
      "",
      "Packaged API:",
      "",
      indented(finding.packagedApi),
      "",
    );
  }
  return `${lines.join("\n")}\n`;
}

function examineCatalog(
  english: ReadonlyMap<string, string>,
  catalog: LinguisticQualityCatalog,
  policy: LinguisticQualityPolicy,
): {
  readonly findings: LinguisticQualityFinding[];
  readonly summary: LinguisticQualityLocaleSummary;
  readonly suspiciousBefore: number;
  readonly suppressed: number;
  readonly reasonCounts: ReadonlyMap<string, number>;
} {
  const drafts: DraftFinding[] = [];
  const reasonCounts = new Map<string, number>();
  let suspiciousBefore = 0;
  let suppressed = 0;
  const publishedPresent = catalog.publishedStatus === "present" && catalog.published != null;
  const published = publishedPresent ? catalog.published : null;

  if (!publishedPresent) {
    drafts.push(
      draft(catalog, "", null, null, null, null, {
        category: catalog.publishedStatus === "missing"
          ? "published_snapshot_missing"
          : "published_snapshot_unavailable",
        classification: "NOT_VERIFIED",
        evidence:
          "No published catalog snapshot is available. The packaged catalog was not used in its place.",
        evidenceStrength: "deterministic",
        affectedSide: "catalog",
      }),
    );
  }
  if (catalog.web == null || catalog.api == null) {
    drafts.push(
      draft(catalog, "", null, null, null, null, {
        category: "catalog_unavailable",
        classification: "NOT_VERIFIED",
        evidence: catalogFileEvidence(catalog),
        evidenceStrength: "deterministic",
        affectedSide: "catalog",
      }),
    );
  }

  const preferred = preferredSurfaces(catalog.glossary);
  const paths = new Set<string>(english.keys());
  if (published) {
    for (const key of published.keys()) paths.add(key);
  }
  if (catalog.web && catalog.api) {
    for (const key of catalog.web.keys()) paths.add(key);
    for (const key of catalog.api.keys()) paths.add(key);
  }

  let missingPathCount = 0;
  let emptyValueCount = 0;
  for (const pathKey of [...paths].sort()) {
    const englishValue = english.get(pathKey) ?? null;
    const publishedValue = published?.get(pathKey) ?? null;
    const webValue = catalog.web?.get(pathKey) ?? null;
    const apiValue = catalog.api?.get(pathKey) ?? null;
    const base = { catalog, pathKey, englishValue, publishedValue, webValue, apiValue };

    if (published && englishValue == null && publishedValue != null) {
      drafts.push(valueDraft(base, {
        category: "unexpected_path",
        classification: "CONFIRMED_DEFECT",
        evidence: "The published catalog has a path that is absent from the canonical English catalog.",
        evidenceStrength: "deterministic",
        affectedSide: "published",
      }));
    }
    if (published && englishValue != null && publishedValue == null) {
      missingPathCount += 1;
      drafts.push(valueDraft(base, {
        category: "missing_path",
        classification: "CONFIRMED_DEFECT",
        evidence: "The published snapshot has no value for this canonical path.",
        evidenceStrength: "deterministic",
        affectedSide: "published",
      }));
    }
    if (publishedValue != null && publishedValue.trim().length === 0) {
      emptyValueCount += 1;
      drafts.push(valueDraft(base, {
        category: "empty_value",
        classification: "CONFIRMED_DEFECT",
        evidence: "The published value is empty.",
        evidenceStrength: "deterministic",
        affectedSide: "published",
      }));
    }

    if (published && englishValue != null && publishedValue != null && publishedValue.trim().length > 0) {
      const mismatch = describeStructureMismatch(englishValue, publishedValue);
      if (mismatch) {
        for (const clause of mismatch.split("; ")) {
          drafts.push(valueDraft(base, {
            category: structureCategory(clause),
            classification: "CONFIRMED_DEFECT",
            evidence: clause,
            evidenceStrength: "deterministic",
            affectedSide: "published",
          }));
        }
      }
      if (BIDI_CONTROL.test(publishedValue)) {
        drafts.push(valueDraft(base, {
          category: "bidirectional_control",
          classification: "CONFIRMED_DEFECT",
          evidence: "The published value contains a bidirectional control character.",
          evidenceStrength: "deterministic",
          affectedSide: "published",
        }));
      }
      if (!webUiLegalNameRequirementMatches(englishValue, publishedValue)) {
        drafts.push(valueDraft(base, {
          category: "structural_defect",
          classification: "CONFIRMED_DEFECT",
          evidence: `${WEB_UI_LEGAL_ENTITY_NAME} occurrences do not match the canonical English text.`,
          evidenceStrength: "deterministic",
          applicableTerminology: [WEB_UI_LEGAL_ENTITY_NAME],
          affectedSide: "published",
          recommendedWorkflow: "restore-legal-name",
        }));
      }
      if (hasHardcodedPlatformName(publishedValue, catalog.brandSiteName)) {
        drafts.push(valueDraft(base, {
          category: "hardcoded_platform_name",
          classification: "REVIEW_CANDIDATE",
          evidence:
            "The published value contains Humanity Union outside the legal entity name and outside {siteName}.",
          evidenceStrength: "deterministic",
          applicableTerminology: catalog.brandSiteName ? [catalog.brandSiteName] : [],
          affectedSide: "published",
        }));
      }
      const identical = classifyEnglishIdenticalWebUiValue({
        path: pathKey,
        english: englishValue,
        localized: publishedValue,
        preferredEnglishSurfaces: preferred,
      });
      if (identical) {
        reasonCounts.set(identical.reason, (reasonCounts.get(identical.reason) ?? 0) + 1);
        if (identical.kind === "accepted-technical") {
          drafts.push(valueDraft(base, {
            category: "english_identical_technical",
            classification: "APPROVED_EXCEPTION",
            evidence: `Existing classifier accepted this identical value as ${identical.reason}.`,
            evidenceStrength: "classifier",
            reviewStatus: "approved",
            affectedSide: "published",
            recommendedWorkflow: "no-change",
          }));
        } else {
          suspiciousBefore += 1;
          const exception = matchingException(policy, catalog.locale, pathKey, publishedValue);
          if (exception) {
            suppressed += 1;
            drafts.push(valueDraft(base, {
              category: "english_identical_suspicious",
              classification: "APPROVED_EXCEPTION",
              evidence: exception.reason,
              evidenceStrength: "configured-rule",
              applicableTerminology: terminologyForExactEnglish(catalog.glossary, englishValue),
              exceptionStatus: `approved:${exception.id}`,
              reviewStatus: "approved",
              affectedSide: "published",
              ruleId: exception.id,
              recommendedWorkflow: "no-change",
            }));
          } else {
            drafts.push(valueDraft(base, {
              category: "english_identical_suspicious",
              classification: "REVIEW_CANDIDATE",
              evidence: `Existing classifier marked this identical value as ${identical.reason}. Identity with English is not itself a defect.`,
              evidenceStrength: "classifier",
              applicableTerminology: terminologyForExactEnglish(catalog.glossary, englishValue),
              affectedSide: "published",
            }));
          }
        }
      }
      drafts.push(
        ...glossaryFindings(base, catalog.glossary),
        ...partialFindings(base, catalog.glossary),
        ...placeholderBoundaryFindings(base, catalog.glossary),
        ...mixedScriptFindings(base, catalog),
      );
    }

    if (catalog.web && catalog.api && webValue !== apiValue) {
      drafts.push(valueDraft(base, {
        category: "web_api_packaged_difference",
        classification: "CONFIRMED_DEFECT",
        evidence: "The packaged WEB catalog and the packaged API catalog differ for this path.",
        evidenceStrength: "deterministic",
        affectedSide: "packaged",
        recommendedWorkflow: "correct-catalog-then-selected-update",
      }));
    }
    if (
      published &&
      typeof publishedValue === "string" &&
      typeof apiValue === "string" &&
      publishedValue !== apiValue
    ) {
      drafts.push(valueDraft(base, {
        category: "published_packaged_difference",
        classification: "NOT_VERIFIED",
        evidence:
          "The published value and the packaged API value differ. Neither source is selected as the correct translation.",
        evidenceStrength: "deterministic",
        affectedSide: "both",
        recommendedWorkflow: "human-review-neither-source-is-assumed-correct",
      }));
    }
    if (catalog.api && typeof apiValue === "string" && englishValue != null) {
      if (!webUiLegalNameRequirementMatches(englishValue, apiValue)) {
        drafts.push(valueDraft(base, {
          category: "structural_defect",
          classification: "CONFIRMED_DEFECT",
          evidence: `${WEB_UI_LEGAL_ENTITY_NAME} occurrences in the packaged API catalog do not match the canonical English text.`,
          evidenceStrength: "deterministic",
          applicableTerminology: [WEB_UI_LEGAL_ENTITY_NAME],
          affectedSide: "packaged",
          recommendedWorkflow: "do-not-publish-packaged-value",
        }));
      }
    }
    drafts.push(...ruleFindings(base, policy));
  }

  const findings = drafts.map(finishFinding);
  return {
    findings,
    suspiciousBefore,
    suppressed,
    reasonCounts,
    summary: summarizeLocale(catalog, english, findings, missingPathCount, emptyValueCount, suppressed),
  };
}

function ruleFindings(
  base: ValueBase,
  policy: LinguisticQualityPolicy,
): DraftFinding[] {
  const findings: DraftFinding[] = [];
  for (const rule of policy.terminologyRules) {
    if (!ruleMatchesPath(rule, base.catalog.locale, base.pathKey, base.englishValue)) {
      continue;
    }
    if (rule.kind === "rejected-exact") {
      for (const side of ["published", "packaged"] as const) {
        const value = side === "published" ? base.publishedValue : base.apiValue;
        if (typeof value !== "string") continue;
        if (side === "published" && base.catalog.publishedStatus !== "present") continue;
        if (rule.acceptedIncludesAny?.some((phrase) => value.includes(phrase))) continue;
        if (!rule.rejectedExact?.includes(value.trim())) continue;
        findings.push(valueDraft(base, {
          category: "terminology_rule",
          classification: rule.classification,
          evidence: rule.evidence,
          evidenceStrength: "configured-rule",
          applicableTerminology: [rule.id, ...(rule.acceptedIncludesAny ?? [])],
          affectedSide: side === "published" ? "published" : "packaged",
          ruleId: rule.id,
          recommendedWorkflow: side === "packaged"
            ? "do-not-publish-packaged-value"
            : "correct-catalog-then-selected-update",
        }));
      }
    } else if (rule.kind === "missing-accepted-phrase") {
      if (base.catalog.publishedStatus !== "present") continue;
      const phrases = rule.acceptedIncludesAny ?? [];
      const publishedMisses = typeof base.publishedValue === "string"
        && !phrases.some((phrase) => base.publishedValue?.includes(phrase));
      const packagedMisses = typeof base.apiValue === "string"
        && !phrases.some((phrase) => base.apiValue?.includes(phrase));
      if (!publishedMisses && !packagedMisses) continue;
      findings.push(valueDraft(base, {
        category: "terminology_rule",
        classification: rule.classification,
        evidence: rule.evidence,
        evidenceStrength: "configured-rule",
        applicableTerminology: [rule.id, ...phrases],
        affectedSide: publishedMisses && packagedMisses ? "both" : publishedMisses ? "published" : "packaged",
        ruleId: rule.id,
      }));
    } else if (rule.kind === "includes") {
      if (base.catalog.publishedStatus !== "present" || typeof base.publishedValue !== "string") continue;
      const phrases = [
        ...(rule.publishedIncludes ? [rule.publishedIncludes] : []),
        ...(rule.publishedIncludesAny ?? []),
      ];
      const hit = phrases.filter((phrase) => base.publishedValue?.includes(phrase));
      if (hit.length === 0) continue;
      findings.push(valueDraft(base, {
        category: "terminology_rule",
        classification: rule.classification,
        evidence: `${rule.evidence} Matched: ${hit.join(", ")}.`,
        evidenceStrength: "configured-rule",
        applicableTerminology: [rule.id, ...hit],
        affectedSide: "published",
        ruleId: rule.id,
      }));
    } else if (
      rule.kind === "catalog-difference" &&
      base.catalog.publishedStatus === "present" &&
      typeof base.publishedValue === "string" &&
      typeof base.apiValue === "string" &&
      base.publishedValue !== base.apiValue
    ) {
      findings.push(valueDraft(base, {
        category: "terminology_rule",
        classification: rule.classification,
        evidence: rule.evidence,
        evidenceStrength: "configured-rule",
        applicableTerminology: [rule.id],
        affectedSide: "both",
        ruleId: rule.id,
        recommendedWorkflow: "human-review-neither-source-is-assumed-correct",
      }));
    }
  }
  return findings;
}

function glossaryFindings(base: ValueBase, glossary: readonly GlossaryConceptEvidence[]): DraftFinding[] {
  if (typeof base.publishedValue !== "string" || typeof base.englishValue !== "string") return [];
  const findings: DraftFinding[] = [];
  for (const concept of glossary) {
    if (concept.preferredTermState !== "published" || !concept.preferredTerm) continue;
    if (concept.preferredTerm === concept.canonicalEnglishTerm) continue;
    if (!containsBounded(base.englishValue, concept.canonicalEnglishTerm)) continue;
    if (!containsBounded(base.publishedValue, concept.canonicalEnglishTerm)) continue;
    if (base.publishedValue.includes(concept.preferredTerm)) continue;
    findings.push(valueDraft(base, {
      category: "glossary_terminology",
      classification: "REVIEW_CANDIDATE",
      evidence: `The published value still contains the canonical term "${concept.canonicalEnglishTerm}" while the published glossary prefers "${concept.preferredTerm}".`,
      evidenceStrength: "glossary",
      applicableTerminology: [concept.conceptId, concept.preferredTerm],
      affectedSide: "published",
      ruleId: concept.conceptId,
    }));
  }
  return findings;
}

function partialFindings(base: ValueBase, glossary: readonly GlossaryConceptEvidence[]): DraftFinding[] {
  if (typeof base.publishedValue !== "string") return [];
  const hits: string[] = [];
  for (const concept of glossary) {
    if (!concept.canonicalEnglishTerm.includes(" ")) continue;
    const extra = trailingExtension(base.publishedValue, concept.canonicalEnglishTerm);
    if (extra) hits.push(`${concept.canonicalEnglishTerm}+${extra}`);
  }
  if (hits.length === 0) return [];
  return [valueDraft(base, {
    category: "partial_translation",
    classification: "REVIEW_CANDIDATE",
    evidence: `A multi-word glossary term is extended by trailing letters: ${hits.join(", ")}. This is a candidate, not a confirmed defect.`,
    evidenceStrength: "glossary",
    applicableTerminology: hits,
    affectedSide: "published",
  })];
}

function placeholderBoundaryFindings(
  base: ValueBase,
  glossary: readonly GlossaryConceptEvidence[],
): DraftFinding[] {
  if (typeof base.publishedValue !== "string") return [];
  const glued = gluedGlossaryTerms(base.publishedValue, glossary);
  if (glued.length === 0) return [];
  return [valueDraft(base, {
    category: "placeholder_boundary",
    classification: "REVIEW_CANDIDATE",
    evidence: `A placeholder is glued directly to a glossary term: ${glued.join(", ")}.`,
    evidenceStrength: "glossary",
    applicableTerminology: glued,
    affectedSide: "published",
  })];
}

function mixedScriptFindings(base: ValueBase, catalog: LinguisticQualityCatalog): DraftFinding[] {
  if (typeof base.publishedValue !== "string") return [];
  const detected = detectMixedScript(base.publishedValue, catalog.brandSiteName);
  if (!detected) return [];
  const strength = mixedScriptStrength(detected.leftoverLatin, catalog.glossary);
  return [valueDraft(base, {
    category: "mixed_script",
    classification: "REVIEW_CANDIDATE",
    evidence: `Scripts after technical masking: ${detected.families.join(", ")}. Leftover Latin: ${detected.leftoverLatin.join(", ") || "(none)"}.`,
    evidenceStrength: strength,
    applicableTerminology: strength === "glossary" ? detected.leftoverLatin : [],
    affectedSide: "published",
  })];
}

function summarizeLocale(
  catalog: LinguisticQualityCatalog,
  english: ReadonlyMap<string, string>,
  findings: readonly LinguisticQualityFinding[],
  missingPathCount: number,
  emptyValueCount: number,
  suppressed: number,
): LinguisticQualityLocaleSummary {
  const own = findings.filter((finding) => finding.locale === catalog.locale && finding.path !== "");
  const count = (category: string) => own.filter((finding) => finding.category === category).length;
  const publishedPresent = catalog.publishedStatus === "present" && catalog.published != null;
  const pathSetEqual = publishedPresent
    ? sameKeySet(english, catalog.published!)
    : null;
  return {
    locale: catalog.locale,
    textDirection: catalog.textDirection,
    englishName: catalog.englishName,
    nativeName: catalog.nativeName,
    publishedStatus: catalog.publishedStatus,
    publishedRevision: catalog.publishedRevision,
    publishedSource: catalog.publishedSource,
    publishedLeafCount: catalog.published?.size ?? 0,
    pathSetEqual,
    diagnosticsExamined: publishedPresent
      ? ["catalog-files", ...VALUE_DIAGNOSTICS]
      : ["catalog-files"],
    diagnosticsNotRun: publishedPresent ? [] : [...VALUE_DIAGNOSTICS],
    missingPathCount,
    emptyValueCount,
    structureFindingCount:
      count("placeholder_mismatch") + count("rich_tag_mismatch") + count("structural_defect"),
    bidirectionalControlCount: count("bidirectional_control"),
    hardcodedPlatformNameCount: count("hardcoded_platform_name"),
    identicalTechnicalCount: count("english_identical_technical"),
    identicalSuspiciousCount: own.filter(
      (finding) =>
        finding.category === "english_identical_suspicious" &&
        finding.classification === "REVIEW_CANDIDATE",
    ).length,
    identicalSuppressedCount: suppressed,
    webApiDifferenceCount: count("web_api_packaged_difference"),
    publishedPackagedDifferenceCount: count("published_packaged_difference"),
    glossaryFindingCount: count("glossary_terminology"),
    partialTranslationCount: count("partial_translation"),
    placeholderBoundaryCount: count("placeholder_boundary"),
    terminologyRuleCount: count("terminology_rule"),
    mixedScriptQueuedCount: own.filter(
      (finding) => finding.category === "mixed_script" && finding.evidenceStrength === "glossary",
    ).length,
    mixedScriptSecondaryCount: own.filter(
      (finding) => finding.category === "mixed_script" && finding.evidenceStrength !== "glossary",
    ).length,
    confirmedDefectCount: findings.filter((finding) => finding.classification === "CONFIRMED_DEFECT").length,
    reviewCandidateCount: findings.filter((finding) => finding.classification === "REVIEW_CANDIDATE").length,
    readiness: catalog.readiness,
  };
}

function summarizeCoverage(
  findings: readonly LinguisticQualityFinding[],
  summaries: readonly LinguisticQualityLocaleSummary[],
  suspiciousBefore: number,
  suppressed: number,
  reasonCounts: ReadonlyMap<string, number>,
): Omit<
  LinguisticQualityReport["coverage"],
  "filteredFindingCount" | "filteredReviewQueueUniqueEntryCount"
> {
  const queue = findings.filter((finding) => finding.inReviewQueue);
  const reasons: Record<string, number> = {};
  for (const key of [...reasonCounts.keys()].sort()) {
    reasons[key] = reasonCounts.get(key) ?? 0;
  }
  return {
    localesDiscovered: summaries.length,
    publishedEntriesExamined: summaries.reduce((sum, row) => sum + row.publishedLeafCount, 0),
    localesWithoutPublishedSnapshot: summaries.filter((row) => row.publishedStatus !== "present").length,
    findingCount: findings.length,
    uniqueEntryCount: uniquePaths(findings.filter((finding) => finding.path !== "")),
    reviewQueueFindingCount: queue.length,
    reviewQueueUniqueEntryCount: uniquePaths(queue),
    identicalTechnical: findings.filter((finding) => finding.category === "english_identical_technical").length,
    identicalSuspiciousBeforeExceptions: suspiciousBefore,
    identicalSuspiciousSuppressed: suppressed,
    identicalSuspiciousAfterExceptions: suspiciousBefore - suppressed,
    identicalReasonCounts: reasons,
    publishedPackagedDifferenceCount: findings.filter(
      (finding) => finding.category === "published_packaged_difference",
    ).length,
    webApiDifferenceCount: findings.filter(
      (finding) => finding.category === "web_api_packaged_difference",
    ).length,
    limitations: [PARTIAL_TRANSLATION_LIMITATION, MIXED_SCRIPT_LIMITATION, GLOSSARY_LIMITATION],
  };
}

type ValueBase = {
  readonly catalog: LinguisticQualityCatalog;
  readonly pathKey: string;
  readonly englishValue: string | null;
  readonly publishedValue: string | null;
  readonly webValue: string | null;
  readonly apiValue: string | null;
};

function valueDraft(
  base: ValueBase,
  partial: Omit<
    DraftFinding,
    | "locale"
    | "textDirection"
    | "path"
    | "english"
    | "published"
    | "packagedWeb"
    | "packagedApi"
    | "publishedRevision"
    | "severity"
    | "applicableTerminology"
    | "exceptionStatus"
    | "reviewStatus"
    | "recommendedWorkflow"
    | "ruleId"
  > &
    Partial<
      Pick<
        DraftFinding,
        | "applicableTerminology"
        | "exceptionStatus"
        | "reviewStatus"
        | "recommendedWorkflow"
        | "ruleId"
      >
    >,
): DraftFinding {
  return draft(
    base.catalog,
    base.pathKey,
    base.englishValue,
    base.publishedValue,
    base.webValue,
    base.apiValue,
    partial,
  );
}

function draft(
  catalog: LinguisticQualityCatalog,
  pathKey: string,
  english: string | null,
  published: string | null,
  packagedWeb: string | null,
  packagedApi: string | null,
  partial: Omit<
    DraftFinding,
    | "locale"
    | "textDirection"
    | "path"
    | "english"
    | "published"
    | "packagedWeb"
    | "packagedApi"
    | "publishedRevision"
    | "severity"
    | "applicableTerminology"
    | "exceptionStatus"
    | "reviewStatus"
    | "recommendedWorkflow"
    | "ruleId"
  > &
    Partial<
      Pick<
        DraftFinding,
        | "applicableTerminology"
        | "exceptionStatus"
        | "reviewStatus"
        | "recommendedWorkflow"
        | "ruleId"
      >
    >,
): DraftFinding {
  const classification = partial.classification;
  return {
    locale: catalog.locale,
    textDirection: catalog.textDirection,
    path: pathKey,
    english,
    published,
    packagedWeb,
    packagedApi,
    publishedRevision: catalog.publishedRevision,
    category: partial.category,
    severity: severityFor(classification, partial.category),
    classification,
    evidence: partial.evidence,
    evidenceStrength: partial.evidenceStrength,
    applicableTerminology: partial.applicableTerminology ?? [],
    exceptionStatus: partial.exceptionStatus ?? "none",
    reviewStatus: partial.reviewStatus ?? reviewStatusFor(classification),
    recommendedWorkflow: partial.recommendedWorkflow ?? workflowFor(classification, partial.category, partial.affectedSide),
    affectedSide: partial.affectedSide,
    ruleId: partial.ruleId ?? null,
  };
}

function finishFinding(finding: DraftFinding): LinguisticQualityFinding {
  return {
    ...finding,
    id: createHash("sha256")
      .update([
        finding.locale,
        finding.path,
        finding.category,
        finding.affectedSide,
        finding.evidence,
        finding.classification,
      ].join("\n"))
      .digest("hex")
      .slice(0, 16),
    inReviewQueue: queueEligible(finding),
  };
}

function queueEligible(finding: DraftFinding): boolean {
  if (finding.classification === "APPROVED_EXCEPTION") return false;
  if (finding.category === "published_packaged_difference") return false;
  if (finding.category === "english_identical_technical") return false;
  if (finding.category === "mixed_script" && finding.evidenceStrength !== "glossary") return false;
  return finding.classification === "CONFIRMED_DEFECT" || finding.classification === "REVIEW_CANDIDATE" || finding.classification === "NOT_VERIFIED";
}

function severityFor(
  classification: LinguisticQualityClassification,
  category: string,
): LinguisticQualitySeverity {
  if (classification === "CONFIRMED_DEFECT") return "high";
  if (classification === "APPROVED_EXCEPTION") return "none";
  if (category === "published_packaged_difference") return "informational";
  if (
    classification === "NOT_VERIFIED" &&
    (category === "published_snapshot_missing" || category === "published_snapshot_unavailable" || category === "catalog_unavailable")
  ) {
    return "review";
  }
  if (classification === "REVIEW_CANDIDATE") return "review";
  return "informational";
}

function reviewStatusFor(
  classification: LinguisticQualityClassification,
): LinguisticQualityReviewStatus {
  if (classification === "CONFIRMED_DEFECT") return "confirmed";
  if (classification === "REVIEW_CANDIDATE") return "human_review_required";
  if (classification === "APPROVED_EXCEPTION") return "approved";
  return "not_verified";
}

function workflowFor(
  classification: LinguisticQualityClassification,
  category: string,
  affectedSide: DraftFinding["affectedSide"],
): string {
  if (classification === "APPROVED_EXCEPTION") return "no-change";
  if (category === "published_snapshot_missing" || category === "published_snapshot_unavailable") {
    return "supply-published-snapshot";
  }
  if (category === "catalog_unavailable") return "add-the-locale-catalog-before-review";
  if (category === "published_packaged_difference") return "human-review-neither-source-is-assumed-correct";
  if (classification === "CONFIRMED_DEFECT" && affectedSide === "packaged") return "do-not-publish-packaged-value";
  if (classification === "CONFIRMED_DEFECT") return "correct-catalog-then-selected-update";
  return "human-review-no-automatic-replacement";
}

function structureCategory(clause: string): string {
  if (clause.includes("<")) return "rich_tag_mismatch";
  if (clause.includes("{") || clause.includes("placeholder")) return "placeholder_mismatch";
  return "structural_defect";
}

function catalogFileEvidence(catalog: LinguisticQualityCatalog): string {
  const missing = [
    catalog.web == null ? "WEB" : null,
    catalog.api == null ? "API" : null,
  ].filter((item): item is string => item != null);
  return `Packaged ${missing.join(" and ")} catalog file is absent for this registry locale.`;
}

function ruleMatchesPath(
  rule: LinguisticQualityRule,
  locale: string,
  pathKey: string,
  english: string | null,
): boolean {
  if (rule.locales && !rule.locales.includes(locale)) return false;
  if (rule.path && rule.path !== pathKey) return false;
  if (rule.pathPrefix && !pathKey.startsWith(rule.pathPrefix)) return false;
  if (rule.pathSuffix && !pathKey.endsWith(rule.pathSuffix)) return false;
  if (rule.englishExact && english !== rule.englishExact) return false;
  return true;
}

function matchingException(
  policy: LinguisticQualityPolicy,
  locale: string,
  pathKey: string,
  published: string,
): LinguisticQualityException | null {
  for (const exception of policy.exceptions) {
    if (exception.locales && !exception.locales.includes(locale)) continue;
    if (!exception.paths.includes(pathKey)) continue;
    if (exception.value !== published) continue;
    return exception;
  }
  return null;
}

function preferredSurfaces(
  glossary: readonly GlossaryConceptEvidence[],
): ReadonlyMap<string, string> {
  const surfaces = new Map<string, string>();
  for (const concept of glossary) {
    if (concept.preferredTermState !== "published" || !concept.preferredTerm) continue;
    if (concept.preferredTerm === concept.canonicalEnglishTerm) continue;
    surfaces.set(concept.canonicalEnglishTerm, concept.preferredTerm);
  }
  return surfaces;
}

function terminologyForExactEnglish(
  glossary: readonly GlossaryConceptEvidence[],
  english: string,
): string[] {
  return glossary
    .filter((concept) => concept.canonicalEnglishTerm === english.trim())
    .map((concept) => concept.conceptId);
}

function containsBounded(text: string, term: string): boolean {
  let from = 0;
  while (from <= text.length) {
    const index = text.indexOf(term, from);
    if (index < 0) return false;
    const before = index === 0 ? "" : text[index - 1] ?? "";
    const after = text[index + term.length] ?? "";
    if ((before === "" || !/\p{L}/u.test(before)) && (after === "" || !/\p{L}/u.test(after))) {
      return true;
    }
    from = index + term.length;
  }
  return false;
}

function trailingExtension(value: string, term: string): string | null {
  let from = 0;
  while (from <= value.length) {
    const index = value.indexOf(term, from);
    if (index < 0) return null;
    const before = index === 0 ? "" : value[index - 1] ?? "";
    if (before !== "" && /\p{L}/u.test(before)) {
      from = index + 1;
      continue;
    }
    let end = index + term.length;
    let extra = "";
    while (end < value.length && /\p{L}/u.test(value[end] ?? "")) {
      extra += value[end];
      end += 1;
    }
    if (extra.length > 0 && extra !== "s") return extra;
    from = index + term.length;
  }
  return null;
}

function gluedGlossaryTerms(
  value: string,
  glossary: readonly GlossaryConceptEvidence[],
): string[] {
  const found = new Set<string>();
  const pattern = /\{[A-Za-z_][A-Za-z0-9_]*\}/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value))) {
    const after = value.slice(match.index + match[0].length);
    for (const concept of glossary) {
      const term = concept.canonicalEnglishTerm;
      if (!after.startsWith(term)) continue;
      const next = after[term.length] ?? "";
      if (next === "" || !/\p{L}/u.test(next)) found.add(term);
    }
  }
  return [...found].sort();
}

function hasHardcodedPlatformName(value: string, siteName: string | null): boolean {
  let text = maskPlaceholders(value).replaceAll(WEB_UI_LEGAL_ENTITY_NAME, " ");
  if (siteName?.trim() === "Humanity Union") {
    text = text.replaceAll(siteName.trim(), " ");
  }
  return text.includes("Humanity Union");
}

function detectMixedScript(
  value: string,
  siteName: string | null,
): { readonly families: readonly string[]; readonly leftoverLatin: readonly string[] } | null {
  let text = maskPlaceholders(value);
  text = text.replace(/<\/?[A-Za-z][A-Za-z0-9]*\b[^>]*>/g, " ");
  text = text.replace(/https?:\/\/\S+/gi, " ");
  text = text.replace(/\S+@\S+/g, " ");
  text = text.replaceAll(WEB_UI_LEGAL_ENTITY_NAME, " ");
  if (siteName && siteName.trim()) text = text.replaceAll(siteName.trim(), " ");
  text = text.replace(/\b[A-Z]{2,6}\b/g, " ");
  text = text.replace(/\b[a-z0-9]+(?:-[a-z0-9]+)+\b/g, " ");
  const families = new Set<string>();
  for (const char of text) {
    const family = scriptFamily(char);
    if (family) families.add(family);
  }
  if (families.size < 2) return null;
  const leftoverLatin = text.match(/\p{Script=Latin}{3,}/gu) ?? [];
  return {
    families: [...families].sort(),
    leftoverLatin: [...new Set(leftoverLatin)].sort(),
  };
}

function mixedScriptStrength(
  leftoverLatin: readonly string[],
  glossary: readonly GlossaryConceptEvidence[],
): LinguisticQualityEvidenceStrength {
  const joined = leftoverLatin.join(" ");
  for (const concept of glossary) {
    const term = concept.canonicalEnglishTerm;
    if (term.includes(" ") && containsBounded(joined, term)) return "glossary";
    if (leftoverLatin.includes(term)) return "glossary";
  }
  return "script-difference";
}

function scriptFamily(char: string): string | null {
  if (!/\p{L}/u.test(char)) return null;
  if (/\p{Script=Latin}/u.test(char)) return "Latin";
  if (/\p{Script=Cyrillic}/u.test(char)) return "Cyrillic";
  if (/\p{Script=Arabic}/u.test(char)) return "Arabic";
  if (/\p{Script=Hebrew}/u.test(char)) return "Hebrew";
  if (/\p{Script=Greek}/u.test(char)) return "Greek";
  if (/\p{Script=Georgian}/u.test(char)) return "Georgian";
  if (
    /\p{Script=Han}/u.test(char) ||
    /\p{Script=Hiragana}/u.test(char) ||
    /\p{Script=Katakana}/u.test(char)
  ) {
    return "HanOrKana";
  }
  if (/\p{Script=Hangul}/u.test(char)) return "Hangul";
  return "Other";
}

function maskPlaceholders(value: string): string {
  let masked = "";
  let depth = 0;
  for (const char of value) {
    if (char === "{") {
      depth += 1;
      continue;
    }
    if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0) masked += " ";
      continue;
    }
    if (depth === 0) masked += char;
  }
  return masked;
}

function sameKeySet(left: ReadonlyMap<string, string>, right: ReadonlyMap<string, string>): boolean {
  if (left.size !== right.size) return false;
  for (const key of left.keys()) {
    if (!right.has(key)) return false;
  }
  return true;
}

function uniquePaths(findings: readonly LinguisticQualityFinding[]): number {
  return new Set(findings.map((finding) => `${finding.locale}\0${finding.path}`)).size;
}

function compareFindings(left: LinguisticQualityFinding, right: LinguisticQualityFinding): number {
  return (
    left.locale.localeCompare(right.locale) ||
    left.path.localeCompare(right.path) ||
    left.category.localeCompare(right.category) ||
    left.affectedSide.localeCompare(right.affectedSide) ||
    left.evidence.localeCompare(right.evidence)
  );
}

function applyFilter(
  findings: readonly LinguisticQualityFinding[],
  filter: LinguisticQualityFilter,
): LinguisticQualityFinding[] {
  return findings.filter((finding) => {
    if (filter.locale && finding.locale !== filter.locale) return false;
    if (filter.category && finding.category !== filter.category) return false;
    if (filter.severity && finding.severity !== filter.severity) return false;
    if (filter.reviewStatus && finding.reviewStatus !== filter.reviewStatus) return false;
    if (filter.pathPrefix && !finding.path.startsWith(filter.pathPrefix)) return false;
    if (filter.publishedPackagedDivergence === true && finding.category !== "published_packaged_difference") {
      return false;
    }
    if (filter.publishedPackagedDivergence === false && finding.category === "published_packaged_difference") {
      return false;
    }
    return true;
  });
}

function indented(value: string | null): string {
  if (value == null) return "    (absent)";
  return value.split("\n").map((line) => `    ${line}`).join("\n");
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value != null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortJson((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

function parseException(
  value: unknown,
  index: number,
  errors: string[],
): LinguisticQualityException | null {
  const record = asRecord(value, `exceptions[${index}]`, errors);
  if (!record) return null;
  rejectUnknown(
    record,
    ["id", "locales", "paths", "value", "suppresses", "reason"],
    `exceptions[${index}]`,
    errors,
  );
  const id = requiredString(record, "id", errors);
  const paths = stringArray(record.paths, `exceptions[${index}].paths`, errors);
  const exceptionValue = requiredString(record, "value", errors);
  const reason = requiredString(record, "reason", errors);
  const suppresses = stringArray(record.suppresses, `exceptions[${index}].suppresses`, errors);
  const locales = record.locales == null
    ? undefined
    : stringArray(record.locales, `exceptions[${index}].locales`, errors) ?? undefined;
  if (!paths || paths.length === 0) errors.push(`exceptions[${index}].paths must name at least one path.`);
  if (!suppresses || suppresses.length === 0 || suppresses.some((item) => !SUPPRESSIBLE_CATEGORIES.has(item))) {
    errors.push(`exceptions[${index}] may suppress only english_identical_suspicious.`);
  }
  if (!id || !exceptionValue || !reason || !paths || !suppresses) return null;
  return {
    id,
    locales,
    paths,
    value: exceptionValue,
    suppresses: ["english_identical_suspicious"],
    reason,
  };
}

function parseRule(value: unknown, index: number, errors: string[]): LinguisticQualityRule | null {
  const label = `terminologyRules[${index}]`;
  const record = asRecord(value, label, errors);
  if (!record) return null;
  rejectUnknown(
    record,
    [
      "id",
      "kind",
      "locales",
      "path",
      "pathPrefix",
      "pathSuffix",
      "englishExact",
      "publishedIncludes",
      "publishedIncludesAny",
      "rejectedExact",
      "acceptedIncludesAny",
      "classification",
      "evidence",
    ],
    label,
    errors,
  );
  const id = requiredString(record, "id", errors);
  const kind = requiredString(record, "kind", errors);
  const classification = requiredString(record, "classification", errors);
  const evidence = requiredString(record, "evidence", errors);
  if (kind && !RULE_KINDS.has(kind)) errors.push(`${label}.kind is not supported.`);
  if (classification && !REVIEW_CLASSIFICATIONS.has(classification)) {
    errors.push(`${label}.classification must be CONFIRMED_DEFECT or REVIEW_CANDIDATE.`);
  }
  const publishedIncludesAny = optionalStringArray(record, "publishedIncludesAny", label, errors);
  const rejectedExact = optionalStringArray(record, "rejectedExact", label, errors);
  const acceptedIncludesAny = optionalStringArray(record, "acceptedIncludesAny", label, errors);
  if (kind === "includes" && !record.publishedIncludes && (publishedIncludesAny?.length ?? 0) === 0) {
    errors.push(`${label} requires publishedIncludes or publishedIncludesAny.`);
  }
  if (kind === "rejected-exact" && (rejectedExact?.length ?? 0) === 0) {
    errors.push(`${label} requires rejectedExact.`);
  }
  if (kind === "missing-accepted-phrase" && (acceptedIncludesAny?.length ?? 0) === 0) {
    errors.push(`${label} requires acceptedIncludesAny.`);
  }
  if (kind === "catalog-difference" && !record.path && !record.pathPrefix) {
    errors.push(`${label} requires path or pathPrefix.`);
  }
  if (!id || !kind || !classification || !evidence) return null;
  if (!RULE_KINDS.has(kind) || !REVIEW_CLASSIFICATIONS.has(classification)) return null;
  return {
    id,
    kind: kind as LinguisticQualityRule["kind"],
    locales: optionalStringArray(record, "locales", label, errors),
    path: optionalString(record, "path"),
    pathPrefix: optionalString(record, "pathPrefix"),
    pathSuffix: optionalString(record, "pathSuffix"),
    englishExact: optionalString(record, "englishExact"),
    publishedIncludes: optionalString(record, "publishedIncludes"),
    publishedIncludesAny,
    rejectedExact,
    acceptedIncludesAny,
    classification: classification as LinguisticQualityRule["classification"],
    evidence,
  };
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function optionalStringArray(
  record: Record<string, unknown>,
  key: string,
  label: string,
  errors: string[],
): string[] | undefined {
  if (record[key] == null) return undefined;
  return stringArray(record[key], `${label}.${key}`, errors) ?? undefined;
}

function asRecord(value: unknown, label: string, errors: string[]): Record<string, unknown> | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${label} must be an object.`);
    return null;
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, label: string, errors: string[]): unknown[] {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array.`);
    return [];
  }
  return value;
}

function requiredString(record: Record<string, unknown>, key: string, errors: string[]): string | null {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${key} must be a non-empty string.`);
    return null;
  }
  return value;
}

function stringArray(value: unknown, label: string, errors: string[]): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item === "")) {
    errors.push(`${label} must be an array of non-empty strings.`);
    return null;
  }
  return value as string[];
}

function rejectUnknown(
  record: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
  errors: string[],
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(record)) {
    if (!allowedSet.has(key)) errors.push(`${label}.${key} is not a supported field.`);
  }
}
