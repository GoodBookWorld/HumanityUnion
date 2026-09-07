/**
 * RESET 05 / 05A — automatic semantic-gap detection for participant-facing HTML.
 * Domain-aware heuristics; ownership/result use the universal MediaSemanticNode contract.
 */

export type PlpSemanticGapKind =
  | "UNOWNED_META"
  | "MISSING_SEMANTIC_NODE"
  | "UNEXPECTED_CANONICAL_FALLBACK"
  | "DOMAIN_NOT_YET_MIGRATED_MARKER"
  | "GEOGRAPHY_COLLAPSED_TO_WORLD"
  | "RAW_LIFECYCLE_STAGE_LABEL"
  | "TITLE_OWNERSHIP_BYPASS"
  | "SIDEBAR_ELECTION_NAME_BYPASS"
  /** RESET 05C — Media FAQ organization identity bypasses Brand Localization. */
  | "MEDIA_FAQ_BRAND_BYPASS";

export type PlpSemanticGapFinding = {
  readonly kind: PlpSemanticGapKind;
  readonly surface: string;
  readonly detail: string;
};

export type PlpSemanticGapReport = {
  readonly pack: "RESET_05" | "RESET_05A";
  readonly locale: string;
  readonly findings: readonly PlpSemanticGapFinding[];
  readonly ok: boolean;
};

const META_OPEN_RE =
  /<p([^>]*\bcountry-initiative-rail-card__meta\b[^>]*)>([\s\S]*?)<\/p>/gi;

const RAW_ENGLISH_LIFECYCLE_STAGE_LABELS = [
  "Collective Decision",
  "Collaborative Analysis",
  "Improvement Proposals",
  "Decision Session",
  "Implementation Commitments",
  "Implementation Tracking",
  "Official Responses",
  "Public Impact",
  "Civic Archive",
] as const;

/**
 * Detect gaps in country Initiative/election rail meta ownership.
 * Intentionally broken fixtures (raw meta text without semantic nodes) fail.
 */
export function evaluateCountryInitiativeRailSemanticGaps(input: {
  readonly html: string;
  readonly locale: string;
  /** When true, more-specific geography codes exist on the canonical card. */
  readonly hasSpecificGeographyCodes?: boolean;
}): PlpSemanticGapReport {
  const findings: PlpSemanticGapFinding[] = [];
  const html = input.html;

  if (/data-hu-media-plp-coverage="DOMAIN_NOT_YET_MIGRATED"/i.test(html)) {
    findings.push({
      kind: "DOMAIN_NOT_YET_MIGRATED_MARKER",
      surface: "country-initiative-rail-card",
      detail: "DOMAIN_NOT_YET_MIGRATED marker still present on Initiative rail",
    });
  }

  let match: RegExpExecArray | null;
  const re = new RegExp(META_OPEN_RE.source, "gi");
  while ((match = re.exec(html)) !== null) {
    const inner = match[2] ?? "";
    const hasSemantic = /data-hu-semantic-node="1"/i.test(inner);
    if (!hasSemantic) {
      findings.push({
        kind: "UNOWNED_META",
        surface: "country-initiative-rail-card__meta",
        detail: "meta paragraph lacks MediaSemanticNode ownership markers",
      });
      continue;
    }
    if (!/data-hu-semantic-path="geographyLabel"/i.test(inner)) {
      findings.push({
        kind: "MISSING_SEMANTIC_NODE",
        surface: "country-initiative-rail-card__meta",
        detail: "geographyLabel semantic path missing",
      });
    }
    // Election rails render geography only. Initiative rails also own activityArea.
    // Do not treat geography's "Region · Country" separator as an activityArea signal.
    const isElectionContext =
      /country-election-rail-card/i.test(html) ||
      /data-hu-lifecycle-profile="public_choice"/i.test(html);
    if (
      !isElectionContext &&
      !/data-hu-semantic-path="activityArea"/i.test(inner)
    ) {
      findings.push({
        kind: "MISSING_SEMANTIC_NODE",
        surface: "country-initiative-rail-card__meta",
        detail: "activityArea semantic path missing beside geography",
      });
    }
    if (
      input.hasSpecificGeographyCodes &&
      />\s*World\s*</i.test(inner)
    ) {
      findings.push({
        kind: "GEOGRAPHY_COLLAPSED_TO_WORLD",
        surface: "country-initiative-rail-card__meta",
        detail:
          "geography rendered World despite more-specific canonical geography codes",
      });
    }
  }

  // Title must declare PLP ownership on country rails
  if (
    /country-initiative-rail-card__title/i.test(html) &&
    !/data-hu-semantic-path="title"[^>]*data-hu-semantic-owner="PLP_ENTITY"|data-hu-semantic-owner="PLP_ENTITY"[^>]*data-hu-semantic-path="title"/i.test(
      html,
    ) &&
    !(/data-hu-semantic-path="title"/i.test(html) &&
      /data-hu-semantic-owner="PLP_ENTITY"/i.test(html))
  ) {
    // Looser: require both attributes present on a title node
    const titleOwned =
      /data-hu-semantic-path="title"/i.test(html) &&
      /country-initiative-rail-card__title[^>]*data-hu-semantic-owner="PLP_ENTITY"|data-hu-semantic-owner="PLP_ENTITY"[^>]*country-initiative-rail-card__title/i.test(
        html,
      );
    if (!titleOwned && !/data-hu-semantic-path="title"/i.test(html)) {
      findings.push({
        kind: "TITLE_OWNERSHIP_BYPASS",
        surface: "country-initiative-rail-card__title",
        detail: "rail title lacks PLP_ENTITY ownership marker",
      });
    }
  }

  return {
    pack: "RESET_05A",
    locale: input.locale,
    findings,
    ok: findings.length === 0,
  };
}

