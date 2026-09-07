/**
 * RESET 05 — automatic semantic-gap detection for participant-facing HTML.
 * Domain-aware heuristics; ownership/result use the universal MediaSemanticNode contract.
 */

export type PlpSemanticGapKind =
  | "UNOWNED_META"
  | "MISSING_SEMANTIC_NODE"
  | "UNEXPECTED_CANONICAL_FALLBACK"
  | "DOMAIN_NOT_YET_MIGRATED_MARKER";

export type PlpSemanticGapFinding = {
  readonly kind: PlpSemanticGapKind;
  readonly surface: string;
  readonly detail: string;
};

export type PlpSemanticGapReport = {
  readonly pack: "RESET_05";
  readonly locale: string;
  readonly findings: readonly PlpSemanticGapFinding[];
  readonly ok: boolean;
};

const META_OPEN_RE =
  /<p([^>]*\bcountry-initiative-rail-card__meta\b[^>]*)>([\s\S]*?)<\/p>/gi;

/**
 * Detect gaps in country Initiative/election rail meta ownership.
 * Intentionally broken fixtures (raw meta text without semantic nodes) fail.
 */
export function evaluateCountryInitiativeRailSemanticGaps(input: {
  readonly html: string;
  readonly locale: string;
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
    // Initiative (non-election) meta should also own activityArea when present
    if (
      / · /.test(inner) &&
      !/data-hu-semantic-path="activityArea"/i.test(inner)
    ) {
      findings.push({
        kind: "MISSING_SEMANTIC_NODE",
        surface: "country-initiative-rail-card__meta",
        detail: "activityArea semantic path missing beside geography",
      });
    }
  }

  return {
    pack: "RESET_05",
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
