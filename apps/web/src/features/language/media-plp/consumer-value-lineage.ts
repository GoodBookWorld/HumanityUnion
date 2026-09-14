/**
 * Reset 03E.5 — consumer value lineage (test/dev authority).
 *
 * Localization success requires end-to-end CONSUMER VALUE LINEAGE, not only
 * published entity validity at the resolver:
 *
 *   OWNERSHIP → LSI.1 → CLI.1 → RESOLVER VALIDITY
 *     → RESOLVED_LOCALIZED → PROJECTED_LOCALIZED
 *     → PROPAGATED_LOCALIZED → RENDERED_LOCALIZED
 *
 * A break after resolver is LOCALIZED_PRESENTATION_CONSUMER_BYPASS.
 */

export const LOCALIZED_PRESENTATION_CONSUMER_BYPASS =
  "LOCALIZED_PRESENTATION_CONSUMER_BYPASS" as const;

export type ConsumerLineagePhase =
  | "RESOLVED_LOCALIZED"
  | "PROJECTED_LOCALIZED"
  | "PROPAGATED_LOCALIZED"
  | "RENDERED_LOCALIZED";

export type ConsumerValueLineageTrace = {
  readonly semanticPath: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly resolvedValue: string | null;
  readonly projectedValue: string | null;
  readonly propagatedValue: string | null;
  readonly renderedValue: string | null;
  readonly canonicalValue: string | null;
  readonly resolverMode: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK" | null;
  readonly phases: Readonly<Record<ConsumerLineagePhase, boolean>>;
  readonly bypass: boolean;
  readonly reason: typeof LOCALIZED_PRESENTATION_CONSUMER_BYPASS | null;
};

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

/**
 * When resolver mode is PUBLISHED_LOCALIZED, every downstream value must equal
 * the resolved localized value (and must not equal the canonical sentinel).
 */
export function evaluateConsumerValueLineage(input: {
  readonly semanticPath: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly resolverMode: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK" | null;
  readonly resolvedValue: string | null;
  readonly projectedValue: string | null;
  readonly propagatedValue: string | null;
  readonly renderedValue: string | null;
  readonly canonicalValue: string | null;
}): ConsumerValueLineageTrace {
  const resolved = norm(input.resolvedValue);
  const projected = norm(input.projectedValue);
  const propagated = norm(input.propagatedValue);
  const rendered = norm(input.renderedValue);
  const canonical = norm(input.canonicalValue);

  const resolvedLocalized =
    input.resolverMode === "PUBLISHED_LOCALIZED" && resolved.length > 0;
  const projectedLocalized =
    resolvedLocalized && projected.length > 0 && projected === resolved;
  const propagatedLocalized =
    projectedLocalized && propagated.length > 0 && propagated === resolved;
  const renderedLocalized =
    propagatedLocalized && rendered.length > 0 && rendered === resolved;

  let bypass = false;
  if (resolvedLocalized) {
    if (!projectedLocalized || !propagatedLocalized || !renderedLocalized) {
      bypass = true;
    }
    // Canonical English/sentinel must never reach the rendered node.
    if (canonical.length > 0 && rendered === canonical && resolved !== canonical) {
      bypass = true;
    }
  }

  return {
    semanticPath: input.semanticPath,
    entityType: input.entityType,
    entityId: input.entityId,
    resolvedValue: input.resolvedValue,
    projectedValue: input.projectedValue,
    propagatedValue: input.propagatedValue,
    renderedValue: input.renderedValue,
    canonicalValue: input.canonicalValue,
    resolverMode: input.resolverMode,
    phases: {
      RESOLVED_LOCALIZED: resolvedLocalized,
      PROJECTED_LOCALIZED: projectedLocalized,
      PROPAGATED_LOCALIZED: propagatedLocalized,
      RENDERED_LOCALIZED: renderedLocalized,
    },
    bypass,
    reason: bypass ? LOCALIZED_PRESENTATION_CONSUMER_BYPASS : null,
  };
}

