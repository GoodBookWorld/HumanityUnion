import type { Initiative } from "@hu/types";

import type { WorkspaceSuggestedAction } from "./types";

function actions(labels: string[]): WorkspaceSuggestedAction[] {
  return labels.map((label, index) => ({
    id: `${label.replace(/\s+/g, "-").toLowerCase()}-${index}`,
    label,
  }));
}

const INITIATIVE_DRAFT_ACTIONS = actions([
  "Improve title",
  "Clarify summary",
  "Check missing fields",
  "Run Civic Compatibility Review",
]);

const MANAGE_PUBLISHED_ACTIONS = actions([
  "Review initiative summary",
  "Check lifecycle readiness",
  "Identify next civic stage",
]);

const OVERVIEW_ACTIONS = actions([
  "Summarize initiative status",
  "Explain lifecycle phase",
  "Identify next civic stage",
]);

const COLLABORATIVE_ANALYSIS_ACTIONS = actions([
  "Strengthen evidence",
  "Identify risks",
  "Suggest improvement structure",
]);

const IMPROVEMENT_PROPOSAL_ACTIONS = actions([
  "Make proposal more specific",
  "Clarify expected improvement",
  "Add rationale",
]);

const INITIATIVE_REVISION_ACTIONS = actions([
  "Summarize accepted proposals",
  "Draft revision summary",
  "Check unresolved recommendations",
]);

const DECISION_SESSION_ACTIONS = actions([
  "Clarify decision question",
  "Review readiness",
  "Explain decision package",
]);

const DECISION_RESULT_ACTIONS = actions([
  "Explain vote result",
  "Summarize verified/unverified participation",
  "Prepare CAP summary",
]);

const CIVIC_ACTION_PACKAGE_ACTIONS = actions([
  "Explain CAP purpose",
  "Suggest recipient categories",
  "Prepare delivery message draft placeholder",
]);

const CIVIC_DELIVERY_ACTIONS = actions([
  "Explain selected recipients",
  "Check missing recipients",
  "Prepare follow-up plan placeholder",
]);

const OFFICIAL_RESPONSE_ACTIONS = actions([
  "Summarize response placeholder",
  "Identify factual commitments",
  "Prepare accountability event placeholder",
]);

const CIVIC_ACCOUNTABILITY_ACTIONS = actions([
  "Suggest next factual event",
  "Check no-response duration",
  "Prepare public accountability summary placeholder",
]);

const IMPLEMENTATION_COMMITMENT_ACTIONS = actions([
  "Clarify commitment scope",
  "Check expected dates",
  "Prepare tracking readiness placeholder",
]);

const IMPLEMENTATION_TRACKING_ACTIONS = actions([
  "Suggest evidence update structure",
  "Check completion evidence",
  "Prepare impact draft placeholder",
]);

const PUBLIC_IMPACT_ACTIONS = actions([
  "Clarify observed impact",
  "Strengthen evidence summary",
  "Prepare archive lessons placeholder",
]);

const CIVIC_INTEGRATION_ACTIONS = actions([
  "Explain pipeline status",
  "Review related records",
  "Identify next available step",
]);

const CIVIC_COMPATIBILITY_REVIEW_ACTIONS = actions([
  "Review compatibility findings",
  "Clarify referenced principles",
  "Prepare revision notes placeholder",
]);

const PUBLIC_CIVIC_ARCHIVE_ACTIONS = actions([
  "Improve lessons learned",
  "Clarify transferable experience",
  "Prepare archive summary placeholder",
  "Check missing civic knowledge fields",
]);

const DEFAULT_ACTIONS = actions([
  "Explain current section",
  "Review civic pipeline status",
  "Identify next available step",
]);

export function getSuggestedActionsForSection(
  sectionTitle: string,
  initiative: Initiative | null,
): WorkspaceSuggestedAction[] {
  if (sectionTitle === "Manage Initiative") {
    if (initiative?.lifecyclePhase === "draft") {
      return INITIATIVE_DRAFT_ACTIONS;
    }

    return MANAGE_PUBLISHED_ACTIONS;
  }

  switch (sectionTitle) {
    case "Overview":
    case "Lifecycle Timeline":
    case "My Initiatives":
      return OVERVIEW_ACTIONS;
    case "Collaborative Analysis":
      return COLLABORATIVE_ANALYSIS_ACTIONS;
    case "Improvement Proposal Decisions":
      return IMPROVEMENT_PROPOSAL_ACTIONS;
    case "Initiative Revision":
      return INITIATIVE_REVISION_ACTIONS;
    case "Decision Session":
      return DECISION_SESSION_ACTIONS;
    case "Decision Result":
      return DECISION_RESULT_ACTIONS;
    case "Civic Delivery":
      return CIVIC_DELIVERY_ACTIONS;
    case "Official Responses":
      return OFFICIAL_RESPONSE_ACTIONS;
    case "Civic Accountability":
      return CIVIC_ACCOUNTABILITY_ACTIONS;
    case "Implementation Commitment":
      return IMPLEMENTATION_COMMITMENT_ACTIONS;
    case "Implementation Tracking":
      return IMPLEMENTATION_TRACKING_ACTIONS;
    case "Public Impact":
      return PUBLIC_IMPACT_ACTIONS;
    case "Public Civic Archive":
      return PUBLIC_CIVIC_ARCHIVE_ACTIONS;
    case "Civic Integration":
      return CIVIC_INTEGRATION_ACTIONS;
    case "Civic Compatibility Review":
      return CIVIC_COMPATIBILITY_REVIEW_ACTIONS;
    default:
      return DEFAULT_ACTIONS;
  }
}

export function getSectionContextLabel(
  sectionTitle: string,
  initiative: Initiative | null,
): string {
  if (sectionTitle === "Manage Initiative" && initiative?.lifecyclePhase === "draft") {
    return "Initiative Draft";
  }

  if (sectionTitle === "Decision Result") {
    return "Collective Decision / Civic Action Package";
  }

  if (sectionTitle === "Official Responses") {
    return "Official Response";
  }

  if (sectionTitle === "Civic Integration") {
    return "Civic Integration Layer";
  }

  return sectionTitle;
}

/** Exported for verification — section-specific action labels must differ. */
export const SECTION_ACTION_SAMPLES = {
  draft: INITIATIVE_DRAFT_ACTIONS,
  analysis: COLLABORATIVE_ANALYSIS_ACTIONS,
  cap: CIVIC_ACTION_PACKAGE_ACTIONS,
  delivery: CIVIC_DELIVERY_ACTIONS,
  accountability: CIVIC_ACCOUNTABILITY_ACTIONS,
  archive: PUBLIC_CIVIC_ARCHIVE_ACTIONS,
} as const;
