/**
 * Pack 08I.15 — universal localization coverage gate (static).
 *
 * Detects public civic presentation that reads canonical semantic fields
 * without the shared Initiative / PublicTranslatedFields contract.
 *
 * Intentional debt must be registered explicitly — silent English is not a
 * default. Counters drive the permanent engineering rule.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

export interface UniversalLocalizationCoverageCounters {
  readonly PUBLIC_SEMANTIC_BYPASS: number;
  readonly UNCLASSIFIED_PARTICIPANT_TEXT: number;
  readonly AUTO_TRANSLATION_BYPASS: number;
  readonly RAW_CANONICAL_RENDER_BYPASS: number;
  readonly BRAND_MACHINE_TRANSLATION_BYPASS: number;
  readonly LEGAL_MACHINE_TRANSLATION_BYPASS: number;
  readonly NON_TRANSLATABLE_VIOLATION: number;
  readonly PRIVATE_DATA_TRANSLATION_ATTEMPT: number;
  readonly GOVERNED_SURFACE_FILES_SCANNED: number;
  readonly REGISTERED_INTENTIONAL_DEBT: number;
}

export interface UniversalLocalizationBypassFinding {
  readonly file: string;
  readonly pattern: string;
  readonly line: number;
  readonly counter:
    | "PUBLIC_SEMANTIC_BYPASS"
    | "UNCLASSIFIED_PARTICIPANT_TEXT"
    | "AUTO_TRANSLATION_BYPASS"
    | "RAW_CANONICAL_RENDER_BYPASS"
    | "BRAND_MACHINE_TRANSLATION_BYPASS"
    | "LEGAL_MACHINE_TRANSLATION_BYPASS"
    | "NON_TRANSLATABLE_VIOLATION"
    | "PRIVATE_DATA_TRANSLATION_ATTEMPT";
}

/**
 * Pack 08K — ZERO unnamed residual participant-facing translation debt.
 *
 * Former 08J.1 Search / PWA / Knowledge / CI / Media / rails entries are closed:
 * those surfaces must build PublicPresentationNode via language/adapters/*
 * (or equivalent) and render from PublicLocalizedPresentation — never raw
 * canonical semantic prose. UI chrome remains uiDictionaryValue / next-intl.
 *
 * Keep this array empty. Do not re-register silent English as intentional debt.
 */
export const INTENTIONAL_LOCALIZATION_DEBT: readonly {
  readonly relativePath: string;
  readonly reason: string;
}[] = [];

/** Governed surfaces that must score 0 unexpected PUBLIC_SEMANTIC / RAW_CANONICAL bypass. */
export const GOVERNED_ZERO_BYPASS_GLOBS = [
  "features/public-initiative-experience/components/",
  "features/public-initiative-mini-card/",
  "features/country-experience/components/",
  "features/initiative-collaborative-analysis/components/InitiativeCollaborativeAnalysisPublicResult.tsx",
  "features/initiative-petition-lifecycle/components/InitiativePetitionPublicResult.tsx",
  "features/initiatives/components/WorldInitiativesPageContent.tsx",
  "features/community-intelligence/components/RelatedInitiativesWidget.tsx",
  "features/official-response/components/OfficialResponsesPublicSection.tsx",
  "features/blog/components/BlogPostCard.tsx",
  "features/blog/components/BlogArticlePageContent.tsx",
  "features/civic-media-center/components/CivicMediaCenterPageContent.tsx",
  "features/civic-media-center/components/CivicMediaTranslatedEditorial.tsx",
  "features/civic-media-center/components/TrustedMediaRailCard.tsx",
] as const;

