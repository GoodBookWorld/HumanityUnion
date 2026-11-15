/**
 * HU-LC-05C.4C.7F.7N — petition-scoped Sources Used presentation.
 *
 * Localizes platform labels / generated count templates via existing WEB_UI
 * keys. Authored titles and revision summaries stay verbatim (dir=auto).
 * Non-semantic items keep API label/summary for backward compatibility.
 */

import type { InitiativeLifecycleSourceSnapshotItem } from "@hu/types";

import type { InitiativeExperienceTranslator } from "../public-initiative-experience/initiative-experience-i18n";

const PETITION_SS = "author.petition.sourceSnapshot";

export type LifecycleSourceSnapshotItemDisplay = {
  readonly label: string;
  /** Localized platform summary when no authored fragment is shown alone. */
  readonly summary: string | null;
  /** Localized version chrome (e.g. "Version 3"). */
  readonly versionLabel: string | null;
  /** Authored content — render with dir=auto; never translate as WEB_UI. */
  readonly authoredText: string | null;
};

function legacyDisplay(item: InitiativeLifecycleSourceSnapshotItem): LifecycleSourceSnapshotItemDisplay {
  return {
    label: item.label,
    summary: item.summary,
    versionLabel: null,
    authoredText: null,
  };
}

/**
 * Resolve display fields for one Sources Used row.
 * Petition semantic `presentation` → WEB_UI. Otherwise preserve API prose.
 */
export function resolveLifecycleSourceSnapshotItemDisplay(
  item: InitiativeLifecycleSourceSnapshotItem,
  t: InitiativeExperienceTranslator,
): LifecycleSourceSnapshotItemDisplay {
  const presentation = item.presentation;
  if (!presentation) {
    return legacyDisplay(item);
  }

  switch (presentation.code) {
    case "petition.revision_reference": {
      const label = t(`${PETITION_SS}.publishedRevision`);
      if (presentation.version == null) {
        return {
          label,
          summary: t(`${PETITION_SS}.noRevision`),
          versionLabel: null,
          authoredText: null,
        };
      }
      return {
        label,
        summary: null,
        versionLabel: t(`${PETITION_SS}.versionLabel`, {
          version: presentation.version,
        }),
        authoredText: presentation.authoredSummary?.trim()
          ? presentation.authoredSummary
          : null,
      };
    }
    case "petition.analysis_reference": {
      const label = t(`${PETITION_SS}.publishedAnalysis`);
      const authored = presentation.authoredTitle?.trim() ?? "";
      if (!authored) {
        return {
          label,
          summary: t(`${PETITION_SS}.noAnalysis`),
          versionLabel: null,
          authoredText: null,
        };
      }
      return {
        label,
        summary: null,
        versionLabel: null,
        authoredText: authored,
      };
    }
    case "petition.proposal_references": {
      const label = t(`${PETITION_SS}.publishedProposals`);
      if (presentation.acceptedCount <= 0) {
        return {
          label,
          summary: t(`${PETITION_SS}.noProposals`),
          versionLabel: null,
          authoredText: null,
        };
      }
      return {
        label,
        // Reuse existing CD count template (present in Staging pack rev 6).
        summary: t("author.collectiveDecision.sourceSnapshot.proposalsCount", {
          count: presentation.acceptedCount,
        }),
        versionLabel: null,
        authoredText: null,
      };
    }
    case "petition.consistency_checks": {
      return {
        label: t(`${PETITION_SS}.consistencyTitle`),
        summary: t("author.collectiveDecision.sourceSnapshot.consistencySummary", {
          warnings: presentation.warningCount,
          total: presentation.totalCount,
        }),
        versionLabel: null,
        authoredText: null,
      };
    }
    default: {
      return legacyDisplay(item);
    }
  }
}
