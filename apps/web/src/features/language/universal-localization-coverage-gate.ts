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
  readonly BRAND_MACHINE_TRANSLATION_BYPASS: number;
  readonly LEGAL_MACHINE_TRANSLATION_BYPASS: number;
  readonly NON_TRANSLATABLE_VIOLATION: number;
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
    | "BRAND_MACHINE_TRANSLATION_BYPASS"
    | "LEGAL_MACHINE_TRANSLATION_BYPASS"
    | "NON_TRANSLATABLE_VIOLATION";
}

/**
 * Explicit residual debt — counted but not treated as unexpected bypass.
 * Shrink this list; do not grow it without an ADR-level reason.
 */
export const INTENTIONAL_LOCALIZATION_DEBT: readonly {
  readonly relativePath: string;
  readonly reason: string;
}[] = [
  {
    relativePath: "features/global-search/components/GlobalSearchPageContent.tsx",
    reason: "Search result titles are projection text; CIVIC overlay not yet unified (08I.15 debt).",
  },
  {
    relativePath: "features/pwa/components/PwaInitiativeFeed.tsx",
    reason: "PWA feed marked CIVIC_DATA/API_OPAQUE historically; presentation contract pending.",
  },
  {
    relativePath: "features/community-intelligence/components/CollaborationOpportunitiesWidget.tsx",
    reason: "CI collaboration titles/summaries await Initiative presentation owner.",
  },
  {
    relativePath: "features/community-intelligence/components/InitiativeOverlapNotice.tsx",
    reason: "Overlap notice titles await Initiative presentation owner.",
  },
  {
    relativePath: "features/public-news/components/PublicNewsRelatedInitiatives.tsx",
    reason: "News related rail titles await Initiative presentation owner.",
  },
  {
    relativePath: "features/member-profile/components/RecentPublicInitiativesDisclosure.tsx",
    reason: "Profile disclosure titles await Initiative presentation owner.",
  },
  {
    relativePath: "features/capability02-integration/components/CivicIntegrationWidgets.tsx",
    reason: "Capability widget titles/summaries await CIVIC_CONTENT presentation owner.",
  },
  {
    relativePath: "features/country-experience/components/TrustedNationalMediaEvidence.tsx",
    reason: "Trusted national media titles/summaries are civic_media projection debt pending PublicTranslatedFields mount.",
  },
  {
    relativePath: "features/knowledge-center",
    reason: "Knowledge article bodies are DOCUMENT_LAYER_DEBT — not a content_translations sourceKind yet.",
  },
];

/** Governed Initiative-path surfaces that must score 0 unexpected PUBLIC_SEMANTIC_BYPASS. */
export const GOVERNED_ZERO_BYPASS_GLOBS = [
  "features/public-initiative-experience/components/",
  "features/public-initiative-mini-card/",
  "features/country-experience/components/",
  "features/initiative-collaborative-analysis/components/InitiativeCollaborativeAnalysisPublicResult.tsx",
  "features/initiative-petition-lifecycle/components/InitiativePetitionPublicResult.tsx",
  "features/initiatives/components/WorldInitiativesPageContent.tsx",
  "features/community-intelligence/components/RelatedInitiativesWidget.tsx",
  "features/official-response/components/OfficialResponsesPublicSection.tsx",
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
      f.counter === "PUBLIC_SEMANTIC_BYPASS" && isGovernedZeroBypass(f.file),
  );

  const count = (key: UniversalLocalizationBypassFinding["counter"]) =>
    findings.filter((f) => f.counter === key).length;

  return {
    counters: {
      PUBLIC_SEMANTIC_BYPASS: count("PUBLIC_SEMANTIC_BYPASS"),
      UNCLASSIFIED_PARTICIPANT_TEXT: count("UNCLASSIFIED_PARTICIPANT_TEXT"),
      BRAND_MACHINE_TRANSLATION_BYPASS: count("BRAND_MACHINE_TRANSLATION_BYPASS"),
      LEGAL_MACHINE_TRANSLATION_BYPASS: count("LEGAL_MACHINE_TRANSLATION_BYPASS"),
      NON_TRANSLATABLE_VIOLATION: count("NON_TRANSLATABLE_VIOLATION"),
      GOVERNED_SURFACE_FILES_SCANNED: scanned,
      REGISTERED_INTENTIONAL_DEBT: INTENTIONAL_LOCALIZATION_DEBT.length,
    },
    findings,
    governedUnexpectedBypasses,
  };
}