export function assertNoConsumerValueLineageBypass(
  traces: readonly ConsumerValueLineageTrace[],
): void {
  const failed = traces.filter((row) => row.bypass);
  if (failed.length === 0) {
    return;
  }
  const detail = failed
    .map(
      (row) =>
        `${row.entityType}/${row.entityId}:${row.semanticPath} resolved=${JSON.stringify(row.resolvedValue)} rendered=${JSON.stringify(row.renderedValue)}`,
    )
    .join("; ");
  throw new Error(`${LOCALIZED_PRESENTATION_CONSUMER_BYPASS}: ${detail}`);
}

/**
 * Read a presentation string at a dotted/indexed path
 * (e.g. overviewTitle, overviewPoints[0].body, faq[1].question).
 */
export function readPresentationStringAtPath(
  presentation: unknown,
  path: string,
): string | null {
  if (!path.trim()) {
    return null;
  }
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  let cursor: unknown = presentation;
  for (const part of parts) {
    if (cursor == null) {
      return null;
    }
    if (Array.isArray(cursor)) {
      const index = Number(part);
      if (!Number.isInteger(index) || index < 0 || index >= cursor.length) {
        return null;
      }
      cursor = cursor[index];
      continue;
    }
    if (typeof cursor !== "object") {
      return null;
    }
    cursor = (cursor as Record<string, unknown>)[part];
  }
  if (typeof cursor === "string") {
    return cursor;
  }
  if (
    cursor &&
    typeof cursor === "object" &&
    "value" in (cursor as object) &&
    typeof (cursor as { value: unknown }).value === "string"
  ) {
    return (cursor as { value: string }).value;
  }
  return null;
}

/** Opaque sentinels for route-level lineage tests (no language detection). */
export const MEDIA_PLP_SENTINELS = {
  editorialOverviewTitle: {
    canonical: "__CANONICAL_EDITORIAL_OVERVIEW_TITLE__",
    localized: "__LOCALIZED_EDITORIAL_OVERVIEW_TITLE__",
  },
  editorialOverviewSummary: {
    canonical: "__CANONICAL_EDITORIAL_OVERVIEW_SUMMARY__",
    localized: "__LOCALIZED_EDITORIAL_OVERVIEW_SUMMARY__",
  },
  editorialPointHeading: {
    canonical: "__CANONICAL_EDITORIAL_POINT_HEADING__",
    localized: "__LOCALIZED_EDITORIAL_POINT_HEADING__",
  },
  editorialPointBody: {
    canonical: "__CANONICAL_EDITORIAL_POINT_BODY__",
    localized: "__LOCALIZED_EDITORIAL_POINT_BODY__",
  },
  faqQuestion: {
    canonical: "__CANONICAL_FAQ_QUESTION__",
    localized: "__LOCALIZED_FAQ_QUESTION__",
  },
  faqAnswer: {
    canonical: "__CANONICAL_FAQ_ANSWER__",
    localized: "__LOCALIZED_FAQ_ANSWER__",
  },
  principleTitle: {
    canonical: "__CANONICAL_PRINCIPLE_TITLE__",
    localized: "__LOCALIZED_PRINCIPLE_TITLE__",
  },
  principleDescription: {
    canonical: "__CANONICAL_PRINCIPLE_DESCRIPTION__",
    localized: "__LOCALIZED_PRINCIPLE_DESCRIPTION__",
  },
  principleWhy: {
    canonical: "__CANONICAL_PRINCIPLE_WHY__",
    localized: "__LOCALIZED_PRINCIPLE_WHY__",
  },
  trustedBody: {
    canonical: "__CANONICAL_TRUSTED_BODY_A__",
    localized: "__LOCALIZED_TRUSTED_BODY_A__",
  },
  newsTitle: {
    canonical: "__CANONICAL_NEWS_TITLE__",
    localized: "__LOCALIZED_NEWS_TITLE__",
  },
  newsSummary: {
    canonical: "__CANONICAL_NEWS_SUMMARY__",
    localized: "__LOCALIZED_NEWS_SUMMARY__",
  },
  verificationBody: {
    canonical: "__CANONICAL_VERIFICATION_BODY__",
    localized: "__LOCALIZED_VERIFICATION_BODY__",
  },
  analysisBody: {
    canonical: "__CANONICAL_ANALYSIS_BODY__",
    localized: "__LOCALIZED_ANALYSIS_BODY__",
  },
} as const;