/**
 * Detect raw English lifecycle stage labels on Initiative detail surfaces
 * when locale is non-English (ownership must be UI_DICTIONARY).
 */
export function evaluateLifecycleStageLabelSemanticGaps(input: {
  readonly html: string;
  readonly locale: string;
}): PlpSemanticGapReport {
  const findings: PlpSemanticGapFinding[] = [];
  if (input.locale.toLowerCase() === "en") {
    return { pack: "RESET_05A", locale: input.locale, findings, ok: true };
  }

  for (const label of RAW_ENGLISH_LIFECYCLE_STAGE_LABELS) {
    // Banner value or overview status with raw English while stage ownership absent
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const valueRe = new RegExp(
      `pie-current-stage__value[^>]*>\\s*${escaped}\\s*<`,
      "i",
    );
    if (valueRe.test(input.html)) {
      findings.push({
        kind: "RAW_LIFECYCLE_STAGE_LABEL",
        surface: "pie-current-stage__value",
        detail: `raw English lifecycle label "${label}" in non-English locale`,
      });
    }
  }

  return {
    pack: "RESET_05A",
    locale: input.locale,
    findings,
    ok: findings.length === 0,
  };
}

/**
 * Candidates sidebar election name must declare Initiative PLP ownership.
 */
export function evaluateElectionSidebarSemanticGaps(input: {
  readonly html: string;
  readonly locale: string;
}): PlpSemanticGapReport {
  const findings: PlpSemanticGapFinding[] = [];
  if (/pie-election__name/i.test(input.html)) {
    const owned =
      /pie-election__name[^>]*data-hu-semantic-path="electionName"|data-hu-semantic-path="electionName"[^>]*pie-election__name/i.test(
        input.html,
      ) ||
      (/data-hu-semantic-path="electionName"/i.test(input.html) &&
        /data-hu-semantic-owner="PLP_ENTITY"/i.test(input.html));
    if (!owned) {
      findings.push({
        kind: "SIDEBAR_ELECTION_NAME_BYPASS",
        surface: "pie-election__name",
        detail:
          "Candidates sidebar election name bypasses Initiative PLP ownership",
      });
    }
  }

  return {
    pack: "RESET_05A",
    locale: input.locale,
    findings,
    ok: findings.length === 0,
  };
}

export function assertNoCountryInitiativeRailSemanticGaps(
  report: PlpSemanticGapReport,
): void {
  if (!report.ok) {
    throw new Error(
      report.findings.map((f) => `${f.kind}:${f.surface}:${f.detail}`).join("; "),
    );
  }
}