const BYPASS_PATTERNS: readonly {
  readonly pattern: RegExp;
  readonly counter: UniversalLocalizationBypassFinding["counter"];
  readonly id: string;
}[] = [
  {
    id: "raw_initiative_title_jsx",
    pattern: /\{(?:initiative|item|result|record)\.title\}/,
    counter: "PUBLIC_SEMANTIC_BYPASS",
  },
  {
    id: "raw_initiative_description_jsx",
    pattern: /\{(?:initiative|item)\.description\}/,
    counter: "PUBLIC_SEMANTIC_BYPASS",
  },
  {
    id: "raw_summary_jsx",
    pattern: /\{(?:latest|response|item|analysis|petition)\.summary\}/,
    counter: "PUBLIC_SEMANTIC_BYPASS",
  },
  {
    id: "brand_via_content_translations",
    pattern: /sourceKind\s*[:=]\s*["']brand["']/,
    counter: "BRAND_MACHINE_TRANSLATION_BYPASS",
  },
  {
    id: "legal_via_content_translations",
    pattern: /sourceKind\s*[:=]\s*["']legal(?:_document)?["']/,
    counter: "LEGAL_MACHINE_TRANSLATION_BYPASS",
  },
  {
    id: "web_ssr_gemini_provider",
    pattern: /GoogleGenerativeAI|@google\/generative-ai|getGenerativeModel\s*\(/,
    counter: "AUTO_TRANSLATION_BYPASS",
  },
  {
    id: "raw_trusted_explanation_jsx",
    pattern: /\{resource\.explanation\}/,
    counter: "RAW_CANONICAL_RENDER_BYPASS",
  },
  {
    id: "private_email_translate_attempt",
    pattern: /translatedContent\s*[:=].*(?:email|phoneNumber|password)/i,
    counter: "PRIVATE_DATA_TRANSLATION_ATTEMPT",
  },
  {
    id: "non_translatable_id_jsx_mutation",
    pattern: /translate(?:Field|Text)?\s*\(\s*(?:initiativeId|participantId|email)\b/,
    counter: "NON_TRANSLATABLE_VIOLATION",
  },
];

function walkTsxFiles(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".next" || entry.endsWith(".test.ts") || entry.endsWith(".test.tsx")) {
      continue;
    }
    const full = path.join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walkTsxFiles(full, out);
    } else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

function isIntentionalDebt(relativePath: string): boolean {
  return INTENTIONAL_LOCALIZATION_DEBT.some(
    (row) =>
      relativePath === row.relativePath ||
      relativePath.startsWith(row.relativePath.replace(/\/$/, "") + "/"),
  );
}

function isGovernedZeroBypass(relativePath: string): boolean {
  return GOVERNED_ZERO_BYPASS_GLOBS.some((glob) => {
    if (glob.endsWith("/")) {
      return relativePath.startsWith(glob);
    }
    return relativePath === glob;
  });
}

/**
 * Run the static coverage gate over apps/web/src.
 */
export function runUniversalLocalizationCoverageGate(webSrcRoot: string): {
  readonly counters: UniversalLocalizationCoverageCounters;
  readonly findings: readonly UniversalLocalizationBypassFinding[];
  readonly governedUnexpectedBypasses: readonly UniversalLocalizationBypassFinding[];
} {
  const findings: UniversalLocalizationBypassFinding[] = [];
  const files = walkTsxFiles(webSrcRoot);
  let scanned = 0;

  for (const absolute of files) {
    const relativePath = path.relative(webSrcRoot, absolute).split(path.sep).join("/");
    if (!relativePath.startsWith("features/")) {
      continue;
    }
    // Focus public/civic feature trees; skip author workspace drafts where canonical is expected.
    if (
      relativePath.includes("/components/") === false &&
      !relativePath.endsWith(".tsx")
    ) {
      continue;
    }
    if (isIntentionalDebt(relativePath)) {
      continue;
    }

    const source = readFileSync(absolute, "utf8");
    // Presentation owners are allowed to pass canonical into resolvers.
    if (
      relativePath.includes("use-initiative-public-presentation.ts") ||
      relativePath.includes("initiative-public-presentation.ts") ||
      relativePath.includes("PublicTranslatedFields.tsx") ||
      relativePath.includes("TranslatedContentView.tsx") ||
      relativePath.includes("resolve-initiative-detail-presentation.ts") ||
      relativePath.includes("InitiativeLocalizedTitle.tsx")
    ) {
      continue;
    }

    scanned += 1;
    const lines = source.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]!;
      // Skip comments
      if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) {
        continue;
      }
      for (const rule of BYPASS_PATTERNS) {
        if (rule.pattern.test(line)) {
          // Allow aria/title that already use displayTitle variable (not raw field).
          if (line.includes("displayTitle") || line.includes("presentation.title")) {
            continue;
          }
          findings.push({
            file: relativePath,
            pattern: rule.id,
            line: i + 1,
            counter: rule.counter,
          });
        }
      }
    }
  }

  const governedUnexpectedBypasses = findings.filter(
    (f) =>
      (f.counter === "PUBLIC_SEMANTIC_BYPASS" || f.counter === "RAW_CANONICAL_RENDER_BYPASS") &&
      isGovernedZeroBypass(f.file),
  );

  const count = (key: UniversalLocalizationBypassFinding["counter"]) =>
    findings.filter((f) => f.counter === key).length;

  return {
    counters: {
      PUBLIC_SEMANTIC_BYPASS: count("PUBLIC_SEMANTIC_BYPASS"),
      UNCLASSIFIED_PARTICIPANT_TEXT: count("UNCLASSIFIED_PARTICIPANT_TEXT"),
      AUTO_TRANSLATION_BYPASS: count("AUTO_TRANSLATION_BYPASS"),
      RAW_CANONICAL_RENDER_BYPASS: count("RAW_CANONICAL_RENDER_BYPASS"),
      BRAND_MACHINE_TRANSLATION_BYPASS: count("BRAND_MACHINE_TRANSLATION_BYPASS"),
      LEGAL_MACHINE_TRANSLATION_BYPASS: count("LEGAL_MACHINE_TRANSLATION_BYPASS"),
      NON_TRANSLATABLE_VIOLATION: count("NON_TRANSLATABLE_VIOLATION"),
      PRIVATE_DATA_TRANSLATION_ATTEMPT: count("PRIVATE_DATA_TRANSLATION_ATTEMPT"),
      GOVERNED_SURFACE_FILES_SCANNED: scanned,
      REGISTERED_INTENTIONAL_DEBT: INTENTIONAL_LOCALIZATION_DEBT.length,
    },
    findings,
    governedUnexpectedBypasses,
  };
}
