import type { Initiative, WorkspaceAssistantCapability } from "@hu/types";

import type { WorkspaceSuggestedAction } from "./types";

function actions(
  items: Array<{ label: string; capability: WorkspaceAssistantCapability }>,
): WorkspaceSuggestedAction[] {
  return items.map((item, index) => ({
    id: `${item.capability}-${index}`,
    label: item.label,
    capability: item.capability,
  }));
}

const INITIATIVE_DRAFT_ACTIONS = actions([
  { label: "Improve title", capability: "improve_title" },
  { label: "Clarify summary", capability: "clarify_summary" },
  { label: "Check missing fields", capability: "check_missing_fields" },
  { label: "Run Civic Compatibility Review", capability: "explain_compatibility_review" },
]);

const MANAGE_PUBLISHED_ACTIONS = actions([
  { label: "Review initiative summary", capability: "explain_current_section" },
  { label: "Check lifecycle readiness", capability: "identify_next_step" },
  { label: "Identify next civic stage", capability: "identify_next_step" },
]);

const OVERVIEW_ACTIONS = actions([
  { label: "Summarize initiative status", capability: "explain_current_section" },
  { label: "Explain lifecycle phase", capability: "explain_current_section" },
  { label: "Identify next civic stage", capability: "identify_next_step" },
]);

const COLLABORATIVE_ANALYSIS_ACTIONS = actions([
  { label: "Strengthen evidence", capability: "strengthen_evidence" },
  { label: "Identify risks", capability: "identify_risks" },
  { label: "Suggest improvement structure", capability: "structure_analysis" },
]);

const IMPROVEMENT_PROPOSAL_ACTIONS = actions([
  { label: "Make proposal more specific", capability: "structure_proposal" },
  { label: "Clarify expected improvement", capability: "structure_proposal" },
  { label: "Add rationale", capability: "structure_proposal" },
]);

const INITIATIVE_REVISION_ACTIONS = actions([
  { label: "Summarize accepted proposals", capability: "draft_revision_summary" },
  { label: "Draft revision summary", capability: "draft_revision_summary" },
  { label: "Check unresolved recommendations", capability: "draft_revision_summary" },
]);

const DECISION_SESSION_ACTIONS = actions([
  { label: "Clarify decision question", capability: "explain_decision_session" },
  { label: "Review readiness", capability: "explain_decision_session" },
  { label: "Explain decision package", capability: "explain_decision_session" },
]);

const DECISION_RESULT_ACTIONS = actions([
  { label: "Explain vote result", capability: "explain_decision_result" },
  {
    label: "Summarize verified/unverified participation",
    capability: "explain_decision_result",
  },
  { label: "Prepare CAP summary", capability: "prepare_cap_summary" },
]);

const CIVIC_ACTION_PACKAGE_ACTIONS = actions([
  { label: "Explain CAP purpose", capability: "prepare_cap_summary" },
  { label: "Suggest recipient categories", capability: "suggest_recipient_categories" },
  { label: "Prepare delivery message draft placeholder", capability: "prepare_delivery_message" },
]);

const CIVIC_DELIVERY_ACTIONS = actions([
  { label: "Explain selected recipients", capability: "suggest_recipient_categories" },
  { label: "Check missing recipients", capability: "suggest_recipient_categories" },
  { label: "Prepare follow-up plan placeholder", capability: "prepare_delivery_message" },
]);

const OFFICIAL_RESPONSE_ACTIONS = actions([
  { label: "Summarize response placeholder", capability: "summarize_official_response" },
  { label: "Identify factual commitments", capability: "summarize_official_response" },
  { label: "Prepare accountability event placeholder", capability: "prepare_accountability_event" },
]);

const CIVIC_ACCOUNTABILITY_ACTIONS = actions([
  { label: "Suggest next factual event", capability: "prepare_accountability_event" },
  { label: "Check no-response duration", capability: "prepare_accountability_event" },
  {
    label: "Prepare public accountability summary placeholder",
    capability: "prepare_accountability_event",
  },
]);

const IMPLEMENTATION_COMMITMENT_ACTIONS = actions([
  { label: "Clarify commitment scope", capability: "structure_implementation_update" },
  { label: "Check expected dates", capability: "structure_implementation_update" },
  {
    label: "Prepare tracking readiness placeholder",
    capability: "structure_implementation_update",
  },
]);

const IMPLEMENTATION_TRACKING_ACTIONS = actions([
  { label: "Suggest evidence update structure", capability: "structure_implementation_update" },
  { label: "Check completion evidence", capability: "structure_implementation_update" },
  { label: "Prepare impact draft placeholder", capability: "clarify_public_impact" },
]);

const PUBLIC_IMPACT_ACTIONS = actions([
  { label: "Clarify observed impact", capability: "clarify_public_impact" },
  { label: "Strengthen evidence summary", capability: "clarify_public_impact" },
  { label: "Prepare archive lessons placeholder", capability: "prepare_archive_lessons" },
]);

const CIVIC_INTEGRATION_ACTIONS = actions([
  { label: "Explain pipeline status", capability: "explain_pipeline_status" },
  { label: "Review related records", capability: "review_related_records" },
  { label: "Identify next available step", capability: "identify_next_step" },
]);

const CIVIC_COMPATIBILITY_REVIEW_ACTIONS = actions([
  { label: "Review compatibility findings", capability: "explain_compatibility_review" },
  { label: "Clarify referenced principles", capability: "explain_compatibility_review" },
  { label: "Prepare revision notes placeholder", capability: "explain_compatibility_review" },
]);

const PUBLIC_CIVIC_ARCHIVE_ACTIONS = actions([
  { label: "Improve lessons learned", capability: "prepare_archive_lessons" },
  { label: "Clarify transferable experience", capability: "prepare_archive_lessons" },
  { label: "Prepare archive summary placeholder", capability: "prepare_archive_lessons" },
  { label: "Check missing civic knowledge fields", capability: "prepare_archive_lessons" },
]);

const DEFAULT_ACTIONS = actions([
  { label: "Explain current section", capability: "explain_current_section" },
  { label: "Review civic pipeline status", capability: "explain_pipeline_status" },
  { label: "Identify next available step", capability: "identify_next_step" },
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
