/**
 * Pack 02G Task 08E.9b — resolve API semantic consistency/conflict warnings
 * to Working Sidebar / source-panel display text.
 *
 * Prefers finite checkId/code + params/civic. Falls back to legacy English
 * detail/message without parsing. Never imports catalog keys into API.
 */

import type {
  InitiativeLifecycleConsistencyCivic,
  InitiativeLifecycleConsistencyParams,
  InitiativeLifecycleConsistencyStatus,
  InitiativeLifecycleStageId,
  InitiativeRevisionChangeSection,
  InitiativeRevisionConflictWarning,
} from "@hu/types";

import type { InitiativeExperienceTranslator } from "../public-initiative-experience/initiative-experience-i18n";

export type ApiConsistencyStageId =
  | "petition"
  | "decisionSession"
  | "collectiveDecision"
  | "implementationCommitment"
  | "implementationTracking"
  | "officialResponse"
  | "publicImpact"
  | "civicArchive";

export type ApiConsistencyCheckLike = {
  readonly checkId: string;
  readonly status: InitiativeLifecycleConsistencyStatus;
  readonly detail?: string;
  readonly label?: string;
  readonly params?: InitiativeLifecycleConsistencyParams & {
    readonly outcomeKind?: string;
  };
  readonly civic?: InitiativeLifecycleConsistencyCivic;
};

export type ApiConsistencyPresentation = {
  readonly text: string;
  readonly mode: "semantic" | "legacy" | "generic";
};

export type ApiConflictPresentation = {
  readonly text: string;
  readonly mode: "semantic" | "legacy" | "generic";
  readonly sectionLabel: string;
};

const REVISION_SECTIONS: readonly InitiativeRevisionChangeSection[] = [
  "title",
  "description",
  "custom",
];

function isRevisionSection(value: string): value is InitiativeRevisionChangeSection {
  return (REVISION_SECTIONS as readonly string[]).includes(value);
}

/** Localize revision section from canonical ID — do not require API sectionLabel. */
export function resolveRevisionConflictSectionLabel(
  section: string,
  t: InitiativeExperienceTranslator,
): string {
  if (isRevisionSection(section)) {
    return t(`author.revision.sectionOptions.${section}`);
  }
  return section;
}

function hasSemanticConsistencySignal(check: ApiConsistencyCheckLike): boolean {
  return check.params !== undefined;
}

function formatStageIds(
  stageIds: readonly InitiativeLifecycleStageId[] | undefined,
  t: InitiativeExperienceTranslator,
): string {
  if (!stageIds || stageIds.length === 0) {
    return "";
  }
  return stageIds
    .map((stageId) => {
      try {
        return t(`author.sidebar.apiConsistency.stages.${stageId}`);
      } catch {
        return stageId;
      }
    })
    .join(", ");
}

/**
 * Resolve one API consistency check to display text.
 * Semantic when `params` is present (new API). Legacy detail otherwise.
 * Unknown checkId with detail → raw detail. Unknown without detail → generic.
 */
export function resolveApiConsistencyCheckDisplay(
  stage: ApiConsistencyStageId,
  check: ApiConsistencyCheckLike,
  t: InitiativeExperienceTranslator,
): ApiConsistencyPresentation {
  if (hasSemanticConsistencySignal(check)) {
    const params = check.params ?? {};
    const values: Record<string, string | number | Date> = {
      count: typeof params.count === "number" ? params.count : 0,
      version: typeof params.version === "number" ? params.version : 0,
      changeCount: typeof params.changeCount === "number" ? params.changeCount : 0,
      outstandingCount:
        typeof params.outstandingCount === "number" ? params.outstandingCount : 0,
      recordCount: typeof params.recordCount === "number" ? params.recordCount : 0,
      unresolvedTrackingCount:
        typeof params.unresolvedTrackingCount === "number"
          ? params.unresolvedTrackingCount
          : 0,
      missingEvidenceCount:
        typeof params.missingEvidenceCount === "number" ? params.missingEvidenceCount : 0,
      title: check.civic?.title ?? "",
      stageIds: formatStageIds(params.stageIds, t),
      outcomeKind: params.outcomeKind ?? "",
    };

    // Variant keys for branches that need more than status alone.
    let leaf = `${check.checkId}.${check.status}`;
    if (check.checkId === "decision-session-available" && check.status === "ok") {
      leaf = params.required === false
        ? "decision-session-available.okOptional"
        : "decision-session-available.ok";
    }
    if (
      check.checkId === "public-impact-available" &&
      check.status === "ok" &&
      params.required === false
    ) {
      leaf = "public-impact-available.okOptional";
    }
    if (
      check.checkId === "official-response-package-available" &&
      check.status === "ok" &&
      params.outcomeKind === "no_official_response_received"
    ) {
      leaf = "official-response-package-available.okNoResponse";
    }
    if (check.checkId === "implementation-complete" && check.status === "warning") {
      leaf =
        (params.recordCount ?? 0) === 0
          ? "implementation-complete.warningEmpty"
          : "implementation-complete.warning";
    }
    if (check.checkId === "ally-recommendations" && check.status === "ok") {
      leaf =
        (params.count ?? 0) > 0
          ? "ally-recommendations.ok"
          : "ally-recommendations.okEmpty";
    }

    try {
      const text = t(`author.sidebar.apiConsistency.${stage}.${leaf}`, values);
      if (text && text !== `author.sidebar.apiConsistency.${stage}.${leaf}`) {
        return { text, mode: "semantic" };
      }
    } catch {
      // fall through
    }
  }

  if (typeof check.detail === "string" && check.detail.trim().length > 0) {
    return { text: check.detail, mode: "legacy" };
  }

  return {
    text: t("author.sidebar.apiConsistency.generic.warning"),
    mode: "generic",
  };
}

/**
 * Resolve Revision conflict warning. Prefer code + section + params.
 */
export function resolveApiConflictWarningDisplay(
  warning: Partial<InitiativeRevisionConflictWarning> & {
    readonly section: string;
    readonly message?: string;
    readonly sectionLabel?: string;
  },
  t: InitiativeExperienceTranslator,
): ApiConflictPresentation {
  const sectionLabel = resolveRevisionConflictSectionLabel(warning.section, t);

  if (
    warning.code === "multiple_changes_same_section" &&
    warning.params &&
    typeof warning.params.changeCount === "number"
  ) {
    try {
      const text = t("author.sidebar.apiConsistency.revision.multiple_changes_same_section", {
        changeCount: warning.params.changeCount,
        section: sectionLabel,
      });
      return { text, mode: "semantic", sectionLabel };
    } catch {
      // fall through
    }
  }

  if (typeof warning.message === "string" && warning.message.trim().length > 0) {
    return {
      text: warning.message,
      mode: "legacy",
      sectionLabel: warning.sectionLabel ?? sectionLabel,
    };
  }

  return {
    text: t("author.sidebar.apiConsistency.generic.conflict"),
    mode: "generic",
    sectionLabel,
  };
}

/** Resolve label chrome for snapshot panels (semantic when params present). */
export function resolveApiConsistencyLabelDisplay(
  stage: ApiConsistencyStageId,
  check: ApiConsistencyCheckLike,
  t: InitiativeExperienceTranslator,
): string {
  if (hasSemanticConsistencySignal(check)) {
    try {
      const key = `author.sidebar.apiConsistency.${stage}.labels.${check.checkId}`;
      const text = t(key);
      if (text && text !== key) {
        return text;
      }
    } catch {
      // fall through
    }
  }
  if (typeof check.label === "string" && check.label.trim().length > 0) {
    return check.label;
  }
  return check.checkId;
}
